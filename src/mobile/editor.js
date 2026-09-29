/* 任务编辑器：全屏动作面板（不是桌面的居中弹窗——手机上要贴拇指、要能躲开软键盘）。
   字段口径对齐 core/schema.js 的 mk()；校验留在这里（文案属 UI），
   而"循环↔完成状态↔progress"的联动调 core/mutations.applyTaskDraftRules，与桌面同一条。
   字段 id 一律用 f 前缀：壳的标题栏占了 #mTitle、副标题占 #mSub，
   同名会让 getElementById 取到标题栏而非输入框（曾因此"新增"永远提交空标题）。 */
import { TYPES, PRIO_NAMES, STATUS_NAMES, DOW_NAMES, GOAL_LEVELS } from "../core/constants.js";
import { fmt, parseD } from "../core/dates.js";
import { today as TODAY } from "../core/clock.js";
import { taskById } from "../core/schema.js";
import { goalById, goalLevel } from "../core/goals.js";
import { applyTaskDraftRules, saveTask, deleteTask, duplicateTask, saveGoal, deleteGoal } from "../core/mutations.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const FREQS = [["", "不重复"], ["daily", "每天"], ["workday", "每个法定工作日"], ["weekly", "每周固定几天"], ["monthly", "每月固定一天"]];

/* 关联目标下拉的选项表：值带档位前缀（"weekly:g1"），选中后能反解出 goalId。
   刻意写成纯函数并导出，是为了让 _recur_test.js 能直接 import 断言：
   这里原先用 `[x].concat(...goalsOf(k).map(g=>[...]))`，而 concat 会展开一层实参，
   于是每对 [值, 标签] 被摊成两个字符串，下拉里一个目标都列不出来；
   更糟的是选中值恒为 ""，保存即静默解除关联。用数组字面量 + 展平，不给 concat 机会。 */
export function goalOptions(goals) {
  return [["", "不关联目标"], ...GOAL_LEVELS.flatMap(([k, label]) => (goals[k] || []).map(g => [k + ":" + g.id, label + " · " + g.title]))];
}
export function goalOptionValue(goals, gid) {
  if (!gid) return "";
  const e = GOAL_LEVELS.find(([k]) => (goals[k] || []).some(g => g.id === gid));
  return e ? e[0] + ":" + gid : "";
}

export function openTaskEditor(app, key) {
  // key 可能是循环实例 id（定义id@日期），编辑的始终是定义本身
  const id = (key || "").split("@")[0] || null;
  const t = id ? taskById(id) : null;
  if (id && !t) return;
  const st = app.state;
  const d = t || {
    title: "", type: TYPES[0], priority: 2, status: "todo", progress: 0,
    start: st.selDate || fmt(TODAY), end: st.selDate || fmt(TODAY),
    plannedTime: 0, actualTime: 0, note: "", goalId: "", recur: null,
    course: false, room: "", teacher: "", dow: null, timeSlot: "",
  };
  const rec = d.recur || { freq: "", days: [], mday: 1 };
  const goalOpts = goalOptions(st.goals);
  const gval = goalOptionValue(st.goals, d.goalId);

  const html = `
    <div class="m-field"><label for="fTitle">标题</label><input id="fTitle" type="text" value="${esc(d.title)}" placeholder="要做什么" autocomplete="off"></div>
    <div class="m-two">
      <div class="m-field"><label for="fType">分类</label><select id="fType">${TYPES.map(x => `<option${x === d.type ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="m-field"><label for="fPrio">优先级</label><select id="fPrio">${[1, 2, 3, 4].map(p => `<option value="${p}"${p === d.priority ? " selected" : ""}>${PRIO_NAMES[p]}</option>`).join("")}</select></div>
    </div>
    <div class="m-two">
      <div class="m-field"><label for="fStart">开始</label><input id="fStart" type="date" value="${esc(d.start)}"></div>
      <div class="m-field"><label for="fEnd">截止</label><input id="fEnd" type="date" value="${esc(d.end)}"></div>
    </div>
    <div class="m-field"><label for="fStatus">状态</label>
      <select id="fStatus">${Object.entries(STATUS_NAMES).map(([k, v]) => `<option value="${k}"${k === d.status ? " selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="m-field"><label for="fProg">进度 <b id="fProgV">${d.progress}%</b></label>
      <input id="fProg" type="range" min="0" max="100" step="5" value="${d.progress}"></div>
    <div class="m-two">
      <div class="m-field"><label for="fPlan">计划分钟</label><input id="fPlan" type="number" min="0" step="5" value="${d.plannedTime || 0}" inputmode="numeric"></div>
      <div class="m-field"><label for="fActual">实际分钟</label><input id="fActual" type="number" min="0" step="5" value="${d.actualTime || 0}" inputmode="numeric"></div>
    </div>
    <div class="m-field"><label for="fGoal">关联目标</label>
      <select id="fGoal">${goalOpts.map(([v, l]) => `<option value="${v}"${v === gval ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    <div class="m-field"><label for="fFreq">重复</label>
      <select id="fFreq">${FREQS.map(([v, l]) => `<option value="${v}"${v === (rec.freq || "") ? " selected" : ""}>${l}</option>`).join("")}</select></div>
    <div id="fRecurWeekly"${rec.freq === "weekly" ? "" : ' hidden'} class="m-field"><label>重复日</label>
      <div class="m-days">${DOW_NAMES.map((n, i) => `<button type="button" data-dow="${i}" class="${(rec.days || []).includes(i) ? "on" : ""}">${n.replace("周", "")}</button>`).join("")}</div></div>
    <div id="fRecurMonthly"${rec.freq === "monthly" ? "" : ' hidden'} class="m-field"><label for="fMday">每月几号（短月自动到月末）</label>
      <input id="fMday" type="number" min="1" max="31" value="${rec.mday || 1}" inputmode="numeric"></div>
    <div class="m-field"><label for="fNote">备注</label><textarea id="fNote" rows="3" placeholder="可选">${esc(d.note)}</textarea></div>
    <div class="m-sheetActs">
      ${id ? '<button class="m-btn danger" data-act="del" type="button">删除</button>' : ""}
      <button class="m-btn ghost" data-close type="button">取消</button>
      <button class="m-btn" data-act="save" type="button">${id ? "保存" : "添加"}</button>
    </div>
    <p class="m-msg" id="fErr" aria-live="polite"></p>`;

  const close = app.sheet(d.course ? "编辑课程" : id ? "编辑任务" : "新增任务", html, (box, doClose) => {
    const $ = s => box.querySelector(s);
    $("#fProg").addEventListener("input", () => { $("#fProgV").textContent = $("#fProg").value + "%"; });
    $("#fFreq").addEventListener("change", () => {
      $("#fRecurWeekly").hidden = $("#fFreq").value !== "weekly";
      $("#fRecurMonthly").hidden = $("#fFreq").value !== "monthly";
    });
    box.querySelectorAll("[data-dow]").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
    if (d.course) { $("#fFreq").disabled = true; }

    const err = m => { $("#fErr").textContent = m; };
    box.querySelector('[data-act="save"]').addEventListener("click", () => {
      const title = $("#fTitle").value.trim();
      if (!title) return err("请填写标题");
      const start = $("#fStart").value || fmt(TODAY), end = $("#fEnd").value || start;
      if (end < start) return err("截止日期不能早于开始日期");
      const freq = d.course ? null : $("#fFreq").value;
      let recur = null;
      if (freq) {
        const days = [...box.querySelectorAll("[data-dow].on")].map(b => +b.dataset.dow);
        if (freq === "weekly" && !days.length) return err("每周重复至少选一天");
        recur = { freq, days, mday: Math.min(31, Math.max(1, +($("#fMday").value) || 1)) };
      }
      const gv = $("#fGoal").value;
      const data = {
        title, type: $("#fType").value, priority: +$("#fPrio").value, status: $("#fStatus").value,
        progress: +$("#fProg").value, start, end,
        plannedTime: +$("#fPlan").value || 0, actualTime: +$("#fActual").value || 0,
        note: $("#fNote").value.trim(), goalId: gv ? gv.split(":")[1] : "", recur,
        course: d.course, room: d.room, teacher: d.teacher, dow: d.dow, timeSlot: d.timeSlot,
      };
      saveTask(id, applyTaskDraftRules(data));
      app.commit();
      doClose();
    });
    const del = box.querySelector('[data-act="del"]');
    if (del) del.addEventListener("click", () => { doClose(); app.deleteTask(id); });
  });
  return close;
}

/* 复制 = core 的 duplicateTask 出副本，再把编辑面板直接开在副本上。
   桌面是"复制完列表里多一条"，手机上重填字段成本高，所以多走这一步；
   它同时覆盖桌面弹窗里"另存为副本"的用法——原任务一个字节都不改。 */
export function duplicateIntoEditor(app, t) {
  const c = duplicateTask(t);
  app.commit();
  return openTaskEditor(app, c.id);
}

/* 目标编辑面板：改名 + 换档位 + 新增。档位与数组顺序的语义与桌面一致。 */export function openGoalEditor(app, gid, presetLevel) {
  const editing = gid ? goalById(gid) : null;
  if (gid && !editing) return;
  const level = gid ? goalLevel(gid) : (presetLevel || "weekly");
  app.sheet(editing ? "编辑目标" : "新增目标", `
    <div class="m-field"><label for="gText">目标描述</label>
      <input id="gText" type="text" value="${esc(editing ? editing.title : "")}" placeholder="想要达成什么" autocomplete="off"></div>
    <div class="m-field"><label for="gLevel">档位</label>
      <select id="gLevel">${GOAL_LEVELS.map(([k, l]) => `<option value="${k}"${k === level ? " selected" : ""}>${l}目标</option>`).join("")}</select></div>
    <div class="m-sheetActs">
      ${editing ? '<button class="m-btn danger" data-act="del" type="button">删除</button>' : ""}
      <button class="m-btn ghost" data-close type="button">取消</button>
      <button class="m-btn" data-act="save" type="button">${editing ? "保存" : "添加"}</button>
    </div>
    <p class="m-msg" id="gErr" aria-live="polite"></p>`,
    (box, close) => {
      const $ = s => box.querySelector(s);
      $('[data-act="save"]').addEventListener("click", () => {
        const title = $("#gText").value.trim();
        if (!title) { $("#gErr").textContent = "请填写目标描述"; return; }
        saveGoal(gid || null, title, $("#gLevel").value);
        app.commit();
        close();
      });
      const del = box.querySelector('[data-act="del"]');
      if (del) del.addEventListener("click", () => { close(); app.deleteGoal(gid); });
    });
}

/* 删除：core 给撤销数据与文案所需字段，浮条与时长归壳 */
export function removeTaskWithUndo(app, id) {
  const r = deleteTask(id);
  if (!r) return;
  app.commit();
  app.toast(`已删除「${r.title}」${r.isRecur && r.occCount ? `（含 ${r.occCount} 条打卡记录）` : ""}`, () => { r.undo(); app.commit(); });
}

export function removeGoalWithUndo(app, id) {
  const r = deleteGoal(id);
  if (!r) return;
  app.forgetGoal(id);       // 折叠集合等视图态由壳自己清，不进 core
  app.commit();
  app.toast(`已删除目标「${r.title}」${r.affectedCount ? `，${r.affectedCount} 条任务已解除关联` : ""}`, () => { r.undo(); app.commit(); });
}
