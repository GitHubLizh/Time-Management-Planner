/* 桌面版的免登录探针入口：用一份假 Supabase client 把 planner.js 起来，
   只为在浏览器里驱动真实的弹窗/渲染链路，不读也不写任何真实数据。
   配套页是仓库根的 _desktop_frame.html（index.html 去掉分流 shim、把入口换成这一份）。
   与 _mobile_frame.html 同一性质：验证工具，不是产品代码。

   ?probe=login 时切到"登录链路"那一套：getSession 先回空（于是停在登录页），
   signInWithPassword 默认必回 invalid_credentials，resetPasswordForEmail/updateUser 回成功，
   并把 onAuthStateChange 的回调留在 window.__probeAuth 上 —— 连错计数、冷却放开、
   PASSWORD_RECOVERY 进"设置新密码"都靠它手工触发。仍然不出网、不落真实存储。 */
import "/src/planner.js";

const user = { id: "probe", email: "probe@example.com" };
const fakeSession = { user, access_token: "probe-token" };
const loginProbe = new URLSearchParams(location.search).get("probe") === "login";

let authCb = null;
let signInWanted = "fail"; // 探针里密码登录默认必错；置 "ok" 后下一次回成功
let signInTries = 0;

/* 事件只在 login 探针下派发：默认那份渲染探针的行为要跟改动前保持一致 */
function fire(event, session) {
  if (loginProbe && authCb) authCb(event, session);
}

/* 链式查询一律回空行：decideInitialSource 于是落到"本机缓存或空白"，
   upsert/insert 收下来当成功，saveRemote 走完整时序但不出网。 */
function fakeTable() {
  const t = {
    select() { return t; },
    eq() { return t; },
    order() { return t; },
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async () => ({ error: null }),
    insert: async () => ({ error: null }),
    update: () => t,
    delete: () => t,
    then: (res) => res({ data: [], error: null }), // 被 await 时回空数组
  };
  return t;
}

const client = {
  from: () => fakeTable(),
  auth: {
    getSession: async () => ({
      data: { session: loginProbe && signInTries === 0 ? null : fakeSession },
      error: null,
    }),
    onAuthStateChange: cb => { authCb = cb; return { data: { subscription: { unsubscribe() { } } } }; },
    signOut: async () => { fire("SIGNED_OUT", null); return { error: null }; },
    signInWithPassword: async () => {
      signInTries++;
      if (signInWanted === "fail") {
        return { data: null, error: { code: "invalid_credentials", message: "Invalid login credentials" } };
      }
      fire("SIGNED_IN", fakeSession);
      return { data: { session: fakeSession, user }, error: null };
    },
    signUp: async () => ({ data: { user, session: fakeSession }, error: null }),
    signInWithOtp: async () => ({ data: { user: true }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => { fire("USER_UPDATED", fakeSession); return { data: { user }, error: null }; },
    signInWithOAuth: async () => ({ data: { url: "http://probe.invalid/oauth" }, error: null }),
  },
};

window.bootstrapPlanner(client, { url: "http://probe.invalid", anonKey: "probe" });

window.__probeAuth = {
  get tries() { return signInTries; },
  setSignIn(v) { signInWanted = v; },
  recovery() { fire("PASSWORD_RECOVERY", fakeSession); },
  storageKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf("planner.authFail.") === 0) out.push(k + "=" + localStorage.getItem(k));
    }
    return out;
  },
};
