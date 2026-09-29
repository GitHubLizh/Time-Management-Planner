/* 目标 tab：三档目标与其关联任务的进度。展开/收起是视图态，留在壳里，不进 core。
   条目右侧 ⋯ 打开操作面板（编辑 / 上下移 / 删除），替代桌面的跨卡拖拽；
   卡片底部一个"新增"按钮，档位由所在卡片决定。 */
import { goalsOf, goalTasks, goalProgress } from "../../core/goals.js";
import { GOAL_LEVELS, STATUS_NAMES } from "../../core/constants.js";

const open = new Set();
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* 目标被删除后清掉它的展开态，否则集合里会留下悬空 id */
export function forgetGoal(id) { open.delete(id); }

export function renderGoals(body, app) {
  document.getElementById("mTitle").textContent = "目标";
  document.getElementById("mSub").textContent = "周 / 月 / 年三档";
  body.innerHTML = GOAL_LEVELS.map(([level, label]) => {
    const list = goalsOf(level);
    return `<div class="m-card"><h2>${label}目标<span class="count">${list.length} 个</span></h2>
      ${list.map(g => {
        const p = goalProgress(g.id), tasks = goalTasks(g.id), isOpen = open.has(g.id);
        return `<div style="border-bottom:1px dashed var(--line);padding:10px 0">
          <div class="m-row" style="min-height:auto;border:none;padding:0" data-gid="${g.id}">
            <div style="flex:1;min-width:0"><div class="title">${esc(g.title)}</div>
              <div class="meta">${p.total ? `关联 ${p.total} 条 · 完成 ${p.done} · ${p.pct}%` : "还没有关联任务"}</div>
              ${p.plain ? `<div class="bar"><i style="width:${p.pct}%"></i></div>` : ""}</div>
            ${tasks.length ? `<button class="m-nav" data-fold="${g.id}" style="font-size:.9rem">${isOpen ? "▾" : "▸"}</button>` : ""}
            <button class="m-nav" data-acts="${g.id}" aria-label="更多操作" style="font-size:.9rem">⋯</button>
          </div>
          ${isOpen ? `<div style="margin-top:6px">${tasks.map(t =>
            `<div style="display:flex;gap:8px;font-size:.82rem;padding:5px 0;color:${t.status === "done" ? "var(--muted)" : "inherit"}">
               <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</span>
               <span>${STATUS_NAMES[t.status] || t.status}</span></div>`).join("")}</div>` : ""}
        </div>`;
      }).join("") || '<div class="m-empty">暂无' + label + '目标</div>'}
      <button class="m-add" data-new="${level}">+ 新增${label}目标</button>
    </div>`;
  }).join("");

  body.querySelectorAll("[data-fold]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.fold;
    open.has(id) ? open.delete(id) : open.add(id);
    app.render();
  }));
  body.querySelectorAll("[data-acts]").forEach(b => b.addEventListener("click", () => app.openGoalActions(b.dataset.acts)));
  body.querySelectorAll("[data-new]").forEach(b => b.addEventListener("click", () => app.newGoal(b.dataset.new)));
}
