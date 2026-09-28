/* 关键词与时间段匹配。零 DOM。
   pinyin-pro 在小程序侧可用性未验证，故实现由壳注入；未注入时按"拼音首字母不匹配"降级，
   中文子串与英文子串匹配不受影响。 */
let _pinyin=null;
export function setPinyinImpl(fn){_pinyin=fn;}

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
