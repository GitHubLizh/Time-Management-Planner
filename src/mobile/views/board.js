/* 看板 tab：桌面靠拖拽跨列改状态，手机上改成卡片里的三态分段控件。
   done 与 progress 的联动仍走 core/mutations.applyKanbanDrop，与桌面同一条规则。 */
import { kanbanSplit } from "../../core/selectors.js";
import { filteredTasks } from "../../core/selectors.js";
import { applyKanbanDrop } from "../../core/mutations.js";
import { taskById } from "../../core/schema.js";

const STATUSES = [["todo", "未开始"], ["doing", "进行中"], ["done", "已完成"]];
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function renderBoard(body, app) {
  const st = app.state;
  document.getElementById("mTitle").textContent = "看板";
  document.getElementById("mSub").textContent = st.kanbanMode === "type" ? "按类型分列" : "按状态分列";
  const all = filteredTasks();
  const { cols, recurCount } = kanbanSplit(all, st.kanbanMode);

  body.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="m-btn ghost" data-km="status" style="height:44px;${st.kanbanMode === "status" ? "border-color:var(--accent);color:var(--accent)" : ""}">按状态</button>
      <button class="m-btn ghost" data-km="type" style="height:44px;${st.kanbanMode === "type" ? "border-color:var(--accent);color:var(--accent)" : ""}">按类型</button>
    </div>
    ${recurCount ? `<div style="font-size:.76rem;color:var(--muted);margin-bottom:10px">另有 ${recurCount} 条循环任务按天打卡，不归列 —— 在"今日"里打卡</div>` : ""}
    ${cols.map(c => `<div class="m-card"><h2>${esc(c.label)}<span class="count">${c.tasks.length}</span></h2>
      ${c.tasks.map(t => `<div style="border-bottom:1px dashed var(--line);padding:10px 0">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="prio p${t.priority}" style="margin-top:0"></span>
          <div class="title" style="flex:1;min-width:0">${esc(t.title)}</div></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          ${STATUSES.map(([k, n]) => `<button data-st="${k}" data-id="${t.id}"
            style="flex:1;min-height:44px;border:1.5px solid ${t.status === k ? "var(--accent)" : "var(--line)"};border-radius:8px;
            background:${t.status === k ? "var(--accent-soft)" : "transparent"};font-size:.78rem;
            ${st.kanbanMode === "type" ? "display:none" : ""}">${n}</button>`).join("")}
          <button data-open="${t.id}" style="min-height:44px;padding:0 16px;border:1.5px solid var(--line);border-radius:8px;font-size:.78rem">编辑</button>
        </div></div>`).join("") || '<div class="m-empty">空</div>'}
    </div>`).join("")}`;

  body.querySelectorAll("[data-km]").forEach(b => b.addEventListener("click", () => { st.kanbanMode = b.dataset.km; app.commit(); }));
  body.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => {
    const t = taskById(b.dataset.id); if (!t) return;
    const r = applyKanbanDrop(t, b.dataset.st, "status", b.dataset.st !== t.status);
    if (r.hintSeen) st.kanbanDragHintSeen = true;
    app.commit();
  }));
  body.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => app.openTask && app.openTask(b.dataset.open)));
}
