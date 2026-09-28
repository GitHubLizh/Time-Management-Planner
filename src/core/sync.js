/* 多设备同步的决策规则。零 DOM、零传输依赖：真正的读写由壳注入 transport 实现，
   小程序/App 换成 wx.request 之类的搬运，判定口径仍然只有一份。

   时间戳语义（沿用桌面已验证的口径，几条要一起改，不能只改一条）：
   - state.updatedAt 在"编辑时刻"打，不是在"推送时刻"打：旧页面推送时时间戳更旧，会被远端挡住。
   - 推送前先读远端：远端更新则放弃本次覆盖并采纳远端，避免两台设备互相盖。
   - 拉取只在远端严格更大时落地。 */

/* 远端行里的时间戳；读失败或没有行都按 0（即"远端没有更新的东西"） */
export function remoteUpdatedAt(data,error){
  return error?0:+((data&&data.state&&data.state.updatedAt)||0);
}
/* 本地时间戳；<=0 视为"从未编辑过" */
export function localUpdatedAt(state){
  return +(state&&state.updatedAt)||0;
}
/* 从未编辑过时补一个推送时刻，返回生效的时间戳 */
export function ensureUpdatedAt(state,now){
  if(!(localUpdatedAt(state)>0))state.updatedAt=now;
  return state.updatedAt;
}
/* 推送决策：adopt-remote 表示本次不写，改为采纳远端 */
export function decidePush(state,remoteAt){
  return remoteAt>localUpdatedAt(state)?{action:"adopt-remote"}:{action:"push"};
}
/* 拉取决策：只有远端严格更新才覆盖本地 */
export function decidePull(state,remoteAt){
  return remoteAt>localUpdatedAt(state);
}
/* 上行载荷：深拷贝，避免序列化期间本地又被改动 */
export function buildPushPayload(userId,state){
  return {user_id:userId,state:JSON.parse(JSON.stringify(state))};
}
