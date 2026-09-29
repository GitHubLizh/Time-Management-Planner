/* 今日 tab：手机上最高频的一屏——看今天要做什么、打卡、看进度。
   顶部 日/周 分段控件切换两种看法（todayMode 与桌面的 kanbanMode 同类，是持久化的视图偏好）：
     日 = 只列这一天的事（任务 / 每日习惯 / 课程三张卡）
     周 = 七天分组单列，一眼看整周并顺手打卡，不做桌面那种七列并排
   条目右侧的 ⋯ 打开显式操作面板（编辑 / 复制 / 上下移 / 取消关联 / 删除），替代桌面的拖拽。
   "选择"进入批量模式（与桌面同一口径：只作用于当天三张列表里看得见的条目），
   bulkMode/bulkSel 是临时视图态，不进 state、不持久化。 */
import { fmt, parseD, addDays, monthRange } from "../../core/dates.js";
import { today as TODAY } from "../../core/clock.js";
import { dayGroups, filteredTasks, tasksOn, statsOf, isOverdue, overdueDays, weekDaysOf } from "../../core/selectors.js";
import { occDone, recurText, recurDoneIn, toggleOcc, statsPool } from "../../core/recur.js";
import { toggleTaskDone, bulkToggleDone, bulkDelete } from "../../core/mutations.js";
import { taskById } from "../../core/schema.js";
import { filterChipHTML, bindFilterChip } from "../filters.js";

const WD = ["日", "一", "二", "三", "四", "五", "六"];
const CHK = "<svg viewBox='0 0 24 24'><path d='M4 12l5 5L20 6'/></svg>";
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let bulkMode = false;
const bulkSel = new Set();
export function isBulkMode() { return bulkMode; }
export function exitBulk() { bulkMode = false; bulkSel.clear(); }
const keyOf = (t, ds) => (t.recur ? t.id + "@" + ds : t.id);
const metaOf = (t, inst) => inst ? recurText(t) : t.course ? `${t.timeSlot} · ${t.room}` : `${t.type} · ${t.progress}%`;

function row(t, ds, opts) {
  opts = opts || {};
  const inst = !!t.recur;
  const key = keyOf(t, ds);
  if (opts.bulk) { // 整行即选中热区：批量态下不给打卡按钮和 ⋯，避免"想选中却改了数据"
    return `<div class="m-row pick ${bulkSel.has(key) ? "on" : ""}" data-id="${key}">
      <span class="m-chk">${CHK}</span>
      <span class="prio p${t.priority}"></span>
      <div style="flex:1;min-width:0">
        <div class="title">${esc(t.title)}</div>
        <div class="meta">${esc(metaOf(t, inst))}</div>
      </div>
    </div>`;
  }
  const done = inst ? occDone(t, ds) : t.status === "done";
  const late = !opts.compact && !inst && isOverdue(t) ? ` <span style="color:var(--overdue)">逾期${overdueDays(t)}天</span>` : "";
  if (opts.compact) { // 周视图只看"哪天有什么"，meta 行（分类·进度）在这里是噪音，去掉后整周矮三成
    return `<div class="m-row wk ${done ? "done" : ""}" data-id="${key}">
      <button class="m-chk" data-act="toggle" aria-label="${done ? "取消完成" : "完成"}">${CHK}</button>
      <span class="prio p${t.priority}"></span>
      <div class="title">${esc(t.title)}</div>
    </div>`;
  }
  return `<div class="m-row ${done ? "done" : ""}" data-id="${key}">
    <button class="m-chk" data-act="toggle" aria-label="${done ? "取消完成" : "完成"}">${CHK}</button>
    <span class="prio p${t.priority}"></span>
    <div style="flex:1;min-width:0">
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${esc(metaOf(t, inst))}${late}</div>
    </div>
    ${opts.compact ? "" : `<button class="m-nav" data-act="more" aria-label="更多操作" style="font-size:.9rem">⋯</button>`}
  </div>`;
}

function segHTML(mode) {
  return `<div class="m-seg">${[["day", "日"], ["week", "周"]].map(([k, l]) =>
    `<button data-mode="${k}" class="${mode === k ? "on" : ""}" aria-pressed="${mode === k}">${l}视图</button>`).join("")}</div>`;
}

/* 周视图：七天各一段，段头给"完成数/单次总数"（循环项没有单一进度，只计项数） */
function weekHTML(ds, pool) {
  return weekDaysOf(ds).map(d => {
    const list = tasksOn(d, pool);
    const s = statsOf(statsPool(list));
    const cnt = !list.length ? "空" : s.total ? s.done + "/" + s.total : list.length + " 项";
    return `<div class="m-day${d === fmt(TODAY) ? " today" : ""}">
      <div class="hd"><b>${d.slice(8)}</b><span>周${WD[parseD(d).getDay()]}</span><span class="cnt">${cnt}</span></div>
      ${list.map(t => row(t, d, { compact: true })).join("")}
    </div>`;
  }).join("");
}

export function renderToday(body, app) {
  const st = app.state;
  const ds = st.selDate || fmt(TODAY);
  const mode = st.todayMode === "week" ? "week" : "day";
  if (mode === "week") exitBulk(); // 批量选择只属于"日"这一屏（桌面同样只在日视图给）
  const pool = filteredTasks();
  const g = dayGroups(ds, pool);
  const all = dayGroups(ds, tasksOn(ds));           // 分母不受筛选影响，与桌面同一口径
  const s = statsOf(statsPool(all.list));
  const d = parseD(ds), [ms, me] = monthRange(ds);
  const week = weekDaysOf(ds);

  if (mode === "week") {
    // 口径写死在单位上：一条任务跨本周 3 天就是 3 项次，避免"7/22"被读成 7 条完成 / 22 条任务
    const ws = statsOf(statsPool(week.reduce((a, x) => a.concat(tasksOn(x)), [])));
    document.getElementById("mTitle").textContent = `${week[0].slice(5)} ~ ${week[6].slice(5)}`;
    document.getElementById("mSub").textContent = `本周 ${ws.total} 项次 · 完成 ${ws.done}${ws.rate !== null ? " · " + ws.rate + "%" : ""}`;
  } else {
    document.getElementById("mTitle").textContent = `${ds.slice(5)} 周${WD[parseD(ds).getDay()]}`;
    document.getElementById("mSub").textContent = `已完成 ${s.done}/${s.total}${s.rate !== null ? " · " + s.rate + "%" : ""}`;
  }

  const keys = g.list.map(t => keyOf(t, ds));       // 可批量集 = 当天三张列表里看得见的条目
  if (bulkMode) [...bulkSel].forEach(k => { if (!keys.includes(k)) bulkSel.delete(k); }); // 被筛选隐藏/已删的选中项失效
  const recurDone = g.recurring.map(t => `${t.title} ${recurDoneIn(t, ms, me).done}/${recurDoneIn(t, ms, me).total}`).join("　");

  const step = mode === "week" ? 7 : 1;
  const bar = `
    <div class="m-datebar">
      <button class="m-nav" data-d="${-step}" aria-label="${mode === "week" ? "上一周" : "前一天"}">‹</button>
      ${mode === "week"
        ? `<div class="day">${week[0].slice(5)} ~ ${week[6].slice(5)}<span class="wd">${week[0].slice(0, 4)} 年 ${parseD(week[0]).getMonth() + 1} 月${week[0].slice(0, 7) !== week[6].slice(0, 7) ? " 跨月" : ""}</span></div>`
        : `<div class="day">${ds.slice(8)}<span class="wd">${ds.slice(0, 7)} · 周${WD[d.getDay()]}</span></div>`}
      <button class="m-nav" data-d="${step}" aria-label="${mode === "week" ? "下一周" : "后一天"}">›</button>
      ${ds !== fmt(TODAY) ? `<button class="m-today" data-d="today">${mode === "week" ? "本周" : "今天"}</button>` : ""}
    </div>`;

  body.innerHTML = segHTML(mode) + bar + filterChipHTML(app) + (mode === "week"
    ? `<div class="m-card">${weekHTML(ds, pool)}</div>`
    : `<div class="m-card">
      <h2>任务<span class="count">${g.normal.length ? g.normal.filter(t => t.status === "done").length + "/" + g.normal.length : ""}</span>
        ${g.list.length ? `<button class="m-pick" data-bulk="1">${bulkMode ? "退出选择" : "选择"}</button>` : ""}</h2>
      ${g.normal.map(t => row(t, ds, { bulk: bulkMode })).join("") || '<div class="m-empty">今天没有单次任务</div>'}
    </div>
    ${g.recurring.length ? `<div class="m-card"><h2>每日习惯<span class="count">${g.recurring.length} 项</span></h2>
      ${g.recurring.map(t => row(t, ds, { bulk: bulkMode })).join("")}
      ${bulkMode ? "" : `<div style="font-size:.74rem;color:var(--muted);margin-top:8px">${esc(recurDone)}</div>`}</div>` : ""}
    ${g.courses.length ? `<div class="m-card"><h2>今天的课<span class="count">${g.courses.length} 节</span></h2>
      ${g.courses.map(t => row(t, ds, { bulk: bulkMode })).join("")}</div>` : ""}
    ${bulkMode ? `<div class="m-bulkspacer"></div><div class="m-bulkbar">
      <div class="top">
        <label class="all"><input type="checkbox" id="mBulkAll"${keys.length && bulkSel.size >= keys.length ? " checked" : ""}>全选</label>
        <span class="n">已选 ${bulkSel.size} 条</span>
        <button class="m-btn ghost" data-bulk-act="exit">退出</button>
      </div>
      <div class="row">
        <button class="m-btn ghost" data-bulk-act="done"${bulkSel.size ? "" : " disabled"}>切换完成</button>
        <button class="m-btn danger" data-bulk-act="del"${bulkSel.size ? "" : " disabled"}>删除</button>
      </div>
    </div>` : ""}`);

  bindFilterChip(body, app);
  body.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.mode === mode) return;
    st.todayMode = b.dataset.mode;
    app.commit();
  }));
  body.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.d;
    st.selDate = v === "today" ? fmt(TODAY) : fmt(addDays(parseD(ds), +v));
    app.commit();
  }));
  const bulkBtn = body.querySelector("[data-bulk]");
  if (bulkBtn) bulkBtn.addEventListener("click", () => { bulkMode = !bulkMode; bulkSel.clear(); app.render(); });

  if (bulkMode) {
    body.querySelectorAll(".m-row").forEach(el => el.addEventListener("click", () => {
      const k = el.dataset.id;
      bulkSel.has(k) ? bulkSel.delete(k) : bulkSel.add(k);
      app.render(); // 只重绘，不 commit：选中态不进 state
    }));
    const all2 = body.querySelector("#mBulkAll");
    all2.addEventListener("change", () => { bulkSel.clear(); if (all2.checked) keys.forEach(k => bulkSel.add(k)); app.render(); });
    body.querySelectorAll("[data-bulk-act]").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.bulkAct;
      if (act === "exit") { exitBulk(); app.render(); return; }
      if (!bulkSel.size) return;
      const r = act === "done" ? bulkToggleDone([...bulkSel]) : bulkDelete([...bulkSel]);
      exitBulk();
      app.commit();
      app.toast(act === "done" ? `已切换 ${r.count} 条任务的完成状态` : `已删除 ${r.count} 条任务`, () => { r.undo(); app.commit(); });
    }));
    return;
  }

  body.querySelectorAll(".m-row").forEach(el => {
    const [id, date] = el.dataset.id.split("@");
    el.querySelector('[data-act="toggle"]').addEventListener("click", () => {
      const t = taskById(id); if (!t) return;
      if (t.recur) toggleOcc(t, date || ds); else toggleTaskDone(t);
      app.commit();
    });
    const more = el.querySelector('[data-act="more"]');
    if (more) more.addEventListener("click", () => app.openTaskActions(el.dataset.id)); // 周视图的条目不给 ⋯
  });
}
