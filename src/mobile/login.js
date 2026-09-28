/* 移动壳登录页。桌面登录页是居中的手帐卡片，手机上那套装饰（胶带、双层虚线框、
   圆章）只会把表单挤出首屏，所以这里用贴边的单列表单，邮箱密码在最前。 */
import { authErrorMessage } from "../core/auth.js";
import { bindDesktopLink } from "./ui-pref.js";

const I = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 14l2.5 2.5L16 12"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.86c2.26-2.08 3.6-5.15 3.6-8.66z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.92-2.91l-3.86-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.24v3.11C3.2 21.3 7.26 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.28A7.19 7.19 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.24A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.24 5.39l4.03-3.11z"/><path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.26 0 3.2 2.7 1.24 6.61l4.03 3.11C6.22 6.88 8.87 4.77 12 4.77z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
};

export function renderLogin(root, session, opts) {
  let mode = "login"; // login | signup | link
  root.innerHTML = `<div class="m-login">
    <div class="brand">${I.logo}<div><h1>手帐风 · 日程</h1><div class="sub" style="font-size:.66rem;color:var(--muted);letter-spacing:.2em">JOURNAL PLANNER</div></div></div>
    <p class="lead">登录后日程与目标在多设备间同步。</p>
    <form id="f">
      <div class="m-field"><label for="e">邮箱</label><input id="e" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="m-field" id="pwRow"><label for="p">密码</label><input id="p" type="password" autocomplete="current-password" minlength="6" required></div>
      <button class="m-btn" id="go" type="submit">登录</button>
    </form>
    <div class="m-alt">
      <button id="toSignup" type="button">注册新账号</button>
      <button id="toLink" type="button">邮箱链接登录</button>
    </div>
    <div class="m-split">或用第三方账号</div>
    <div class="m-oauth">
      <button id="oauthGoogle" type="button">${I.google} Google</button>
      <button id="oauthGithub" type="button">${I.github} GitHub</button>
    </div>
    <p class="m-msg" id="msg" aria-live="polite"></p>
    <div style="margin-top:18px;text-align:center"><a href="/index.html" class="to-desktop" style="font-size:.76rem">改用桌面版</a></div>
  </div>`;

  const $ = s => root.querySelector(s);
  const say = t => { $("#msg").textContent = t || ""; };

  function setMode(m) {
    mode = m;
    const isLink = m === "link";
    $("#pwRow").hidden = isLink;
    $("#go").textContent = m === "signup" ? "注册" : isLink ? "发送登录链接" : "登录";
    $("#p").autocomplete = m === "signup" ? "new-password" : "current-password";
    say("");
  }
  $("#toSignup").addEventListener("click", () => setMode("signup"));
  $("#toLink").addEventListener("click", () => setMode("link"));
  root.querySelectorAll(".m-alt button").forEach(b => b.addEventListener("click", () => {
    root.querySelectorAll(".m-alt button").forEach(x => x.style.borderColor = "");
    if (b !== $("#go")) b.style.borderColor = "var(--accent)";
  }));

  $("#f").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#e").value.trim(), pw = $("#p").value;
    const btn = $("#go"); btn.disabled = true; say("");
    try {
      if (mode === "link") {
        const { error } = await session.auth.otp(email);
        say(error ? authErrorMessage(error) : "登录链接已发送，请查收邮箱。");
      } else {
        const r = mode === "signup" ? await session.auth.signUp(email, pw) : await session.auth.signIn(email, pw);
        if (r.error) say(authErrorMessage(r.error));
        else if (mode === "signup" && !r.data.session) say("注册成功，请查收确认邮件后再登录。");
      }
    } catch (err) { say(authErrorMessage(err) || "登录失败，请稍后重试。"); }
    finally { btn.disabled = false; }
  });
  $("#oauthGoogle").addEventListener("click", () => session.auth.oauth("google").then(({ error }) => { if (error) say(authErrorMessage(error)); }));
  $("#oauthGithub").addEventListener("click", () => session.auth.oauth("github").then(({ error }) => { if (error) say(authErrorMessage(error)); }));
  bindDesktopLink(root);
  if (opts && opts.message) say(opts.message);
  setMode("login");
}
