/* 移动壳的会话层：Supabase 认证 + 云端行读写 + 本机缓存。
   这是"外科水管"，可以每端各一份；但什么时候覆盖、什么时候采纳远端、
   首次装载取哪份数据 —— 这些判定全部委托 core/sync.js，不在此处另立口径。 */
import { decideInitialSource, decidePush, decidePull, remoteUpdatedAt, ensureUpdatedAt, buildPushPayload } from "../core/sync.js";
import { authErrorMessage } from "../core/auth.js";

const CACHE_PREFIX = "journalPlanner.v3."; // 与桌面同一前缀：两端共享本机缓存

export function createSession(client, config) {
  let user = null, accessToken = null, dirty = false, pushTimer = null, pullBusy = false;

  function cacheKey() { return CACHE_PREFIX + user.id; }
  function readCache() {
    if (!user) return null;
    try { const raw = localStorage.getItem(cacheKey()); if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.tasks)) return s; } } catch (e) { }
    return null;
  }
  function writeCache(state) { if (user) { try { localStorage.setItem(cacheKey(), JSON.stringify(state)); } catch (e) { } } }

  async function fetchRow() {
    return await client.from("planner_states").select("state").eq("user_id", user.id).maybeSingle();
  }

  /* 推送：先读远端，远端更新则采纳远端而不覆盖 */
  async function push(state) {
    if (!user || !client) return { pushed: false };
    const me = user;
    ensureUpdatedAt(state, Date.now());
    const { data, error } = await fetchRow();
    if (me !== user) return { skipped: true };
    if (decidePush(state, remoteUpdatedAt(data, error)).action === "adopt-remote") {
      return { adopted: data.state };
    }
    const row = buildPushPayload(me.id, state);
    const { error: upError } = await client.from("planner_states").upsert(row, { onConflict: "user_id" });
    if (me !== user) return { skipped: true };
    if (upError) return { error: authErrorMessage(upError) };
    dirty = false;
    return { pushed: true };
  }

  /* 每次本地改动：写缓存 + 500ms 去抖后推送（与桌面同一节奏） */
  function commit(state) {
    state.updatedAt = Date.now();
    dirty = true;
    writeCache(state);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push(state); }, 500);
  }

  /* 拉取：仅当远端严格更新才落地；guards 由壳给出（弹窗开着/正在编辑时不打断） */
  async function pull(state, guards) {
    if (!user || !client || pullBusy || dirty) return {};
    if (guards && guards()) return {};
    pullBusy = true;
    const me = user;
    try {
      const { data, error } = await fetchRow();
      if (error || me !== user || !data || !data.state) return {};
      return decidePull(state, +(data.state.updatedAt || 0)) ? { adopted: data.state } : {};
    } finally { pullBusy = false; }
  }

  /* 会话激活：云端行优先于本机缓存；云端没这一行才把本机（或空白）迁上去 */
  async function activate(u) {
    user = u;
    const { data: sess } = await client.auth.getSession();
    accessToken = sess && sess.session && sess.session.access_token || null;
    const { data, error } = await fetchRow();
    if (error) return { error: authErrorMessage(error) };
    const src = decideInitialSource(data && data.state, readCache());
    dirty = !src.fromCloud;
    return { state: src.state, needPush: dirty };
  }

  /* 卸载兜底：常规 fetch 会被浏览器取消，keepalive 能保证最后一次送达 */
  function flush(state) {
    if (!dirty || !user || !config || !accessToken) return;
    clearTimeout(pushTimer);
    ensureUpdatedAt(state, Date.now());
    try {
      fetch(config.url + "/rest/v1/planner_states?on_conflict=user_id", {
        method: "POST",
        headers: { apikey: config.anonKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return:minimal" },
        body: JSON.stringify([buildPushPayload(user.id, state)]),
        keepalive: true,
      });
      dirty = false;
    } catch (e) { }
  }

  /* 回调直接落回移动页本身，而不是靠桌面的分流 shim 再转发一次：
     少一跳就少一类丢参数的问题（邮箱链接与 OAuth 的授权码都在 query string 里）。 */
  const selfUrl = location.origin + location.pathname;
  const auth = {
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => client.auth.signUp({ email, password }),
    otp: (email) => client.auth.signInWithOtp({ email, options: { emailRedirectTo: selfUrl } }),
    oauth: (provider) => client.auth.signInWithOAuth({ provider, options: { redirectTo: selfUrl } }),
    signOut: () => client.auth.signOut(),
    onChange: cb => client.auth.onAuthStateChange((_e, s) => cb(s)),
  };

  return {
    get user() { return user; },
    get dirty() { return dirty; },
    auth, activate, commit, push, pull, flush, readCache, writeCache,
    clearDirty() { dirty = false; },
  };
}
