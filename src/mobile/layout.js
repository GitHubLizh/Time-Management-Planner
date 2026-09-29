/* 宽屏（平板 ≥700px）判据。只有壳和视图用它，core 一律不碰 matchMedia——
   小程序/APP 阶段这一层整个换掉，判定口径不共享。 */
const MQ = "(min-width:700px)";

/* 全壳共用同一个 MediaQueryList：每次新建对象时，change 回调里读到的新对象可能还没跟上
   刚刚变化的视口（实测跨断点那一次 isWide() 仍是旧值，右栏没跟上 CSS 的两栏）。
   同一个实例的 matches 在其 change 事件触发时必然已更新。 */
let mql = null;
function list() {
  if (!mql && typeof window !== "undefined" && window.matchMedia) mql = window.matchMedia(MQ);
  return mql;
}

export function isWide() {
  const m = list();
  return !!m && m.matches;
}

/* 断点跨越时的回调（转场要收起右栏，否则窄屏看不见它、回到宽屏又留着过期表单）。
   除 MQ 的 change 事件外再挂一条 window resize 兜底：同一个 mql 实例的 matches 是判据，
   两次回调之间值没变就不重复触发（隐藏页里 change 事件会迟到，实测踩到，靠 resize 补上）。 */
export function onWideChange(fn) {
  const m = list();
  if (!m) return () => {};
  let last = m.matches;
  const h = () => {
    if (m.matches === last) return;
    last = m.matches;
    fn(m.matches);
  };
  if (m.addEventListener) m.addEventListener("change", h);
  else if (m.addListener) m.addListener(h);      // Safari 13 及以下只有旧 API
  window.addEventListener("resize", h);
  return () => {
    if (m.removeEventListener) m.removeEventListener("change", h);
    else if (m.removeListener) m.removeListener(h);
    window.removeEventListener("resize", h);
  };
}
