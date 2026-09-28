/* 移动壳 → 桌面壳的手动切换。必须写入偏好，否则会被桌面 head 里的分流 shim 立刻弹回来。
   （桌面那侧是内联脚本，不能等模块加载，否则跳转前会闪一下桌面页；
     两处用同一个键 planner.ui，改动时一起改。） */
export const UI_PREF_KEY = "planner.ui";

export function goDesktop() {
  try { localStorage.setItem(UI_PREF_KEY, "desktop"); } catch (e) { }
  location.href = "/index.html";
}

/* 给渲染出来的页面绑定"去桌面"入口 */
export function bindDesktopLink(root) {
  root.querySelectorAll(".to-desktop").forEach(a => a.addEventListener("click", e => { e.preventDefault(); goDesktop(); }));
}
