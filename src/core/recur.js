/* 循环任务展开引擎：库里只存一条定义，"某天实例"按规则现算。零 DOM。
   实例不是数据，id 用「定义id@日期」拼出来，打卡记录写回定义的 doneOn。
   start/end 复用为循环起止窗口（含首尾）。 */
import { fmt, parseD, addDays } from "./dates.js";
import { today } from "./clock.js";
import { DOW_NAMES } from "./constants.js";
import { isLegalWorkday } from "./holidays.js";

export function occursOn(t,ds){
  const r=t.recur;if(!r)return false;
  if(ds<t.start||ds>t.end)return false;
  const d=parseD(ds);
  if(r.freq==="weekly")return r.days.indexOf(d.getDay())>=0;
  if(r.freq==="monthly")return d.getDate()===Math.min(r.mday,new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
  if(r.freq==="workday")return isLegalWorkday(ds); // 法定工作日（扣除节假日·含调休补班）
  return true; // daily
}
export function recurText(t){
  const r=t.recur;if(!r)return"";
  if(r.freq==="weekly")return "每"+(r.days.length?r.days.map(d=>DOW_NAMES[d].slice(1)).join("、"):"—");
  if(r.freq==="monthly")return "每月 "+r.mday+" 号";
  if(r.freq==="workday")return "法定工作日";
  return "每天";
}
export function nextOccurrence(t,fromStr){
  let d=parseD(fromStr<t.start?t.start:fromStr);
  for(let i=0;i<400;i++){
    const ds=fmt(d);
    if(ds>t.end)return"";
    if(occursOn(t,ds))return ds;
    d=addDays(d,1);
  }
  return"";
}
export function prevOccurrence(t,beforeStr){ // 严格早于 beforeStr 的最近一次发生
  let d=addDays(parseD(beforeStr),-1);
  for(let i=0;i<400;i++){
    const ds=fmt(d);
    if(ds<t.start)return"";
    if(occursOn(t,ds))return ds;
    d=addDays(d,-1);
  }
  return"";
}
export function occurrencesBetween(t,fromStr,toStr){
  const out=[];
  for(let ds=nextOccurrence(t,fromStr);ds&&ds<=toStr;ds=nextOccurrence(t,fmt(addDays(parseD(ds),1))))out.push(ds);
  return out;
}
export function occDone(t,ds){return !!(t&&t.recur&&t.doneOn&&t.doneOn[ds]);}
export function toggleOcc(t,ds){if(occDone(t,ds))delete t.doneOn[ds];else t.doneOn[ds]=fmt(today);}
export function recurDoneIn(t,from,to){const l=occurrencesBetween(t,from,to);return {done:l.filter(ds=>occDone(t,ds)).length,total:l.length};}
export function recurStreak(t){ // 连续打卡次数：从今天（今天已打卡）或上一个发生日起，往前数连续有记录的次数
  if(!t.recur)return 0;
  const todayStr=fmt(today);
  let ds=occDone(t,todayStr)?todayStr:prevOccurrence(t,todayStr);
  let n=0;
  while(ds&&ds>=t.start&&occDone(t,ds)){n++;ds=prevOccurrence(t,ds);}
  return n;
}
/* 统计口径：循环任务不进完成率、逾期、迟完与看板，只在日/周/月历按实例呈现 */
export function statsPool(list){return list.filter(t=>!t.recur);}
