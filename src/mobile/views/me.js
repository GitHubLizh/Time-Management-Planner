/* 我的 tab：进度概览、筛选、主题、账号。详细浏览（课表/周/月/年矩阵）仍在桌面完成。 */
import { statsOf, overdueList, filteredTasks, hasActiveFilter } from "../../core/selectors.js";
import { filterSummary } from "../../core/filters.js";
import { statsPool } from "../../core/recur.js";
import { goalProgress } from "../../core/goals.js";
import { goalsOf } from "../../core/goals.js";
import { fmt, parseD } from "../../core/dates.js";
import { bindDesktopLink } from "../ui-pref.js";
import { today as TODAY } from "../../core/clock.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function renderMe(body, app) {
  const st = app.state;
  document.getElementById("mTitle").textContent = "我的";
  document.getElementById("mSub").textContent = (app.user && app.user.email) || "";
  const stat = statsOf(statsPool(filteredTasks()));
  const od = overdueList().length;
  const parts = filterSummary(st.filters, st);
  const monthStr = fmt(TODAY).slice(0, 7);
  const monthTasks = statsPool(st.tasks).filter(t => t.start <= monthStr + "-31" && t.end >= monthStr + "-01");
  const ms = statsOf(monthTasks);

  body.innerHTML = `
    <div class="m-card"><h2>概览</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
        <div><div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stat.rate}%</div><div style="font-size:.72rem;color:var(--muted)">筛选内完成率</div></div>
        <div><div style="font-size:1.5rem;font-weight:800">${stat.done}/${stat.total}</div><div style="font-size:.72rem;color:var(--muted)">已完成 / 总数</div></div>
        <div><div style="font-size:1.5rem;font-weight:800;color:${od ? "var(--overdue)" : "var(--ink)"}">${od}</div><div style="font-size:.72rem;color:var(--muted)">逾期未完成</div></div>
      </div>
      <div style="font-size:.78rem;color:var(--muted);margin-top:10px">本月（${monthStr}）单次任务 ${ms.total} 条，完成 ${ms.done} 条 · ${ms.rate}%</div>
    </div>
    <div class="m-card"><h2>目标进度</h2>
      ${["weekly", "monthly", "yearly"].map(k => {
        const gs = goalsOf(k); if (!gs.length) return "";
        const p = gs.reduce((a, g) => { const x = goalProgress(g.id); return { total: a.total + x.total, pct: a.pct + x.pct }; }, { total: 0, pct: 0 });
        return `<div style="display:flex;gap:10px;align-items:center;padding:6px 0">
          <span style="width:4em;font-size:.82rem;color:var(--muted)">${{ weekly: "周", monthly: "月", yearly: "年" }[k]}目标</span>
          <div class="bar" style="flex:1;margin:0"><i style="width:${gs.length ? Math.round(p.pct / gs.length) : 0}%"></i></div>
          <span style="font-size:.78rem">${gs.length} 个</span></div>`;
      }).join("")}
    </div>
    <div class="m-card"><h2>筛选<span class="count">${parts.length ? parts.length + " 项生效" : "未启用"}</span></h2>
      <div class="m-field"><label for="kw">搜索任务标题（支持拼音首字母）</label><input id="kw" type="search" value="${esc(st.filters.keyword)}" placeholder="例如 xzb 搜到「写周报」"></div>
      <button class="m-btn ghost" id="openFilter" style="height:48px;margin-bottom:10px">筛选条件${parts.length ? " · " + esc(parts.join(" · ")) : ""}</button>
      ${hasActiveFilter() ? '<button class="m-btn ghost" id="resetFilter" style="height:44px">清除筛选</button>' : '<div style="font-size:.78rem;color:var(--muted)">当前显示全部任务</div>'}
    </div>
    <div class="m-card"><h2>外观与账号</h2>
      <button class="m-btn ghost" id="theme" style="height:48px;margin-bottom:10px">${st.theme === "e" ? "切成 I 人 · 安静" : "切成 E 人 · 明快"}</button>
      <div style="font-size:.74rem;color:var(--muted);margin-bottom:10px">完整视图（课表 / 周 / 月历 / 年 / 甘特）在桌面版：<a href="/index.html" class="to-desktop">打开桌面版</a></div>
      <button class="m-btn ghost" id="out" style="height:48px;color:var(--overdue);border-color:var(--overdue)">退出登录</button>
    </div>`;

  const kw = body.querySelector("#kw");
  let timer = null;
  const apply = () => { st.filters.keyword = kw.value.trim(); app.commit(); };
  kw.addEventListener("compositionend", apply);
  kw.addEventListener("input", () => { if (!kw.isComposing) { clearTimeout(timer); timer = setTimeout(apply, 300); } });
  const rf = body.querySelector("#resetFilter"); if (rf) rf.addEventListener("click", () => app.clearFilters());
  body.querySelector("#openFilter").addEventListener("click", () => app.openFilters());
  body.querySelector("#theme").addEventListener("click", () => { st.theme = st.theme === "e" ? "i" : "e"; app.commit(); });
  bindDesktopLink(body);
  body.querySelector("#out").addEventListener("click", async () => { app.session.flush(st); await app.session.auth.signOut(); location.reload(); });
}
