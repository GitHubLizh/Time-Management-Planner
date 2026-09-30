/* 每月复盘的移动入口：一月一篇，业务键就是月份（没有 id）。
   写/改/删全部走 core/mutations 的 saveReview / deleteReview，与桌面同一条规则；
   面板经 app.sheet() 出口，所以在平板上自动落进右栏，手机上仍是贴底面板。 */
import { saveReview, deleteReview } from "../core/mutations.js";
import { fmt } from "../core/dates.js";
import { today as TODAY } from "../core/clock.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function openReviewSheet(app, m) {
  const r = m ? app.state.goals.reviews.find(x => x.m === m) : null;
  app.sheet(m ? "编辑 " + m + " 的复盘" : "写每月复盘", `
    <div class="m-field"><label for="rvMonth">月份（改同一月即覆盖这一篇）</label>
      <input id="rvMonth" type="month" value="${esc(m || fmt(TODAY).slice(0, 7))}"></div>
    <div class="m-field"><label for="rvText">这个月做得怎样、下月怎么调</label>
      <textarea id="rvText" rows="5" placeholder="例：交付比计划晚 4 天，卡在评审排期。下月把评审提前到周三。">${esc(r ? r.text : "")}</textarea></div>
    <div class="m-sheetActs">
      ${m ? '<button class="m-btn danger" data-act="del" type="button">删除</button>' : ""}
      <button class="m-btn ghost" data-close type="button">取消</button>
      <button class="m-btn" data-act="save" type="button">保存</button>
    </div>
    <p class="m-msg" id="rvErr" aria-live="polite"></p>`,
    (box, close) => {
      const $ = s => box.querySelector(s);
      $('[data-act="save"]').addEventListener("click", () => {
        const mm = $("#rvMonth").value.slice(0, 7), text = $("#rvText").value.trim();
        if (!mm) { $("#rvErr").textContent = "请选择月份"; return; }
        if (!text) { $("#rvErr").textContent = "请填写复盘内容"; return; }
        saveReview(mm, text); // 同月覆盖 / 新月份插入与排序都在 core 里
        app.commit();
        close();
      });
      const del = box.querySelector('[data-act="del"]');
      if (del) del.addEventListener("click", () => { close(); removeReviewWithUndo(app, m); });
    });
}

/* 删除带 6 秒撤销，与删任务/删目标同一套浮条口径 */
export function removeReviewWithUndo(app, m) {
  const r = deleteReview(m);
  if (!r) return;
  app.commit();
  app.toast(`已删除 ${r.m} 的复盘`, () => { r.undo(); app.commit(); });
}
