/* 移动壳登录页。桌面登录页是居中的手帐卡片，手机上那套装饰（胶带、双层虚线框、
   圆章）只会把表单挤出首屏，所以这里用贴边的单列表单，邮箱密码在最前。
   连错计数的规则在 core/auth（与桌面同一份），这里只管读、写与展示。 */
import { authErrorMessage, createPasswordFailGuard, isPasswordFailure, PASSWORD_FAIL_LIMIT } from "../core/auth.js";
import { bindDesktopLink } from "./ui-pref.js";

const I = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 14l2.5 2.5L16 12"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.86c2.26-2.08 3.6-5.15 3.6-8.66z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.92-2.91l-3.86-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.24v3.11C3.2 21.3 7.26 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.28A7.19 7.19 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.24A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.24 5.39l4.03-3.11z"/><path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.26 0 3.2 2.7 1.24 6.61l4.03 3.11C6.22 6.88 8.87 4.77 12 4.77z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
};

/* 一次 renderLogin 就是一个实例：退出登录、恢复会话都会重画整页 DOM，
   而上一实例留下的计时器回调闭包里还指着旧的 mode/guardEmail，会通过同一个 root
   摸到新 DOM 上（实测：recovery 该收起的引导面板被旧计时器又翻成可见）。
   所以每次渲染换一个 token，回调里发现自己已不是当前实例就立刻停手。 */
let currentInstance = null;

export function renderLogin(root, session, opts) {
  const instance = {};
  currentInstance = instance;
  let mode = "login"; // login | signup | link | reset
  let busy = false;   // 请求在飞，期间 renderGuard 不碰提交按钮的 disabled
  let guardEmail = ""; // 触发引导的邮箱，输入框清空后仍按它判定
  let ticker = null;
  let wasLocked = false;
  let linkTimer = null;     // 邮箱链接的 60 秒重发冷却
  let linkCooling = false;  // 冷却期间按钮归倒计时管，renderGuard 不碰它的 disabled
  let linkCoolBtns = [];
  /* 与桌面同域，所以两端共用这一份计数；无 localStorage 时传 null，守卫按"没锁"降级 */
  const fail = createPasswordFailGuard(typeof localStorage === "undefined" ? null : localStorage);
  const recovered = !!(opts && opts.recovery);
  root.innerHTML = `<div class="m-login">
    <div class="brand">${I.logo}<div><h1>手帐风 · 日程</h1><div class="sub" style="font-size:.66rem;color:var(--muted);letter-spacing:.2em">JOURNAL PLANNER</div></div></div>
    <p class="lead" id="lead">登录后日程与目标在多设备间同步。</p>
    <form id="f">
      <div class="m-field" id="eRow"><label for="e">邮箱</label><input id="e" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="m-field" id="pwRow"><label for="p">密码</label><input id="p" type="password" autocomplete="current-password" minlength="6" required></div>
      <button class="m-btn" id="go" type="submit">登录</button>
    </form>
    <div class="m-alt" id="altRow">
      <button id="toSignup" type="button">注册新账号</button>
      <button id="toLink" type="button">邮箱链接登录</button>
    </div>
    <div class="m-fallback" id="fb" hidden>
      <div class="t" id="fbT"></div>
      <button class="m-btn" id="fbReset" type="button">发送重置密码邮件</button>
      <button class="m-btn ghost" id="fbLink" type="button">发送邮箱登录链接</button>
      <div class="hint">点一下就直接发信，到邮箱里点邮件中的链接即可登录（同一浏览器打开才能完成验证）。也可以直接用下方的 Google / GitHub 登录。</div>
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
  const activeEmail = () => $("#e").value.trim() || guardEmail;
  const fbTitle = st => !st.guide ? "" : "密码已连续输错 " + st.fails + " 次。" + (st.locked
    ? "为保护账号，密码登录暂停 " + Math.ceil(st.retryInMs / 1000) + " 秒。"
    : "换个方式更快：发一封重置密码邮件，或用邮箱链接 / 第三方登录。");

  function renderGuard() {
    if (currentInstance !== instance) { if (ticker) { clearInterval(ticker); ticker = null; } return; } // 已被新一次渲染取代
    const st = fail.state(activeEmail());
    const show = st.guide && mode !== "reset";
    $("#fb").hidden = !show;
    if (show) $("#fbT").textContent = fbTitle(st);
    // 只锁密码这一条路：邮箱链接、重置邮件、第三方此刻必须还能点
    if (!busy && !linkCooling) $("#go").disabled = !!(show && st.locked && mode === "login");
    if (st.locked) { if (!ticker) ticker = setInterval(renderGuard, 1000); } // 每秒重读，到点自动放开
    else {
      if (ticker) { clearInterval(ticker); ticker = null; }
      if (wasLocked && /^密码登录暂停中/.test($("#msg").textContent)) say(""); // 到点了就别把"暂停中"留在屏上
    }
    wasLocked = !!st.locked;
  }

  /* 邮箱链接的重发冷却：Supabase 对同一地址有发信频率限制，连点只会换回一次 rate limit。 */
  function startLinkCooldown(btns) {
    linkCoolBtns = btns.filter(Boolean);
    linkCooling = true;
    let left = 60;
    const paint = () => linkCoolBtns.forEach(b => { b.textContent = `重新发送(${left})`; b.disabled = true; });
    paint();
    linkTimer = setInterval(() => {
      if (currentInstance !== instance) { clearInterval(linkTimer); linkTimer = null; return; } // 页面已被重画
      left--;
      if (left <= 0) { stopLinkCooldown(); return; }
      paint();
    }, 1000);
  }
  function stopLinkCooldown() {
    if (linkTimer) { clearInterval(linkTimer); linkTimer = null; }
    linkCoolBtns.forEach(b => { if (b.dataset.coolLabel) b.textContent = b.dataset.coolLabel; b.disabled = false; });
    linkCoolBtns = [];
    if (!linkCooling) return;
    linkCooling = false;
    renderGuard(); // 密码那边的锁定状态该由守卫重新决定
  }
  async function sendLoginLink(btns) {
    if (linkCooling) return;
    const email = $("#e").value.trim();
    if (!email) { say("请先填写邮箱，再发送登录链接。"); return; }
    const list = (btns || [$("#go")]).filter(Boolean);
    list.forEach(b => { if (!b.dataset.coolLabel) b.dataset.coolLabel = b.textContent; b.disabled = true; });
    busy = true; say("正在发送登录链接…");
    try {
      const { error } = await session.auth.otp(email);
      if (error) { list.forEach(b => { b.disabled = false; }); say(authErrorMessage(error)); return; }
      say("登录链接已发到 " + email + "，请到邮箱点击邮件里的链接完成登录（可能在垃圾邮件里）。");
      startLinkCooldown(list);
    } catch (err) {
      list.forEach(b => { b.disabled = false; });
      say(authErrorMessage(err) || "发送失败，请稍后重试。");
    } finally { busy = false; }
  }

  function setMode(m) {
    stopLinkCooldown(); // 先收掉重发倒计时，否则它会把下面的文案又改回"重新发送(N)"
    mode = m;
    const isLink = m === "link";
    const isReset = m === "reset";
    /* 必填字段被隐藏时浏览器会在 submit 前静默拦住（不报错也不进监听），所以两者一起改 */
    $("#eRow").hidden = isReset;
    $("#e").required = !isReset;
    $("#pwRow").hidden = isLink;
    $("#p").required = !isLink;
    $("#go").textContent = isReset ? "保存新密码" : isLink ? "发送登录链接" : m === "signup" ? "注册" : "登录";
    $("#go").disabled = false;
    $("#altRow").hidden = isReset;
    $("#toLink").hidden = isLink || isReset;
    $("#p").autocomplete = (m === "signup" || isReset) ? "new-password" : "current-password";
    $("#lead").textContent = isReset
      ? ("邮件链接已确认身份" + (session.user && session.user.email ? "，为 " + session.user.email : "") + " 设置新密码，保存后请用它登录。")
      : "登录后日程与目标在多设备间同步。";
    say("");
    busy = false;
    renderGuard();
  }
  $("#toSignup").addEventListener("click", () => setMode("signup"));
  $("#toLink").addEventListener("click", () => setMode("link"));
  /* 面板里这颗一步到位：切到邮箱链接模式并当场发信。原先只切模式，变化全在面板上方，
     面板里一个字没动，用户点了以为"没反应"（2026-10-01 实测反馈）。 */
  $("#fbLink").addEventListener("click", () => { setMode("link"); sendLoginLink([$("#go"), $("#fbLink")]); });
  root.querySelectorAll(".m-alt button").forEach(b => b.addEventListener("click", () => {
    root.querySelectorAll(".m-alt button").forEach(x => x.style.borderColor = "");
    if (b !== $("#go")) b.style.borderColor = "var(--accent)";
  }));

  /* 换邮箱就重新判定：冷却是"这个账号"的，不该牵连另一个账号，也不该被清空输入框绕开 */
  $("#e").addEventListener("input", renderGuard);
  $("#fbReset").addEventListener("click", async () => {
    const email = $("#e").value.trim() || guardEmail;
    if (!email) { say("请先填写邮箱，再发送重置密码邮件。"); return; }
    const btn = $("#fbReset");
    btn.disabled = true;
    say("正在发送重置密码邮件…");
    try {
      const { error } = await session.auth.resetEmail(email);
      if (error) { btn.disabled = false; say(authErrorMessage(error)); return; }
      say("重置密码邮件已发到 " + email + "，请在同一浏览器打开邮件里的链接设置新密码（可能在垃圾邮件里）。");
      // 发信冷却：Supabase 对同一地址有频率限制，连点只会换来一次 rate limit
      let left = 60;
      btn.textContent = `重新发送(${left})`;
      const timer = setInterval(() => {
        if (currentInstance !== instance) { clearInterval(timer); return; } // 页面已被重画，别再改新按钮
        left--;
        if (left <= 0) { clearInterval(timer); btn.textContent = "发送重置密码邮件"; btn.disabled = false; return; }
        btn.textContent = `重新发送(${left})`;
      }, 1000);
    } catch (err) { btn.disabled = false; say(authErrorMessage(err) || "发送失败，请稍后重试。"); }
  });

  $("#f").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#e").value.trim(), pw = $("#p").value;
    const btn = $("#go");
    if (mode === "login") {
      const st0 = fail.state(email);
      if (st0.locked) { // 冷却内不出网：省一次必错的请求，也别去撞 Supabase 自己的频率限制
        // 刻意不写剩余秒数：这行字会一直留在提示位上，而秒数在面板标题里每秒刷新
        say("密码登录暂停中，可发重置密码邮件或发邮箱登录链接。");
        renderGuard();
        return;
      }
    }
    if (mode === "link") { await sendLoginLink([btn]); return; } // 发信与冷却都在 sendLoginLink 里，面板那颗按钮走同一条路
    busy = true; btn.disabled = true; say("");
    try {
      if (mode === "reset") {
        const { error } = await session.auth.updatePassword(pw);
        if (error) { say(authErrorMessage(error)); return; }
        fail.reset(session.user && session.user.email); // 邮件链接已证明邮箱归本人，连错的账到这里清掉
        if (guardEmail) fail.reset(guardEmail);
        guardEmail = "";
        if (opts && opts.onRecovered) await opts.onRecovered(); // 交回 boot：装载状态、进主界面
        return;
      }
      if (mode === "signup" || mode === "login") {
        const r = mode === "signup" ? await session.auth.signUp(email, pw) : await session.auth.signIn(email, pw);
        if (r.error) {
          if (mode === "login" && isPasswordFailure(r.error)) {
            guardEmail = email;
            const st = fail.record(email);
            const left = PASSWORD_FAIL_LIMIT - st.fails;
            say(authErrorMessage(r.error) + (st.guide ? "" : left > 0 ? "（再错 " + left + " 次将暂停密码登录）" : ""));
            renderGuard();
          } else say(authErrorMessage(r.error));
        } else {
          fail.reset(email); guardEmail = ""; renderGuard();
          if (mode === "signup" && !r.data.session) say("注册成功，请查收确认邮件后再登录。");
        }
      }
    } catch (err) { say(authErrorMessage(err) || "登录失败，请稍后重试。"); }
    finally { busy = false; btn.disabled = false; }
  });
  $("#oauthGoogle").addEventListener("click", () => session.auth.oauth("google").then(({ error }) => { if (error) say(authErrorMessage(error)); }));
  $("#oauthGithub").addEventListener("click", () => session.auth.oauth("github").then(({ error }) => { if (error) say(authErrorMessage(error)); }));
  bindDesktopLink(root);
  if (opts && opts.message) say(opts.message);
  setMode(recovered ? "reset" : "login");
  if (recovered) say("邮件链接已验证，请设置新密码。");
}
