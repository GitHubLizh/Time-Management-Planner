/* 看板 tab：桌面靠拖拽跨列改状态，手机上改成卡片里的三态分段控件。
   done 与 progress 的联动仍走 core/mutations.applyKanbanDrop，与桌面同一条规则。
   列内超过 5 条折叠，点开才展开 —— 折叠态按分列模式各存一份，只活在内存里（不进 state，
   免得每点一次展开就往云端整包推一次），与桌面壳同一口径。 */
import { kanbanSplit, foldKanbanCols, kanbanFoldReveal, doneAtText } from "../../core/selectors.js";
import { filteredTasks } from "../../core/selectors.js";
import { applyKanbanDrop } from "../../core/mutations.js";
import { taskById } from "../../core/schema.js";
import { filterChipHTML, bindFilterChip } from "../filters.js";

const STATUSES = [["todo", "未开始"], ["doing", "进行中"], ["done", "已完成"]];
const expanded = { status: new Set(), type: new Set() };
function toggleFold(mode, key) {
  const s = expanded[mode];
  if (s.has(key)) s.delete(key); else s.add(key);
}
function reveal(mode, taskId) {
  const k = kanbanFoldReveal(kanbanSplit(filteredTasks(), mode).cols, taskId);
  if (k) expanded[mode].add(k);
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function renderBoard(body, app) {
  const st = app.state;
  document.getElementById("mTitle").textContent = "看板";
  document.getElementById("mSub").textContent = st.kanbanMode === "type" ? "按类型分列" : "按状态分列";
  const all = filteredTasks();
  const { cols, recurCount } = kanbanSplit(all, st.kanbanMode);
  const folded = foldKanbanCols(cols, expanded[st.kanbanMode]);

  body.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="m-btn ghost" data-km="status" style="height:44px;${st.kanbanMode === "status" ? "border-color:var(--accent);color:var(--accent)" : ""}">按状态</button>
      <button class="m-btn ghost" data-km="type" style="height:44px;${st.kanbanMode === "type" ? "border-color:var(--accent);color:var(--accent)" : ""}">按类型</button>
    </div>
    ${filterChipHTML(app)}
    ${recurCount ? `<div style="font-size:.76rem;color:var(--muted);margin-bottom:10px">另有 ${recurCount} 条循环任务按天打卡，不归列 —— 在"今日"里打卡</div>` : ""}
    ${folded.map(c => `<div class="m-card"><h2>${esc(c.label)}<span class="count">${c.tasks.length}</span></h2>
      ${c.shown.map(t => `<div style="border-bottom:1px dashed var(--line);padding:10px 0">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="prio p${t.priority}" style="margin-top:0"></span>
          <div class="title" style="flex:1;min-width:0">${esc(t.title)}</div></div>
        ${doneAtText(t) ? `<div style="font-size:.74rem;color:var(--muted);margin-top:4px">${esc(doneAtText(t))}</div>` : ""}
        <div style="display:flex;gap:6px;margin-top:8px">
          ${STATUSES.map(([k, n]) => `<button data-st="${k}" data-id="${t.id}"
            style="flex:1;min-height:44px;border:1.5px solid ${t.status === k ? "var(--accent)" : "var(--line)"};border-radius:8px;
            background:${t.status === k ? "var(--accent-soft)" : "transparent"};font-size:.78rem;
            ${st.kanbanMode === "type" ? "display:none" : ""}">${n}</button>`).join("")}
          <button data-open="${t.id}" style="min-height:44px;padding:0 16px;border:1.5px solid var(--line);border-radius:8px;font-size:.78rem">编辑</button>
        </div></div>`).join("") || '<div class="m-empty">空</div>'}${c.foldable ? `
      <button class="m-fold" data-kfold="${esc(c.key)}" aria-expanded="${c.collapsed ? "false" : "true"}">${c.collapsed ? `展开其余 ${c.hiddenCnt} 条` : "收起"}</button>` : ""}
    </div>`).join("")}`;

  bindFilterChip(body, app);
  body.querySelectorAll("[data-km]").forEach(b => b.addEventListener("click", () => { st.kanbanMode = b.dataset.km; app.commit(); }));
  body.querySelectorAll("[data-kfold]").forEach(b => b.addEventListener("click", () => {
    toggleFold(st.kanbanMode, b.dataset.kfold);
    app.render(); // 折叠是纯显示，不该为此推一次云端
  }));
  body.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => {
    const t = taskById(b.dataset.id); if (!t) return;
    const moved = b.dataset.st !== t.status;
    const r = applyKanbanDrop(t, b.dataset.st, "status", b.dataset.st !== t.status);
    if (r.hintSeen) st.kanbanDragHintSeen = true;
    if (moved) reveal(st.kanbanMode, t.id); // 改完状态那条若被折叠挡住，当场展开目标列
    app.commit();
  }));
  body.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => app.openTask && app.openTask(b.dataset.open)));
}
