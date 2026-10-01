/* 移动壳入口：建 Supabase 客户端 → 恢复会话 → 装载状态（规则同 core/sync）→ 挂壳。
   无会话时渲染登录页；OAuth 回跳后由 onAuthStateChange 接住。 */
import { createClient } from "@supabase/supabase-js";
import { createSession } from "./session.js";
import { resolveSupabaseBase } from "../endpoint.js";
import { renderLogin } from "./login.js";
import { createApp } from "./shell.js";

const root = document.getElementById("mRoot");
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* 桌面的分流 shim 会把手机用户直接带到本页，所以这里不能白屏：
   任何启动期异常都给出可读提示 + 一条明确的退路（写偏好后回桌面，不会被弹回来）。 */
function fatal(reason) {
  try { localStorage.setItem("planner.ui", "desktop"); } catch (e) { }
  root.innerHTML = `<div class="m-login"><h1 style="font-size:1.1rem">手机版加载失败</h1>
    <p class="lead" style="margin:8px 0 16px">${reason || "未知错误"}。你可以先用桌面版，问题修复后再回手机版。</p>
    <a class="m-btn" href="/index.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">打开桌面版</a></div>`;
  if (window.console) console.error("[mobile boot]", reason);
}
window.addEventListener("error", e => fatal(e.message));
window.addEventListener("unhandledrejection", e => fatal((e.reason && e.reason.message) || String(e.reason)));

if (!url || !anonKey) {
  root.innerHTML = '<div class="m-login"><p class="m-msg">请在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</p></div>';
} else {
  try {
    const base = resolveSupabaseBase(url);   // 部署态走同域代理，dev 直连
    const client = createClient(base, anonKey);
    const session = createSession(client, { url: base, anonKey });
    let app = null;
    let recoveryPending = false; // 收到 PASSWORD_RECOVERY：新密码没落定前不挂载主界面
    let pending = null;          // 已完成 activate、还没挂载的那份结果

    async function mount() {
      if (recoveryPending) { showRecovery(); return; } // 事件与 activate 的先后不确定，这里再收一次口
      const r = pending;
      if (!r) return;
      if (!app) {
        app = createApp(root, session, r.state || undefined);
        app.session = session;               // 视图模块经 app 拿会话（退出登录要 flush）
        if (!location.hash) location.hash = "#/today";
        app.render();
      } else if (r.state) {
        app.reload(r.state);
      }
      if (r.needPush) await session.push(app.state); // 云端还没有这一行：把本机缓存或空白迁移上去
    }
    /* 点重置邮件链接回来时 auth-js 发的是 PASSWORD_RECOVERY（不是 SIGNED_IN）：
       会话此刻已有效但旧密码依旧是错的，先停在"设置新密码"，设完再挂载。 */
    function showRecovery() {
      renderLogin(root, session, {
        recovery: true,
        onRecovered: async () => { recoveryPending = false; pending = pending || await session.activate(session.user); await mount(); },
      });
    }

    async function enter(user) {
      const r = await session.activate(user);
      if (r.error) { renderLogin(root, session, { message: r.error }); return; }
      pending = r;
      await mount();
    }

    client.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryPending = true;
        if (pending) showRecovery();
        else if (s && s.user) enter(s.user);
        return;
      }
      if (s && s.user) enter(s.user);
      else if (!s) { app = null; pending = null; recoveryPending = false; renderLogin(root, session); }
    });

    const { data } = await client.auth.getSession();
    if (data && data.session && data.session.user) enter(data.session.user);
    else renderLogin(root, session);
  } catch (e) { fatal(e.message); }
}
