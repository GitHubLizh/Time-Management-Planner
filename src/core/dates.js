/* 日期与时长格式化：ISO 日期串（YYYY-MM-DD）与 Date 互转。零 DOM。 */
export function pad(n){return String(n).padStart(2,"0");}
export function fmt(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
/* 到秒的时刻串：日期部分复用 fmt，字典序仍与时间先后一致（看板已完成列就靠这个比） */
export function fmtStamp(d){return `${fmt(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
export function parseD(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}
/* 时刻串取日粒度前缀。任务只有截止日、没有截止时刻，所以凡与截止日相比都先降到日 */
export function dayOf(s){return String(s||"").slice(0,10);}
/* 呈现专用：存储串保持 ISO 的 T（定长才能比字典序），只在写给人眼的地方把它换成空格 */
export function stampText(s){return String(s||"").replace("T"," ");}
export function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
export function mondayOf(d){const x=new Date(d);const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);x.setHours(0,0,0,0);return x;}
export function monthRange(ds){const d=parseD(ds),ms=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;return [ms+"-01",ms+"-"+pad(new Date(d.getFullYear(),d.getMonth()+1,0).getDate())];}
export function fmtDur(min){return min>=60?Math.round(min/6)/10+"h":min+"′";}
