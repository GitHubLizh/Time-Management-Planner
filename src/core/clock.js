import { fmt, fmtStamp, parseD } from "./dates.js";

/* 核心层的"今天"：跨零点后逾期判定与今日高亮要自愈，所以它是可变的，但只就地改、不换引用。
   浏览器壳的定时器与小程序的 onShow 都通过 advanceClock 推进它，core 自身不启任何计时器。 */
export const today = new Date();
today.setHours(0, 0, 0, 0);

/* 推进到 now 所在日；未跨日则不动。返回是否推进过，以及推进前后的日期串，
   好让壳层自己决定要不要跟进 selDate 和重绘（core 不认识 renderAll）。 */
export function advanceClock(now = new Date()) {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  if (+next === +today) return { advanced: false, prev: fmt(today), current: fmt(today) };
  const prev = fmt(today);
  today.setTime(+next);
  return { advanced: true, prev, current: fmt(today) };
}

/* 测试与离线复现用的时钟锚定：把"今天"设为指定日期 */
export function setToday(ds) {
  const d = parseD(ds);
  today.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  today.setHours(0, 0, 0, 0);
}

/* 到秒的"此刻"。不复用 today —— 它被刻意归零到 00:00（逾期与迟完都按整天算，依赖这点），
   从它身上取时刻永远得到 T00:00:00。默认走真实墙上时钟，setNowStamp 与 setToday 同为测试锚点。 */
let _nowStamp = null;
export function setNowStamp(s) { _nowStamp = s || null; }
export function nowStamp() { return _nowStamp || fmtStamp(new Date()); }
