/* 移动壳的应用框架：路由、底部 tab、渲染循环、动作面板。
   视图模块只拿到一个 app 对象（state / commit / navigate / sheet），不认识会话细节。 */
import { state, setState } from "../core/schema.js";
import { setPinyinImpl } from "../core/filters.js";
import { pinyin } from "pinyin-pro";
import { TODAY_TABS } from "./tabs.js";
import { isWide, onWideChange } from "./layout.js";
import { openTaskEditor, openGoalEditor, duplicateIntoEditor, removeTaskWithUndo, removeGoalWithUndo } from "./editor.js";
import { openTaskActions, openGoalActions } from "./actions.js";
import { openFilterSheet, clearFilters } from "./filters.js";
import { renderToday, isBulkMode, exitBulk } from "./views/today.js";
import { renderGoals, forgetGoal as forgetOpenGoal } from "./views/goals.js";
import { renderBoard } from "./views/board.js";
import { renderMe } from "./views/me.js";

setPinyinImpl(pinyin); // 与桌面同一实现；小程序阶段可注入别的或不注入（首字母降级）

const VIEWS = { today: renderToday, goals: renderGoals, board: renderBoard, me: renderMe };

export function createApp(mount, session, initial) {
  setState(initial || { tasks: [], goals: { weekly: [], monthly: [], yearly: [], reviews: [] } });

  /* 平板（≥700px）走两栏：左列列表、右列详情/编辑器，不再叠底部面板。
     所有面板都经 app.sheet() 出来，所以只在出口处分一次流——视图模块不需要认识"宽屏"这件事，
     编辑器/目标面板/筛选面板因此一次性获得两栏形态。core 仍不碰 matchMedia（判据在 layout.js）。
     右栏空着时的提示由 CSS 的 .m-detail:empty::before 出，不由 JS 填——
     隐藏页/部分内核里 MQ change 与 resize 事件不派发，把版式挂在事件上就会出现"CSS 两栏、JS 以为窄屏"。 */
  const pane = () => mount.querySelector(".m-detail");

  function closeDetail() { app._detail = false; app._openedWide = null; app.selKey = ""; pane().innerHTML = ""; }

  /* 收口当前开着的面板：窄屏是贴底面板，宽屏是右栏。切 tab 与跨断点都要走这里，
     否则贴底面板会带着过期表单留在 .show 状态里（跨断点实测踩过）。 */
  function closePanel() {
    if (app._sheetClose) { const c = app._sheetClose; app._sheetClose = null; c(); }
    app._detail = false; app.selKey = ""; app._openedWide = null;
    pane().innerHTML = "";
  }

  const app = {
    /* 必须用 getter：core 的 setState 会重新赋值导出绑定，快照会让 reload/采纳远端之后的
       所有写操作落到那份孤儿对象上（视图改 st.selDate、壳持久化 state，两边不是同一个对象）。 */
    get state() { return state; },
    get user() { return session.user; },
    selKey: "",        // 右栏当前编辑的是哪一条（视图态，不进 state、不持久化）
    _detail: false,    // 右栏开着表单：拉它做推迟云端拉取的判据，也让 render 不去动这一栏
    _sheetClose: null, // 窄屏贴底面板的收口函数
    _openedWide: null, // 面板开出时处在宽屏还是窄屏，跨断点要收口
    _tab: "",
    route: () => (location.hash.replace(/^#\//, "") || "today").split("?")[0],
    navigate(tab) { if (app.route() !== tab) location.hash = "#/" + tab; },
    /* 写操作后统一走这里：core mutations 已改过 state，壳只负责持久化 + 重绘 */
    commit() { session.commit(state); app.render(); },
    reload(next) { setState(next); app.render(); }, // 会话重新激活时换一份状态，不重建壳
    openTask(key) { return openTaskEditor(app, key); },
    copyTask(t) { return duplicateIntoEditor(app, t); },
    openFilters() { return openFilterSheet(app); },
    clearFilters() { return clearFilters(app); },
    /* 显式操作面板替代桌面拖拽：排序/改档/取消关联都在这里 */
    openTaskActions(key) { return openTaskActions(app, key); },
    openGoalActions(gid) { return openGoalActions(app, gid); },
    openGoal(gid) { return openGoalEditor(app, gid); },
    newGoal(level) { return openGoalEditor(app, null, level); },
    deleteTask(id) { return removeTaskWithUndo(app, id); },
    deleteGoal(id) { return removeGoalWithUndo(app, id); },
    forgetGoal(id) { return forgetOpenGoal(id); },
    toast(msg, undo) {
      const bar = mount.querySelector(".m-toast");
      bar.textContent = msg;
      bar.classList.add("show");
      bar.onclick = e => { e.stopPropagation(); if (undo) { undo(); } hide(); };
      clearTimeout(app._toastT);
      app._toastT = setTimeout(hide, 6000);
      function hide() { clearTimeout(app._toastT); bar.classList.remove("show"); bar.onclick = null; }
    },
    sheet(title, html, bind) {
      if (isWide()) {
        pane().innerHTML = `<div class="m-detailCard"><h3>${title}</h3>${html}</div>`;
        app._detail = true;
        app._openedWide = true;                               // 开栏时处在哪个形态，跨断点就要收口
        const card = pane().querySelector(".m-detailCard");
        const close = () => closeDetail();
        card.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
        if (bind) bind(card, close);
        return close;
      }
      const mask = mount.querySelector(".m-sheet-mask"), box = mount.querySelector(".m-sheet");
      box.innerHTML = `<div class="grab"></div><h3>${title}</h3>${html}`;
      mask.classList.add("show"); box.classList.add("show");
      const close = () => { mask.classList.remove("show"); box.classList.remove("show"); app._sheetClose = null; app._openedWide = null; };
      app._sheetClose = close; app._openedWide = false;
      mask.onclick = close;
      box.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
      if (bind) bind(box, close);
      return close;
    },
    render() {
      const tab = app.route();
      if (tab !== "today") exitBulk(); // 批量态是"今日这一屏"的选择模式，切走即退出（与桌面切视图一致）
      if (tab !== app._tab) closePanel(); // 面板只属于当前这一屏，切 tab 收起（与批量态同一口径）
      else if (app._openedWide !== null && app._openedWide !== isWide()) closePanel(); // 断点变了就先收口（事件万一没送到，这里兜住）
      app._tab = tab;
      const body = mount.querySelector(".m-body");
      document.body.className = "m theme-" + (state.theme || "e");
      (VIEWS[tab] || renderToday)(body, app);
      mount.querySelector("#mAdd").style.display = isBulkMode() ? "none" : ""; // 批量态只留底栏一个主操作区
      mount.querySelectorAll(".m-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    },
  };

  mount.innerHTML = `
    <header class="m-head">
      <div><h1 id="mTitle">今日</h1><div class="sub" id="mSub"></div></div>
      <div class="right"><button class="m-nav" id="mTheme" title="切换主题">◐</button></div>
    </header>
    <main class="m-cols">
      <div class="m-body"></div>
      <aside class="m-detail" aria-label="详情与编辑"></aside>
    </main>
    <button class="m-fab" id="mAdd" aria-label="新增任务">+</button>
    <nav class="m-tabs">${TODAY_TABS.map(t => `<button data-tab="${t.key}">${t.icon}<span>${t.label}</span></button>`).join("")}</nav>
    <div class="m-sheet-mask"></div>
    <div class="m-sheet" role="dialog" aria-modal="true"></div>
    <div class="m-toast" role="status"></div>`;

  mount.querySelectorAll(".m-tabs button").forEach(b => b.addEventListener("click", () => app.navigate(b.dataset.tab)));
  mount.querySelector("#mAdd").addEventListener("click", () => app.openTask(null));
  mount.querySelector("#mTheme").addEventListener("click", () => {
    state.theme = state.theme === "e" ? "i" : "e";
    app.commit();
  });
  window.addEventListener("hashchange", () => app.render());
  window.addEventListener("beforeunload", () => session.flush(state));
  onWideChange(() => { closePanel(); app.render(); }); // 跨断点：贴底面板/右栏都收口，窄屏那套与宽屏那套不混用
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && app._detail) closeDetail();      // 键盘用户在这一栏有退路（窄屏是点遮罩）
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) return;
    const r = await session.pull(state, () => !!mount.querySelector(".m-sheet.show") || app._detail || isBulkMode()); // 面板开着或正在多选都不打断
    if (r.adopted) { setState(r.adopted); app.render(); } // 切回前台先跟一次云端，避免两台设备各写各的
  });
  return app;
}
