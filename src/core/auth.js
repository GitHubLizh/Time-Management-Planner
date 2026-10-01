/* 认证相关的纯规则：错误码/错误信息 → 中文提示。零 DOM。
   Supabase 的 message 会随版本变，所以先认 code、再退回正则匹配 message；
   两个壳（桌面与移动）以及以后的小程序都复用这一份，避免同一错误在手机上显示英文原文。 */
export const AUTH_ERR_ZH={
  invalid_credentials:"邮箱或密码不正确。",
  email_not_confirmed:"邮箱尚未确认，请先查收确认邮件。",
  invalid_email:"邮箱地址格式不正确。",
  user_already_exists:"该邮箱已注册，请直接登录。",
  weak_password:"密码强度不足，请至少使用 6 位以上字符。",
  over_email_send_rate_limit:"发信过于频繁，请约 1 小时后再试。",
  over_request_rate_limit:"操作过于频繁，请稍后再试。",
  otp_expired:"验证码已过期，请重新获取。",
  invalid_otp:"验证码不正确，请检查后重试。",
  signup_disabled:"当前未开放注册。",
};
export function authErrorMessage(err){
  if(!err)return"";
  if(AUTH_ERR_ZH[err.code])return AUTH_ERR_ZH[err.code];
  const m=String(err.message||"");
  if(/invalid login credentials/i.test(m))return"邮箱或密码不正确。";
  if(/email not confirmed/i.test(m))return"邮箱尚未确认，请先查收确认邮件。";
  if(/invalid email|email address is invalid/i.test(m))return"邮箱地址格式不正确。";
  if(/already registered|already been registered/i.test(m))return"该邮箱已注册，请直接登录。";
  if(/weak password|password should|at least 6/i.test(m))return"密码强度不足，请至少使用 6 位以上字符。";
  if(/rate limit|too many|otp expired/i.test(m))return"操作过于频繁，请稍后再试（约 1 小时自动恢复）。";
  if(/invalid otp|token has expired|expired token/i.test(m))return"验证码已过期或无效，请重新获取。";
  if(/signups not allowed/i.test(m))return"当前未开放注册。";
  if(/failed to fetch|network|fetch failed|timeout/i.test(m))return"网络连接失败，请检查网络后重试。";
  return m;
}

/* ============ 密码连错的处置规则 ============ */
/* 连错到达上限后暂停密码提交，并把"重置密码 / 邮箱链接 / 第三方"这三条出路摆到眼前。
   两条口径要说清楚：
   1) 只统计"凭证不对"（invalid_credentials）这一类。网络失败、邮箱未确认、发信过频都不算 ——
      把它们计入会把"用户在断网上重试"误判成"有人在猜密码"，锁错人。
   2) 计次按邮箱归一（trim + 小写）存在调用方给的 storage 里。core 不认识 localStorage，
      两端各自注入（桌面 index.html 与移动 mobile.html 同域，于是两壳看到的是同一份计数）；
      测试注入一个假对象即可跑纯逻辑。
   注意 storage 可能整个抛错（无痕模式），此时一律按"没锁"降级，不能把登录挡死。 */
export const PASSWORD_FAIL_LIMIT=5;
export const PASSWORD_RETRY_COOLDOWN_MS=60000;
export const PASSWORD_FAIL_KEY_PREFIX="planner.authFail.";

function passwordFailKey(email){
  return PASSWORD_FAIL_KEY_PREFIX+String(email||"").trim().toLowerCase();
}
export function isPasswordFailure(err){
  if(!err)return false;
  if(err.code)return err.code==="invalid_credentials";
  return /invalid login credentials/i.test(String(err.message||""));
}
export function createPasswordFailGuard(storage,opts){
  const o=opts||{};
  const limit=o.limit??PASSWORD_FAIL_LIMIT;
  const cooldownMs=o.cooldownMs??PASSWORD_RETRY_COOLDOWN_MS;
  const clock=o.now||(()=>Date.now());
  const read=k=>{try{return storage&&storage.getItem(k)}catch(e){return null}};
  const write=(k,v)=>{try{storage&&storage.setItem(k,v)}catch(e){}};
  const drop=k=>{try{storage&&storage.removeItem(k)}catch(e){}};
  const load=email=>{
    const raw=read(passwordFailKey(email));
    if(!raw)return {fails:0,unlockAt:0};
    try{
      const rec=JSON.parse(raw);
      return {fails:Math.max(0,Number(rec&&rec.fails)||0),unlockAt:Number(rec&&rec.unlockAt)||0};
    }catch(e){return {fails:0,unlockAt:0}}
  };
  // guide 只跟"到没到上限"走，locked 只在冷却内 —— 面板要留在眼前，按钮到点就该放开
  const view=(rec,at)=>{
    const guide=rec.fails>=limit;
    const locked=guide&&at<rec.unlockAt;
    return {fails:rec.fails,guide,locked,retryInMs:locked?rec.unlockAt-at:0};
  };
  const at=when=>when==null?clock():when;
  return {
    limit,
    state(email,when){return view(load(email),at(when))},
    /* 到上限那一次起锁；此后每次再错都重新计时（不靠"每 5 次"的倍数，少一条口径） */
    record(email,when){
      const t=at(when);
      const rec=load(email);
      const next={fails:rec.fails+1,unlockAt:0};
      if(next.fails>=limit)next.unlockAt=t+cooldownMs;
      write(passwordFailKey(email),JSON.stringify(next));
      return view(next,t);
    },
    reset(email){drop(passwordFailKey(email))},
  };
}
