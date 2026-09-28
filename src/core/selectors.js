/* 取数与统计口径：所有"从 state 到列表/数字"的查询。零 DOM。
   统计口径：循环任务不进完成率、逾期、迟完与看板，只在日/周/月历按实例呈现。 */
import { fmt, parseD } from "./dates.js";
import { today } from "./clock.js";
import { state } from "./schema.js";
import { occursOn, statsPool } from "./recur.js";
import { taskById } from "./schema.js";
import { titleMatchesKeyword, slotOf } from "./filters.js";

export function filteredTasks(){
  const f=state.filters;
  const keyword=f.keyword.trim().toLowerCase();
  return state.tasks.filter(t=>{
    if(keyword&&!titleMatchesKeyword(t.title,keyword))return false;
    if(state.onlyOverdue&&!isOverdue(t))return false;
    if(state.onlyLate&&!isLateDone(t))return false;
    if(f.type&&t.type!==f.type)return false;
    if(f.prio&&String(t.priority)!==f.prio)return false;
    if(f.status&&t.status!==f.status)return false;
    if(f.year){const y=(t.start||"").slice(0,4);if(y!==f.year)return false;}
    if(f.month){const m=(t.start||"").slice(5,7);if(m!==f.month)return false;}
    if(f.slot){if(slotOf(t)!==f.slot)return false;}
    return true;
  });
}
export function tasksOn(dateStr,pool){
  return (pool||state.tasks).filter(t=>{
    if(t.recur)return occursOn(t,dateStr);
    if(t.course&&t.dow!==null&&t.dow!==undefined){
      return parseD(dateStr).getDay()===t.dow && t.start<=dateStr;
    }
    return t.start<=dateStr&&t.end>=dateStr;
  });
}
export function splitId(id){ // 实例 id → 定义 + 日期；定义 id 原样返回
  const s=String(id),i=s.lastIndexOf("@");
  return i<0?{task:taskById(s),date:""}:{task:taskById(s.slice(0,i)),date:s.slice(i+1)};
}
export function isOverdue(t){return !t.course&&!t.recur&&t.status!=="done"&&!!t.end&&t.end<fmt(today);}
export function overdueDays(t){return Math.round((today-parseD(t.end))/86400000);}
export function overdueList(pool){return (pool||state.tasks).filter(isOverdue);}
/* ---------- 迟完留痕：完成时刻晚于截止日期。doneAt 只由 syncDoneAt 写，课程与循环任务被清空故不参与 ---------- */
export function syncDoneAt(t){t.doneAt=(t.status==="done"&&!t.course&&!t.recur)?(t.doneAt||fmt(today)):"";}
export function isLateDone(t){return !t.recur&&t.status==="done"&&!!t.doneAt&&t.doneAt>t.end;}
export function lateDays(t){return Math.round((parseD(t.doneAt)-parseD(t.end))/86400000);}
export function lateList(pool){return (pool||state.tasks).filter(isLateDone);}
export function statsOf(list){
  const s={total:list.length,done:0,doing:0,todo:0,q:{1:0,2:0,3:0,4:0},types:{}};
  list.forEach(t=>{s[t.status]++;s.q[t.priority]++;s.types[t.type]=(s.types[t.type]||0)+1;});
  s.rate=s.total?Math.round(s.done/s.total*100):0;
  return s;
}
export function hasActiveFilter(){const f=state.filters;return f.keyword.trim()||f.year||f.month||f.prio||f.status||f.type||f.slot||state.onlyOverdue||state.onlyLate;}
