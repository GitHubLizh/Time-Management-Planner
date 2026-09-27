// 批量选择（日视图三张列表）：完成切换/删除 + 撤销整体恢复，在桩 DOM 里跑 planner.js 断言
const fs=require("fs"),path=require("path"),vm=require("vm");
const plannerPath=process.argv[2]||path.resolve(__dirname,"src/planner.js");
const html=fs.readFileSync(process.argv[3]||path.resolve(__dirname,"index.html"),"utf8");
const src=fs.readFileSync(plannerPath,"utf8");
const executableSrc=src.replace('import { pinyin } from "pinyin-pro";','const { pinyin } = require("pinyin-pro");');

function makeEl(){
  const el={
    style:{},dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){},querySelector(){return makeEl()},querySelectorAll(){return[]},
    closest(){return null},getBoundingClientRect(){return{top:0,bottom:0,left:0,right:0,width:100,height:20}},
    setAttribute(){},appendChild(){},
    value:"",checked:false,textContent:"",innerHTML:"",clientWidth:200,clientHeight:170,width:0,height:0,
    get parentElement(){return makeEl()},
  };
  return new Proxy(el,{get:(t,p)=>p in t?t[p]:undefined,set:(t,p,v)=>{t[p]=v;return true}});
}
const mkTask=o=>Object.assign({title:"任务",type:"工作项目",priority:2,status:"todo",
  start:"2026-09-18",end:"2026-09-18",progress:0,plannedTime:30,actualTime:0,
  course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"",note:""},o);
const initialState={
  tasks:[
    mkTask({id:"a",title:"第一条"}),
    mkTask({id:"b",title:"第二条",status:"done",progress:100,doneAt:"2026-09-17"}),
    mkTask({id:"c",title:"第三条"}),
    mkTask({id:"r",title:"喝水",recur:{freq:"daily",days:[],mday:1},doneOn:{"2026-09-17":"2026-09-17"}}),
    mkTask({id:"k",title:"课程",course:true,dow:5,timeSlot:"08:00-09:40"}),
  ],
  goals:{weekly:[],monthly:[],yearly:[],reviews:[]},view:"day",theme:"e",
  filters:{year:"",month:"",prio:"",status:"",type:"",slot:"",keyword:""},selDate:"2026-09-18",
  kanbanMode:"status",onlyOverdue:false,onlyLate:false};
const store={};
const els={};
const getEl=s=>els[s]||(els[s]=makeEl());
class TestDate extends Date{
  constructor(...args){super(...(args.length?args:[2026,8,18,12]));}
  static now(){return new Date(2026,8,18,12).getTime();}
}
const ctx=vm.createContext({
  console,require,Date:TestDate,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},
  document:{body:getEl("body"),querySelector:getEl,querySelectorAll:()=>[],addEventListener(){},createElement:()=>makeEl(),hidden:false},
  window:{addEventListener(){},devicePixelRatio:1},
  getComputedStyle:()=>({getPropertyValue:()=>"#000"}),
  alert:m=>{ctx.__alert=m},confirm:()=>true,
});
ctx.globalThis=ctx;
try{vm.runInContext(executableSrc,ctx,{filename:"planner.js"})}catch(e){console.log("[setup] 顶层抛错（渲染桩不全不影响取函数）:",e.message)}
vm.runInContext(`setState(${JSON.stringify(initialState)})`,ctx);

const F=name=>ctx[name];
const R=code=>vm.runInContext(code,ctx);
let pass=0,fail=0;
function eq(label,got,want){
  const a=JSON.stringify(got),b=JSON.stringify(want);
  if(a===b){pass++;console.log("  ok   "+label+" = "+a)}
  else{fail++;console.log("  FAIL "+label+" got "+a+" want "+b)}
}
function clickUndo(){R("(()=>{const fn=pendingUndo;hideUndo();if(fn)fn()})()");}
const snapshot=()=>R('JSON.stringify(state.tasks.map(t=>({id:t.id,status:t.status,progress:t.progress,doneAt:t.doneAt,doneOn:t.doneOn})))');
const ids=()=>R("state.tasks.map(t=>t.id).join(',')");

console.log("\n== 条目渲染：仅传 opts.bulk 时出现复选框 ==");
F("setState")(JSON.parse(JSON.stringify(initialState)));
const plain=F("taskItemHTML")(F("taskById")("a"),{});
eq("普通渲染无复选框",/bulk-chk/.test(plain),false);
const bulk=F("taskItemHTML")(F("taskById")("a"),{bulk:true});
eq("批量渲染有复选框",/class="bulk-chk" data-act="bulk-check"/.test(bulk),true);
eq("未选中时不带 checked",/checked/.test(bulk),false);
R('bulkSel=new Set(["a","r@2026-09-18"])');
const checked=F("taskItemHTML")(F("taskById")("a"),{bulk:true});
eq("选中集合内的任务渲染 checked",/bulk-chk" data-act="bulk-check" checked/.test(checked),true);
const instBulk=F("taskItemHTML")(F("taskById")("r"),{occ:"2026-09-18",bulk:true});
eq("循环实例复选框用复合 id 命中集合",/checked/.test(instBulk),true);
R("bulkSel.clear()");

console.log("\n== 进入/退出批量模式 ==");
R('bulkMode=false;bulkSel=new Set(["ghost"])');
F("setBulkMode")(true);
eq("#bulkBar 显示",els["#bulkBar"].style.display,"flex");
eq("进入模式清空旧选中",R("[...bulkSel].length"),0);
eq("日视图三张列表出现复选框",/bulk-chk/.test(els["#view-day"].innerHTML),true);
eq("今日任务条目在批量列表中",/data-id="a"/.test(els["#view-day"].innerHTML),true);
F("setBulkMode")(false);
eq("退出后隐藏操作条",els["#bulkBar"].style.display,"none");
eq("退出后条目恢复无复选框",/bulk-chk/.test(els["#view-day"].innerHTML),false);

console.log("\n== 勾选与计数 ==");
F("setBulkMode")(true);
F("bulkToggleKey")("a");F("bulkToggleKey")("b");F("bulkToggleKey")("r@2026-09-18");
eq("计数含循环实例",els["#bulkCount"].textContent,"已选 3 条");
F("bulkToggleKey")("b");
eq("取消勾选计数回落",els["#bulkCount"].textContent,"已选 2 条");

console.log("\n== prune：renderDay 清掉不可见 key（桩里 DOM 查询恒空→全清）==");
R('bulkSel=new Set(["a","nope"]);renderDay()');
eq("不可见 key 被清理",R("[...bulkSel].length"),0);
eq("计数同步为 0",els["#bulkCount"].textContent,"已选 0 条");

console.log("\n== 批量完成切换 + 撤销 ==");
F("setState")(JSON.parse(JSON.stringify(initialState)));
F("setBulkMode")(true);
const before=snapshot();
R('bulkSel=new Set(["a","b","r@2026-09-18"]);bulkApplyDone()');
eq("a 未完成→完成",F("taskById")("a").status,"done");
eq("a 进度置 100",F("taskById")("a").progress,100);
eq("a 记录完成日为今天",F("taskById")("a").doneAt,"2026-09-18");
eq("b 已完成→取消",F("taskById")("b").status,"todo");
eq("取消完成后 doneAt 清空",F("taskById")("b").doneAt,"");
eq("循环实例当天打卡",!!F("taskById")("r").doneOn["2026-09-18"],true);
eq("其他日期打卡不受波及",!!F("taskById")("r").doneOn["2026-09-17"],true);
eq("撤销浮条文案",els["#undoMsg"].textContent,"已切换 3 条任务的完成状态");
eq("执行后自动退出批量模式",R("bulkMode"),false);
clickUndo();
eq("撤销后逐条还原",snapshot(),before);

console.log("\n== 批量删除 + 撤销（含循环实例归并与次序还原）==");
F("setState")(JSON.parse(JSON.stringify(initialState)));
F("setBulkMode")(true);
const beforeIds=ids(),beforeSnap=snapshot();
R('bulkSel=new Set(["a","c","r@2026-09-18"]);bulkApplyDelete()');
eq("r 实例归并为删整条定义",ids(),"b,k");
eq("浮条按去重后定义条数计",els["#undoMsg"].textContent,"已删除 3 条任务");
clickUndo();
eq("撤销后 id 次序精确还原",ids(),beforeIds);
eq("撤销后字段完整还原",snapshot(),beforeSnap);
eq("循环任务打卡记录随快照回来",Object.keys(F("taskById")("r").doneOn),["2026-09-17"]);

console.log("\n== 撤销单槽：批量动作覆盖前一条撤销 ==");
F("setState")(JSON.parse(JSON.stringify(initialState)));
F("deleteTask")("k");
R('bulkMode=true;bulkSel=new Set(["a"]);bulkApplyDelete()');
eq("旧的单条删除撤销已被覆盖为批量文案",els["#undoMsg"].textContent,"已删除 1 条任务");
clickUndo();
eq("撤销恢复的是批量删除",ids().includes("a")&&!ids().includes("k"),true);

console.log("\n== 空选择不执行 ==");
F("setState")(JSON.parse(JSON.stringify(initialState)));
R('bulkMode=true;bulkSel.clear();bulkApplyDone();bulkApplyDelete()');
eq("空选择不改任务数组",ids(),"a,b,c,r,k");
eq("空选择不弹提示",ctx.__alert,undefined);

console.log("\n== id 选择器对账 ==");
{
  const declared=new Set([...html.matchAll(/\bid="([\w-]+)"/g),...src.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]));
  const used=[...new Set([...src.matchAll(/"#([A-Za-z][\w-]*)"/g)].map(m=>m[1]))]
    .filter(i=>!/^[0-9a-f]{3,8}$/i.test(i)&&!i.endsWith("-"));
  eq("脚本引用的每个 #id 都真实存在",used.filter(i=>!declared.has(i)),[]);
}

console.log("\n"+(fail?"有失败":"全部通过")+` — pass ${pass} / fail ${fail}`);
process.exit(fail?1:0);
