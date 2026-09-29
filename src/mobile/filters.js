/* 移动端的筛选：入口在"我的"，生效提示是今日/看板顶部的一条胶囊。
   口径全部来自 core：可筛字段见 state.filters（core/schema.js 的 defaultState），
   摘要文案走 core/filters.filterSummary（与桌面 banner 同一份），计数用 overdueList/lateList。
   逾期与迟完互斥、开启即跳看板 —— 这两条也是桌面的原行为（桌面点芯片会切到 kanban）。 */
import { defaultState } from "../core/schema.js";
import { filterSummary, SLOT_NAMES } from "../core/filters.js";
import { PRIO_NAMES, STATUS_NAMES, TYPES } from "../core/constants.js";
import { hasActiveFilter, overdueList, lateList } from "../core/selectors.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const OPTS = (cur, rows) => rows.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");

function field(id, label, cur, rows) {
  return `<div class="m-field"><label for="${id}">${esc(label)}</label><select id="${id}">${OPTS(cur, rows)}</select></div>`;
}

export function openFilterSheet(app) {
  const st = app.state, f = st.filters;
  const years = [...new Set(st.tasks.map(t => (t.start || "").slice(0, 4)))].sort();
  const od = overdueList(st.tasks).length, lt = lateList(st.tasks).length;
  const flag = (key, label, on, hint) => `<button class="m-act ${on ? "on" : ""}" data-flag="${key}">
      <span>${esc(label)}</span><small>${esc(hint)}</small></button>`;

  app.sheet("筛选", `
    ${field("qYear", "年份", f.year, [["", "全部年份"]].concat(years.map(y => [y, y + " 年"])))}
    ${field("qMonth", "月份", f.month, [["", "全部月份"]].concat(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, "0"), (i + 1) + " 月"])))}
    ${field("qPrio", "优先级", f.prio, [["", "全部优先级"]].concat([1, 2, 3, 4].map(p => [String(p), PRIO_NAMES[p]])))}
    ${field("qStatus", "状态", f.status, [["", "全部状态"]].concat(Object.entries(STATUS_NAMES)))}
    ${field("qType", "分类", f.type, [["", "全部类型"]].concat(TYPES.map(t => [t, t])))}
    ${field("qSlot", "时间段", f.slot, [["", "全部时间段"]].concat(Object.entries(SLOT_NAMES).map(([k, l]) => [k, l + " " + { morning: "6-12", afternoon: "12-18", evening: "18-24" }[k]])))}
    <div class="m-acts">
      ${flag("onlyOverdue", "仅逾期未完成", st.onlyOverdue, od ? `全库 ${od} 项，不受其他筛选影响` : "全库没有逾期")}
      ${flag("onlyLate", "仅迟完", st.onlyLate, lt ? `全库 ${lt} 项（完成日晚于截止日）` : "全库没有迟完记录")}
    </div>
    <div class="m-sheetActs">
      <button class="m-btn ghost" data-freset type="button">清除全部</button>
      <button class="m-btn" data-close type="button">完成</button>
    </div>`,
    (box, close) => {
      const set = (key, val) => { st.filters[key] = val; app.commit(); };
      const bind = (id, key) => box.querySelector("#" + id).addEventListener("change", e => set(key, e.target.value));
      bind("qYear", "year"); bind("qMonth", "month"); bind("qPrio", "prio");
      bind("qStatus", "status"); bind("qType", "type"); bind("qSlot", "slot");
      box.querySelectorAll("[data-flag]").forEach(b => b.addEventListener("click", () => {
        const key = b.dataset.flag, on = !st[key];
        st[key] = on;
        if (on) st[key === "onlyOverdue" ? "onlyLate" : "onlyOverdue"] = false; // 互斥：与桌面同一口径
        app.commit();
        if (on) { close(); app.navigate("board"); } // 逾期/迟完项不在"今天"，去看板看（桌面点芯片也是切看板）
      }));
      box.querySelector("[data-freset]").addEventListener("click", () => {
        clearFilters(app);
        close();
      });
    });
}

/* 清除全部：三处入口（我的卡片的"清除筛选"、胶囊上的"清除"、面板里的"清除全部"）走同一个函数，
   免得出现"清了下拉但逾期还开着"这种半套。 */
export function clearFilters(app) {
  const st = app.state;
  st.filters = defaultState().filters;
  st.onlyOverdue = false; st.onlyLate = false;
  app.commit();
}

/* 今日 / 看板顶部的生效提示：摘要 + 一键清除 */
export function filterChipHTML(app) {
  const st = app.state;
  if (!hasActiveFilter()) return "";
  const parts = filterSummary(st.filters, st);
  return `<div class="m-fchip"><span class="t">筛选中 · ${esc(parts.join(" · "))}</span>
    <button data-fclear="1">清除</button></div>`;
}

export function bindFilterChip(scope, app) {
  const b = scope.querySelector("[data-fclear]");
  if (b) b.addEventListener("click", () => clearFilters(app));
}
