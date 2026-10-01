/* 移动壳登录页的免登录探针脚本：用一份桩会话驱动 renderLogin 的真实监听器链路
   （连错计数、60 秒冷却、引导面板、发重置邮件、设置新密码），不出网、不碰真实账号。
   与 _desktop_boot.js / _mobile_frame.html 同一性质：验证工具，不是产品代码。
   写成外链模块而不是内联 <script>：内联那份在 vite dev 下走 html-proxy，
   放进 iframe（_mobile_login_frame.html 量 390px 几何用的就是 iframe）会 500。 */
import { renderLogin } from "/src/mobile/login.js";

const root = document.getElementById("mRoot");
const user = { id: "u1", email: "probe@example.com" };
let wanted = "fail"; // 密码登录默认必回 invalid_credentials；__probe.setSignIn("ok") 后回成功
let tries = 0;

const session = {
  user,
  auth: {
    signIn: async () => {
      tries++;
      return wanted === "fail"
        ? { data: null, error: { code: "invalid_credentials", message: "Invalid login credentials" } }
        : { data: { session: { user }, user }, error: null };
    },
    signUp: async () => ({ data: { session: { user }, user }, error: null }),
    otp: async () => ({ data: { user: true }, error: null }),
    resetEmail: async () => ({ data: {}, error: null }),
    updatePassword: async () => ({ data: { user }, error: null }),
    oauth: async () => ({ data: { url: "http://probe.invalid" }, error: null }),
    signOut: async () => ({ error: null }),
  },
};

/* 重画一次就等于"收到一个新事件"：recovery 分支由 boot.js 带 opts.recovery 触发，
   探针里直接照那份参数复现，不必真去点邮件链接。 */
function draw(opts) { renderLogin(root, session, opts); }
draw();

async function autoFail(times) {
  const q = s => root.querySelector(s);
  const set = (s, v) => { const el = q(s); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  set("#e", "probe@example.com"); set("#p", "wrongpass1");
  for (let i = 0; i < (times || 5); i++) {
    q("#f").requestSubmit();
    await new Promise(r => setTimeout(r, 60));
  }
}
const q = new URLSearchParams(location.search);
if (q.get("auto") === "fail5") autoFail(5);

window.__probe = {
  get tries() { return tries; },
  setSignIn(v) { wanted = v; },
  recovery() {
    draw({
      recovery: true,
      onRecovered: async () => { root.innerHTML = '<p class="m-msg">探针：新密码已保存，进主界面</p>'; },
    });
  },
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf("planner.authFail.") === 0) out.push(k + "=" + localStorage.getItem(k));
    }
    return out;
  },
  /* 几何读数：登录页在 390px 视口下会不会横向溢出、面板按钮够不够 44px 触控高度。
     内置浏览器没有可见 surface（顶层 innerWidth 恒为 0），只能靠 iframe 自己的视口量。 */
  geom() {
    const w = s => { const e = root.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
    const h = s => { const e = root.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
    const de = document.documentElement;
    return {
      vw: innerWidth, overflowX: de.scrollWidth - de.clientWidth,
      login: w(".m-login"), go: w("#go"), alt: w("#altRow"), toLink: w("#toLink"),
      fb: w("#fb"), fbReset: w("#fbReset"), fbLink: w("#fbLink"), hint: w("#fb .hint"),
      goH: h("#go"), fbResetH: h("#fbReset"), fbLinkH: h("#fbLink"),
      panelHidden: root.querySelector("#fb").hidden,
      goDisabled: root.querySelector("#go").disabled,
    };
  },
};
