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
  if(/rate limit/i.test(m))return"操作过于频繁，请稍后再试。";
  return m||"操作失败，请稍后重试。";
}
