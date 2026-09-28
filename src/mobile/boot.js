/* 移动壳入口：建 Supabase 客户端 → 恢复会话 → 装载状态（规则同 core/sync）→ 挂壳。
   无会话时渲染登录页；OAuth 回跳后由 onAuthStateChange 接住。 */
import { createClient } from "@supabase/supabase-js";
import { createSession } from "./session.js";
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
    const client = createClient(url, anonKey);
    const session = createSession(client, { url, anonKey });
    let app = null;

    async function enter(user) {
      const r = await session.activate(user);
      if (r.error) { renderLogin(root, session, { message: r.error }); return; }
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

    client.auth.onAuthStateChange((_e, s) => {
      if (s && s.user) enter(s.user);
      else if (!s) { app = null; renderLogin(root, session); }
    });

    const { data } = await client.auth.getSession();
    if (data && data.session && data.session.user) enter(data.session.user);
    else renderLogin(root, session);
  } catch (e) { fatal(e.message); }
}
