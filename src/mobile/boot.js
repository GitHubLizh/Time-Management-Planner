/* 移动壳入口：建 Supabase 客户端 → 恢复会话 → 装载状态（规则同 core/sync）→ 挂壳。
   无会话时渲染登录页；OAuth 回跳后由 onAuthStateChange 接住。 */
import { createClient } from "@supabase/supabase-js";
import { createSession } from "./session.js";
import { renderLogin } from "./login.js";
import { createApp } from "./shell.js";

const root = document.getElementById("mRoot");
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  root.innerHTML = '<div class="m-login"><p class="m-msg">请在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。</p></div>';
} else {
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
}
