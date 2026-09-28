/* 底部四个 tab：按"手机上要做的事"划分，不是桌面七个视图的缩略。
   课表归入今日与目标，周/月/年的汇总口径放进展位，详细浏览仍在桌面完成。 */
const s = (paths) => `<svg viewBox="0 0 24 24">${paths}</svg>`;
export const TODAY_TABS = [
  { key: "today", label: "今日", icon: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>') },
  { key: "goals", label: "目标", icon: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>') },
  { key: "board", label: "看板", icon: s('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="5" height="14" rx="1"/>') },
  { key: "me", label: "我的", icon: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>') },
];
