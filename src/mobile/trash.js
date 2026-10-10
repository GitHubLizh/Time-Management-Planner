/* 回收站的移动入口：卡片挂在"我的"页，删掉的任务在这里挑一条恢复。
   写操作全走 core/mutations 的 restoreTask / purgeTrashEntry / emptyTrash，与桌面同一条规则；
   反馈走 app.toast 的 6 秒撤销，与删任务/删复盘同一套浮条口径。
   showAll 是纯显示态，留在模块里而不是 state：进 state 就等于每点一次折叠往云端推一整包。 */
import { trashList, trashExcerpt, trashPolicyText } from "../core/selectors.js";
import { restoreTask, purgeTrashEntry, emptyTrash } from "../core/mutations.js";
import { stampText } from "../core/dates.js";

const LIMIT = 5; // 一屏先露 5 条，与看板列内折叠同一节奏
let showAll = false;

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

export function trashCardHTML(app) {
  const list = trashList(app.state.trash);
  const shown = showAll ? list : list.slice(0, LIMIT);
  return `<div class="m-card"><h2>回收站<span class="count">${list.length} 条</span></h2>
    ${shown.map(e => {
      const x = trashExcerpt(e);
      const meta = [x.type, x.status, x.isCourse ? "课程" : "", x.isRecur ? `循环${x.occCount ? " · " + x.occCount + " 次打卡" : ""}` : "", "删除于 " + stampText(x.deletedAt)]
        .filter(Boolean).join(" · ");
      return `<div class="m-row" data-tid="${esc(x.tid)}" style="min-height:auto">
        <div style="flex:1;min-width:0"><div class="title">${esc(x.title)}</div><div class="meta">${esc(meta)}</div></div>
        <button class="m-btn ghost" data-tact="restore" style="width:auto;flex:0 0 auto;padding:0 14px;min-height:44px;font-size:.8rem">恢复</button>
        <button class="m-nav" data-tact="purge" aria-label="彻底删除 ${esc(x.title)}" style="font-size:1rem">×</button>
      </div>`;
    }).join("") || `<div class="m-empty">回收站是空的。删掉的任务会先进这里，随时可以挑一条恢复。</div>`}
    ${list.length > LIMIT ? `<button class="m-fold" data-tfold="1" aria-expanded="${showAll ? "true" : "false"}">${showAll ? "收起" : `展开其余 ${list.length - LIMIT} 条`}</button>` : ""}
    ${list.length ? `<button class="m-btn ghost" data-tempty="1" style="height:44px;margin-top:10px">清空回收站（${list.length} 条）</button>` : ""}
    <div class="m-note">${esc(trashPolicyText())}</div>
  </div>`;
}

export function bindTrash(body, app) {
  body.querySelectorAll("[data-tact]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); // 平板两栏下 .m-row 整行是可点的，行内按钮不该顺带把行点开
    const row = b.closest("[data-tid]"); if (!row) return;
    const r = b.dataset.tact === "restore" ? restoreTask(row.dataset.tid) : purgeTrashEntry(row.dataset.tid);
    if (!r) { app.render(); return; } // 条目已经不在了（另一台设备刚处理过）：重绘即可
    app.commit();
    app.toast(
      b.dataset.tact === "restore"
        ? (r.conflict ? `任务「${r.title}」本就还在列表里，多余的回收站条目已清除` : `已恢复任务「${r.title}」`)
        : `已彻底删除「${r.title}」`,
      () => { r.undo(); app.commit(); });
  }));
  const fold = body.querySelector("[data-tfold]");
  if (fold) fold.addEventListener("click", () => { showAll = !showAll; app.render(); });
  const empty = body.querySelector("[data-tempty]");
  if (empty) empty.addEventListener("click", () => {
    const r = emptyTrash(); if (!r) return;
    showAll = false;
    app.commit();
    app.toast(`已清空回收站（${r.count} 条）`, () => { r.undo(); app.commit(); });
  });
}
