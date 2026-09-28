/* 日期与时长格式化：ISO 日期串（YYYY-MM-DD）与 Date 互转。零 DOM。 */
export function pad(n){return String(n).padStart(2,"0");}
export function fmt(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
export function parseD(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}
export function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
export function mondayOf(d){const x=new Date(d);const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);x.setHours(0,0,0,0);return x;}
export function monthRange(ds){const d=parseD(ds),ms=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;return [ms+"-01",ms+"-"+pad(new Date(d.getFullYear(),d.getMonth()+1,0).getDate())];}
export function fmtDur(min){return min>=60?Math.round(min/6)/10+"h":min+"′";}
