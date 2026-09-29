/* 今日 tab：手机上最高频的一屏——看今天要做什么、打卡、看进度。
   只列"今天这一天的事"，周/月/年的汇总口径放在"我的"，不做桌面式的多卡同屏。
   条目右侧的 ⋯ 打开显式操作面板（编辑 / 复制 / 上下移 / 取消关联 / 删除），替代桌面的拖拽。
   "选择"进入批量模式（与桌面同一口径：只作用于当天三张列表里看得见的条目），
   bulkMode/bulkSel 是临时视图态，不进 state、不持久化。 */
import { fmt, parseD, addDays, monthRange } from "../../core/dates.js";
import { today as TODAY } from "../../core/clock.js";
import { dayGroups, filteredTasks, tasksOn, statsOf, isOverdue, overdueDays } from "../../core/selectors.js";
import { occDone, recurText, recurDoneIn, toggleOcc, statsPool } from "../../core/recur.js";
import { toggleTaskDone, bulkToggleDone, bulkDelete } from "../../core/mutations.js";
import { taskById } from "../../core/schema.js";

const WD = ["日", "一", "二", "三", "四", "五", "六"];
const CHK = "<svg viewBox='0 0 24 24'><path d='M4 12l5 5L20 6'/></svg>";
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let bulkMode = false;
const bulkSel = new Set();
export function isBulkMode() { return bulkMode; }
export function exitBulk() { bulkMode = false; bulkSel.clear(); }
const keyOf = (t, ds) => (t.recur ? t.id + "@" + ds : t.id);

function row(t, ds, bulk) {
  const inst = !!t.recur;
  const key = keyOf(t, ds);
  const meta = inst ? recurText(t) : t.course ? `${t.timeSlot} · ${t.room}` : `${t.type} · ${t.progress}%`;
  if (bulk) { // 整行即选中热区：批量态下不给打卡按钮和 ⋯，避免"想选中却改了数据"
    return `<div class="m-row pick ${bulkSel.has(key) ? "on" : ""}" data-id="${key}">
      <span class="m-chk">${CHK}</span>
      <span class="prio p${t.priority}"></span>
      <div style="flex:1;min-width:0">
        <div class="title">${esc(t.title)}</div>
        <div class="meta">${esc(meta)}</div>
      </div>
    </div>`;
  }
  const done = inst ? occDone(t, ds) : t.status === "done";
  const late = !inst && isOverdue(t) ? ` <span style="color:var(--overdue)">逾期${overdueDays(t)}天</span>` : "";
  return `<div class="m-row ${done ? "done" : ""}" data-id="${key}">
    <button class="m-chk" data-act="toggle" aria-label="${done ? "取消完成" : "完成"}">${CHK}</button>
    <span class="prio p${t.priority}"></span>
    <div style="flex:1;min-width:0">
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${esc(meta)}${late}</div>
    </div>
    <button class="m-nav" data-act="more" aria-label="更多操作" style="font-size:.9rem">⋯</button>
  </div>`;
}

export function renderToday(body, app) {
  const st = app.state;
  const ds = st.selDate || fmt(TODAY);
  const pool = filteredTasks();
  const g = dayGroups(ds, pool);
  const all = dayGroups(ds, tasksOn(ds));           // 分母不受筛选影响，与桌面同一口径
  const s = statsOf(statsPool(all.list));
  document.getElementById("mTitle").textContent = `${ds.slice(5)} 周${WD[parseD(ds).getDay()]}`;
  document.getElementById("mSub").textContent = `已完成 ${s.done}/${s.total}${s.rate !== null ? " · " + s.rate + "%" : ""}`;

  const keys = g.list.map(t => keyOf(t, ds));       // 可批量集 = 当天三张列表里看得见的条目
  if (bulkMode) [...bulkSel].forEach(k => { if (!keys.includes(k)) bulkSel.delete(k); }); // 被筛选隐藏/已删的选中项失效
  const pick = () => { bulkMode = !bulkMode; bulkSel.clear(); app.render(); };

  const d = parseD(ds), [ms, me] = monthRange(ds);
  const recurDone = g.recurring.map(t => `${t.title} ${recurDoneIn(t, ms, me).done}/${recurDoneIn(t, ms, me).total}`).join("　");

  body.innerHTML = `
    <div class="m-datebar">
      <button class="m-nav" data-d="-1" aria-label="前一天">‹</button>
      <div class="day">${ds.slice(8)}<span class="wd">${ds.slice(0, 7)} · 周${WD[d.getDay()]}</span></div>
      <button class="m-nav" data-d="1" aria-label="后一天">›</button>
      ${ds !== fmt(TODAY) ? '<button class="m-today" data-d="today">今天</button>' : ""}
    </div>
    <div class="m-card">
      <h2>任务<span class="count">${g.normal.length ? g.normal.filter(t => t.status === "done").length + "/" + g.normal.length : ""}</span>
        ${g.list.length ? `<button class="m-pick" data-bulk="1">${bulkMode ? "退出选择" : "选择"}</button>` : ""}</h2>
      ${g.normal.map(t => row(t, ds, bulkMode)).join("") || '<div class="m-empty">今天没有单次任务</div>'}
    </div>
    ${g.recurring.length ? `<div class="m-card"><h2>每日习惯<span class="count">${g.recurring.length} 项</span></h2>
      ${g.recurring.map(t => row(t, ds, bulkMode)).join("")}
      ${bulkMode ? "" : `<div style="font-size:.74rem;color:var(--muted);margin-top:8px">${esc(recurDone)}</div>`}</div>` : ""}
    ${g.courses.length ? `<div class="m-card"><h2>今天的课<span class="count">${g.courses.length} 节</span></h2>
      ${g.courses.map(t => row(t, ds, bulkMode)).join("")}</div>` : ""}
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
    </div>` : ""}`;

  body.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.d;
    st.selDate = v === "today" ? fmt(TODAY) : fmt(addDays(parseD(ds), +v));
    app.commit();
  }));
  const bulkBtn = body.querySelector("[data-bulk]");
  if (bulkBtn) bulkBtn.addEventListener("click", pick);

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
    el.querySelector('[data-act="more"]').addEventListener("click", () => app.openTaskActions(el.dataset.id));
  });
}
