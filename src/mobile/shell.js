/* 移动壳的应用框架：路由、底部 tab、渲染循环、动作面板。
   视图模块只拿到一个 app 对象（state / commit / navigate / sheet），不认识会话细节。 */
import { state, setState } from "../core/schema.js";
import { setPinyinImpl } from "../core/filters.js";
import { pinyin } from "pinyin-pro";
import { TODAY_TABS } from "./tabs.js";
import { renderToday } from "./views/today.js";
import { renderGoals } from "./views/goals.js";
import { renderBoard } from "./views/board.js";
import { renderMe } from "./views/me.js";

setPinyinImpl(pinyin); // 与桌面同一实现；小程序阶段可注入别的或不注入（首字母降级）

const VIEWS = { today: renderToday, goals: renderGoals, board: renderBoard, me: renderMe };

export function createApp(mount, session, initial) {
  setState(initial || { tasks: [], goals: { weekly: [], monthly: [], yearly: [], reviews: [] } });

  const app = {
    state,
    get user() { return session.user; },
    route: () => (location.hash.replace(/^#\//, "") || "today").split("?")[0],
    navigate(tab) { if (app.route() !== tab) location.hash = "#/" + tab; },
    /* 写操作后统一走这里：core mutations 已改过 state，壳只负责持久化 + 重绘 */
    commit() { session.commit(state); app.render(); },
    reload(next) { setState(next); app.render(); }, // 会话重新激活时换一份状态，不重建壳
    sheet(title, html, bind) {
      const mask = mount.querySelector(".m-sheet-mask"), box = mount.querySelector(".m-sheet");
      box.innerHTML = `<div class="grab"></div><h3>${title}</h3>${html}`;
      mask.classList.add("show"); box.classList.add("show");
      const close = () => { mask.classList.remove("show"); box.classList.remove("show"); };
      mask.onclick = close;
      box.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
      if (bind) bind(box, close);
      return close;
    },
    render() {
      const tab = app.route();
      const body = mount.querySelector(".m-body");
      document.body.className = "m theme-" + (state.theme || "e");
      (VIEWS[tab] || renderToday)(body, app);
      mount.querySelectorAll(".m-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    },
  };

  mount.innerHTML = `
    <header class="m-head">
      <div><h1 id="mTitle">今日</h1><div class="sub" id="mSub"></div></div>
      <div class="right"><button class="m-nav" id="mTheme" title="切换主题">◐</button></div>
    </header>
    <main class="m-body"></main>
    <button class="m-fab" id="mAdd" hidden aria-label="新增任务">+</button>
    <nav class="m-tabs">${TODAY_TABS.map(t => `<button data-tab="${t.key}">${t.icon}<span>${t.label}</span></button>`).join("")}</nav>
    <div class="m-sheet-mask"></div>
    <div class="m-sheet" role="dialog" aria-modal="true"></div>`;

  mount.querySelectorAll(".m-tabs button").forEach(b => b.addEventListener("click", () => app.navigate(b.dataset.tab)));
  mount.querySelector("#mTheme").addEventListener("click", () => {
    state.theme = state.theme === "e" ? "i" : "e";
    app.commit();
  });
  window.addEventListener("hashchange", () => app.render());
  window.addEventListener("beforeunload", () => session.flush(state));
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) return;
    const r = await session.pull(state, () => !!mount.querySelector(".m-sheet.show"));
    if (r.adopted) { setState(r.adopted); app.render(); } // 切回前台先跟一次云端，避免两台设备各写各的
  });
  return app;
}
