/* 法定节假日与调休口径、农历/节气查询。零 DOM，fetch 由调用方注入以便小程序/测试替换。 */
import { Solar } from "lunar-javascript";
import { fmt, parseD } from "./dates.js";

/* 法定工作日判定数据：口径为国务院办公厅放假安排（off=放假日，makeup=调休补班的周末，均为 MM-DD）。
   内置 2025/2026 作离线兜底；运行时从 holiday-cn 镜像（逐条解析国务院通知、公布后自动更新）同步当年与次年。
   HOLIDAY_SRC 记录每年口径来源：builtin=内置 / live=已同步官方源；两者皆无的年份退回普通周一至周五并在界面如实标注。 */
export const CN_HOLIDAY_BUILTIN={
  "2025":{off:["01-01","01-28","01-29","01-30","01-31","02-01","02-02","02-03","02-04","04-04","04-05","04-06","05-01","05-02","05-03","05-04","05-05","05-31","06-01","06-02","10-01","10-02","10-03","10-04","10-05","10-06","10-07","10-08"],
          makeup:["01-26","02-08","04-27","09-28","10-11"],
          names:[["01-01","01-01","元旦"],["01-28","02-04","春节"],["04-04","04-06","清明节"],["05-01","05-05","劳动节"],["05-31","06-02","端午节"],["10-01","10-08","国庆节、中秋节"]]},
  "2026":{off:["01-01","01-02","01-03","02-15","02-16","02-17","02-18","02-19","02-20","02-21","02-22","02-23","04-04","04-05","04-06","05-01","05-02","05-03","05-04","05-05","06-19","06-20","06-21","09-25","09-26","09-27","10-01","10-02","10-03","10-04","10-05","10-06","10-07"],
          makeup:["01-04","02-14","02-28","05-09","09-20","10-10"],
          names:[["01-01","01-03","元旦"],["02-15","02-23","春节"],["04-04","04-06","清明节"],["05-01","05-05","劳动节"],["06-19","06-21","端午节"],["09-25","09-27","中秋节"],["10-01","10-07","国庆节"]]}
};
export const CN_HOLIDAY={};
export const HOLIDAY_SRC={};
export function buildHolidayYear(y,offMMDD,makeupMMDD,nameRanges){
  const ok=s=>typeof s==="string"&&/^\d{2}-\d{2}$/.test(s),p=m=>y+"-"+m;
  const names={};
  (Array.isArray(nameRanges)?nameRanges:[]).forEach(r=>{
    if(!Array.isArray(r)||r.length!==3)return;
    const [a,b,name]=r;if(!ok(a)||!ok(b)||typeof name!=="string"||!name)return;
    let d=parseD(p(a)),end=parseD(p(b));
    while(d<=end){names[fmt(d)]=name;d.setDate(d.getDate()+1);}
  });
  return {off:new Set(offMMDD.filter(ok).map(p)),makeup:new Set(makeupMMDD.filter(ok).map(p)),names};
}
for(const y in CN_HOLIDAY_BUILTIN){const h=CN_HOLIDAY_BUILTIN[y];CN_HOLIDAY[y]=buildHolidayYear(y,h.off,h.makeup,h.names);HOLIDAY_SRC[y]="builtin";}

/* 法规意义上的工作日：调休补班的周末算工作日；法定节假日不算；其余按周一至周五。
   年份未收录 CN_HOLIDAY 时，退回普通周一至周五判定。 */
export function isLegalWorkday(ds){
  const w=parseD(ds).getDay(),h=CN_HOLIDAY[ds.slice(0,4)];
  if(!h)return w>=1&&w<=5;
  if(h.makeup.has(ds))return true;
  if(h.off.has(ds))return false;
  return w>=1&&w<=5;
}
/* 把 holiday-cn 年度 JSON（days:[{date,isOffDay,name}]）灌入判定表；isOffDay=true 为放假，false 为补班。
   只接受日期前缀与年份一致的条目，脏数据直接丢弃；无任何有效条目时保留内置数据不覆盖。 */
export function applyHolidayYear(y,data){
  const off=[],makeup=[],names=[];
  (data&&Array.isArray(data.days)?data.days:[]).forEach(d=>{
    if(d&&typeof d.date==="string"&&d.date.slice(0,4)===String(y)){
      const mm=d.date.slice(5);
      if(d.isOffDay===true){off.push(mm);if(typeof d.name==="string"&&d.name)names.push([mm,mm,d.name]);}
      else if(d.isOffDay===false)makeup.push(mm);
    }
  });
  if(!off.length&&!makeup.length)return false;
  CN_HOLIDAY[y]=buildHolidayYear(y,off,makeup,names);HOLIDAY_SRC[y]="live";
  return true;
}

export const SOLAR_FESTIVALS={"01-01":"元旦","03-08":"妇女节","03-12":"植树节","05-01":"劳动节","05-04":"青年节","06-01":"儿童节","07-01":"建党节","08-01":"建军节","09-10":"教师节","09-18":"国耻日","10-01":"国庆节","12-13":"国家公祭日"};
const _lunarCache=new Map();
export function lunarOf(ds){
  let v=_lunarCache.get(ds);
  if(!v){const s=Solar.fromYmd(+ds.slice(0,4),+ds.slice(5,7),+ds.slice(8,10)),l=s.getLunar();
    v={day:l.getDay(),monthName:l.getMonthInChinese(),jieqi:l.getJieQi(),dayCh:l.getDayInChinese(),fest:l.getFestivals()};
    _lunarCache.set(ds,v);}
  return v;
}

export const HOLIDAY_MIRROR="https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/";
export async function refreshHolidayYear(y){
  try{
    const res=await fetch(HOLIDAY_MIRROR+y+".json",{cache:"no-store"});
    if(!res.ok)return false;
    const data=await res.json();
    if(!data||String(data.year)!==String(y))return false; // 校验年份，防止镜像返回错位数据
    return applyHolidayYear(y,data);
  }catch(e){return false;} // 拉取失败：静默保留内置数据
}
