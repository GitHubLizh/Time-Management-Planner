// 金样本抓取器：在桩 DOM 里用固定数据渲染七个视图，把 innerHTML 落盘。
// 用途：分组几何下沉到 core/selectors.js 前后各跑一次，逐字节 diff 证明输出等价。
// 用法：node _golden_render.mjs <输出文件名>
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pinyin } from "pinyin-pro";
import * as coreClock from "./src/core/clock.js";
import { seedFromCoreImports } from "./_core_seed.mjs";

const out = process.argv[2] || "/tmp/golden.json";
const src = fs.readFileSync("src/planner.js", "utf8");
// 剥掉 import 块（含跨行写法）：这些符号下面直接挂进 vm 全局
const executableSrc = src.replace(/^[ \t]*import[\s\S]*?from\s+"[^"]+";[ \t]*\n/gm, "");
// 按壳的 import 表（含别名）准备 core 符号种子
const seed = await seedFromCoreImports(src);
coreClock.setToday("2026-09-18");

function makeEl() {
  const el = {
    style: {}, dataset: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false } },
    addEventListener(){}, querySelector(){ return makeEl() }, querySelectorAll(){ return [] },
    closest(){ return null }, getBoundingClientRect(){ return { top:0, bottom:0, left:0, right:0, width:100, height:20 } },
    setAttribute(){}, appendChild(){}, getContext(){ return new Proxy({}, { get:(t,p)=>p==="measureText"?()=>({width:8}):()=>{} }) },
    value:"", checked:false, textContent:"", innerHTML:"", clientWidth:600, clientHeight:170, width:0, height:0,
    get parentElement(){ return makeEl() },
  };
  return new Proxy(el, { get:(t,p)=>p in t?t[p]:undefined, set:(t,p,v)=>{t[p]=v;return true} });
}
class TestDate extends Date {
  constructor(...a){ super(...(a.length?a:[2026,8,18,12])); }
  static now(){ return new Date(2026,8,18,12).getTime(); }
}
const store = {}, els = {};
const getEl = s => els[s] || (els[s] = makeEl());
const sandbox = {
  console, Date:TestDate, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){},
  localStorage:{ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} },
  document:{ body:getEl("body"), querySelector:getEl, querySelectorAll:()=>[], addEventListener(){}, createElement:()=>makeEl(), hidden:false },
  window:{ addEventListener(){}, devicePixelRatio:1 },
  getComputedStyle:()=>({ getPropertyValue:()=>"#000" }),
  pinyin, alert(){}, confirm:()=>true,
};
sandbox.TODAY = coreClock.today; // 同一对象就地推进
/* 保留 getter：展开运算会把 seed 的访问器求值成快照，state 被 setState 重新赋值后壳就读不到了 */
Object.defineProperties(sandbox, Object.getOwnPropertyDescriptors(seed));
const ctx = vm.createContext(sandbox);
vm.runInContext(executableSrc, ctx, { filename:"planner.js" });

// 覆盖各分支的夹具：循环+单次+课程、逾期、迟完、目标带成员、跨周跨月、多类型
const fixture = {
  view:"day", theme:"e", selDate:"2026-09-18", kanbanMode:"status",
  filters:{keyword:"",year:"",month:"",prio:"",status:"",type:"",slot:""},
  onlyOverdue:false, onlyLate:false,
  tasks:[
    {id:"t1",title:"写周报",type:"工作项目",priority:1,status:"doing",start:"2026-09-14",end:"2026-09-16",progress:40,plannedTime:60,actualTime:30,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g1",note:"覆盖上周",doneAt:"",recur:null,doneOn:{}},
    {id:"t2",title:"喝水",type:"饮食健康",priority:2,status:"todo",start:"2026-09-01",end:"2026-09-30",progress:0,plannedTime:5,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g1",note:"",doneAt:"",recur:{freq:"daily",days:[],mday:1},doneOn:{"2026-09-17":"2026-09-17","2026-09-18":"2026-09-18"}},
    {id:"t3",title:"高级算法课",type:"学习成长",priority:3,status:"todo",start:"2026-09-01",end:"2026-12-31",progress:0,plannedTime:100,actualTime:0,course:true,room:"教3-201",teacher:"王老师",dow:2,timeSlot:"10:00-11:40",goalId:"",note:"",doneAt:"",recur:null,doneOn:{}},
    {id:"t4",title:"体检报告",type:"生活居家",priority:2,status:"done",start:"2026-09-01",end:"2026-09-10",progress:100,plannedTime:30,actualTime:45,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g2",note:"",doneAt:"2026-09-12",recur:null,doneOn:{}},
    {id:"t5",title:"每月 31 号复盘",type:"心灵成长",priority:4,status:"todo",start:"2026-09-01",end:"2026-12-31",progress:0,plannedTime:20,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g3",note:"",doneAt:"",recur:{freq:"monthly",days:[],mday:31},doneOn:{}},
    {id:"t6",title:"跑步",type:"运动健身",priority:2,status:"done",start:"2026-09-18",end:"2026-09-18",progress:100,plannedTime:30,actualTime:30,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g3",note:"",doneAt:"2026-09-18",recur:null,doneOn:{}},
    {id:"t7",title:"法工作日值日",type:"工作项目",priority:1,status:"todo",start:"2026-09-01",end:"2026-10-31",progress:10,plannedTime:15,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g1",note:"",doneAt:"",recur:{freq:"workday",days:[],mday:1},doneOn:{"2026-09-25":"2026-09-25"}},
    {id:"t8",title:"读一本书",type:"学习成长",priority:2,status:"doing",start:"2026-08-01",end:"2026-09-30",progress:55,plannedTime:300,actualTime:180,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"g4",note:"",doneAt:"",recur:null,doneOn:{}},
  ],
  goals:{
    weekly:[{id:"g1",title:"本周交付"},{id:"gX",title:"空目标"}],
    monthly:[{id:"g2",title:"月度健康"},{id:"g3",title:"月度成长"}],
    yearly:[{id:"g4",title:"年度学习"}],
    reviews:[{year:2026,month:8,note:"八月复盘内容"},{year:2026,month:9,note:""}],
  },
};

const views = ["schedule","day","week","month","mprogress","year","kanban"];
const result = {};
for (const mode of ["status","type"]) {
  for (const v of views) {
    ctx.setState(JSON.parse(JSON.stringify(fixture)));
    ctx.state.view = v;
    ctx.state.kanbanMode = mode;
    vm.runInContext("renderAll()", ctx);
    result[`${v}#${mode}`] = els["#view-" + v].innerHTML;
  }
}
ctx.setState(JSON.parse(JSON.stringify(fixture)));
vm.runInContext("buildNav();renderBanner()", ctx);
result["__nav"] = els["#viewNav"].innerHTML;
result["__banner"] = els["#banner"].innerHTML;

fs.writeFileSync(out, JSON.stringify(result, null, 1), "utf8");
console.log("写入", out, Object.keys(result).length, "段渲染输出，总长",
  Object.values(result).reduce((a,s)=>a+s.length,0), "字符");
