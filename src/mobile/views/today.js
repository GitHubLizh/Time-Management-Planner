/* 今日 tab：手机上最高频的一屏——看今天要做什么、打卡、看进度。
   只列"今天这一天的事"，周/月/年的汇总口径放在"我的"，不做桌面式的多卡同屏。
   条目右侧的 ⋯ 打开显式操作面板（编辑 / 上下移 / 取消关联 / 删除），替代桌面的拖拽。 */
import { fmt, parseD, addDays, monthRange } from "../../core/dates.js";
import { today as TODAY } from "../../core/clock.js";
import { dayGroups, filteredTasks, tasksOn, statsOf, isOverdue, overdueDays } from "../../core/selectors.js";
import { occDone, recurText, recurDoneIn, toggleOcc, statsPool } from "../../core/recur.js";
import { toggleTaskDone } from "../../core/mutations.js";
import { taskById } from "../../core/schema.js";

const WD = ["日", "一", "二", "三", "四", "五", "六"];
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function row(t, ds, app) {
  const inst = !!t.recur;
  const done = inst ? occDone(t, ds) : t.status === "done";
  const meta = inst ? recurText(t) : t.course ? `${t.timeSlot} · ${t.room}` : `${t.type} · ${t.progress}%`;
  const late = !inst && isOverdue(t) ? ` <span style="color:var(--overdue)">逾期${overdueDays(t)}天</span>` : "";
  return `<div class="m-row ${done ? "done" : ""}" data-id="${inst ? t.id + "@" + ds : t.id}">
    <button class="m-chk" data-act="toggle" aria-label="${done ? "取消完成" : "完成"}">${"<svg viewBox='0 0 24 24'><path d='M4 12l5 5L20 6'/></svg>"}</button>
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
      <h2>任务<span class="count">${g.normal.length ? g.normal.filter(t => t.status === "done").length + "/" + g.normal.length : ""}</span></h2>
      ${g.normal.map(t => row(t, ds)).join("") || '<div class="m-empty">今天没有单次任务</div>'}
    </div>
    ${g.recurring.length ? `<div class="m-card"><h2>每日习惯<span class="count">${g.recurring.length} 项</span></h2>
      ${g.recurring.map(t => row(t, ds)).join("")}
      <div style="font-size:.74rem;color:var(--muted);margin-top:8px">${esc(recurDone)}</div></div>` : ""}
    ${g.courses.length ? `<div class="m-card"><h2>今天的课<span class="count">${g.courses.length} 节</span></h2>
      ${g.courses.map(t => row(t, ds)).join("")}</div>` : ""}`;

  body.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.d;
    st.selDate = v === "today" ? fmt(TODAY) : fmt(addDays(parseD(ds), +v));
    app.commit();
  }));
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
