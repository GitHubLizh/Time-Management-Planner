/* 移动端的显式操作面板 —— 取代桌面的拖拽。
   语义与桌面一一对应，且都落到 core/mutations 里的同一个函数，不另立规则：
     上移 / 下移  → moveTask(id, 相邻条, before/after)      （顺序即 state.tasks 数组顺序）
     取消关联     → applyDrop(task, {type:"unlink"})         （桌面拖到"未关联"落点的同一入口）
     目标排序     → moveGoal(id, 相邻目标, level, after)
   可排序范围照抄桌面：只有"今日任务"卡片（dayGroups.normal）参与上下排序，
   循环与课程条目在桌面本来就拖不动（#dayNormal 才是 [data-reorder] 容器）。
   桌面拖拽本来也没有撤销，所以这里同样不提供（保持一致，不做多余能力）。 */
import { state } from "../core/schema.js";
import { dayGroups, filteredTasks } from "../core/selectors.js";
import { goalsOf, goalLevel } from "../core/goals.js";
import { GOAL_LEVELS } from "../core/constants.js";
import { fmt } from "../core/dates.js";
import { today as TODAY } from "../core/clock.js";
import { moveTask, moveGoal, applyDrop } from "../core/mutations.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function row(label, act, opts) {
  opts = opts || {};
  return `<button class="m-act ${opts.danger ? "danger" : ""} ${opts.off ? "off" : ""}" data-act="${act}"${opts.off ? " disabled" : ""}>
    <span>${esc(label)}</span>${opts.hint ? `<small>${esc(opts.hint)}</small>` : ""}</button>`;
}

export function openTaskActions(app, key) {
  const ds = app.state.selDate || fmt(TODAY);
  const groups = dayGroups(ds, filteredTasks());
  const id = (key || "").split("@")[0];
  const t = groups.list.find(x => x.id === id);
  if (!t) return;
  const sortable = !t.recur && !t.course;
  const list = groups.normal;
  const i = list.findIndex(x => x.id === id);
  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const goal = t.goalId ? (state.goals.weekly.concat(state.goals.monthly, state.goals.yearly).find(g => g.id === t.goalId)) : null;

  app.sheet(t.title, `
    <div class="m-acts">
      ${row("编辑内容", "edit", { hint: "字段、时间、重复、关联目标" })}
      ${!t.recur ? row("复制为新任务", "dup", { hint: "内容照抄，状态/进度/实际耗时归零" }) : ""}
      ${sortable ? row("上移", "up", { off: !prev, hint: prev ? "移到「" + prev.title + "」前面" : "已在最前" }) : ""}
      ${sortable ? row("下移", "down", { off: !next, hint: next ? "移到「" + next.title + "」后面" : "已在最后" }) : ""}
      ${t.goalId ? row("取消关联目标", "unlink", { hint: goal ? "当前：" + goal.title : "" }) : ""}
      ${row("删除任务", "del", { danger: true, hint: "删除后 6 秒内可撤销" })}
    </div>
    <p class="m-note">${esc(ds)} · ${sortable ? "上下位置即列表顺序，与桌面拖拽同一套规则" : "循环与课程任务不参与排序（桌面同样不可拖）"}</p>`,
    (box, close) => {
      const go = act => {
        if (act === "edit") { close(); app.openTask(key); return; }
        if (act === "dup") { close(); app.copyTask(t); return; } // 副本直接进编辑面板，原任务不动
        if (act === "del") { close(); app.deleteTask(t.id); return; }
        if (act === "up" && prev) moveTask(t.id, prev.id, false);
        else if (act === "down" && next) moveTask(t.id, next.id, true);
        else if (act === "unlink") applyDrop({ kind: "task", id: t.id }, { type: "unlink" });
        else { close(); return; }
        app.commit();
        close();
      };
      box.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => go(b.dataset.act)));
    });
}

export function openGoalActions(app, gid) {
  const level = goalLevel(gid);
  if (!level) return;
  const list = goalsOf(level);
  const i = list.findIndex(x => x.id === gid);
  if (i < 0) return;
  const g = list[i], prev = i > 0 ? list[i - 1] : null, next = i < list.length - 1 ? list[i + 1] : null;
  const label = (GOAL_LEVELS.find(([k]) => k === level) || [])[1];

  app.sheet(g.title, `
    <div class="m-acts">
      ${row("编辑目标", "edit", { hint: "改名或换档位" })}
      ${row("上移", "up", { off: !prev, hint: prev ? "移到「" + prev.title + "」前面" : "已在最前" })}
      ${row("下移", "down", { off: !next, hint: next ? "移到「" + next.title + "」后面" : "已在最后" })}
      ${row("删除目标", "del", { danger: true, hint: "关联任务会一并解除" })}
    </div>
    <p class="m-note">${label}目标 · 顺序即该档位内的上下位置</p>`,
    (box, close) => {
      box.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
        const act = b.dataset.act;
        if (act === "edit") { close(); app.openGoal(gid); return; }
        if (act === "del") { close(); app.deleteGoal(gid); return; }
        if (act === "up" && prev) moveGoal(gid, prev.id, level, false);
        else if (act === "down" && next) moveGoal(gid, next.id, level, true);
        else { close(); return; }
        app.commit();
        close();
      }));
    });
}
