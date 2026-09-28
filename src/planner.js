"use strict";
import { pinyin } from "pinyin-pro";
import { Solar } from "lunar-javascript";

/* ================= 常量与图标 ================= */
const TYPES=["生活居家","饮食健康","运动健身","形象管理","心灵成长","工作项目","财务管理","学习成长","签到奖励"];
const TYPE_COLORS=["#c98a5b","#7fa35a","#5a9a8f","#b58bb5","#8f86c9","#5b84c4","#c4a24a","#4a86c8","#c96f7a"];
const PRIO_NAMES={1:"P1 重要紧急",2:"P2 重要不紧急",3:"P3 紧急不重要",4:"P4 不紧急不重要"};
const STATUS_NAMES={todo:"未开始",doing:"进行中",done:"已完成"};
const RECUR_RULES={daily:"每天重复",workday:"每个法定工作日（周一至周五，扣除节假日·含调休补班）",weekly:"每周固定几天",monthly:"每月固定一天"};
const DOW_NAMES=["周日","周一","周二","周三","周四","周五","周六"];
/* 法定工作日判定数据：口径为国务院办公厅放假安排（off=放假日，makeup=调休补班的周末，均为 MM-DD）。
   内置 2025/2026 作离线兜底；运行时从 holiday-cn 镜像（逐条解析国务院通知、公布后自动更新）同步当年与次年。
   HOLIDAY_SRC 记录每年口径来源：builtin=内置 / live=已同步官方源；两者皆无的年份退回普通周一至周五并在界面如实标注。 */
const CN_HOLIDAY_BUILTIN={
  "2025":{off:["01-01","01-28","01-29","01-30","01-31","02-01","02-02","02-03","02-04","04-04","04-05","04-06","05-01","05-02","05-03","05-04","05-05","05-31","06-01","06-02","10-01","10-02","10-03","10-04","10-05","10-06","10-07","10-08"],
          makeup:["01-26","02-08","04-27","09-28","10-11"],
          names:[["01-01","01-01","元旦"],["01-28","02-04","春节"],["04-04","04-06","清明节"],["05-01","05-05","劳动节"],["05-31","06-02","端午节"],["10-01","10-08","国庆节、中秋节"]]},
  "2026":{off:["01-01","01-02","01-03","02-15","02-16","02-17","02-18","02-19","02-20","02-21","02-22","02-23","04-04","04-05","04-06","05-01","05-02","05-03","05-04","05-05","06-19","06-20","06-21","09-25","09-26","09-27","10-01","10-02","10-03","10-04","10-05","10-06","10-07"],
          makeup:["01-04","02-14","02-28","05-09","09-20","10-10"],
          names:[["01-01","01-03","元旦"],["02-15","02-23","春节"],["04-04","04-06","清明节"],["05-01","05-05","劳动节"],["06-19","06-21","端午节"],["09-25","09-27","中秋节"],["10-01","10-07","国庆节"]]}
};
const CN_HOLIDAY={};
const HOLIDAY_SRC={};
function buildHolidayYear(y,offMMDD,makeupMMDD,nameRanges){
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
const GOAL_LEVELS=[["weekly","周"],["monthly","月"],["yearly","年"]];
const VIEWS=[["schedule","课表"],["day","日"],["week","周"],["month","月历"],["mprogress","月进度"],["year","年"],["kanban","看板"]];
const VIEW_ICONS={
  schedule:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 4v17M15 4v17"/>',
  day:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  week:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>',
  month:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="8" cy="14" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
  mprogress:'<path d="M3 20h18M6 20V10M11 20V4M16 20v-9M21 20v-5"/>',
  year:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  kanban:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="5" height="14" rx="1"/>'
};
function icon(path,cls){return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;}
const I={
  check:icon('<path d="M4 12l5 5L20 6"/>'),
  edit:icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash:icon('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>'),
  plus:icon('<path d="M12 5v14M5 12h14"/>'),
  copy:icon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  flag:icon('<path d="M5 21V4M5 4c4-2 8 2 14 0v9c-6 2-10-2-14 0"/>'),
  chart:icon('<path d="M3 20h18M7 20v-7M12 20V6M17 20v-10"/>'),
  target:icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  book:icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M20 17v5H6.5a2.5 2.5 0 0 1 0-5"/>'),
  clock:icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  pin:icon('<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  user:icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'),
  list:icon('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  refresh:icon('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>'),
  recur:icon('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  chev:icon('<path d="M9 6l6 6-6 6"/>')
};

/* ================= 日期工具 ================= */
function pad(n){return String(n).padStart(2,"0");}
function fmt(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function parseD(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function mondayOf(d){const x=new Date(d);const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);x.setHours(0,0,0,0);return x;}
const TODAY=new Date();TODAY.setHours(0,0,0,0);
/* TODAY 会被 rollDate() 就地推进，使页面跨零点后逾期判定与"今日"高亮自愈 */
function rollDate(){
  const now=new Date();now.setHours(0,0,0,0);
  if(+now===+TODAY)return false;
  if(document.body.classList.contains("dragging-task"))return false; // 拖拽中不重建 DOM，留给下一秒重试
  const prev=fmt(TODAY);
  TODAY.setTime(+now);
  if(state.selDate===prev)state.selDate=fmt(TODAY); // 未手动选过日期时跟着走一天
  save();renderAll();
  return true;
}

let _id=1;
function mk(o){return Object.assign({title:"",type:"学习成长",priority:2,status:"todo",start:fmt(TODAY),end:fmt(TODAY),progress:0,plannedTime:60,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"",note:"",doneAt:"",recur:null,doneOn:{}},o,{id:"t"+(_id++)});} // id 放最后：复制时传入整条任务也不能沿用源 id

/* ================= 状态管理 ================= */
const CACHE_PREFIX="journalPlanner.v3.";
let _gid=1;
let state;
let supabaseClient=null;
let supabaseConfig=null;
let currentUser=null;
let syncTimer=null;
let activationId=0;
let dirty=false;        // 本地有未推送到云端的改动
let pullBusy=false;
let accessToken=null;   // 供 beforeunload 的 keepalive 请求同步取用
function newGoalId(){return "g"+(_gid++);}
function defaultState(){
  return {tasks:[],goals:{weekly:[],monthly:[],yearly:[],reviews:[]},view:"day",theme:"e",
    filters:{keyword:"",year:"",month:"",prio:"",status:"",type:"",slot:""},
    selDate:fmt(TODAY),kanbanMode:"status",kanbanDragHintSeen:false,onlyOverdue:false,onlyLate:false};
}
function readState(key){
  try{const raw=localStorage.getItem(key);if(raw){const s=JSON.parse(raw);if(s&&Array.isArray(s.tasks))return s;}}catch(e){}
  return null;
}
function cacheKey(userId){return CACHE_PREFIX+userId;}
function writeCache(){
  if(!currentUser)return;
  localStorage.setItem(cacheKey(currentUser.id),JSON.stringify(state));
}
function save(){
  state.updatedAt=Date.now(); // 编辑时刻而非推送时刻：旧页面推送时时间戳更旧，会被远端挡住
  dirty=true;
  writeCache();
  if(!currentUser||!supabaseClient)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{saveRemote();},500);
}
async function fetchRemoteRow(user){
  return await supabaseClient.from("planner_states").select("state").eq("user_id",user.id).maybeSingle();
}
async function saveRemote(){
  if(!currentUser||!supabaseClient)return false;
  const user=currentUser;
  if(!(state.updatedAt>0))state.updatedAt=Date.now();
  const {data,error}=await fetchRemoteRow(user);
  if(user!==currentUser)return false;
  const remoteAt=error?0:+((data&&data.state&&data.state.updatedAt)||0);
  if(remoteAt>(state.updatedAt||0)){applyRemoteState(data.state);return false;} // 云端比本地新：以远端为准，放弃本次覆盖
  const row={user_id:user.id,state:JSON.parse(JSON.stringify(state))};
  const {error:upError}=await supabaseClient.from("planner_states").upsert(row,{onConflict:"user_id"});
  if(user!==currentUser)return false;
  if(upError){setAuthMessage("云端保存失败，请检查网络后重试。");return false;}
  dirty=false;
  return true;
}
function applyRemoteState(s){
  setState(s);writeCache();dirty=false;
  if(document.body.classList.contains("auth-locked"))return;
  renderAll();
}
function pullRemote(){
  if(!currentUser||!supabaseClient||pullBusy||dirty)return;
  if(isModalOpen()||bulkMode||document.body.classList.contains("dragging-task"))return; // 编辑/拖拽/批量选中进行中不打断，留给下一轮
  pullBusy=true;
  const user=currentUser;
  fetchRemoteRow(user).then(({data,error})=>{
    if(error||user!==currentUser||!data||!data.state)return;
    if(+(data.state.updatedAt||0)>(state.updatedAt||0))applyRemoteState(data.state);
  }).finally(()=>{pullBusy=false;});
}
function flushRemoteSync(){
  if(!dirty||!currentUser||!supabaseConfig||!accessToken)return;
  clearTimeout(syncTimer);
  if(!(state.updatedAt>0))state.updatedAt=Date.now();
  try{ // 常规 fetch 在页面卸载时会被浏览器取消，keepalive 请求能保证送达（请求体上限 64KB）
    fetch(supabaseConfig.url+"/rest/v1/planner_states?on_conflict=user_id",{
      method:"POST",
      headers:{apikey:supabaseConfig.anonKey,Authorization:"Bearer "+accessToken,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return:minimal"},
      body:JSON.stringify([{user_id:currentUser.id,state:JSON.parse(JSON.stringify(state))}]),
      keepalive:true
    });
    dirty=false;
  }catch(e){}
}
function normalize(s){
  const g=s.goals||{};
  const up=arr=>(Array.isArray(arr)?arr:[]).map(x=>typeof x==="string"?{id:newGoalId(),title:x}:(x&&x.id?x:{id:newGoalId(),title:String(x??"")}));
  s.goals={weekly:up(g.weekly),monthly:up(g.monthly),yearly:up(g.yearly),reviews:Array.isArray(g.reviews)?g.reviews:[]};
  s.tasks.forEach(t=>{
    if(typeof t.goalId!=="string")t.goalId="";
    if(typeof t.doneAt!=="string")t.doneAt="";
    if(t.course)t.doneAt="";
    if(!RECUR_RULES[t.recur&&t.recur.freq])t.recur=null;
    else{
      if(!Array.isArray(t.recur.days))t.recur.days=[];
      t.recur.days=[...new Set(t.recur.days.map(Number).filter(d=>d>=0&&d<=6))].sort((a,b)=>a-b);
      t.recur.mday=Math.min(31,Math.max(1,+t.recur.mday||1));
      if(t.recur.freq==="weekly"&&!t.recur.days.length)t.recur.days=[parseD(t.start).getDay()];
    }
    if(typeof t.doneOn!=="object"||!t.doneOn)t.doneOn={};
    if(t.fixed){
      if(!t.course){
        t.recur={freq:"daily",days:[],mday:1};
        if(t.status==="done"){const d=t.doneAt||t.end;t.doneOn={[d]:d};}
      }
      delete t.fixed;
    }
    if(!t.recur)t.doneOn={};
  });
  return s;
}
function setState(value){
  const base=defaultState();
  const source=value&&Array.isArray(value.tasks)?value:{};
  state=normalize({...base,...source,filters:{...base.filters,...(source.filters||{})},goals:source.goals||base.goals});
  _id=maxSuffix(state.tasks,"id")+1;
  _gid=maxSuffix(state.goals.weekly.concat(state.goals.monthly,state.goals.yearly),"id")+1;
}
function maxSuffix(list,key){return list.reduce((m,x)=>Math.max(m,parseInt(String(x[key]??"").replace(/\D/g,""),10)||0),0);}
try{localStorage.removeItem("journalPlanner.v1");}catch(e){}
setState(defaultState());

/* ================= 工具 ================= */
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

let authMode="login";
let authEventsBound=false;
let dateWatcherStarted=false;
function setAuthMessage(message){const el=$("#authMessage");if(el)el.textContent=message||"";}
const AUTH_ERR_ZH={
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
function authErrorMessage(err){
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
function setAuthMode(mode){
  authMode=mode;
  const isLogin=mode==="login";
  const isLink=mode==="link";
  const _d=new Date();
  $("#authStampDate").textContent=(_d.getMonth()+1)+"月"+_d.getDate()+"日";
  $("#authTitle").textContent=isLink?"邮箱链接登录":isLogin?"登录时间管理台":"注册时间管理台";
  $("#authDescription").textContent=isLink
    ?"无需密码，向你的邮箱发送一封登录邮件，点击其中链接即可登录。新邮箱会自动创建账户。"
    :isLogin?"登录后可在不同设备间安全同步你的日程与目标。":"注册后可将本机日程安全同步到你的账户。";
  $("#authPasswordRow").hidden=isLink;
  $("#authPassword").required=!isLink;
  $("#authSubmit").textContent=isLink?"发送登录链接":isLogin?"登录":"注册";
  $("#authSubmit").disabled=false;
  $("#authMode").textContent=isLink?"返回密码登录":isLogin?"没有账号？注册":"已有账号？登录";
  $("#authOtp").hidden=isLink;
  if(!isLink)$("#authPassword").autocomplete=isLogin?"current-password":"new-password";
  setAuthMessage("");
}
function showAuthScreen(message){
  document.body.classList.add("auth-locked");
  $("#authUser").hidden=true;
  setAuthMode("login");
  setAuthMessage(message);
}
function showPlanner(user){
  $("#authUserEmail").textContent=user.email||"已登录";
  $("#authUser").hidden=false;
  document.body.classList.remove("auth-locked");
}
function bindAuthEvents(){
  if(authEventsBound)return;
  authEventsBound=true;
  $("#authMode").addEventListener("click",()=>setAuthMode(authMode==="login"?"signup":"login"));
  $("#authOtp").addEventListener("click",()=>setAuthMode("link"));
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("#authEmail").value.trim();
    if(!supabaseClient)return;
    if(authMode==="link"){
      $("#authSubmit").disabled=true;
      setAuthMessage("正在发送登录链接…");
      const {error}=await supabaseClient.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});
      if(error){$("#authSubmit").disabled=false;setAuthMessage(authErrorMessage(error));return;}
      setAuthMessage("登录链接已发送，请到邮箱点击邮件中的链接完成登录（可能在垃圾邮件里）。");
      // 发送冷却：Supabase 对同一邮箱有发信频率限制，连点会触发 rate limit
      let left=60;
      $("#authSubmit").textContent=`重新发送(${left})`;
      const timer=setInterval(()=>{
        left--;
        if(left<=0||authMode!=="link"){clearInterval(timer);if(authMode==="link"){$("#authSubmit").textContent="发送登录链接";$("#authSubmit").disabled=false;}return;}
        $("#authSubmit").textContent=`重新发送(${left})`;
      },1000);
      return;
    }
    const password=$("#authPassword").value;
    $("#authSubmit").disabled=true;
    setAuthMessage(authMode==="login"?"正在登录…":"正在注册…");
    const result=authMode==="login"
      ?await supabaseClient.auth.signInWithPassword({email,password})
      :await supabaseClient.auth.signUp({email,password});
    $("#authSubmit").disabled=false;
    if(result.error){setAuthMessage(authErrorMessage(result.error));return;}
    if(authMode==="signup"&&!result.data.session)setAuthMessage("注册成功，请查收确认邮件后再登录。");
  });
  $("#signOut").addEventListener("click",async()=>{
    if(!supabaseClient)return;
    const {error}=await supabaseClient.auth.signOut();
    if(error)setAuthMessage(authErrorMessage(error));
  });
  const oauthButtons={"#authOAuthGoogle":"google","#authOAuthGithub":"github"};
  Object.keys(oauthButtons).forEach(sel=>{
    const btn=$(sel);
    if(!btn)return;
    btn.addEventListener("click",()=>signInWithOAuth(oauthButtons[sel]));
  });
}
async function signInWithOAuth(provider){
  if(!supabaseClient)return;
  setAuthMessage("正在跳转到第三方登录…");
  const {error}=await supabaseClient.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin}});
  if(error)setAuthMessage(authErrorMessage(error));
}
async function activateSession(user){
  const request=++activationId;
  currentUser=user;
  const {data: sessData}=await supabaseClient.auth.getSession();
  accessToken=sessData&&sessData.session&&sessData.session.access_token||null;
  const {data,error}=await fetchRemoteRow(user);
  if(request!==activationId||currentUser!==user)return;
  if(error){currentUser=null;showAuthScreen("无法读取云端数据，请稍后重试。");return;}
  const nextState=data&&data.state||readState(cacheKey(user.id));
  setState(nextState||defaultState());
  writeCache();
  dirty=!data; // 云端还没有这一行：把本机缓存（或空白状态）迁移上去；已有云端数据则不再回写，避免旧缓存覆盖
  initializePlanner();
  showPlanner(user);
  if(dirty)await saveRemote();
}
async function bootstrapPlanner(client,config){
  supabaseClient=client;
  supabaseConfig=config||null;
  bindAuthEvents();
  window.addEventListener("beforeunload",flushRemoteSync);
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){showAuthScreen(authErrorMessage(error));return;}
  if(data.session&&data.session.user)await activateSession(data.session.user);
  else showAuthScreen();
  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    accessToken=session&&session.access_token||null;
    if(session&&session.user){if(!currentUser||currentUser.id!==session.user.id)activateSession(session.user);}
    else if(!session){currentUser=null;accessToken=null;dirty=false;showAuthScreen();}
  });
}
function taskById(id){return state.tasks.find(t=>t.id===id);}
function slotOf(t){
  if(t.course&&t.timeSlot){const h=parseInt(t.timeSlot.split(":")[0],10);if(h<12)return"morning";if(h<18)return"afternoon";return"evening";}
  return"";
}
function titleMatchesKeyword(title,keyword){
  const text=String(title||"").toLowerCase();
  if(text.includes(keyword))return true;
  if(!/^[a-z0-9]+$/.test(keyword))return false;
  const initials=pinyin(text,{pattern:"first",toneType:"none",separator:""}).replace(/\s+/g,"");
  return initials.includes(keyword);
}
function filteredTasks(){
  const f=state.filters;
  const keyword=f.keyword.trim().toLowerCase();
  return state.tasks.filter(t=>{
    if(keyword&&!titleMatchesKeyword(t.title,keyword))return false;
    if(state.onlyOverdue&&!isOverdue(t))return false;
    if(state.onlyLate&&!isLateDone(t))return false;
    if(f.type&&t.type!==f.type)return false;
    if(f.prio&&String(t.priority)!==f.prio)return false;
    if(f.status&&t.status!==f.status)return false;
    if(f.year){const y=(t.start||"").slice(0,4);if(y!==f.year)return false;}
    if(f.month){const m=(t.start||"").slice(5,7);if(m!==f.month)return false;}
    if(f.slot){if(slotOf(t)!==f.slot)return false;}
    return true;
  });
}
function tasksOn(dateStr,pool){
  return (pool||state.tasks).filter(t=>{
    if(t.recur)return occursOn(t,dateStr);
    if(t.course&&t.dow!==null&&t.dow!==undefined){
      return parseD(dateStr).getDay()===t.dow && t.start<=dateStr;
    }
    return t.start<=dateStr&&t.end>=dateStr;
  });
}
/* ---------- 循环任务：库里只存一条定义，渲染时按规则现展开成当天实例。
   实例不是数据，id 用「定义id@日期」拼出来，打卡记录写回定义的 doneOn。
   start/end 复用为循环起止窗口（含首尾） ---------- */
/* 法规意义上的工作日：调休补班的周末算工作日；法定节假日不算；其余按周一至周五。
   年份未收录 CN_HOLIDAY 时，退回普通周一至周五判定。 */
function isLegalWorkday(ds){
  const w=parseD(ds).getDay(),h=CN_HOLIDAY[ds.slice(0,4)];
  if(!h)return w>=1&&w<=5;
  if(h.makeup.has(ds))return true;
  if(h.off.has(ds))return false;
  return w>=1&&w<=5;
}
/* 把 holiday-cn 年度 JSON（days:[{date,isOffDay,name}]）灌入判定表；isOffDay=true 为放假，false 为补班。
   只接受日期前缀与年份一致的条目，脏数据直接丢弃；无任何有效条目时保留内置数据不覆盖。 */
function applyHolidayYear(y,data){
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
/* 日历日格排版：数字左上悬浮字标 休(红)/班(蓝)/末(玫瑰灰)，数字下方信息行（见 dayInfoBadge）。
   末=普通周末，不依赖节假日数据；休/班需该年有数据，无数据年份不假装有数据。 */
function dayMarkBadge(ds){
  const h=CN_HOLIDAY[ds.slice(0,4)];
  if(h){
    if(h.off.has(ds))return '<i class="dmark off">休</i>';
    if(h.makeup.has(ds))return '<i class="dmark work">班</i>';
  }
  const w=parseD(ds).getDay();
  return (w===0||w===6)?'<i class="dmark wkend">末</i>':"";
}
/* 格子底色：放假/周末淡粉、补班淡灰；today 橙底优先级在 CSS 里用 :not(.today) 保住 */
function dayTint(ds){
  const h=CN_HOLIDAY[ds.slice(0,4)];
  if(h){if(h.off.has(ds))return " off";if(h.makeup.has(ds))return " mk";}
  const w=parseD(ds).getDay();return (w===0||w===6)?" wkend":"";
}
/* 信息行优先级：法定假期名（红，仅假期首日）> 节气（绿）> 节日/纪念日（红）> 农历初一显月名（绿）> 农历日（灰）。
   农历/节气/农历传统节日来自 lunar-javascript 库；公历节日用下方精选表——刻意不用库的公历节日表（含 全民国防教育日 等窄口径节日，与参考万年历不一致）。 */
const SOLAR_FESTIVALS={"01-01":"元旦","03-08":"妇女节","03-12":"植树节","05-01":"劳动节","05-04":"青年节","06-01":"儿童节","07-01":"建党节","08-01":"建军节","09-10":"教师节","09-18":"国耻日","10-01":"国庆节","12-13":"国家公祭日"};
const _lunarCache=new Map();
function lunarOf(ds){
  let v=_lunarCache.get(ds);
  if(!v){const s=Solar.fromYmd(+ds.slice(0,4),+ds.slice(5,7),+ds.slice(8,10)),l=s.getLunar();
    v={day:l.getDay(),monthName:l.getMonthInChinese(),jieqi:l.getJieQi(),dayCh:l.getDayInChinese(),fest:l.getFestivals()};
    _lunarCache.set(ds,v);}
  return v;
}
function dayInfoBadge(ds){
  const h=CN_HOLIDAY[ds.slice(0,4)];
  if(h&&h.off.has(ds)){const n=h.names[ds],p=fmt(addDays(parseD(ds),-1));if(n&&!(h.off.has(p)&&h.names[p]===n))return `<i class="dname n-hol">${esc(n)}</i>`;} // 仅假期首日显名
  const l=lunarOf(ds);
  if(l.jieqi)return `<i class="dname n-term">${esc(l.jieqi)}</i>`;
  const mem=SOLAR_FESTIVALS[ds.slice(5)]||l.fest[0];
  if(mem)return `<i class="dname n-hol">${esc(mem)}</i>`;
  if(l.day===1)return `<i class="dname n-term">${esc(l.monthName)}月</i>`;
  return `<i class="dname">${esc(l.dayCh)}</i>`;
}
const HOLIDAY_MIRROR="https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/";
async function refreshHolidayYear(y){
  try{
    const res=await fetch(HOLIDAY_MIRROR+y+".json",{cache:"no-store"});
    if(!res.ok)return false;
    const data=await res.json();
    if(!data||String(data.year)!==String(y))return false; // 校验年份，防止镜像返回错位数据
    return applyHolidayYear(y,data);
  }catch(e){return false;} // 拉取失败：静默保留内置数据
}
async function initHolidays(){
  if(typeof fetch!=="function")return; // 测试桩环境无 fetch，跳过
  const y=+fmt(TODAY).slice(0,4);
  const rs=await Promise.all([refreshHolidayYear(y),refreshHolidayYear(y+1)]);
  if(rs.some(Boolean)&&typeof renderAll==="function")renderAll(); // 同步成功时刷新界面，让来源标注即时生效
}
function occursOn(t,ds){
  const r=t.recur;if(!r)return false;
  if(ds<t.start||ds>t.end)return false;
  const d=parseD(ds);
  if(r.freq==="weekly")return r.days.indexOf(d.getDay())>=0;
  if(r.freq==="monthly")return d.getDate()===Math.min(r.mday,new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
  if(r.freq==="workday")return isLegalWorkday(ds); // 法定工作日（扣除节假日·含调休补班）
  return true; // daily
}
function recurText(t){
  const r=t.recur;if(!r)return"";
  if(r.freq==="weekly")return "每"+(r.days.length?r.days.map(d=>DOW_NAMES[d].slice(1)).join("、"):"—");
  if(r.freq==="monthly")return "每月 "+r.mday+" 号";
  if(r.freq==="workday")return "法定工作日";
  return "每天";
}
function nextOccurrence(t,fromStr){
  let d=parseD(fromStr<t.start?t.start:fromStr);
  for(let i=0;i<400;i++){
    const ds=fmt(d);
    if(ds>t.end)return"";
    if(occursOn(t,ds))return ds;
    d=addDays(d,1);
  }
  return"";
}
function prevOccurrence(t,beforeStr){ // 严格早于 beforeStr 的最近一次发生
  let d=addDays(parseD(beforeStr),-1);
  for(let i=0;i<400;i++){
    const ds=fmt(d);
    if(ds<t.start)return"";
    if(occursOn(t,ds))return ds;
    d=addDays(d,-1);
  }
  return"";
}
function occurrencesBetween(t,fromStr,toStr){
  const out=[];
  for(let ds=nextOccurrence(t,fromStr);ds&&ds<=toStr;ds=nextOccurrence(t,fmt(addDays(parseD(ds),1))))out.push(ds);
  return out;
}
function occDone(t,ds){return !!(t&&t.recur&&t.doneOn&&t.doneOn[ds]);}
function toggleOcc(t,ds){if(occDone(t,ds))delete t.doneOn[ds];else t.doneOn[ds]=fmt(TODAY);}
function recurDoneIn(t,from,to){const l=occurrencesBetween(t,from,to);return {done:l.filter(ds=>occDone(t,ds)).length,total:l.length};}
function recurStreak(t){ // 连续打卡次数：从今天（今天已打卡）或上一个发生日起，往前数连续有记录的次数
  if(!t.recur)return 0;
  const today=fmt(TODAY);
  let ds=occDone(t,today)?today:prevOccurrence(t,today);
  let n=0;
  while(ds&&ds>=t.start&&occDone(t,ds)){n++;ds=prevOccurrence(t,ds);}
  return n;
}
function monthRange(ds){const d=parseD(ds),ms=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;return [ms+"-01",ms+"-"+pad(new Date(d.getFullYear(),d.getMonth()+1,0).getDate())];}
function splitId(id){ // 实例 id → 定义 + 日期；定义 id 原样返回
  const s=String(id),i=s.lastIndexOf("@");
  return i<0?{task:taskById(s),date:""}:{task:taskById(s.slice(0,i)),date:s.slice(i+1)};
}
/* 统计口径：循环任务不进完成率、逾期、迟完与看板，只在日/周/月历按实例呈现 */
function statsPool(list){return list.filter(t=>!t.recur);}
/* ---------- 逾期判定：截止日期已过且未标记完成（课程与循环任务按周期计，不参与） ---------- */
function isOverdue(t){return !t.course&&!t.recur&&t.status!=="done"&&!!t.end&&t.end<fmt(TODAY);}
function overdueDays(t){return Math.round((TODAY-parseD(t.end))/86400000);}
function overdueList(pool){return (pool||state.tasks).filter(isOverdue);}
function overdueBadge(t,compact){
  const d=overdueDays(t);
  return `<span class="badge-overdue" title="截止 ${esc(t.end)} 未完成，已逾期 ${d} 天">${I.flag}${compact?"逾期"+d+"天":"逾期 "+d+" 天"}</span>`;
}
/* ---------- 迟完留痕：完成时刻晚于截止日期。doneAt 只由 syncDoneAt 写，课程与循环任务被清空故不参与 ---------- */
function syncDoneAt(t){t.doneAt=(t.status==="done"&&!t.course&&!t.recur)?(t.doneAt||fmt(TODAY)):"";}
function isLateDone(t){return !t.recur&&t.status==="done"&&!!t.doneAt&&t.doneAt>t.end;}
function lateDays(t){return Math.round((parseD(t.doneAt)-parseD(t.end))/86400000);}
function lateList(pool){return (pool||state.tasks).filter(isLateDone);}
function lateBadge(t){
  const d=lateDays(t);
  return `<span class="badge-late" title="截止 ${esc(t.end)} · 实际 ${esc(t.doneAt)} 完成 · 迟 ${d} 天">${I.flag}迟 ${d} 天完成</span>`;
}
/* ---------- 循环条目的呈现：徽标 + 本月次数（数字全部来自 doneOn 与循环窗口，可点开 title 核对） ---------- */
function recurBadge(t){
  return `<span class="badge-recur" title="循环任务：${esc(recurText(t))} · 循环窗口 ${esc(t.start)} ~ ${esc(t.end)} · 每次完成单独记录，不计入完成率与逾期">${I.recur}${esc(recurText(t))}</span>`;
}
function recurStatHTML(t,ds){
  const [ms,me]=monthRange(ds),p=recurDoneIn(t,ms,me),st=recurStreak(t);
  const inMonth=occurrencesBetween({recur:t.recur,start:ms,end:me,doneOn:{}},ms,me).length; // 整月按规则有多少天，与循环窗口无关
  const tip=`${ms.slice(0,7)} 按「${recurText(t)}」共 ${inMonth} 天`
    +(inMonth!==p.total?`，落在循环窗口 ${t.start}~${t.end} 内的 ${p.total} 天`:"")
    +` · 已打卡 ${p.done} 次 · 连续 ${st} 次 = 从今天或上一个发生日往前数，连续留有打卡记录的次数`;
  return `<div class="recur-stat" title="${esc(tip)}">本月 <b>${p.done}/${p.total}</b> 次${st?` · <span class="streak">连续 ${st} 次</span>`:""}</div>`;
}
function statsOf(list){
  const s={total:list.length,done:0,doing:0,todo:0,q:{1:0,2:0,3:0,4:0},types:{}};
  list.forEach(t=>{s[t.status]++;s.q[t.priority]++;s.types[t.type]=(s.types[t.type]||0)+1;});
  s.rate=s.total?Math.round(s.done/s.total*100):0;
  return s;
}
function fmtDur(min){return min>=60?Math.round(min/6)/10+"h":min+"′";}
function quadrantOf(p){return p;}

/* ================= 顶部：主题 / 导航 / 筛选 ================= */
function applyTheme(){
  document.body.className="theme-"+state.theme;
  $$("#themeToggle button").forEach(b=>b.classList.toggle("active",b.dataset.theme===state.theme));
}
$("#themeToggle").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  state.theme=b.dataset.theme;save();applyTheme();
});
function buildNav(){
  $("#viewNav").innerHTML=VIEWS.map(([k,n])=>
    `<button data-view="${k}" class="${state.view===k?'active':''}">${icon(VIEW_ICONS[k])}${n}</button>`).join("");
}
$("#viewNav").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  exitBulk();state.view=b.dataset.view;save();renderAll();
});
function buildFilters(){
  const years=[...new Set(state.tasks.map(t=>(t.start||"").slice(0,4)))].sort();
  $("#fYear").innerHTML='<option value="">全部年份</option>'+years.map(y=>`<option value="${y}">${y} 年</option>`).join("");
  $("#fMonth").innerHTML='<option value="">全部月份</option>'+Array.from({length:12},(_,i)=>`<option value="${pad(i+1)}">${i+1} 月</option>`).join("");
  $("#fType").innerHTML='<option value="">全部类型</option>'+TYPES.map(t=>`<option>${t}</option>`).join("");
  const f=state.filters;
  $("#fKeyword").value=f.keyword;
  $("#fYear").value=f.year;$("#fMonth").value=f.month;$("#fPrio").value=f.prio;
  $("#fStatus").value=f.status;$("#fType").value=f.type;$("#fSlot").value=f.slot;
}
function searchTasks(e){
  if(e.isComposing)return;
  const keyword=$("#fKeyword").value;
  if(state.filters.keyword===keyword)return;
  state.filters.keyword=keyword;
  save();renderAll();
}
$("#fKeyword").addEventListener("input",searchTasks);
$("#fKeyword").addEventListener("compositionend",searchTasks);
$("#filterBar").addEventListener("change",e=>{
  if(!e.target.matches("select"))return;
  state.filters={keyword:state.filters.keyword,year:$("#fYear").value,month:$("#fMonth").value,prio:$("#fPrio").value,
    status:$("#fStatus").value,type:$("#fType").value,slot:$("#fSlot").value};
  save();renderAll();
});
$("#fReset").addEventListener("click",()=>{
  state.filters=defaultState().filters;
  state.onlyOverdue=false;
  state.onlyLate=false;
  save();buildFilters();renderAll();
});
function renderBanner(){
  const list=filteredTasks();
  const n=list.length;
  const rc=list.filter(t=>t.recur).length;
  const f=state.filters;const parts=[];
  if(f.keyword.trim())parts.push('标题匹配「'+f.keyword.trim()+'」');
  if(f.year)parts.push(f.year+" 年");if(f.month)parts.push(parseInt(f.month)+" 月");
  if(f.prio)parts.push(PRIO_NAMES[f.prio]);if(f.status)parts.push(STATUS_NAMES[f.status]);
  if(f.type)parts.push(f.type);if(f.slot)parts.push({morning:"早晨",afternoon:"下午",evening:"晚间"}[f.slot]);
  if(state.onlyOverdue)parts.push("仅逾期未完成");
  if(state.onlyLate)parts.push("仅迟完");
  const od=overdueList(state.tasks);
  const longest=od.length?Math.max(...od.map(overdueDays)):0;
  const late=lateList(state.tasks);
  const tail=`<span class="banner-tail">`+
    (od.length
      ? `<button class="overdue-chip ${state.onlyOverdue?'on':''}" data-overdue="1" title="全库逾期未完成 ${od.length} 项，最久已 ${longest} 天（此计数不受其他筛选影响）· 点击只在看板显示这些任务，再点取消">${I.flag}逾期 ${od.length} 项 · 最久 ${longest} 天</button>`
      : `<span class="overdue-chip clear" title="全库没有逾期未完成的任务">${I.check}无逾期</span>`)+
    (late.length
      ? `<button class="late-chip ${state.onlyLate?'on':''}" data-late="1" title="全库迟完 ${late.length} 项（完成日晚于截止日，最迟 ${Math.max(...late.map(lateDays))} 天）· 此计数不受其他筛选影响 · 点击只在看板显示这些任务，再点取消">${I.clock}迟完 ${late.length} 项</button>`
      : `<span class="late-chip clear" title="全库没有迟完记录（旧数据未记完成日的不在其中）">${I.check}无迟完</span>`)+
    `</span>`;
  $("#banner").innerHTML=icon('<path d="M4 5h16M7 12h10M10 19h4"/>')+
    `<span class="banner-summary" role="status">当前筛选：${parts.length?esc(parts.join(" · ")):"未应用筛选（显示全部）"} — 共 <b title="按任务定义条数计，与日/周/月历里展开出的循环实例无关">${n}</b> 条结果${rc?`（含 ${rc} 条循环任务，各按 1 条计）`:""}</span>`+tail;
}
$("#banner").addEventListener("click",e=>{
  const od=e.target.closest("[data-overdue]");
  const lt=e.target.closest("[data-late]");
  if(!od&&!lt)return;
  if(od){
    state.onlyOverdue=!state.onlyOverdue;
    if(state.onlyOverdue){state.onlyLate=false;state.view="kanban";}
  }else{
    state.onlyLate=!state.onlyLate;
    if(state.onlyLate){state.onlyOverdue=false;state.view="kanban";}
  }
  save();renderAll();
});

/* ================= 目标：聚合与渲染 ================= */
const expandedGoals=new Set();
function goalsOf(level){return state.goals[level]||[];}
function goalLevel(id){const e=GOAL_LEVELS.find(([k])=>goalsOf(k).some(g=>g.id===id));return e?e[0]:"";}
function goalById(id){const k=goalLevel(id);return k?goalsOf(k).find(g=>g.id===id):null;}
function goalTasks(id){return state.tasks.filter(t=>t.goalId===id);}
function goalTasksOn(id,dates){return goalTasks(id).filter(t=>dates.some(ds=>tasksOn(ds,[t]).length));}
function goalVisibleThisWeek(g,dates){return !goalTasks(g.id).length||goalTasksOn(g.id,dates).length||goalTasks(g.id).some(t=>!t.recur&&t.status!=="done");}
function taskGoal(t){return t&&t.goalId?goalById(t.goalId):null;}
function goalProgress(id,list){
  list=list||goalTasks(id);const plain=statsPool(list); // 循环任务不进进度：它没有单一进度值可平均
  return {total:list.length,plain:plain.length,done:plain.filter(t=>t.status==="done").length,
    pct:plain.length?Math.round(plain.reduce((a,t)=>a+(+t.progress||0),0)/plain.length):0,
    recur:list.length-plain.length};
}
function goalItemHTML(g,level){
  const p=goalProgress(g.id),open=expandedGoals.has(g.id);
  const note=p.total?(p.recur&&!p.plain?`关联 ${p.total} 条循环任务 · 不参与进度`
      :`关联 ${p.total} 条任务 · 已完成 ${p.done} · ${p.pct}%${p.recur?`（另 ${p.recur} 条循环不计入）`:""}`)
    :"拖任务到此处即可关联";
  return `<div class="goal-item ${open?'open':''}" data-gid="${g.id}" data-level="${level}" draggable="true">${I.target}
    <div style="flex:1;min-width:0"><span>${esc(g.title)}</span>
      ${p.plain?`<div class="progress-bar"><i style="width:${p.pct}%"></i></div>`:""}
      <div style="font-size:.7rem;color:var(--muted);margin-top:3px">${note}</div>
    </div>
    <div style="display:flex;gap:4px;flex:0 0 auto">
      <button class="icon-btn gm-toggle" data-gact="fold" data-gid="${g.id}" title="展开 / 收起关联任务">${I.chev}</button>
      <button class="icon-btn" data-gact="edit" data-gid="${g.id}" data-level="${level}" title="编辑目标">${I.edit}</button>
      <button class="icon-btn" data-gact="del" data-gid="${g.id}" title="删除目标">${I.trash}</button>
    </div></div>`;
}
function goalMembersHTML(g){
  if(!expandedGoals.has(g.id))return "";
  const list=goalTasks(g.id);
  return `<div class="goal-members" data-gid="${g.id}">${list.map(t=>`<div class="gm-row" data-gmid="${t.id}" draggable="true" title="点击编辑该任务 · 拖动可排序">
      <span class="prio-dot p${t.priority}" style="margin-top:4px"></span>
      <span class="gm-t ${t.recur?"":t.status==='done'?'done':''}">${esc(t.title)}</span>
      ${t.recur?recurBadge(t):""}
      ${isOverdue(t)?overdueBadge(t,true):""}${isLateDone(t)?lateBadge(t):""}
      ${t.recur?"":`<span class="status-pill st-${t.status}">${STATUS_NAMES[t.status]}</span>`}</div>`).join("")||'<div class="gm-empty">该目标下暂无任务</div>'}</div>`;
}
function goalCardHTML(level,label,extraStyle,dates){
  const list=dates?goalsOf(level).filter(g=>goalVisibleThisWeek(g,dates)):goalsOf(level);
  return `<div class="card" style="${extraStyle||''}"><h3>${I.flag}${label}<button class="btn small ghost" style="margin-left:auto" data-gadd="${level}">${I.plus.replace('class=""','style="width:13px;height:13px"')} 新增</button></h3>
    ${list.map(g=>goalItemHTML(g,level)+goalMembersHTML(g)).join("")||`<div class="goal-empty" data-gadd="${level}" title="新增${label}">${I.target}<span>暂无${label}</span><b>设定第一个目标</b></div>`}</div>`;
}

/* ================= 通用组件 ================= */
function taskItemHTML(t,opts){
  opts=opts||{};
  const ds=opts.occ,inst=!!ds; // inst：这一天的一次循环实例，勾选只作用于当天
  const done=inst?occDone(t,ds):t.status==="done";
  const [ms,me]=inst?monthRange(ds):["",""];
  const mp=inst?recurDoneIn(t,ms,me):null;
  const key=inst?t.id+"@"+ds:t.id; // 与 data-id 同构，批量选中集用它作 key
  return `<div class="task-item ${done?'done':''}" data-id="${key}"${opts.sortable?' draggable="true"':''}>
    ${opts.bulk?`<input type="checkbox" class="bulk-chk" data-act="bulk-check"${bulkSel.has(key)?' checked':''}>`:""}
    <span class="prio-dot p${t.priority}" title="${PRIO_NAMES[t.priority]}"></span>
    <button class="chk" data-act="toggle" title="${inst?(done?"取消今天这一次的打卡":"记录今天这一份已完成，不影响其他日期"):"勾选完成"}">${I.check}</button>
    <div class="t-body">
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-meta">
        <span class="tag">${esc(t.type)}</span>
        ${inst?recurBadge(t):`<span class="status-pill st-${t.status}">${STATUS_NAMES[t.status]}</span>`}
        ${t.course?`<span>${I.pin.replace('class=""','style="width:11px;height:11px;vertical-align:-1px"')} ${esc(t.room)} · ${esc(t.teacher)}</span>`:""}
        ${(()=>{const g=taskGoal(t);return g?`<span class="tag outline" title="归属目标">${I.target.replace('class=""','style="width:10px;height:10px;vertical-align:-1px"')} ${esc(g.title)}</span>`:"";})()}
        ${inst?"":`<span>${t.start}${t.end!==t.start?" ~ "+t.end:""}</span>`}
        ${isOverdue(t)?overdueBadge(t):""}
        ${isLateDone(t)?lateBadge(t):""}
        ${t.course&&t.timeSlot?`<span>${esc(t.timeSlot)}</span>`:""}
        ${opts.showTime&&!inst?`<span>计划 ${t.plannedTime}′ / 实际 ${t.actualTime}′</span>`:""}
      </div>
      ${inst?recurStatHTML(t,ds):""}
      <div class="progress-bar"><i style="width:${inst?(mp.total?Math.round(mp.done/mp.total*100):0):t.progress}%"></i></div>
    </div>
    <div class="t-acts">
      <button class="icon-btn" data-act="edit" title="${inst?"编辑这条循环规则（对所有日期生效）":"编辑"}">${I.edit}</button>
      ${inst?"":`<button class="icon-btn" data-act="copy" title="复制一条相同任务（起止日期照抄，状态/进度/实际耗时归零）">${I.copy}</button>`}
      <button class="icon-btn" data-act="del" title="${inst?"删除整条循环任务（含全部打卡记录）":"删除"}">${I.trash}</button>
    </div>
  </div>`;
}
/* 周 / 月历的紧凑条目。循环任务在这里展开为当天实例，点击打开的仍是那条定义 */
function miniTaskHTML(t,ds,style){
  const inst=!!t.recur,done=inst?occDone(t,ds):t.status==="done";
  const meta=inst?`${esc(recurText(t))} · ${done?"已打卡":"未打卡"}`
    :t.course?`${esc(t.timeSlot)} · ${esc(t.room)}`
    :`${esc(t.type)} · ${STATUS_NAMES[t.status]}`;
  return `<div class="mini-task ${done?'done':''} ${t.course?'course':''} ${inst?'recur':''}" data-id="${inst?t.id+"@"+ds:t.id}" style="${inst?'border-left:3px dashed var(--accent)':style||''}">
    <b>${esc(t.title)}</b><div class="mt-meta" style="color:var(--muted)">${meta}</div>${ds===t.end&&isOverdue(t)?overdueBadge(t,true):""}</div>`;
}
function bindTaskEvents(root){
  root.addEventListener("click",e=>{
    const btn=e.target.closest("[data-act]");if(!btn)return;
    const item=btn.closest("[data-id]");
    const {task:t,date:ds}=splitId(item.dataset.id);if(!t)return; // ds 非空即循环实例
    const act=btn.dataset.act;
    if(act==="bulk-check"){bulkToggleKey(item.dataset.id);return;} // 复选框已被浏览器原生翻转，只同步集合，不重绘
    if(act==="toggle"){
      if(ds)toggleOcc(t,ds);
      else{
        t.status=t.status==="done"?"todo":"done";
        t.progress=t.status==="done"?100:0;
        syncDoneAt(t);
      }
      save();renderAll();
    }else if(act==="edit"){openModal(t.id);}
    else if(act==="copy"){duplicateTask(t);}
    else if(act==="del"){deleteTask(t.id);}
  });
}
/* ---------- 复制任务：内容照抄（含起止日期），状态/进度/完成日/实际耗时归零，紧跟源任务之后 ---------- */
function duplicateTask(src){
  const t=mk(Object.assign({},src,{status:"todo",progress:0,doneAt:"",actualTime:0,doneOn:{}})); // 副本的循环规则照抄，但打卡记录从零开始
  const i=state.tasks.findIndex(x=>x.id===src.id);
  if(i>=0)state.tasks.splice(i+1,0,t);else state.tasks.push(t);
  save();buildFilters();renderAll();
}
/* ---------- 删除撤销：删除立即生效，底部浮条 6 秒内可撤销；期间再删则旧记录作废 ---------- */
let pendingUndo=null,undoTimer=null;
function showUndo(msg,fn){
  clearTimeout(undoTimer);
  pendingUndo=fn;
  $("#undoMsg").textContent=msg;
  $("#undoBar").style.display="flex";
  undoTimer=setTimeout(hideUndo,6000);
}
function hideUndo(){clearTimeout(undoTimer);pendingUndo=null;$("#undoBar").style.display="none";}
$("#undoBtn").addEventListener("click",()=>{const fn=pendingUndo;hideUndo();if(fn)fn();});
function deleteTask(id){
  const t=taskById(id);if(!t)return;
  const i=state.tasks.findIndex(x=>x.id===id);
  const snap=JSON.parse(JSON.stringify(t));
  const n=Object.keys(snap.doneOn||{}).length;
  state.tasks=state.tasks.filter(x=>x.id!==id);save();renderAll();
  showUndo(`已删除任务「${snap.title}」${snap.recur&&n?`（含 ${n} 条打卡记录）`:""}`,()=>{
    state.tasks.splice(Math.min(i,state.tasks.length),0,snap);save();renderAll();
  });
}
/* ---------- 批量选择：仅日视图三张列表。bulkMode/bulkSel 是临时态，不进 state、不持久化 ---------- */
let bulkMode=false,bulkSel=new Set();
function bulkKeys(){return $$("#view-day #dayNormal [data-id],#view-day #dayCourses [data-id],#view-day #dayRecur [data-id]").map(el=>el.dataset.id);}
function setBulkMode(on){
  if(bulkMode===on)return;
  bulkMode=on;bulkSel.clear();
  $("#bulkBar").style.display=on?"flex":"none";
  renderAll(); // #view-day 上的 .bulk-mode 类由 renderDay 维护
}
function exitBulk(){if(bulkMode)setBulkMode(false);}
function bulkToggleKey(key){
  if(bulkSel.has(key))bulkSel.delete(key);else bulkSel.add(key);
  updateBulkBar();
}
function bulkSelectAll(on){
  bulkSel.clear();
  if(on)bulkKeys().forEach(k=>bulkSel.add(k));
  renderAll(); // 重绘三张列表以同步各复选框的 checked 态
}
function updateBulkBar(){
  $("#bulkCount").textContent=`已选 ${bulkSel.size} 条`;
  const keys=bulkKeys(),all=$("#bulkAll");
  all.checked=keys.length>0&&bulkSel.size>=keys.length;
  $("#bulkDone").disabled=$("#bulkDel").disabled=bulkSel.size===0;
}
/* 批量切换完成：逐条走与单条勾选相同的翻转语义（循环实例只作用于当天），快照后可整体撤销 */
function bulkApplyDone(){
  if(!bulkSel.size)return;
  const snaps=[];
  for(const k of [...bulkSel]){
    const {task:t,date:ds}=splitId(k);if(!t)continue;
    if(ds){
      snaps.push({id:t.id,occ:ds,prev:(t.doneOn||{})[ds]});
      toggleOcc(t,ds);
    }else{
      snaps.push({id:t.id,prev:{status:t.status,progress:t.progress,doneAt:t.doneAt}});
      t.status=t.status==="done"?"todo":"done";
      t.progress=t.status==="done"?100:0;
      syncDoneAt(t);
    }
  }
  const n=snaps.length;
  save();exitBulk();renderAll();
  showUndo(`已切换 ${n} 条任务的完成状态`,()=>{
    for(const s of snaps){
      const t=taskById(s.id);if(!t)continue;
      if(s.occ){if(s.prev===undefined)delete t.doneOn[s.occ];else t.doneOn[s.occ]=s.prev;}
      else Object.assign(t,s.prev);
    }
    save();renderAll();
  });
}
/* 批量删除：循环实例归并回整条定义（与单条删除语义一致）；快照按原数组索引升序插回，次序精确还原 */
function bulkApplyDelete(){
  if(!bulkSel.size)return;
  const ids=[...new Set([...bulkSel].map(k=>{const {task:t}=splitId(k);return t&&t.id;}).filter(Boolean))];
  const snaps=ids.map(id=>{
    const i=state.tasks.findIndex(x=>x.id===id);
    return i<0?null:{i,snap:JSON.parse(JSON.stringify(state.tasks[i]))};
  }).filter(Boolean).sort((a,b)=>a.i-b.i);
  const gone=new Set(snaps.map(s=>s.snap.id));
  state.tasks=state.tasks.filter(t=>!gone.has(t.id));
  const n=snaps.length;
  save();exitBulk();renderAll();
  showUndo(`已删除 ${n} 条任务`,()=>{
    for(const s of snaps)state.tasks.splice(Math.min(s.i,state.tasks.length),0,s.snap);
    save();renderAll();
  });
}
$("#bulkExit").addEventListener("click",()=>exitBulk());
$("#bulkAll").addEventListener("change",e=>bulkSelectAll(e.target.checked));
$("#bulkDone").addEventListener("click",bulkApplyDone);
$("#bulkDel").addEventListener("click",bulkApplyDelete);
function statsPanelHTML(list){
  const s=statsOf(list);
  const typeBars=TYPES.filter(t=>s.types[t]).map(t=>{
    const pct=Math.round(s.types[t]/s.total*100);
    return `<div class="hbar"><span class="lbl">${t}</span><span class="bar"><i style="width:${pct}%;background:${TYPE_COLORS[TYPES.indexOf(t)]}"></i></span><span class="val">${s.types[t]}</span></div>`;
  }).join("");
  return `<div class="grid4" style="margin-bottom:12px">
    <div class="stat-box"><div class="stat-num">${s.total}</div><div class="stat-label">总任务</div></div>
    <div class="stat-box"><div class="stat-num" style="color:#3f8f5f">${s.done}</div><div class="stat-label">已完成</div></div>
    <div class="stat-box"><div class="stat-num">${s.doing}</div><div class="stat-label">进行中</div></div>
    <div class="stat-box"><div class="stat-num" style="color:var(--muted)">${s.todo}</div><div class="stat-label">未开始</div></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>${I.target}四象限分布</h3>
      <div class="quad-legend">
        <div class="q1"><b>P1 重要紧急</b>${s.q[1]} 项</div>
        <div class="q2"><b>P2 重要不紧急</b>${s.q[2]} 项</div>
        <div class="q3"><b>P3 紧急不重要</b>${s.q[3]} 项</div>
        <div class="q4"><b>P4 不紧急不重要</b>${s.q[4]} 项</div>
      </div>
      <div class="deco-line"></div>
      <div class="hbar"><span class="lbl">完成率</span><span class="bar"><i style="width:${s.rate}%"></i></span><span class="val">${s.rate}%</span></div>
    </div>
    <div class="card"><h3>${I.chart}任务类型分布</h3>${typeBars||'<div class="empty-tip">暂无数据</div>'}</div>
  </div>`;
}

/* ================= 课表视图 ================= */
const SLOT_TIMES=[["08:00","09:40"],["10:00","11:40"],["14:00","15:40"],["16:00","17:40"],["19:00","20:40"]];
function slotStart(s){return SLOT_TIMES[s][0];}
function renderSchedule(){
  const pool=filteredTasks();
  const courses=state.tasks.filter(t=>t.course); // 课表始终显示完整课表
  const shownCourses=courses.filter(c=>pool.includes(c)||!hasActiveFilter());
  let html=`<div class="card"><h3>${I.book}本周课表（周一至周日 · 08:00 - 22:00）</h3>
  <div class="timetable-wrap"><table class="timetable"><thead><tr><th>时间</th>${["周一","周二","周三","周四","周五","周六","周日"].map(w=>`<th>${w}</th>`).join("")}</tr></thead><tbody>`;
  SLOT_TIMES.forEach((st,si)=>{
    html+=`<tr><td class="time-col">第${si+1}大节<br>${st[0]}-${st[1]}</td>`;
    for(let dow=1;dow<=7;dow++){
      const d=dow%7;
      const cs=shownCourses.filter(c=>c.dow===d&&c.timeSlot&&c.timeSlot.startsWith(st[0].slice(0,2)));
      html+=`<td class="cell">${cs.map(c=>`<div class="course-block" data-id="${c.id}"><b>${esc(c.title)}</b><span class="meta">${esc(c.room)}<br>${esc(c.teacher)} · ${esc(c.timeSlot)}</span></div>`).join("")}</td>`;
    }
    html+="</tr>";
  });
  html+=`</tbody></table></div>
  <div class="deco-line"></div>
  <div class="legend"><span><i style="background:var(--accent)"></i>课程卡片点击可编辑，自动同步到日 / 周 / 月历 / 看板</span></div>
  </div>
  <h2 class="section-title">课程列表</h2>
  <div class="card"><div class="add-fab"><button class="btn small" data-newcourse="1">${I.plus.replace('class=""','style="width:13px;height:13px"')} 新增课程</button></div>
  <div id="courseList">${shownCourses.map(t=>taskItemHTML(t)).join("")||'<div class="empty-tip">当前筛选下没有课程</div>'}</div></div>`;
  $("#view-schedule").innerHTML=html;
  const v=$("#view-schedule");
  bindTaskEvents(v.querySelector("#courseList").parentElement);
  v.querySelector(".timetable").addEventListener("click",e=>{
    const b=e.target.closest(".course-block");if(b)openModal(b.dataset.id);
  });
  v.querySelector("[data-newcourse]").addEventListener("click",()=>openModal(null,true));
}
function hasActiveFilter(){const f=state.filters;return f.keyword.trim()||f.year||f.month||f.prio||f.status||f.type||f.slot||state.onlyOverdue||state.onlyLate;}

/* ================= 日视图 ================= */
let calNav=null; // 迷你日历临时浏览的月份 {y,m,anchor:当时的selDate}，selDate 变化后自动失效回归跟随
function renderDay(){
  const sel=parseD(state.selDate);
  const weekStart=mondayOf(sel);
  const weekDays=Array.from({length:7},(_,i)=>fmt(addDays(weekStart,i)));
  const pool=filteredTasks();
  const dayTasks=tasksOn(state.selDate,pool);
  const courses=dayTasks.filter(t=>t.course);
  const recurring=dayTasks.filter(t=>t.recur);
  const normal=dayTasks.filter(t=>!t.recur&&!t.course);
  const normalTotal=tasksOn(state.selDate).filter(t=>!t.recur&&!t.course).length; // 不受筛选影响的全量
  if(calNav&&calNav.anchor!==state.selDate)calNav=null;
  const selY=sel.getFullYear(),selM=sel.getMonth();
  const y=calNav?calNav.y:selY,m=calNav?calNav.m:selM;
  const first=new Date(y,m,1);const startOffset=(first.getDay()+6)%7;
  const daysIn=new Date(y,m+1,0).getDate();
  const todayStr=fmt(TODAY);
  let calCells="";
  for(let i=0;i<startOffset;i++)calCells+="<td></td>";
  for(let dd=1;dd<=daysIn;dd++){
    const ds=fmt(new Date(y,m,dd));
    const cls=[ds<todayStr?"past":"",ds===todayStr?"today":"",ds===state.selDate?"sel":"",tasksOn(ds).length?"has-task":""].join(" ");
    calCells+=`<td class="${cls}${dayTint(ds)}" data-date="${ds}"><span class="dtop">${dayMarkBadge(ds)}${dd}</span>${dayInfoBadge(ds)}</td>`;
    if((startOffset+dd)%7===0)calCells+="</tr><tr>";
  }
  const ty=TODAY.getFullYear();
  let yearOpts="";for(let yy=Math.min(y,ty)-1;yy<=Math.max(y,ty)+1;yy++)yearOpts+=`<option value="${yy}"${yy===y?" selected":""}>${yy}</option>`;
  let monthOpts="";for(let mm=0;mm<12;mm++)monthOpts+=`<option value="${mm}"${mm===m?" selected":""}>${String(mm+1).padStart(2,"0")}月</option>`;
  const s=statsOf(statsPool(dayTasks));
  const planSum=normal.reduce((a,t)=>a+(+t.plannedTime||0),0);
  const actSum=normal.reduce((a,t)=>a+(+t.actualTime||0),0);
  const od=overdueList(state.tasks).sort((a,b)=>overdueDays(b)-overdueDays(a));
  const html=`<div class="day-layout">
    <div>
      <div class="card" style="margin-bottom:14px"><h3 class="cal-head"><button class="cal-nav" data-cal-nav="-1" title="上一月">‹</button><select class="cal-sel cal-year" data-cal-year title="选择年份">${yearOpts}</select><select class="cal-sel cal-month" data-cal-month title="选择月份">${monthOpts}</select><button class="cal-nav" data-cal-nav="1" title="下一月">›</button><button class="cal-nav today-btn" data-cal-today title="回到今天">回到今天</button></h3>
        <table class="mini-cal mini-cal-wide"><thead><tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr></thead>
        <tbody><tr>${calCells}</tr></tbody></table>
      </div>
      <div class="card" style="margin-bottom:14px"><h3>${I.chart}今日概览</h3>
        <div class="hbar" style="margin-bottom:10px"><span class="lbl">完成率</span><span class="bar"><i style="width:${s.rate}%"></i></span><span class="val">${s.done}/${s.total}</span></div>
        <div class="grid2" style="margin-bottom:12px">
          <div class="stat-box"><div class="stat-num">${fmtDur(planSum)}</div><div class="stat-label" title="今日普通任务的计划时长合计（课程与循环不计）">计划时长</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#3f8f5f">${fmtDur(actSum)}</div><div class="stat-label" title="今日普通任务的实际时长合计（课程与循环不计）">实际时长</div></div>
        </div>
        <div class="quad-legend">
          <div class="q1"><b>P1 重要紧急</b>立即做 · ${s.q[1]} 项</div>
          <div class="q2"><b>P2 重要不紧急</b>计划做 · ${s.q[2]} 项</div>
          <div class="q3"><b>P3 紧急不重要</b>授权做 · ${s.q[3]} 项</div>
          <div class="q4"><b>P4 不紧急不重要</b>减少做 · ${s.q[4]} 项</div>
        </div>
      </div>
      <div class="card"><h3>${I.flag}逾期提醒<span class="tag" style="margin-left:auto" title="全库逾期未完成的任务数，不受筛选影响">${od.length}</span></h3>
        ${od.length?`<div class="od-list">${od.map(t=>`<div class="od-row" data-od-date="${t.end}" title="点击查看截止日 ${t.end} 当天">
          <span class="od-dot" style="background:var(--p${t.priority})"></span>
          <span class="od-title">${esc(t.title)}</span>${overdueBadge(t,true)}</div>`).join("")}</div>`
        :'<div class="od-empty">'+I.check+' 全库没有逾期未完成的任务</div>'}
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div><div style="font-size:.8rem;color:var(--muted)">${state.selDate} · ${"周"+"日一二三四五六"[sel.getDay()]}</div>
          <div class="clock" id="liveClock">--:--:--</div></div>
          <button class="btn small" data-newtask="1">${I.plus.replace('class=""','style="width:13px;height:13px"')} 新增任务</button>
        </div>
        <div class="deco-line"></div>
        <div class="legend">
          <span title="P1 重要紧急 · 立即做"><i style="background:var(--p1)"></i>P1</span><span title="P2 重要不紧急 · 计划做"><i style="background:var(--p2)"></i>P2</span>
          <span title="P3 紧急不重要 · 授权做"><i style="background:var(--p3)"></i>P3</span><span title="P4 不紧急不重要 · 减少做"><i style="background:var(--p4)"></i>P4</span>
          <span style="margin-left:auto">今日完成率 <b style="color:var(--accent)" title="分母为今日的非循环任务 ${s.total} 条，已完成 ${s.done} 条；循环任务与课程不计入">${s.rate}%</b>（${s.done}/${s.total}）${recurring.length?` · <span title="循环任务按天单独打卡，不计入今日完成率">今日循环 ${recurring.length} 项不计入</span>`:""}</span>
        </div>
      </div>
      <div class="card" style="margin-bottom:14px"><h3>${I.list}今日任务<span class="tag" style="margin-left:auto">${hasActiveFilter()?normal.length+" / "+normalTotal:normal.length}</span><button class="btn small ghost" data-bulk="1" style="margin-left:10px">${bulkMode?"退出选择":"选择"}</button></h3>
        <div id="dayNormal" data-reorder="1">${normal.map(t=>taskItemHTML(t,{showTime:true,sortable:!bulkMode,bulk:bulkMode})).join("")||'<div class="empty-tip">今日暂无普通任务</div>'}</div>
        <div class="unlink-zone drop-unlink" data-unlink="1">拖到此处取消关联</div>
      </div>
      <div class="grid2">
        <div class="card"><h3>${I.book}今日课程</h3><div id="dayCourses">${courses.map(t=>taskItemHTML(t,{bulk:bulkMode})).join("")||'<div class="empty-tip">今日无课</div>'}</div></div>
        <div class="card"><h3>${I.recur}今日循环<span class="tag" style="margin-left:auto">${recurring.length}</span></h3><div id="dayRecur">${recurring.map(t=>taskItemHTML(t,{occ:state.selDate,bulk:bulkMode})).join("")||'<div class="empty-tip">今日没有到期的循环任务</div>'}</div></div>
      </div>
    </div>
    <div>
      ${goalCardHTML("weekly","本周目标","margin-bottom:14px",weekDays)}
      ${goalCardHTML("monthly","本月目标","margin-bottom:14px")}
      ${goalCardHTML("yearly","年度目标","")}
    </div>
  </div>`;
  $("#view-day").innerHTML=html;
  const v=$("#view-day");
  v.classList.toggle("bulk-mode",bulkMode);
  v.querySelector("[data-bulk]").addEventListener("click",()=>setBulkMode(!bulkMode));
  if(bulkMode){ // 任务被删/被筛选隐藏后选中态失效：只保留当前 DOM 里看得见的 key
    const vis=new Set(bulkKeys());
    [...bulkSel].forEach(k=>{if(!vis.has(k))bulkSel.delete(k)});
    updateBulkBar();
  }
  [ "#dayNormal","#dayCourses","#dayRecur"].forEach(selq=>bindTaskEvents(v.querySelector(selq)));
  v.querySelector(".mini-cal").addEventListener("click",e=>{
    const td=e.target.closest("td[data-date]");if(!td)return;
    exitBulk();calNav=null;state.selDate=td.dataset.date;save();renderAll();
  });
  v.querySelectorAll("[data-cal-nav]").forEach(b=>b.addEventListener("click",()=>{
    const d=+b.dataset.calNav;
    const base=calNav||{y,m};
    const nm=base.m+d;
    calNav={y:base.y+Math.floor(nm/12),m:(nm+12)%12,anchor:state.selDate};
    renderDay();
  }));
  const todayBtn=v.querySelector("[data-cal-today]");
  if(todayBtn)todayBtn.addEventListener("click",()=>{exitBulk();calNav=null;state.selDate=todayStr;save();renderAll();});
  const ySel=v.querySelector("[data-cal-year]"),mSel=v.querySelector("[data-cal-month]");
  [ySel,mSel].forEach(sel=>sel.addEventListener("change",()=>{
    calNav={y:+ySel.value,m:+mSel.value,anchor:state.selDate};
    renderDay();
  }));
  v.querySelectorAll(".od-row").forEach(r=>r.addEventListener("click",()=>{
    exitBulk();calNav=null;state.selDate=r.dataset.odDate;save();renderAll();
  }));
  v.querySelector("[data-newtask]").addEventListener("click",()=>openModal(null,false));
  tickClock();
}
let clockTimer=null;
function tickClock(){
  clearInterval(clockTimer);
  const el=$("#liveClock");if(!el)return;
  const f=()=>{const n=new Date();el.textContent=`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;};
  f();clockTimer=setInterval(f,1000);
}

/* ================= 周视图 ================= */
function renderWeek(){
  const mon=mondayOf(parseD(state.selDate));
  const pool=filteredTasks();
  const days=Array.from({length:7},(_,i)=>fmt(addDays(mon,i)));
  const weekTasks=pool.filter(t=>days.some(ds=>tasksOn(ds,[t]).length));
  const statTasks=statsPool(weekTasks); // 概览数字只算单次任务，避免每日习惯把总数灌水
  const s=statsOf(statTasks);
  const recurCnt=weekTasks.length-statTasks.length;
  const typeCnt={};statTasks.forEach(t=>typeCnt[t.type]=(typeCnt[t.type]||0)+1);
  const maxType=Math.max(1,...Object.values(typeCnt));
  const planSum=statTasks.reduce((a,t)=>a+(t.plannedTime||0),0);
  const actSum=statTasks.reduce((a,t)=>a+(t.actualTime||0),0);
  let html=`<div class="card" style="margin-bottom:14px"><h3>${I.chart}本周概览（${days[0]} ~ ${days[6]}）${recurCnt?`<span class="tag outline" style="margin-left:auto" title="本周有 ${recurCnt} 条循环任务，只在下方的日程列出现，不计入本页任何数字">另 ${recurCnt} 条循环不计入</span>`:""}</h3>
    <div class="grid4" style="margin-bottom:12px">
      <div class="stat-box"><div class="stat-num">${s.rate}%</div><div class="stat-label">本周完成率</div></div>
      <div class="stat-box"><div class="stat-num">${s.done}/${s.total}</div><div class="stat-label">已完成 / 总数</div></div>
      <div class="stat-box"><div class="stat-num">${s.doing}</div><div class="stat-label">进行中</div></div>
      <div class="stat-box"><div class="stat-num">${Math.round(actSum/60)}h</div><div class="stat-label">实际投入（计划 ${Math.round(planSum/60)}h）</div></div>
    </div>
    <div class="grid2">
      <div><b style="font-size:.8rem">任务类型</b><div style="margin-top:8px">${TYPES.filter(t=>typeCnt[t]).map(t=>
        `<div class="hbar"><span class="lbl">${t}</span><span class="bar"><i style="width:${Math.round(typeCnt[t]/maxType*100)}%;background:${TYPE_COLORS[TYPES.indexOf(t)]}"></i></span><span class="val">${typeCnt[t]}</span></div>`).join("")||'<div class="empty-tip">暂无</div>'}</div></div>
      <div><b style="font-size:.8rem">每日任务数量<span style="font-weight:400;color:var(--muted)">（不含循环实例）</span></b><div style="margin-top:8px">${days.map((ds,i)=>{
        const cnt=ds2=>tasksOn(ds2,pool).filter(t=>!t.recur).length;
        const c=cnt(ds);const mx=Math.max(1,...days.map(cnt));
        return `<div class="hbar"><span class="lbl">${"周"+"一二三四五六日"[i]} ${ds.slice(5)}</span><span class="bar"><i style="width:${Math.round(c/mx*100)}%"></i></span><span class="val">${c}</span></div>`;}).join("")}</div></div>
    </div>
    <div class="deco-line"></div>
    <b style="font-size:.8rem">本周目标进度</b>
    <div style="margin-top:8px">${goalsOf("weekly").filter(g=>goalVisibleThisWeek(g,days)).map(g=>{const p=goalProgress(g.id);
      return `<div class="hbar"><span class="lbl" style="width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(g.title)}">${esc(g.title)}</span><span class="bar"><i style="width:${p.pct}%"></i></span><span class="val">${p.total?p.pct+"%":"—"}</span></div>`;}).join("")||'<div class="empty-tip">暂无本周目标</div>'}</div>
  </div>
  <div class="week-grid">`;
  days.forEach((ds,i)=>{
    const list=tasksOn(ds,pool).sort((a,b)=>(a.course?0:1)-(b.course?0:1)||a.priority-b.priority);
    html+=`<div class="week-col ${ds===fmt(TODAY)?'today':''}">
      <div class="wd">${"周"+"一二三四五六日"[i]}<span class="dnum">${ds.slice(8)}</span></div>
      ${list.map(t=>miniTaskHTML(t,ds)).join("")||'<div style="font-size:.68rem;color:var(--muted);text-align:center;padding:8px 0">—</div>'}
    </div>`;
  });
  html+="</div>";
  $("#view-week").innerHTML=html;
  $("#view-week").onclick=e=>{
    const mt=e.target.closest(".mini-task");if(mt)openModal(splitId(mt.dataset.id).task.id);
  };
}

/* ================= 月历视图 ================= */
function renderMonth(){
  const sel=parseD(state.selDate);
  const y=sel.getFullYear(),m=sel.getMonth();
  const first=new Date(y,m,1);const startOffset=(first.getDay()+6)%7;
  const daysIn=new Date(y,m+1,0).getDate();
  const pool=filteredTasks();
  const monthStr=`${y}-${pad(m+1)}`;
  const monthTasks=pool.filter(t=>(t.start<=monthStr+"-31"&&t.end>=monthStr+"-01")||(t.course&&t.start<=monthStr+"-31"));
  const statTasks=statsPool(monthTasks);
  const s=statsOf(statTasks);
  const recurCnt=monthTasks.length-statTasks.length;
  let cells="";
  const totalCells=Math.ceil((startOffset+daysIn)/7)*7;
  for(let i=0;i<totalCells;i++){
    const dd=i-startOffset+1;
    if(dd<1||dd>daysIn){cells+='<div class="day-cell out"></div>';continue;}
    const ds=`${monthStr}-${pad(dd)}`;
    const list=tasksOn(ds,pool);
    const doneCnt=list.filter(t=>t.recur?occDone(t,ds):t.status==="done").length;
    cells+=`<div class="day-cell ${ds===fmt(TODAY)?'today':''}${dayTint(ds)}" data-date="${ds}">
      <div class="dn"><span class="dnum"><span class="dtop">${dayMarkBadge(ds)}${dd}</span>${dayInfoBadge(ds)}</span><span class="cnt">${list.length?doneCnt+"/"+list.length+" ✓":""}</span></div>
      ${list.slice(0,3).map(t=>miniTaskHTML(t,ds,`border-left:3px solid ${['var(--p1)','var(--p2)','var(--p3)','var(--p4)'][t.priority-1]}`)).join("")}
      ${list.length>3?`<div style="color:var(--muted);font-size:.62rem">+${list.length-3} 更多</div>`:""}
    </div>`;
  }
  const typeCnt={};statTasks.forEach(t=>typeCnt[t.type]=(typeCnt[t.type]||0)+1);
  const html=`<div class="month-layout">
    <div class="card"><h3>${I.book}${y} 年 ${m+1} 月${recurCnt?`<span class="tag outline" style="margin-left:auto" title="虚线左边框的是循环任务的当天实例，打卡状态逐日独立，不与单次任务混算">含循环实例</span>`:""}</h3>
      <div class="month-grid">${["一","二","三","四","五","六","日"].map(w=>`<div class="mh">周${w}</div>`).join("")}${cells}</div>
    </div>
    <div>
      ${goalCardHTML("monthly","本月目标","margin-bottom:14px")}
      <div class="card" style="margin-bottom:14px"><h3>${I.chart}月度统计${recurCnt?`<span class="tag outline" style="margin-left:auto" title="本月有 ${recurCnt} 条循环任务定义，其每日实例不计入本页数字">${recurCnt} 条循环未计入</span>`:""}</h3>
        <div class="grid2" style="margin-bottom:10px">
          <div class="stat-box"><div class="stat-num">${s.total}</div><div class="stat-label">月度任务</div></div>
          <div class="stat-box"><div class="stat-num">${s.rate}%</div><div class="stat-label">完成率</div></div>
        </div>
        <div class="hbar"><span class="lbl">已完成</span><span class="bar"><i style="width:${s.rate}%;background:#3f8f5f"></i></span><span class="val">${s.done}</span></div>
        <div class="hbar"><span class="lbl">进行中</span><span class="bar"><i style="width:${s.total?Math.round(s.doing/s.total*100):0}%"></i></span><span class="val">${s.doing}</span></div>
        <div class="hbar"><span class="lbl">未开始</span><span class="bar"><i style="width:${s.total?Math.round(s.todo/s.total*100):0}%;background:#9aa3ad"></i></span><span class="val">${s.todo}</span></div>
      </div>
      <div class="card"><h3>${I.list}分类统计</h3>
        ${TYPES.filter(t=>typeCnt[t]).map(t=>`<div class="hbar"><span class="lbl">${t}</span><span class="bar"><i style="width:${Math.round(typeCnt[t]/s.total*100)}%;background:${TYPE_COLORS[TYPES.indexOf(t)]}"></i></span><span class="val">${typeCnt[t]}</span></div>`).join("")||'<div class="empty-tip">暂无</div>'}
      </div>
    </div>
  </div>`;
  $("#view-month").innerHTML=html;
  $("#view-month").onclick=e=>{
    const mt=e.target.closest(".mini-task");
    if(mt){openModal(splitId(mt.dataset.id).task.id);return;}
    const cell=e.target.closest(".day-cell[data-date]");
    if(cell){state.selDate=cell.dataset.date;state.view="day";save();renderAll();}
  };
}

/* ================= 月进度视图（表格 + 甘特） ================= */
function onTimeStripHTML(pool){
  const done=pool.filter(t=>t.status==="done");
  const tracked=done.filter(t=>t.doneAt!=="");           // 分母：有完成时间记录的已完成任务
  const late=tracked.filter(isLateDone);
  const onTime=tracked.length-late.length;
  const untracked=done.length-tracked.length;
  if(!tracked.length)
    return `<div class="ontime-strip">${done.length
      ? `本月已完成 <b>${done.length}</b> 条，但都没有完成时间记录（该字段自 2026-09-16 起才开始写入，此前完成的任务无法追溯），<b>无法计算按时率</b>。`
      : `本月暂无已完成任务，无按时率可算。`}</div>`;
  const worst=late.length?Math.max(...late.map(lateDays)):0;
  return `<div class="ontime-strip">按时完成率 <b>${Math.round(onTime/tracked.length*100)}%</b>
    · 按时 ${onTime} / 计入分母 ${tracked.length}（均为已完成且有完成时间记录）
    · 迟完 <b style="color:var(--late)">${late.length}</b> 条${late.length?`，最迟 ${worst} 天`:""}
    ${untracked?`· 另有 ${untracked} 条已完成任务无完成时间记录，<b>未计入分母</b>`:""}</div>`;
}
function renderMProgress(){
  const sel=parseD(state.selDate);
  const y=sel.getFullYear(),m=sel.getMonth();
  const monthStr=`${y}-${pad(m+1)}`;
  const daysIn=new Date(y,m+1,0).getDate();
  const inMonth=t=>!t.course&&t.start<=monthStr+"-"+pad(daysIn)&&t.end>=monthStr+"-01";
  const spanCnt=filteredTasks().filter(inMonth).length;
  const pool=filteredTasks().filter(t=>inMonth(t)&&!t.recur);
  const recurCnt=spanCnt-pool.length;
  const weeks=[];
  let wStart=new Date(y,m,1);
  while(wStart.getMonth()===m||weeks.length===0){
    const wEnd=addDays(wStart,6);
    weeks.push({s:new Date(wStart),e:wEnd>new Date(y,m+1,0)?new Date(y,m+1,0):wEnd});
    wStart=addDays(wEnd,1);
    if(weeks.length>5)break;
  }
  const rows=pool.map(t=>{
    return `<tr data-id="${t.id}">
      <td><b>${esc(t.title)}</b><br><span style="font-size:.68rem;color:var(--muted)">${esc(t.type)}</span>${isOverdue(t)?"<br>"+overdueBadge(t):(isLateDone(t)?"<br>"+lateBadge(t):"")}</td>
      <td style="white-space:nowrap">${t.start}<br>${t.end}</td>
      <td><span class="prio-dot p${t.priority}" style="margin:0"></span> P${t.priority}</td>
      <td><span class="status-pill st-${t.status}">${STATUS_NAMES[t.status]}</span></td>
      <td><input type="range" min="0" max="100" step="5" value="${t.progress}" data-prog="${t.id}"><br><span style="font-size:.7rem;color:var(--accent)">${t.progress}%</span></td>
      <td><button class="icon-btn" data-act="edit" data-eid="${t.id}">${I.edit}</button></td>
    </tr>`;}).join("");
  // 甘特：按周 5 列
  const ganttRows=pool.map(t=>{
    let bars="";
    weeks.forEach((w,wi)=>{
      const ws=fmt(w.s),we=fmt(w.e);
      if(t.start<=we&&t.end>=ws){
        const ovS=t.start>ws?t.start:ws, ovE=t.end<we?t.end:we;
        const totalW=(w.e-w.s)/86400000+1;
        const l=(parseD(ovS)-w.s)/86400000/totalW*100;
        const wd=((parseD(ovE)-parseD(ovS))/86400000+1)/totalW*100;
        bars+=`<div class="gantt-cell"><div class="gantt-bar" data-id="${t.id}" style="left:${l}%;width:${wd}%" title="${esc(t.title)} ${ovS}~${ovE}"><i style="width:${t.progress}%"></i><span>${t.progress}%</span></div></div>`;
      }else bars+='<div class="gantt-cell"></div>';
    });
    return `<div class="gantt-row"><div class="gname" title="${esc(t.title)}">${esc(t.title)}</div>${bars}</div>`;
  }).join("");
  const html=`<div class="card" style="margin-bottom:14px"><h3>${I.list}${m+1} 月任务进度表${recurCnt?`<span class="tag outline" style="margin-left:auto" title="另有 ${recurCnt} 条循环任务横跨本月，它没有单一进度值，不进本表与甘特">${recurCnt} 条循环未列入</span>`:""}</h3>
    ${onTimeStripHTML(pool)}
    <div class="table-wrap"><table class="data"><thead><tr><th>任务名称</th><th>起止日期</th><th>优先级</th><th>状态</th><th>完成进度</th><th>操作</th></tr></thead>
    <tbody>${rows||`<tr><td colspan="6"><div class="empty-tip">${recurCnt?"本月只有循环任务，它们不进本表":"本月暂无任务"}</div></td></tr>`}</tbody></table></div>
  </div>
  <div class="card"><h3>${I.chart}${m+1} 月甘特图（按周）</h3>
    <div class="gantt-wrap"><div class="gantt">
      <div class="gantt-row head"><div class="gname">任务 / 周</div>${weeks.map((w,i)=>`<div class="gantt-cell" style="display:flex;align-items:center;padding-left:6px">W${i+1} ${fmt(w.s).slice(5)}~${fmt(w.e).slice(5)}</div>`).join("")}</div>
      ${ganttRows||'<div class="empty-tip" style="margin-top:10px">暂无数据</div>'}
    </div></div>
  </div>`;
  $("#view-mprogress").innerHTML=html;
  const v=$("#view-mprogress");
  v.oninput=e=>{
    const r=e.target.closest("[data-prog]");if(!r)return;
    const t=taskById(r.dataset.prog);t.progress=+r.value;
    if(t.progress===100)t.status="done";else if(t.progress>0&&t.status==="todo")t.status="doing";
    if(t.progress<100&&t.status==="done")t.status="doing";
    save();renderAll();
  };
  v.onclick=e=>{
    const ed=e.target.closest("[data-eid]");if(ed){openModal(ed.dataset.eid);return;}
    const bar=e.target.closest(".gantt-bar");if(bar)openModal(bar.dataset.id);
  };
}

/* ================= 年视图 ================= */
function renderYear(){
  const y=parseD(state.selDate).getFullYear();
  const pool=filteredTasks();
  const yrMatch=t=>t.start.slice(0,4)==String(y)||t.end.slice(0,4)==String(y);
  const yearTasks=statsPool(pool).filter(yrMatch);
  const recurCnt=pool.filter(t=>t.recur&&yrMatch(t)).length;
  const s=statsOf(yearTasks);
  let months="";
  for(let mo=0;mo<12;mo++){
    const first=new Date(y,mo,1);const off=(first.getDay()+6)%7;const dim=new Date(y,mo+1,0).getDate();
    let cells="";for(let i=0;i<off;i++)cells+="<td></td>";
    for(let dd=1;dd<=dim;dd++){
      const ds=fmt(new Date(y,mo,dd));
      cells+=`<td class="${ds===fmt(TODAY)?'today':''} ${tasksOn(ds,pool).length?'has-task':''}${dayTint(ds)}" data-date="${ds}" style="font-size:.62rem;padding:2px"><span class="dtop">${dayMarkBadge(ds)}${dd}</span>${dayInfoBadge(ds)}</td>`;
      if((off+dd)%7===0)cells+="</tr><tr>";
    }
    const mTasks=yearTasks.filter(t=>t.start<=`${y}-${pad(mo+1)}-31`&&t.end>=`${y}-${pad(mo+1)}-01`);
    const ms=statsOf(mTasks);
    months+=`<div class="year-month"><h4>${mo+1} 月 <span style="float:right;font-size:.68rem;color:var(--muted)">${ms.done}/${ms.total} · ${ms.rate}%</span></h4>
      <table class="mini-cal"><thead><tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr></thead><tbody><tr>${cells}</tr></tbody></table></div>`;
  }
  const html=`<div class="grid3" style="margin-bottom:14px">
    ${goalCardHTML("yearly",y+" 年度目标","")}
    <div class="card"><h3>${I.refresh}每月复盘</h3>${state.goals.reviews.map(r=>`<div class="review-item"><b>${esc(r.m)}</b><p>${esc(r.text)}</p></div>`).join("")||'<div class="empty-tip">暂无复盘记录</div>'}</div>
    <div class="card"><h3>${I.chart}年度统计${recurCnt?`<span class="tag outline" style="margin-left:auto" title="${y} 年有 ${recurCnt} 条循环任务，其每日实例不进本页数字与下方图表">${recurCnt} 条循环未计入</span>`:""}</h3>
      <div class="grid2" style="margin-bottom:10px">
        <div class="stat-box"><div class="stat-num">${s.total}</div><div class="stat-label">年度任务</div></div>
        <div class="stat-box"><div class="stat-num">${s.rate}%</div><div class="stat-label">完成率</div></div>
      </div>
      <div class="hbar"><span class="lbl">已完成</span><span class="bar"><i style="width:${s.rate}%;background:#3f8f5f"></i></span><span class="val">${s.done}</span></div>
      <div class="hbar"><span class="lbl">进行中</span><span class="bar"><i style="width:${s.total?Math.round(s.doing/s.total*100):0}%"></i></span><span class="val">${s.doing}</span></div>
      <div class="hbar"><span class="lbl">未开始</span><span class="bar"><i style="width:${s.total?Math.round(s.todo/s.total*100):0}%;background:#9aa3ad"></i></span><span class="val">${s.todo}</span></div>
      <div class="deco-line"></div>
      <canvas class="chart" id="yearChart"></canvas>
    </div>
  </div>
  <div class="year-grid">${months}</div>`;
  $("#view-year").innerHTML=html;
  $("#view-year").onclick=e=>{
    const td=e.target.closest("td[data-date]");
    if(td){state.selDate=td.dataset.date;state.view="day";save();renderAll();}
  };
  drawYearChart(y,statsPool(pool));
}
function drawYearChart(y,pool){
  const cv=$("#yearChart");if(!cv)return;
  const dpr=window.devicePixelRatio||1;
  const W=cv.clientWidth,H=cv.clientHeight;
  cv.width=W*dpr;cv.height=H*dpr;
  const ctx=cv.getContext("2d");ctx.scale(dpr,dpr);
  const data=Array.from({length:12},(_,mo)=>{
    const ms=`${y}-${pad(mo+1)}`;
    const l=pool.filter(t=>t.start<=ms+"-31"&&t.end>=ms+"-01");
    return l.length?Math.round(l.filter(t=>t.status==="done").length/l.length*100):0;
  });
  const cs=getComputedStyle(document.body);
  const accent=cs.getPropertyValue("--accent").trim(),line=cs.getPropertyValue("--grid-line").trim(),muted=cs.getPropertyValue("--muted").trim();
  const bw=W/12;
  ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(0,H-20);ctx.lineTo(W,H-20);ctx.stroke();
  data.forEach((v,i)=>{
    const h=(H-40)*v/100;
    ctx.fillStyle=accent;ctx.globalAlpha=.85;
    const x=i*bw+bw*0.25,w=bw*0.5;
    ctx.beginPath();ctx.roundRect(x,H-20-h,w,h,3);ctx.fill();
    ctx.globalAlpha=1;ctx.fillStyle=muted;font(ctx,"9px");
    ctx.fillText((i+1)+"",x+w/2-3,H-7);
    if(v)ctx.fillText(v,x+w/2-(v>9?7:3),H-24-h);
  });
  ctx.fillStyle=muted;ctx.fillText("每月完成率 %",4,10);
}
function font(ctx,s){ctx.font=s+' "PingFang SC","Microsoft YaHei",sans-serif';}

/* ================= 看板视图 ================= */
function renderKanban(){
  const all=filteredTasks();
  const pool=statsPool(all);
  const recurCnt=all.length-pool.length;
  const mode=state.kanbanMode;
  let cols;
  if(mode==="status")cols=[["todo","未开始"],["doing","进行中"],["done","已完成"]];
  else cols=TYPES.map(t=>[t,t]);
  let html=`<div class="kanban-switch">
    <button data-km="status" class="${mode==='status'?'active':''}">按状态分列</button>
    <button data-km="type" class="${mode==='type'?'active':''}">按任务类型分列</button>
    ${recurCnt?`<span class="tag outline" style="align-self:center" title="循环任务按天逐次打卡，没有单一状态可归列，因此不进看板；去日 / 周 / 月历视图查看和打卡">另有 ${recurCnt} 条循环任务不在此列</span>`:""}
    <button class="btn small" style="margin-left:auto" data-seasonal="1">${I.plus.replace('class=""','style="width:13px;height:13px"')} 新增任务</button>
  </div>
  ${mode==="status"&&!state.kanbanDragHintSeen?'<div class="kanban-drag-hint" role="status"><b>提示</b> 拖拽任务到其他列以更新状态</div>':''}
  <div class="kanban ${mode==='type'?'type-mode':''}">`;
  cols.forEach(([key,label])=>{
    const list=pool.filter(t=>mode==="status"?t.status===key:t.type===key);
    html+=`<div class="kanban-col" data-col="${key}"><h4>${esc(label)}<span class="tag">${list.length}</span></h4>
      ${list.map(t=>`<div class="kanban-card" draggable="true" data-id="${t.id}">
        <button class="icon-btn kc-edit" draggable="false" title="编辑任务">${I.edit}</button>
        <div class="kc-title"><span class="prio-dot p${t.priority}" style="margin:0 4px 0 0"></span>${esc(t.title)}</div>
        <div class="kc-meta"><span class="tag outline">${esc(t.type)}</span><span>${t.end} ${isOverdue(t)?"已截止":"截止"}</span>${isOverdue(t)?overdueBadge(t):""}${isLateDone(t)?lateBadge(t):""}${t.course?`<span>${esc(t.timeSlot)}</span>`:""}</div>
        <div class="progress-bar"><i style="width:${t.progress}%"></i></div>
      </div>`).join("")||'<div style="font-size:.7rem;color:var(--muted);text-align:center;padding:14px 0">拖拽任务到此列</div>'}
    </div>`;
  });
  html+="</div>";
  $("#view-kanban").innerHTML=html;
  const v=$("#view-kanban");
  v.querySelector(".kanban-switch").addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    if(b.dataset.km){state.kanbanMode=b.dataset.km;save();renderAll();}
    if(b.dataset.seasonal)openModal(null,false);
  });
  let dragId=null,sourceCol="";
  const board=v.querySelector(".kanban");
  const clearDropTargets=()=>{
    board.classList.remove("dragging");
    v.querySelectorAll(".kanban-col").forEach(col=>col.classList.remove("drag-target","drag-over"));
  };
  v.querySelectorAll(".kanban-card").forEach(c=>{
    c.addEventListener("dragstart",()=>{
      dragId=c.dataset.id;sourceCol=c.closest(".kanban-col").dataset.col;
      board.classList.add("dragging");
      v.querySelectorAll(".kanban-col").forEach(col=>{if(col.dataset.col!==sourceCol)col.classList.add("drag-target");});
    });
    c.addEventListener("dragend",clearDropTargets);
    c.addEventListener("dblclick",()=>openModal(c.dataset.id));
    const eb=c.querySelector(".kc-edit");
    if(eb)eb.addEventListener("click",()=>openModal(c.dataset.id)); // 绑在每次重建的按钮上，避免常驻容器叠监听器
  });
  v.querySelectorAll(".kanban-col").forEach(col=>{
    col.addEventListener("dragover",e=>{if(col.dataset.col===sourceCol)return;e.preventDefault();col.classList.add("drag-over");});
    col.addEventListener("dragleave",()=>col.classList.remove("drag-over"));
    col.addEventListener("drop",e=>{
      e.preventDefault();
      const t=taskById(dragId);if(!t){clearDropTargets();return;}
      const changed=col.dataset.col!==sourceCol;
      if(mode==="status"){
        t.status=col.dataset.col;
        if(t.status==="done")t.progress=100;
        else if(t.status==="todo"&&t.progress===100)t.progress=0;
        syncDoneAt(t);
        if(changed)state.kanbanDragHintSeen=true;
      }else t.type=col.dataset.col;
      clearDropTargets();save();renderAll();
    });
  });
}

/* ================= 任务编辑弹窗 ================= */
let editingId=null;
function openModal(id,asCourse){
  editingId=id;
  const t=id?taskById(id):mk({start:state.selDate,end:state.selDate,course:!!asCourse,dow:asCourse?((parseD(state.selDate).getDay()+6)%7+1)%7:null,timeSlot:asCourse?"08:00-09:40":""});
  $("#tmTitle").textContent=id?"编辑任务":"新增任务";
  buildGoalSelect();
  $("#tTitle").value=t.title;$("#tType").value=t.type;$("#tPrio").value=t.priority;
  $("#tGoal").value=goalById(t.goalId)?t.goalId:"";
  $("#tStatus").value=t.status;$("#tProg").value=t.progress;$("#tProgVal").textContent=t.progress+"%";
  $("#tStart").value=t.start;$("#tEnd").value=t.end;
  $("#tPlan").value=t.plannedTime;$("#tActual").value=t.actualTime;
  $("#tNote").value=t.note||"";
  $("#tCourse").checked=t.course;
  $("#tRoom").value=t.room;$("#tTeacher").value=t.teacher;
  $("#tDow").value=t.dow===null||t.dow===undefined?1:t.dow;$("#tTime").value=t.timeSlot;
  $("#courseFields").style.display=t.course?"block":"none";
  $("#tRecur").value=t.recur?t.recur.freq:"";
  $("#tMday").value=t.recur?t.recur.mday:1;
  buildWeekdayBoxes(t.recur&&t.recur.freq==="weekly"?t.recur.days:[parseD(t.start).getDay()]);
  syncRecurForm();
  $("#tDelete").style.visibility=id?"visible":"hidden";
  $("#taskModal").classList.add("show");
}
/* ---------- 循环规则表单：可见性随「重复周期」切换，并实时预告窗口内会发生几次 ---------- */
function buildWeekdayBoxes(days){
  $("#tWeekdays").innerHTML=[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" value="${d}"${days.indexOf(d)>=0?" checked":""}>${DOW_NAMES[d]}</label>`).join("");
}
function readRecur(){
  const freq=$("#tRecur").value;
  if(!freq)return null;
  if(freq==="weekly")return {freq,days:$$("#tWeekdays input:checked").map(i=>+i.value).sort((a,b)=>a-b),mday:1};
  if(freq==="monthly")return {freq,days:[],mday:Math.min(31,Math.max(1,+$("#tMday").value||1))};
  return {freq,days:[],mday:1};
}
function syncRecurForm(){
  const freq=$("#tRecur").value;
  $("#tWeekdays").style.display=freq==="weekly"?"flex":"none";
  $("#tMonthlyRow").style.display=freq==="monthly"?"grid":"none";
  $("#tStatusRow").style.display=freq?"none":"grid"; // 循环任务按次打卡，整体状态/进度无意义
  $("#tStartLbl").textContent=freq?"循环开始日":"开始日期";
  $("#tEndLbl").textContent=freq?"循环截至日（含）":"截止日期";
  if(!freq){$("#tRecurHint").innerHTML="单次任务：勾一次即整条完成，计入完成率与逾期。";return;}
  const from=$("#tStart").value,to=$("#tEnd").value,r=readRecur();
  const n=occurrencesBetween({recur:r,start:from,end:to,doneOn:{}},from,to).length;
  let warn=n?"":"<br>当前起止日期内一次都不会发生，请放宽窗口。";
  if(freq==="workday"){ // 逐年如实标注节假日口径来源：已同步官方源 / 内置安排 / 无数据退回普通周
    const parts=[];let cur=null;
    for(let y=+from.slice(0,4);from&&y<=+to.slice(0,4);y++){
      const k=CN_HOLIDAY[y]?(HOLIDAY_SRC[y]==="live"?"live":"builtin"):"none";
      if(!cur||cur.k!==k)cur={k,years:[]},parts.push(cur);
      cur.years.push(y);
    }
    const label={live:"已同步官方源",builtin:"内置官方安排",none:"暂无数据，按普通周一至周五计"};
    if(parts.length)warn+="<br>节假日口径："+parts.map(p=>p.years.join("、")+" 年"+label[p.k]).join("；")+"。";
  }
  $("#tRecurHint").innerHTML=`「${esc(RECUR_RULES[freq])}」在 ${esc(from)} ~ ${esc(to)} 内共发生 <b>${n}</b> 次，每次单独打卡。`+warn;
}
$("#tRecur").addEventListener("change",()=>{
  let auto="";
  if($("#tRecur").value){$("#tCourse").checked=false;$("#courseFields").style.display="none";}
  const s=$("#tStart").value,e=$("#tEnd").value;
  if($("#tRecur").value&&e&&s&&e<fmt(addDays(parseD(s),7))){ // 窗口不足一周时顺延一年，免得建完只出现一次
    $("#tEnd").value=fmt(addDays(parseD(s),364));
    auto="结束日已自动顺延一年（原窗口不足一周），可自行调整。";
  }
  syncRecurForm();
  if(auto)$("#tRecurHint").innerHTML+="<br>"+auto;
});
$("#tWeekdays").addEventListener("change",syncRecurForm);
$("#tMday").addEventListener("input",syncRecurForm);
["tStart","tEnd"].forEach(i=>$("#"+i).addEventListener("change",syncRecurForm));
$("#tCourse").addEventListener("change",e=>{
  $("#courseFields").style.display=e.target.checked?"block":"none";
  if(e.target.checked&&$("#tRecur").value){$("#tRecur").value="";syncRecurForm();} // 课程与循环任务二选一
});
$("#tProg").addEventListener("input",e=>{$("#tProgVal").textContent=e.target.value+"%";});
$("#tCancel").addEventListener("click",()=>$("#taskModal").classList.remove("show"));
$("#taskModal").addEventListener("click",e=>{if(e.target.id==="taskModal")$("#taskModal").classList.remove("show");});
$("#taskModal").addEventListener("keydown",e=>{
  if(e.key!=="Enter"||e.isComposing)return; // isComposing：中文输入法选字的回车不当作保存
  if(e.target.tagName==="TEXTAREA"||e.target.tagName==="BUTTON")return; // 备注内回车换行；按钮上回车走原生聚焦行为
  e.preventDefault();
  $("#tSave").click();
});
$("#tDelete").addEventListener("click",()=>{$("#taskModal").classList.remove("show");deleteTask(editingId);});
function formTaskData(){
  const isCourse=$("#tCourse").checked;
  const recur=isCourse?null:readRecur();
  const data={
    title:$("#tTitle").value.trim(),type:$("#tType").value,priority:+$("#tPrio").value,status:$("#tStatus").value,
    progress:+$("#tProg").value,start:$("#tStart").value||fmt(TODAY),end:$("#tEnd").value||$("#tStart").value||fmt(TODAY),
    plannedTime:+$("#tPlan").value||0,actualTime:+$("#tActual").value||0,
    note:$("#tNote").value.trim(),
    course:isCourse,goalId:$("#tGoal").value,recur,
    room:isCourse?$("#tRoom").value.trim():"",teacher:isCourse?$("#tTeacher").value.trim():"",
    dow:isCourse?+$("#tDow").value:null,timeSlot:isCourse?$("#tTime").value.trim():""
  };
  if(!data.title){alert("请填写任务标题");return null;}
  if(data.end<data.start){alert("截止日期不能早于开始日期");return null;}
  if(recur&&recur.freq==="weekly"&&!recur.days.length){alert("每周重复至少要勾选一个星期日");return null;}
  if(recur&&data.status==="done")data.status="todo"; // 循环任务没有「整条已完成」这个状态
  if(!recur&&data.status==="done")data.progress=100;
  return data;
}
$("#tSave").addEventListener("click",()=>{
  const data=formTaskData();if(!data)return;
  let t;
  if(editingId){t=taskById(editingId);Object.assign(t,data);}
  else{t=mk(data);state.tasks.push(t);}
  if(!t.recur)t.doneOn={}; // 取消循环时丢掉打卡痕迹，避免它悄悄影响以后的重开
  syncDoneAt(t);
  save();$("#taskModal").classList.remove("show");buildFilters();renderAll();
});
/* 另存为副本：只按当前表单内容新建一条，不改动（也不保存）弹窗里正在编辑的原任务 */
$("#tCopy").addEventListener("click",()=>{
  const data=formTaskData();if(!data)return;
  if(editingId)data.id=editingId; // 让副本插在源任务后面
  duplicateTask(data);
  $("#taskModal").classList.remove("show");
});

/* ================= 目标编辑与拖拽关联 ================= */
function buildGoalSelect(){
  $("#tGoal").innerHTML='<option value="">不关联目标</option>'+GOAL_LEVELS.map(([k,label])=>{
    const gs=goalsOf(k);
    return gs.length?`<optgroup label="${label}目标">${gs.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join("")}</optgroup>`:"";}).join("");
}
let editingGoal=null;
function openGoalModal(id,level){
  editingGoal=id||null;
  const g=id?goalById(id):{level:level||"weekly",title:""};
  $("#gmTitle").textContent=id?"编辑目标":"新增目标";
  $("#gLevel").value=id?goalLevel(id):g.level;
  $("#gText").value=g.title;
  $("#gDelete").style.visibility=id?"visible":"hidden";
  $("#goalModal").classList.add("show");
}
function deleteGoal(id){
  const g=goalById(id);if(!g)return;
  const lv=goalLevel(id);
  const gi=goalsOf(lv).findIndex(x=>x.id===id);
  const snap=JSON.parse(JSON.stringify(g));
  const affected=state.tasks.filter(t=>t.goalId===id).map(t=>t.id);
  state.goals[lv]=goalsOf(lv).filter(x=>x.id!==id);
  state.tasks.forEach(t=>{if(t.goalId===id)t.goalId="";}); // 解除关联，避免悬空 goalId
  expandedGoals.delete(id);
  save();renderAll();
  showUndo(`已删除目标「${snap.title}」${affected.length?`，${affected.length} 条任务已解除关联`:""}`,()=>{
    goalsOf(lv).splice(Math.min(gi,goalsOf(lv).length),0,snap);
    affected.forEach(tid=>{const t=taskById(tid);if(t&&!t.goalId)t.goalId=id;}); // 只恢复仍未归属的任务，不覆盖撤销前手动改的关联
    save();renderAll();
  });
}
$("#gCancel").addEventListener("click",()=>$("#goalModal").classList.remove("show"));
$("#goalModal").addEventListener("click",e=>{if(e.target.id==="goalModal")$("#goalModal").classList.remove("show");});
$("#gDelete").addEventListener("click",()=>{$("#goalModal").classList.remove("show");deleteGoal(editingGoal);});
$("#gSave").addEventListener("click",()=>{
  const title=$("#gText").value.trim(),level=$("#gLevel").value;
  if(!title){alert("请填写目标描述");return;}
  if(editingGoal){
    const g=goalById(editingGoal),from=goalLevel(editingGoal);
    g.title=title;
    if(from!==level){state.goals[from]=goalsOf(from).filter(x=>x.id!==editingGoal);goalsOf(level).push(g);}
  }else goalsOf(level).push({id:newGoalId(),title});
  save();$("#goalModal").classList.remove("show");renderAll();
});
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-gadd]");
  if(add){openGoalModal(null,add.dataset.gadd);return;}
  const act=e.target.closest("[data-gact]");
  if(act){
    const a=act.dataset.gact,gid=act.dataset.gid;
    if(a==="edit")openGoalModal(gid,act.dataset.level);
    else if(a==="del")deleteGoal(gid);
    else if(a==="fold"){expandedGoals.has(gid)?expandedGoals.delete(gid):expandedGoals.add(gid);renderAll();}
    return;
  }
  const gm=e.target.closest("[data-gmid]");
  if(gm)openModal(gm.dataset.gmid);
});

/* ---- 拖拽：关联目标 / 取消关联 / 任务与目标各自排序 ---- */
let dragItem=null; // {kind:"task"|"goal", id}
function nearestGoalRow(card,cy){
  const rows=Array.from(card.querySelectorAll(".goal-item"));
  if(!rows.length)return null;
  let best=null,bd=Infinity;
  rows.forEach(r=>{const b=r.getBoundingClientRect();const d=cy<b.top?b.top-cy:(cy>b.bottom?cy-b.bottom:0);if(d<bd){bd=d;best=r;}});
  return best;
}
function dropZone(node,cy){
  if(!dragItem||!node||!node.closest)return null;
  const g=node.closest(".goal-item");
  if(dragItem.kind==="goal"){ // 拖目标只用于排序，不触发关联与取消关联
    if(g&&g.dataset.gid!==dragItem.id)
      return {el:g,type:"moveGoal",ref:g.dataset.gid,level:g.dataset.level,after:cy>g.getBoundingClientRect().top+g.offsetHeight/2};
    return null;
  }
  const row=node.closest(".task-item,.gm-row"); // 落在条目上先按排序处理
  if(row){
    const ref=row.dataset.id||row.dataset.gmid;
    const members=row.closest(".goal-members");
    if(ref&&ref!==dragItem.id&&(members||row.closest("[data-reorder]")))
      return {el:row,type:"move",ref,gid:members?members.dataset.gid:"",after:cy>row.getBoundingClientRect().top+row.offsetHeight/2};
  }
  if(g)return {el:g,type:"link",gid:g.dataset.gid};
  const card=node.closest(".card"); // 整张目标卡都算命中区，按指针纵坐标挑最近的一行
  if(card){const r=nearestGoalRow(card,cy);if(r)return {el:r,type:"link",gid:r.dataset.gid};}
  const u=node.closest("[data-unlink]");
  if(u&&taskGoal(taskById(dragItem.id)))return {el:u,type:"unlink"};
  return null;
}
function moveTask(dragId,refId,after){ // 顺序即 state.tasks 数组顺序，不另设字段
  const from=state.tasks.findIndex(t=>t.id===dragId);if(from<0)return;
  const [t]=state.tasks.splice(from,1);
  const to=state.tasks.findIndex(x=>x.id===refId);
  state.tasks.splice(to<0?state.tasks.length:(after?to+1:to),0,t);
}
function moveGoal(dragId,refId,level,after){ // 目标顺序即其档位数组顺序；跨卡放置即改档位
  const arr=state.goals[level];if(!arr)return;
  let g,from=arr.findIndex(x=>x.id===dragId);
  if(from<0){
    const src=goalLevel(dragId);if(!src)return;
    from=state.goals[src].findIndex(x=>x.id===dragId);if(from<0)return;
    [g]=state.goals[src].splice(from,1);
  }else [g]=arr.splice(from,1);
  const to=arr.findIndex(x=>x.id===refId);
  arr.splice(to<0?arr.length:(after?to+1:to),0,g);
}
function markZone(z){
  $$(".drag-over,.drop-before,.drop-after").forEach(x=>x.classList.remove("drag-over","drop-before","drop-after"));
  if(z)z.el.classList.add((z.type==="move"||z.type==="moveGoal")?(z.after?"drop-after":"drop-before"):"drag-over");
}
document.addEventListener("dragstart",e=>{
  if(bulkMode)return; // 批量模式下禁拖，避免与勾选冲突
  const gg=e.target.closest(".goal-item");
  if(gg)dragItem={kind:"goal",id:gg.dataset.gid};
  else{
    const it=e.target.closest(".task-item,.gm-row");if(!it)return;
    if(it.classList.contains("task-item")&&!it.closest("[data-reorder]"))return; // 非排序列表里的条目不可拖起
    dragItem={kind:"task",id:it.dataset.id||it.dataset.gmid};
  }
  if(dragItem.kind==="task")document.body.classList.add("dragging-task"); // 取消关联条只对任务有意义
  e.dataTransfer.effectAllowed="linkMove";
  e.dataTransfer.setData("text/plain",dragItem.kind+":"+dragItem.id);
});
document.addEventListener("dragend",()=>{
  dragItem=null;document.body.classList.remove("dragging-task");markZone(null);
});
document.addEventListener("dragenter",e=>{
  const z=dropZone(e.target,e.clientY);if(!z)return;
  e.preventDefault(); // 不取消 dragenter 的话，松手时浏览器不会派发 drop
  e.dataTransfer.dropEffect=z.type==="link"?"link":"move";
  markZone(z);
});
document.addEventListener("dragover",e=>{
  const z=dropZone(e.target,e.clientY);
  if(!z){markZone(null);return;} // 拖到非放置区时清掉残留高亮
  e.preventDefault();
  e.dataTransfer.dropEffect=z.type==="link"?"link":"move";
  markZone(z);
});
document.addEventListener("drop",e=>{
  const z=dropZone(e.target,e.clientY);if(!z)return;
  e.preventDefault();
  const item=dragItem;
  markZone(null);
  dragItem=null;document.body.classList.remove("dragging-task");
  if(!item)return;
  if(z.type==="moveGoal"){moveGoal(item.id,z.ref,z.level,z.after);save();renderAll();return;}
  if(item.kind!=="task")return;
  const t=taskById(item.id);if(!t)return;
  if(z.type==="link"){if(t.goalId!==z.gid){t.goalId=z.gid;expandedGoals.add(z.gid);}} // 自动展开，让关联结果立刻可见
  else if(z.type==="move"){
    moveTask(item.id,z.ref,z.after);
    if(z.gid&&t.goalId!==z.gid){t.goalId=z.gid;expandedGoals.add(z.gid);} // 插进某目标的成员清单即归属该目标
  }
  else t.goalId="";
  save();renderAll();
});

/* ================= 总渲染 ================= */
const RENDER={schedule:renderSchedule,day:renderDay,week:renderWeek,month:renderMonth,mprogress:renderMProgress,year:renderYear,kanban:renderKanban};
function renderAll(){
  buildNav();renderBanner();
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+state.view).classList.add("active");
  RENDER[state.view]();
}
function isModalOpen(){return $("#taskModal").classList.contains("show")||$("#goalModal").classList.contains("show");}
function initializePlanner(){
  $("#tType").innerHTML=TYPES.map(t=>`<option>${t}</option>`).join("");
  $("#gLevel").innerHTML=GOAL_LEVELS.map(([k,label])=>`<option value="${k}">${label}目标</option>`).join("");
  applyTheme();buildFilters();renderAll();
  if(dateWatcherStarted)return;
  dateWatcherStarted=true;
  setInterval(rollDate,1000);
  initHolidays(); // 后台同步最新官方节假日数据，失败时保留内置兜底
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){rollDate();pullRemote();}}); // 切回标签页时主动拉云端，多设备不再停留在旧内容
  window.addEventListener("focus",pullRemote);
  setInterval(()=>{if(!document.hidden)pullRemote();},60000); // 常开页面的兜底轮询
  window.addEventListener("resize",()=>{if(state.view==="year")drawYearChart(parseD(state.selDate).getFullYear(),statsPool(filteredTasks()));});
}
window.bootstrapPlanner=bootstrapPlanner;
