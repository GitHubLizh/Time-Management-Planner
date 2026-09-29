/* 关键词与时间段匹配。零 DOM。
   pinyin-pro 在小程序侧可用性未验证，故实现由壳注入；未注入时按"拼音首字母不匹配"降级，
   中文子串与英文子串匹配不受影响。 */
import { PRIO_NAMES, STATUS_NAMES } from "./constants.js";

let _pinyin=null;
export function setPinyinImpl(fn){_pinyin=fn;}

export const SLOT_NAMES={morning:"早晨",afternoon:"下午",evening:"晚间"};

/* 筛选摘要：桌面 banner 与移动壳胶囊共用同一份文案口径，只出片段，HTML 由壳自己拼。
   顺序即桌面 banner 原有顺序：关键词 → 年 → 月 → 优先级 → 状态 → 类型 → 时段 → 逾期 → 迟完。 */
export function filterSummary(filters,state){
  const f=filters||{},parts=[];
  if(f.keyword&&f.keyword.trim())parts.push('标题匹配「'+f.keyword.trim()+'」');
  if(f.year)parts.push(f.year+" 年");
  if(f.month)parts.push(parseInt(f.month)+" 月");
  if(f.prio)parts.push(PRIO_NAMES[f.prio]);
  if(f.status)parts.push(STATUS_NAMES[f.status]);
  if(f.type)parts.push(f.type);
  if(f.slot)parts.push(SLOT_NAMES[f.slot]);
  if(state.onlyOverdue)parts.push("仅逾期未完成");
  if(state.onlyLate)parts.push("仅迟完");
  return parts;
}

export function slotOf(t){
  if(t.course&&t.timeSlot){const h=parseInt(t.timeSlot.split(":")[0],10);if(h<12)return"morning";if(h<18)return"afternoon";return"evening";}
  return"";
}
export function titleMatchesKeyword(title,keyword){
  const text=String(title||"").toLowerCase();
  if(text.includes(keyword))return true;
  if(!/^[a-z0-9]+$/.test(keyword))return false;
  if(!_pinyin)return false;
  const initials=_pinyin(text,{pattern:"first",toneType:"none",separator:""}).replace(/\s+/g,"");
  return initials.includes(keyword);
}
