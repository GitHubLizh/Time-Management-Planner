/* 取数与统计口径：所有"从 state 到列表/数字"的查询。零 DOM。
   统计口径：循环任务不进完成率、逾期、迟完与看板，只在日/周/月历按实例呈现。 */
import { fmt, parseD, addDays, mondayOf, pad } from "./dates.js";
import { today } from "./clock.js";
import { TYPES } from "./constants.js";
import { state } from "./schema.js";
import { occursOn, occDone, statsPool } from "./recur.js";
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

/* ================= 分组几何 =================
   这些分组/排布规则原先内联在七个渲染函数里，桌面能跑只是因为它们在模板中间。
   移动壳、小程序、APP 要的是同一份分组结果，所以只把"算哪一格放什么"下沉，
   HTML 拼接仍留在各壳里 —— core 不产 HTML。 */

/* 课表：5 大节 × 7 天。列顺序沿用原实现的 周一…周日（dow 1..7，周日取 0） */
export const SLOT_TIMES=[["08:00","09:40"],["10:00","11:40"],["14:00","15:40"],["16:00","17:40"],["19:00","20:40"]];
export function scheduleGrid(courses){
  return SLOT_TIMES.map((slot,si)=>({slot,index:si,
    cells:Array.from({length:7},(_,k)=>{const dow=(k+1)%7;
      return {dow,tasks:courses.filter(c=>c.dow===dow&&c.timeSlot&&c.timeSlot.startsWith(slot[0].slice(0,2)))};})}));
}

/* 日视图：当天任务按课程/循环/普通三分，normalTotal 不受筛选影响 */
export function dayGroups(selDate,pool){
  const list=tasksOn(selDate,pool);
  return {list,
    courses:list.filter(t=>t.course),
    recurring:list.filter(t=>t.recur),
    normal:list.filter(t=>!t.recur&&!t.course),
    normalTotal:tasksOn(selDate).filter(t=>!t.recur&&!t.course).length};
}
export function weekDaysOf(selDate){const mon=mondayOf(parseD(selDate));return Array.from({length:7},(_,i)=>fmt(addDays(mon,i)));}
/* 迷你日历：不带 pool，走全量（日视图小日历的"有任务"点不受筛选影响） */
export function miniCalGrid(y,m){
  const first=new Date(y,m,1),startOffset=(first.getDay()+6)%7,daysIn=new Date(y,m+1,0).getDate();
  const todayStr=fmt(today);
  return {startOffset,daysIn,
    days:Array.from({length:daysIn},(_,k)=>{const dd=k+1,ds=fmt(new Date(y,m,dd));
      return {dd,ds,past:ds<todayStr,today:ds===todayStr,sel:ds===state.selDate,hasTask:!!tasksOn(ds).length};})};
}

/* 周视图：7 列 + 每日数量条（循环实例不计入数量） */
export function weekColumns(pool,days){
  return days.map(ds=>({ds,tasks:tasksOn(ds,pool).sort((a,b)=>(a.course?0:1)-(b.course?0:1)||a.priority-b.priority)}));
}
export function dailyCounts(pool,days){
  const list=days.map(ds=>tasksOn(ds,pool).filter(t=>!t.recur).length);
  return {counts:list,max:Math.max(1,...list)};
}

/* 月历：含首尾补位格；doneCnt 对循环任务按当天实例计 */
export function monthTasksOf(y,m,pool){
  const monthStr=`${y}-${pad(m+1)}`;
  return pool.filter(t=>(t.start<=monthStr+"-31"&&t.end>=monthStr+"-01")||(t.course&&t.start<=monthStr+"-31"));
}
export function monthGrid(y,m,pool){
  const first=new Date(y,m,1),startOffset=(first.getDay()+6)%7,daysIn=new Date(y,m+1,0).getDate();
  const monthStr=`${y}-${pad(m+1)}`,totalCells=Math.ceil((startOffset+daysIn)/7)*7,cells=[];
  for(let i=0;i<totalCells;i++){
    const dd=i-startOffset+1;
    if(dd<1||dd>daysIn){cells.push({out:true,dd:0,ds:"",list:[],doneCnt:0});continue;}
    const ds=`${monthStr}-${pad(dd)}`,list=tasksOn(ds,pool);
    cells.push({out:false,dd,ds,list,doneCnt:list.filter(t=>t.recur?occDone(t,ds):t.status==="done").length});
  }
  return {startOffset,daysIn,monthStr,cells};
}

/* 月进度：自然周切分（首周从 1 号起、末周截到月末，最多 6 周） */
export function progressWeeks(y,m){
  const weeks=[];let wStart=new Date(y,m,1);
  const monthEnd=new Date(y,m+1,0);
  while(wStart.getMonth()===m||weeks.length===0){
    const wEnd=addDays(wStart,6);
    weeks.push({s:new Date(wStart),e:wEnd>monthEnd?monthEnd:wEnd});
    wStart=addDays(wEnd,1);
    if(weeks.length>5)break;
  }
  return weeks;
}
export function monthSpanFilter(y,m){
  const daysIn=new Date(y,m+1,0).getDate(),monthStr=`${y}-${pad(m+1)}`;
  return t=>!t.course&&t.start<=monthStr+"-"+pad(daysIn)&&t.end>=monthStr+"-01";
}
/* 甘特：每周一格，null 表示该周无条 */
export function ganttCells(t,weeks){
  return weeks.map(w=>{
    const ws=fmt(w.s),we=fmt(w.e);
    if(t.start>we||t.end<ws)return null;
    const ovS=t.start>ws?t.start:ws,ovE=t.end<we?t.end:we;
    const totalW=(w.e-w.s)/86400000+1;
    return {ovS,ovE,left:(parseD(ovS)-w.s)/86400000/totalW*100,width:((parseD(ovE)-parseD(ovS))/86400000+1)/totalW*100};
  });
}

/* 年视图：年度归属判定 + 单月日历矩阵 */
export function yearSplit(y,pool){
  const yrMatch=t=>t.start.slice(0,4)==String(y)||t.end.slice(0,4)==String(y);
  return {yearTasks:statsPool(pool).filter(yrMatch),recurCount:pool.filter(t=>t.recur&&yrMatch(t)).length};
}
export function yearMonthDays(y,mo,pool){
  const first=new Date(y,mo,1),off=(first.getDay()+6)%7,dim=new Date(y,mo+1,0).getDate();
  return {off,dim,days:Array.from({length:dim},(_,k)=>{const dd=k+1,ds=fmt(new Date(y,mo,dd));
    return {dd,ds,hasTask:!!tasksOn(ds,pool).length};})};
}
export function monthSlice(tasks,y,mo){
  const a=`${y}-${pad(mo+1)}-01`,b=`${y}-${pad(mo+1)}-31`;
  return tasks.filter(t=>t.start<=b&&t.end>=a);
}
/* 年度图表：12 个月各自的完成率（无任务记 0，与"0%"同形，沿用原口径） */
export function monthlyRates(y,pool){
  return Array.from({length:12},(_,mo)=>{
    const l=monthSlice(pool,y,mo);
    return l.length?Math.round(l.filter(t=>t.status==="done").length/l.length*100):0;
  });
}

/* 看板：分列与循环任务计数 */
export function kanbanSplit(pool,mode){
  const cols=mode==="status"?[["todo","未开始"],["doing","进行中"],["done","已完成"]]:TYPES.map(t=>[t,t]);
  const plain=statsPool(pool);
  return {cols:cols.map(([key,label])=>({key,label,tasks:plain.filter(t=>mode==="status"?t.status===key:t.type===key)})),
    recurCount:pool.length-plain.length};
}
