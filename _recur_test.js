// 桌面壳 planner.js 在桩化 DOM 里执行；它 import 的 core 模块用**真实实现**挂进 vm 全局，
// 于是断言覆盖的是 core 的真代码，而不是壳里残留的平行副本。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pinyin } from "pinyin-pro";
import * as coreDates from "./src/core/dates.js";
import * as coreClock from "./src/core/clock.js";
import * as coreConstants from "./src/core/constants.js";
import * as coreHolidays from "./src/core/holidays.js";
import * as coreFilters from "./src/core/filters.js";
import * as coreRecur from "./src/core/recur.js";
import * as coreSchema from "./src/core/schema.js";
import * as coreSelectors from "./src/core/selectors.js";
import * as coreGoals from "./src/core/goals.js";

const plannerPath=process.argv[2];
const html=fs.readFileSync(process.argv[3]||path.resolve(path.dirname(plannerPath),"..","index.html"),"utf8");
const src=fs.readFileSync(plannerPath,"utf8");
// 剥掉 import 行：这些符号下面直接挂到 vm 全局，vm 里的自由标识符就能解析到 core 实现
const executableSrc=src.split("\n").filter(l=>!/^\s*import[\s\S]*?from\s+"[^"]+";\s*$/.test(l)).join("\n");

// core 的时钟锚到夹具那天：core 是在 Node 里真实加载的，拿不到 vm 的假 Date
coreClock.setToday("2026-09-18");

function makeEl(){
  const el={
    style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){},querySelector(){return makeEl()},querySelectorAll(){return[]},
    closest(){return null},getBoundingClientRect(){return{top:0,bottom:0,left:0,right:0,width:100,height:20}},
    setAttribute(){},appendChild(){},getContext(){return new Proxy({},{get:(t,p)=>p==="measureText"?()=>({width:8}):()=>{}})},
    value:"",checked:false,textContent:"",innerHTML:"",clientWidth:200,clientHeight:170,width:0,height:0,
    get parentElement(){return makeEl()},
  };
  return new Proxy(el,{get:(t,p)=>p in t?t[p]:undefined,set:(t,p,v)=>{t[p]=v;return true}});
}
// 预置一条循环任务 + 一条单次任务，显式走 setState()+normalize() 建 state
const initialState={
  tasks:[{id:"t7",title:"喝水",type:"饮食健康",priority:2,status:"todo",start:"2026-09-01",end:"2026-09-30",
    progress:0,plannedTime:5,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"",note:"",
    recur:{freq:"daily",days:[],mday:1},doneOn:{"2026-09-17":"2026-09-17"}},
   {id:"t8",title:"写周报",type:"工作项目",priority:1,status:"doing",start:"2026-09-16",end:"2026-09-19",
    progress:40,plannedTime:60,actualTime:30,course:false,goalId:"",note:""}],
  goals:{weekly:[],monthly:[],yearly:[],reviews:[]},view:"day",theme:"e",
  filters:{year:"",month:"",prio:"",status:"",type:"",slot:""},selDate:"2026-09-18",
  kanbanMode:"status",onlyOverdue:false,onlyLate:false};
const store={};
const els={};
const getEl=s=>els[s]||(els[s]=makeEl());
class TestDate extends Date{
  constructor(...args){super(...(args.length?args:[2026,8,18,12]));}
  static now(){return new Date(2026,8,18,12).getTime();}
}
const ctx=vm.createContext({
  console,Date:TestDate,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},
  document:{body:getEl("body"),querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},createElement:()=>makeEl(),hidden:false},
  window:{addEventListener(){},devicePixelRatio:1},
  getComputedStyle:()=>({getPropertyValue:()=>"#000"}),
  alert:m=>{ctx.__alert=m},confirm:()=>true,
  // core 导出挂进 vm（含 planner 里用的别名 TODAY）
  ...coreDates,...coreConstants,...coreHolidays,...coreFilters,...coreRecur,...coreSelectors,...coreGoals,
  ...coreSchema, TODAY:coreClock.today, pinyin,
});
/* state 是 core 里的可变单例，ESM live binding 不会同步进 vm 全局，所以包一层：
   每次 setState 后把引用重新刷进 ctx，壳与 core 才看到同一个对象 */
const coreSetState=coreSchema.setState;
ctx.setState=(v)=>{coreSetState(v);ctx.state=coreSchema.state;};
ctx.globalThis=ctx;
try{vm.runInContext(executableSrc,ctx,{filename:"planner.js"})}catch(e){console.log("[setup] 顶层抛错（渲染桩不全不影响取函数）:",e.message)}
vm.runInContext(`setState(${JSON.stringify(initialState)})`,ctx);

const F=name=>ctx[name];
let pass=0,fail=0;
function eq(label,got,want){
  const a=JSON.stringify(got),b=JSON.stringify(want);
  if(a===b){pass++;console.log("  ok   "+label+" = "+a)}
  else{fail++;console.log("  FAIL "+label+" got "+a+" want "+b)}
}
const occ=(t,from,to)=>F("occurrencesBetween")(t,from,to);

console.log("\n== 展开引擎 ==");
const daily={recur:{freq:"daily",days:[],mday:1},start:"2026-09-01",end:"2026-09-10",doneOn:{}};
eq("每天 9/1~9/10 次数",occ(daily,"2026-09-01","2026-09-10").length,10);
eq("窗口外不展开",occ(daily,"2026-09-11","2026-09-20").length,0);
eq("部分窗口",occ(daily,"2026-09-05","2026-09-07"),["2026-09-05","2026-09-06","2026-09-07"]);

const weekly={recur:{freq:"weekly",days:[1,3,5],mday:1},start:"2026-09-01",end:"2026-09-30",doneOn:{}};
eq("每周一三五 9月全部发生日",occ(weekly,"2026-09-01","2026-09-30"),
  ["2026-09-02","2026-09-04","2026-09-07","2026-09-09","2026-09-11","2026-09-14","2026-09-16","2026-09-18","2026-09-21","2026-09-23","2026-09-25","2026-09-28","2026-09-30"]);
eq("周日不展开",F("occursOn")(weekly,"2026-09-06"),false);
eq("窗口首日之前就停",F("nextOccurrence")(weekly,"2026-08-01"),"2026-09-02");
eq("窗口耗尽返回空",F("prevOccurrence")(weekly,"2026-09-02"),"");

const m31={recur:{freq:"monthly",days:[],mday:31},start:"2026-01-01",end:"2026-12-31",doneOn:{}};
eq("每月31号→短月按月末",occ(m31,"2026-01-01","2026-04-30"),["2026-01-31","2026-02-28","2026-03-31","2026-04-30"]);
const m30={recur:{freq:"monthly",days:[],mday:30},start:"2024-01-01",end:"2024-03-31",doneOn:{}};
eq("每月30号在闰年2月=2/29",occ(m30,"2024-02-01","2024-02-29"),["2024-02-29"]);
const m1={recur:{freq:"monthly",days:[],mday:1},start:"2026-09-01",end:"2026-12-31",doneOn:{}};
eq("每月1号",occ(m1,"2026-09-01","2026-12-31"),["2026-09-01","2026-10-01","2026-11-01","2026-12-01"]);
// 2026-09-01 是周二；9/5(六)、9/6(日) 应被工作日规则跳过
const wd={recur:{freq:"workday",days:[],mday:1},start:"2026-09-01",end:"2026-09-10",doneOn:{}};
eq("工作日 9/1~9/10（跳过六日）",occ(wd,"2026-09-01","2026-09-10"),
  ["2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-09-07","2026-09-08","2026-09-09","2026-09-10"]);
eq("工作日 recurText",F("recurText")(wd),"法定工作日");
// 国庆 10/1~10/7 放假全排除；10/8(四)10/9(五) 正常；10/10(六) 补班算工作日
const wdOct={recur:{freq:"workday",days:[],mday:1},start:"2026-10-01",end:"2026-10-11",doneOn:{}};
eq("工作日扣除国庆·含10/10补班",occ(wdOct,"2026-10-01","2026-10-11"),
  ["2026-10-08","2026-10-09","2026-10-10"]);
// 9/20(日)补班算工作日；9/25(五)中秋放假被扣除
const wdMid={recur:{freq:"workday",days:[],mday:1},start:"2026-09-19",end:"2026-09-26",doneOn:{}};
eq("工作日含9/20补班·扣9/25中秋",occ(wdMid,"2026-09-19","2026-09-26"),
  ["2026-09-20","2026-09-21","2026-09-22","2026-09-23","2026-09-24"]);
// 2025 春节 1/28~2/4 放假；1/26(日)、2/8(六) 补班算工作日
const wdCn25={recur:{freq:"workday",days:[],mday:1},start:"2025-01-25",end:"2025-02-09",doneOn:{}};
eq("2025春节：补班日算工作日·假期扣除",occ(wdCn25,"2025-01-25","2025-02-09"),
  ["2025-01-26","2025-01-27","2025-02-05","2025-02-06","2025-02-07","2025-02-08"]);
// 未收录年份退回普通周一至周五（2027-01-01 是周五；1/2六 1/3日 排除）
const wd27={recur:{freq:"workday",days:[],mday:1},start:"2027-01-01",end:"2027-01-03",doneOn:{}};
eq("未收录年份2027退回普通周",occ(wd27,"2027-01-01","2027-01-03"),["2027-01-01"]);

console.log("\n== 官方源同步 applyHolidayYear ==");
const ev=expr=>vm.runInContext(expr,ctx); // const 声明不挂在 ctx 属性上，只能在 vm 内求值
// 空载荷/无有效条目不得覆盖已有内置数据
eq("空载荷拒绝",F("applyHolidayYear")("2026",{year:2026,days:[]}),false);
eq("2026仍为内置口径",ev('HOLIDAY_SRC["2026"]'),"builtin");
// 灌入 2027（1/1周五放假、1/3周日补班），并混入脏条目应被过滤
const applied=F("applyHolidayYear")("2027",{year:2027,days:[
  {name:"元旦",date:"2027-01-01",isOffDay:true},
  {name:"补班",date:"2027-01-03",isOffDay:false},
  {name:"错年份",date:"2026-05-11",isOffDay:true},
  {name:"坏格式",date:"2027/01/02",isOffDay:true},
  {name:"缺字段",date:"2027-01-04"}]})&&ev('HOLIDAY_SRC["2027"]');
eq("有效载荷接受并标注live",applied,"live");
eq("2027/1/1(五)放假不算工作日",F("isLegalWorkday")("2027-01-01"),false);
eq("2027/1/3(日)补班算工作日",F("isLegalWorkday")("2027-01-03"),true);
eq("脏条目未混入(1/2六非补班)",F("isLegalWorkday")("2027-01-02"),false);
const wd27b={recur:{freq:"workday",days:[],mday:1},start:"2027-01-01",end:"2027-01-04",doneOn:{}};
eq("同步后展开走法规口径",occ(wd27b,"2027-01-01","2027-01-04"),["2027-01-03","2027-01-04"]);
eq("字标：国庆10/1(首日)显休",F("dayMarkBadge")("2026-10-01"),'<i class="dmark off">休</i>');
eq("字标：国庆内周六也显休",F("dayMarkBadge")("2026-10-03"),'<i class="dmark off">休</i>');
eq("字标：live 年份跟随同步数据",F("dayMarkBadge")("2027-01-01"),'<i class="dmark off">休</i>');
eq("字标：9/20(日)补班显班",F("dayMarkBadge")("2026-09-20"),'<i class="dmark work">班</i>');
eq("字标：普通周五无标",F("dayMarkBadge")("2026-09-18"),"");
eq("字标：普通周六标末",F("dayMarkBadge")("2026-09-19"),'<i class="dmark wkend">末</i>');
eq("字标：无数据年份周一无标",F("dayMarkBadge")("2028-06-12"),"");
eq("字标：无数据年份周六也标末",F("dayMarkBadge")("2028-06-10"),'<i class="dmark wkend">末</i>');
eq("底色：9/25放假off",F("dayTint")("2026-09-25")," off");
eq("底色：9/20补班mk（周末补班优先灰不显粉）",F("dayTint")("2026-09-20")," mk");
eq("底色：9/19周末wkend",F("dayTint")("2026-09-19")," wkend");
eq("底色：9/18普通日无",F("dayTint")("2026-09-18"),"");
console.log("\n== 信息行 dayInfoBadge（农历/节气/节日，对齐参考图）==");
eq("普通日显农历(9/1=七月二十)",F("dayInfoBadge")("2026-09-01"),'<i class="dname">二十</i>');
eq("节气绿标(9/7白露)",F("dayInfoBadge")("2026-09-07"),'<i class="dname n-term">白露</i>');
eq("节气绿标(9/23秋分)",F("dayInfoBadge")("2026-09-23"),'<i class="dname n-term">秋分</i>');
eq("教师节红标(9/10)",F("dayInfoBadge")("2026-09-10"),'<i class="dname n-hol">教师节</i>');
eq("国耻日红标(9/18)",F("dayInfoBadge")("2026-09-18"),'<i class="dname n-hol">国耻日</i>');
eq("库公历窄口径节日不显(9/19=初九)",F("dayInfoBadge")("2026-09-19"),'<i class="dname">初九</i>');
eq("农历传统节日保留(1/26腊八节)",F("dayInfoBadge")("2026-01-26"),'<i class="dname n-hol">腊八节</i>');
eq("农历初一显月名(9/11=八月)",F("dayInfoBadge")("2026-09-11"),'<i class="dname n-term">八月</i>');
eq("假期首日显假期名(9/25中秋节)",F("dayInfoBadge")("2026-09-25"),'<i class="dname n-hol">中秋节</i>');
eq("假期次日回归农历(9/26=十六)",F("dayInfoBadge")("2026-09-26"),'<i class="dname">十六</i>');
eq("国庆10/1假期名优先(国庆节)",F("dayInfoBadge")("2026-10-01"),'<i class="dname n-hol">国庆节</i>');
eq("国庆次日农历(10/2=廿二)",F("dayInfoBadge")("2026-10-02"),'<i class="dname">廿二</i>');
eq("无节假日数据年份农历照常",/^<i class="dname">[^<]+<\/i>$/.test(F("dayInfoBadge")("2028-06-12")),true);
// 无 fetch 的桩环境里 initHolidays 必须安静跳过（同步返回，不抛错）
F("initHolidays")();
eq("桩环境无fetch不破坏内置口径",ev('HOLIDAY_SRC["2026"]'),"builtin");

console.log("\n== 打卡与连续（今天 = 2026-09-18 周五）==");
const t2={recur:{freq:"daily",days:[],mday:1},start:"2026-09-01",end:"2026-09-30",doneOn:{}};
F("toggleOcc")(t2,"2026-09-18");
eq("打卡写入 doneOn",t2.doneOn["2026-09-18"],"2026-09-18");
F("toggleOcc")(t2,"2026-09-18");
eq("再点取消",F("occDone")(t2,"2026-09-18"),false);
t2.doneOn={"2026-09-15":"x","2026-09-16":"x","2026-09-17":"x"};
eq("今天未打卡→从上一个发生日往前数",F("recurStreak")(t2),3);
t2.doneOn["2026-09-18"]="x";
eq("今天已打卡计入连续",F("recurStreak")(t2),4);
delete t2.doneOn["2026-09-17"];
eq("昨天断档→只连续到今天这 1 次",F("recurStreak")(t2),1);
const wk={recur:{freq:"weekly",days:[1,3,5],mday:1},start:"2026-08-01",end:"2026-12-31",
  doneOn:{"2026-09-16":"x","2026-09-14":"x","2026-09-11":"x"}};
eq("每周任务按发生日数连续",F("recurStreak")(wk),3);
eq("本月应发生/已打卡",F("recurDoneIn")(wk,"2026-09-01","2026-09-30"),{done:3,total:13});
eq("窗口起点之前的打卡不算数",F("recurDoneIn")({recur:{freq:"daily",days:[],mday:1},start:"2026-09-10",end:"2026-09-20",doneOn:{"2026-09-01":"x","2026-09-12":"x"}},"2026-09-01","2026-09-20"),{done:1,total:11});

console.log("\n== 脚本内部 state（由 setState()+normalize() 建出）==");
eq("splitId 实例 id",((r)=>({id:r.task&&r.task.id,date:r.date}))(F("splitId")("t7@2026-09-18")),{id:"t7",date:"2026-09-18"});
eq("splitId 定义 id",((r)=>({id:r.task&&r.task.id,date:r.date}))(F("splitId")("t7")),{id:"t7",date:""});
eq("splitId 未知 id",((r)=>({task:!!r.task,date:r.date}))(F("splitId")("nope@2026-09-18")),{task:false,date:"2026-09-18"});
eq("tasksOn 按日展开（循环 t7 + 单次 t8）",F("tasksOn")("2026-09-18").map(t=>t.id),["t7","t8"]);
eq("tasksOn 窗口外只剩单次",F("tasksOn")("2026-10-05").map(t=>t.id),[]);
eq("循环任务不进 statsPool",F("statsPool")(F("tasksOn")("2026-09-18")).map(t=>t.id),["t8"]);
eq("循环任务窗口已过也不算逾期",F("isOverdue")(Object.assign({},F("taskById")("t7"),{end:"2026-09-01",status:"todo"})),false);
/* 逾期边界：时钟锚在 2026-09-18，"今日到期"不能算逾期（补此断言前，把 < 改成 <= 测试仍全绿） */
const ov=o=>F("isOverdue")(Object.assign({},F("taskById")("t8"),o));
eq("昨天截止未完成 = 逾期",ov({end:"2026-09-17",status:"todo"}),true);
eq("今天截止未完成 ≠ 逾期（边界）",ov({end:"2026-09-18",status:"todo"}),false);
eq("明天截止 ≠ 逾期",ov({end:"2026-09-19",status:"todo"}),false);
eq("已过截止但已完成 ≠ 逾期",ov({end:"2026-09-10",status:"done"}),false);
eq("课程不计逾期",ov({end:"2026-09-10",status:"todo",course:true}),false);
eq("存量数据被补齐 doneOn",Object.keys(F("taskById")("t7").doneOn),["2026-09-17"]);
eq("recurText 每天",F("recurText")(F("taskById")("t7")),"每天");
eq("recurText 每周",F("recurText")({recur:{freq:"weekly",days:[1,3],mday:1}}),"每一、三");
eq("recurText 每月",F("recurText")({recur:{freq:"monthly",days:[],mday:15}}),"每月 15 号");
const inst=F("taskItemHTML")(F("taskById")("t7"),{occ:"2026-09-18"});
eq("实例条目用复合 id",/data-id="t7@2026-09-18"/.test(inst),true);
eq("实例条目显示循环徽标",/badge-recur/.test(inst),true);
eq("实例条目显示本月 1\/30（9\/17 已打卡）",/本月 <b>1\/30<\/b> 次 · <span class="streak">连续 1 次<\/span>/.test(inst),true);
eq("实例条目不给复制按钮",/data-act="copy"/.test(inst),false);
const def=F("taskItemHTML")(F("taskById")("t7"),{});
eq("定义条目仍是原 id",/data-id="t7"/.test(def),true);
eq("定义条目显示状态而非循环徽标",/badge-recur/.test(def),false);
eq("月历紧凑条目用复合 id",/data-id="t7@2026-09-20"/.test(F("miniTaskHTML")(F("taskById")("t7"),"2026-09-20")),true);

console.log("\n== 旧数据迁移 normalize ==");
const old={tasks:[
  {id:"t1",title:"早起",status:"done",start:"2026-09-01",end:"2026-09-18",fixed:true,doneAt:"2026-09-10"},
  {id:"t2",title:"普通",status:"todo",start:"2026-09-01",end:"2026-09-05",fixed:false},
  {id:"t3",title:"旧课",course:true,dow:3,fixed:true,start:"2026-09-01",end:"2026-09-30"},
],goals:{weekly:["字符串目标"],monthly:[],yearly:[],reviews:[]}};
const m=F("normalize")(JSON.parse(JSON.stringify(old)));
eq("fixed→daily",m.tasks[0].recur,{freq:"daily",days:[],mday:1});
eq("已完成的旧习惯只补实际完成那 1 条",Object.keys(m.tasks[0].doneOn),["2026-09-10"]);
eq("fixed 字段已删",m.tasks[0].fixed,undefined);
eq("非 fixed 不加 recur",m.tasks[1].recur,null);
eq("课程不叠加循环",m.tasks[2].recur,null);
eq("课程保留 dow",m.tasks[2].dow,3);
eq("课程不记完成日",m.tasks[2].doneAt,"");
eq("字符串目标仍被升级",m.goals.weekly[0].title==="字符串目标",true);
const bad={tasks:[
  {id:"t9",title:"脏数据",recur:{freq:"yearly",days:[],mday:1},doneOn:{"2026-09-01":"x"}},
  {id:"t10",recur:{freq:"weekly",days:["3",3,3,9],mday:1},start:"2026-09-03",end:"2026-09-20"},
  {id:"t11",recur:{freq:"monthly",days:[],mday:99},start:"2026-09-01",end:"2026-09-30"},
  {id:"t12",recur:{freq:"daily",days:[],mday:1},status:"done",start:"2026-09-01",end:"2026-09-05",doneAt:"2026-09-09"},
],goals:{}};
const b=F("normalize")(JSON.parse(JSON.stringify(bad)));
eq("未知 freq 归 null",b.tasks[0].recur,null);
eq("无 recur 时丢掉 doneOn",b.tasks[0].doneOn,{});
eq("weekly 的 days 去噪排序",b.tasks[1].recur.days,[3]);
eq("mday 越界钳到 31",b.tasks[2].recur.mday,31);
eq("每月31号在9月=9\/30",F("occursOn")(b.tasks[2],"2026-09-30"),true);
eq("循环任务不保留 doneAt 语义（由 isLateDone 挡）",F("isLateDone")(b.tasks[3]),false);

console.log("\n== 各视图渲染（跑通 + 口径抽查）==");
function renders(name){
  try{F(name)();return els["#view-"+({"renderDay":"day","renderWeek":"week","renderMonth":"month","renderYear":"year","renderKanban":"kanban","renderMProgress":"mprogress","renderSchedule":"schedule"})[name]].innerHTML;}
  catch(e){fail++;console.log("  FAIL "+name+" 抛错: "+e.message);return "";}
}
const dHTML=renders("renderDay");
eq("日视图渲染出今日循环实例",/data-id="t7@2026-09-18"/.test(dHTML),true);
eq("日视图单次任务用定义 id",/data-id="t8"/.test(dHTML),true);
eq("日视图今日完成率分母只算 t8（0/1）",/0%<\/b>（0\/1）/.test(dHTML),true);
eq("日视图标注循环不计入",/今日循环 1 项不计入/.test(dHTML),true);
eq("日视图不再有「固定任务」字样",/固定任务/.test(dHTML),false);
// 日视图左列小日历：9/25~27 三个休、9/20 一个班；红标 3（教师节/国耻日/中秋节）绿标 3（白露/八月/秋分），其余 24 格显农历
eq("日视图小日历休字标=3",(dHTML.match(/class="dmark off"/g)||[]).length,3);
eq("日视图小日历班字标=1",(dHTML.match(/class="dmark work"/g)||[]).length,1);
eq("日视图小日历末字标=5（六日扣除班1/休2后）",(dHTML.match(/class="dmark wkend"/g)||[]).length,5);
eq("日视图小日历红标=3",(dHTML.match(/class="dname n-hol"/g)||[]).length,3);
eq("日视图小日历绿标=3",(dHTML.match(/class="dname n-term"/g)||[]).length,3);
eq("日视图小日历农历行=24（30格-红3-绿3）",(dHTML.match(/class="dname(?! n-)/g)||[]).length,24);
const wHTML=renders("renderWeek");
eq("周视图列出自周五的循环实例",/data-id="t7@2026-09-18"/.test(wHTML),true);
eq("周视图概览「已完成/总数」= 0/1（不含循环）",/stat-num">0\/1<\/div><div class="stat-label">已完成 \/ 总数/.test(wHTML),true);
eq("周视图标注另 1 条循环不计入",/另 1 条循环不计入/.test(wHTML),true);
const goalState={tasks:[
  {id:"t9",title:"上周目标任务",type:"学习成长",priority:2,status:"done",start:"2026-09-07",end:"2026-09-11",progress:100,goalId:"g1"},
  {id:"t10",title:"本周目标任务",type:"学习成长",priority:2,status:"doing",start:"2026-09-18",end:"2026-09-18",progress:50,goalId:"g2"},
  {id:"t11",title:"上周遗留任务",type:"学习成长",priority:2,status:"todo",start:"2026-09-07",end:"2026-09-11",progress:0,goalId:"g3"}
],goals:{weekly:[{id:"g1",title:"上周已完成目标"},{id:"g2",title:"本周进行中目标"},{id:"g3",title:"上周未完成目标"},{id:"g4",title:"新建空目标"}],monthly:[],yearly:[],reviews:[]},view:"week",theme:"e",filters:{year:"",month:"",prio:"",status:"",type:"",slot:""},selDate:"2026-09-18",kanbanMode:"status",onlyOverdue:false,onlyLate:false};
F("setState")(goalState);
const weekGoalHTML=renders("renderWeek");
eq("周视图不显示上周已完成目标",/上周已完成目标/.test(weekGoalHTML),false);
eq("周视图显示本周有任务的目标",/本周进行中目标/.test(weekGoalHTML),true);
eq("周视图保留上周未完成目标",/上周未完成目标/.test(weekGoalHTML),true);
eq("周视图显示新建空目标",/新建空目标/.test(weekGoalHTML),true);
const dayGoalHTML=renders("renderDay");
eq("日视图不显示上周已完成目标",/上周已完成目标/.test(dayGoalHTML),false);
eq("日视图显示本周有任务的目标",/本周进行中目标/.test(dayGoalHTML),true);
eq("日视图保留上周未完成目标",/上周未完成目标/.test(dayGoalHTML),true);
eq("日视图显示新建空目标",/新建空目标/.test(dayGoalHTML),true);
eq("空目标保留拖拽关联入口",/data-gid="g4" data-level="weekly" draggable="true"/.test(dayGoalHTML),true);
eq("空目标显示拖拽提示",/拖任务到此处即可关联/.test(dayGoalHTML),true);
F("taskById")("t10").goalId="g4";
eq("关联任务后目标仍显示",/新建空目标/.test(renders("renderDay")),true);
F("taskById")("t10").goalId="";
eq("取消最后一条任务关联后日视图保留空目标",/新建空目标/.test(renders("renderDay")),true);
eq("取消最后一条任务关联后周视图保留空目标",/新建空目标/.test(renders("renderWeek")),true);
F("setState")(initialState);
const moHTML=renders("renderMonth");
eq("月历格子里有循环实例",/data-id="t7@2026-09-05"/.test(moHTML),true);
eq("月历标注含循环实例",/含循环实例/.test(moHTML),true);
// 2026-09 月历：休 3（25~27）/ 班 1（20）；红标 3（教师节/国耻日/中秋节）绿标 3（白露/八月/秋分）
eq("月历休字标=3（9/25~27）",(moHTML.match(/class="dmark off"/g)||[]).length,3);
eq("月历班字标=1（9/20）",(moHTML.match(/class="dmark work"/g)||[]).length,1);
eq("月历末字标=5",(moHTML.match(/class="dmark wkend"/g)||[]).length,5);
eq("月历红标=3",(moHTML.match(/class="dname n-hol"/g)||[]).length,3);
eq("月历绿标=3",(moHTML.match(/class="dname n-term"/g)||[]).length,3);
eq("月历农历行=24",(moHTML.match(/class="dname(?! n-)/g)||[]).length,24);
eq("月历 20 号带班字标",/data-date="2026-09-20"[\s\S]*?dmark work/.test(moHTML),true);
eq("月历 25 号带休字标",/data-date="2026-09-25"[\s\S]*?dmark off/.test(moHTML),true);
eq("月历普通日也显农历(17号初七)",/data-date="2026-09-17"[\s\S]*?dname">初七</.test(moHTML),true);
eq("月度统计标注 1 条循环未计入",/1 条循环未计入/.test(moHTML),true);
const mpHTML=renders("renderMProgress");
eq("月进度表不含循环行",/data-id="t7"/.test(mpHTML),false);
eq("月进度表含单次任务行",/data-id="t8"/.test(mpHTML),true);
eq("月进度表标注 1 条循环未列入",/1 条循环未列入/.test(mpHTML),true);
const kHTML=renders("renderKanban");
eq("看板不含循环任务",/data-id="t7"/.test(kHTML),false);
eq("看板标注循环任务不在此列",/另有 1 条循环任务不在此列/.test(kHTML),true);
eq("看板展示拖拽状态提示",/拖拽任务到其他列以更新状态/.test(kHTML),true);
F("setState")({...initialState,kanbanDragHintSeen:true});
const dismissedHintHTML=renders("renderKanban");
eq("完成首次拖拽后隐藏提示",/拖拽任务到其他列以更新状态/.test(dismissedHintHTML),false);
F("setState")(initialState);
const yHTML=renders("renderYear");
eq("年视图标注 1 条循环未计入",/1 条循环未计入/.test(yHTML),true);
renders("renderSchedule");
const bHTML=(F("renderBanner")(),els["#banner"].innerHTML);
eq("顶部结果数按定义计（2 条）",/共 <b[^>]*>2<\/b> 条结果（含 1 条循环任务，各按 1 条计）/.test(bHTML),true);

console.log("\n== 任务标题搜索 ==");
const searchState={...initialState,tasks:[
  {...initialState.tasks[1],id:"t1",title:"编写 API 周报"},
  {...initialState.tasks[1],id:"t2",title:"复盘 api 文档",status:"todo",priority:2},
  {...initialState.tasks[1],id:"t3",title:"整理资料",note:"API 周报"},
  {...initialState.tasks[0],id:"t4",title:"每日阅读"},
  {...initialState.tasks[1],id:"t5",title:"API 课程",course:true,dow:5,timeSlot:"08:00-09:40"},
  {...initialState.tasks[1],id:"t6",title:"校对 [草稿].* <标签>"}
]};
function searchIds(keyword,filters={}){
  F("setState")({...searchState,filters:{...initialState.filters,keyword,...filters}});
  return F("filteredTasks")().map(t=>t.id);
}
eq("旧筛选状态自动补齐空搜索词",F("defaultState")().filters.keyword,"");
eq("空搜索保留所有任务",searchIds(""),["t1","t2","t3","t4","t5","t6"]);
eq("中文关键字包含匹配且不搜索备注",searchIds("周报"),["t1"]);
eq("忽略英文大小写及首尾空格",searchIds("  aPi  "),["t1","t2","t5"]);
eq("与状态、优先级组合筛选",searchIds("api",{status:"todo",prio:"2"}),["t2"]);
eq("其他筛选仍可排除匹配标题",searchIds("api",{year:"2025"}),[]);
eq("循环任务可按标题搜索",searchIds("阅读"),["t4"]);
eq("特殊字符按字面量匹配",searchIds("[草稿].*"),["t6"]);
eq("无匹配返回空数组",searchIds("没有这项任务"),[]);
eq("纯空白等同未搜索",searchIds(" \t "),["t1","t2","t3","t4","t5","t6"]);
eq("纯空白不激活筛选",!!F("hasActiveFilter")(),false);
searchIds("周报");
eq("搜索被识别为有效筛选",!!F("hasActiveFilter")(),true);
const searchedDay=renders("renderDay");
eq("日视图显示匹配任务",/data-id="t1"/.test(searchedDay),true);
eq("日视图不显示未匹配任务",/data-id="t2"/.test(searchedDay),false);
eq("日视图显示筛选前后数量",/1 \/ 4<\/span>/.test(searchedDay),true);
eq("搜索不匹配课程时课表不会忽略筛选",/data-id="t5"/.test(renders("renderSchedule")),false);
searchIds("课程");
eq("匹配课程仍显示在课表",/data-id="t5"/.test(renders("renderSchedule")),true);
searchIds("<标签>");
F("renderBanner")();
eq("筛选摘要安全转义搜索词",els["#banner"].innerHTML.includes("标题匹配「&lt;标签&gt;」"),true);
F("buildFilters")();
eq("重新构建筛选栏恢复搜索词",els["#fKeyword"].value,"<标签>");
els["#fKeyword"].value="周报";
F("searchTasks")({isComposing:true});
eq("中文输入法组词时不更新搜索",F("filteredTasks")().map(t=>t.id),["t6"]);
F("searchTasks")({});
eq("中文输入完成后实时更新搜索",F("filteredTasks")().map(t=>t.id),["t1"]);
els["#fKeyword"].value="";
F("searchTasks")({});
eq("清空输入恢复所有结果",F("filteredTasks")().length,6);
F("setState")(initialState);
F("buildFilters")();
eq("加载无搜索字段的旧状态时输入框为空",els["#fKeyword"].value,"");

console.log("\n== 拼音首字母搜索 ==");
eq("xz 匹配写周报",F("titleMatchesKeyword")("写周报","xz"),true);
eq("xzb 匹配写周报完整首字母",F("titleMatchesKeyword")("写周报","xzb"),true);
eq("首字母必须连续，不跳过中间字符",F("titleMatchesKeyword")("写周报","xb"),false);
eq("末尾首字母可匹配且不搜索备注",searchIds("zb"),["t1"]);
eq("忽略首字母大小写及首尾空格",searchIds("  YD  "),["t4"]);
eq("完整循环任务首字母可搜索",searchIds("mryd"),["t4"]);
eq("拼音首字母与状态筛选叠加",searchIds("yd",{status:"doing"}),[]);
eq("课程可按首字母搜索",searchIds("kc"),["t5"]);
eq("英文与中文首字母连续匹配",searchIds("apizb"),["t1"]);
eq("英文、数字和首字母可混合",F("titleMatchesKeyword")("完成ABC123任务","abc123rw"),true);
eq("重庆使用词语读音 cq",F("titleMatchesKeyword")("重庆出差","cqcc"),true);
eq("银行使用词语读音 yh",F("titleMatchesKeyword")("银行转账","yhzz"),true);
eq("无匹配首字母不返回任务",searchIds("zzzz"),[]);
eq("缺少标题不会抛错",F("titleMatchesKeyword")(undefined,"yd"),false);
searchIds("yd");
const renamedTask=F("taskById")("t4");
const originalTitle=renamedTask.title;
renamedTask.title="每日跑步";
eq("修改标题后旧首字母立即失效",F("filteredTasks")().length,0);
vm.runInContext('state.filters.keyword="pb"',ctx);
eq("修改标题后新首字母立即生效",F("filteredTasks")().map(t=>t.id),["t4"]);
renamedTask.title=originalTitle;
F("setState")(initialState);

console.log("\n== id 选择器对账（桩 DOM 不会因 id 不存在而抛错，只能靠静态比对）==");
{
  const declared=new Set([...html.matchAll(/\bid="([\w-]+)"/g),...src.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]));
  // 脚本里所有形如 "#xxx" 的字符串都当选择器看待；排除色值与拼接前缀（"#view-"+state.view）
  const used=[...new Set([...src.matchAll(/"#([A-Za-z][\w-]*)"/g)].map(m=>m[1]))]
    .filter(i=>!/^[0-9a-f]{3,8}$/i.test(i)&&!i.endsWith("-"));
  const missing=used.filter(i=>!declared.has(i));
  eq("脚本引用的每个 #id 都真实存在",missing,[]);
  console.log(`  （声明 ${declared.size} 个 id，脚本按选择器引用 ${used.length} 个）`);
}

console.log("\n"+(fail?"有失败":"全部通过")+` — pass ${pass} / fail ${fail}`);
process.exit(fail?1:0);
