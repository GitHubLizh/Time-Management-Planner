/* 状态模型与工厂：业务数据 + 视图偏好都在同一个对象里，键的归属见 STATE_VIEW_KEYS。
   `state` 是本模块的可变单例，importer 通过 ESM live binding 观察它的重新赋值。零 DOM。 */
import { fmt, dayOf, parseD, addDays } from "./dates.js";
import { today } from "./clock.js";
import { RECUR_RULES, TRASH_LIMIT, TRASH_KEEP_DAYS } from "./constants.js";

let _id=1;
export function mk(o){return Object.assign({title:"",type:"学习成长",priority:2,status:"todo",start:fmt(today),end:fmt(today),progress:0,plannedTime:60,actualTime:0,course:false,room:"",teacher:"",dow:null,timeSlot:"",goalId:"",note:"",doneAt:"",recur:null,doneOn:{}},o,{id:"t"+(_id++)});} // id 放最后：复制时传入整条任务也不能沿用源 id
let _gid=1;
let _tid=1;
export let state;
export function newGoalId(){return "g"+(_gid++);}
export function newTrashId(){return "x"+(_tid++);}
export function defaultState(){
  return {tasks:[],trash:[],goals:{weekly:[],monthly:[],yearly:[],reviews:[]},view:"day",theme:"e",
    filters:{keyword:"",year:"",month:"",prio:"",status:"",type:"",slot:""},
    selDate:fmt(today),kanbanMode:"status",todayMode:"day",kanbanDragHintSeen:false,onlyOverdue:false,onlyLate:false};
}
export function normalize(s){
  const g=s.goals||{};
  const up=arr=>(Array.isArray(arr)?arr:[]).map(x=>typeof x==="string"?{id:newGoalId(),title:x}:(x&&x.id?x:{id:newGoalId(),title:String(x??"")}));
  /* 复盘没有 id，业务键是月份：只收 {m:string, text:string}，其余整条丢掉。
     以前 reviews 全局只读、写不进，脏数据进不来；入口开放后必须钳位——
     外部（手改云端行 / 旧缓存）塞进缺字段的条目时，页面不该渲染出 undefined。 */
  const rv=arr=>(Array.isArray(arr)?arr:[]).filter(x=>x&&typeof x.m==="string"&&x.m)
    .map(x=>({m:x.m,text:typeof x.text==="string"?x.text:""}));
  s.goals={weekly:up(g.weekly),monthly:up(g.monthly),yearly:up(g.yearly),reviews:rv(g.reviews)};
  /* 任务字段钳位抽成一条规则：回收站里存的快照与 tasks 本体同源，
     脏快照一样会在回收站卡片上渲染出 undefined，所以两边过同一个函数。 */
  const nt=t=>{
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
        if(t.status==="done"){const d=dayOf(t.doneAt)||t.end;t.doneOn={[d]:d};} // doneOn 按日索引，秒级 doneAt 得先降回日
      }
      delete t.fixed;
    }
    if(!t.recur)t.doneOn={};
    return t;
  };
  s.tasks.forEach(nt);
  /* 回收站条目形状：{tid 条目号, idx 删除时所在下标, task 任务快照, deletedAt 删除时刻（到秒）}。
     缺 tid 补一个（恢复时按 tid 定位，没有它就没法区分同一条任务的两次删除）；
     缺 task 或缺 deletedAt 的一律丢弃——前者没东西可恢复，后者算不出保留期。 */
  s.trash=(Array.isArray(s.trash)?s.trash:[]).filter(e=>e&&e.task&&typeof e.task.title==="string"&&typeof e.deletedAt==="string"&&e.deletedAt)
    .map(e=>({tid:typeof e.tid==="string"&&e.tid?e.tid:newTrashId(),idx:Math.max(0,parseInt(e.idx,10)||0),task:nt(e.task),deletedAt:e.deletedAt}));
  pruneTrash(s);
  return s;
}
/* 就地执行保留策略：先按删除时刻升序排（清空撤销会把条目乱序塞回来），再掐掉过期与超额两头。
   在 normalize 与各回收站写操作里都会走一次，界面上看到的条数因此永远等于真正落盘的内容。 */
export function pruneTrash(s){
  const cutoff=fmt(addDays(today,-TRASH_KEEP_DAYS));
  s.trash=s.trash.sort((a,b)=>a.deletedAt<b.deletedAt?-1:a.deletedAt>b.deletedAt?1:0)
    .filter(e=>dayOf(e.deletedAt)>=cutoff);
  if(s.trash.length>TRASH_LIMIT)s.trash=s.trash.slice(s.trash.length-TRASH_LIMIT);
  return s.trash;
}
export function setState(value){
  const base=defaultState();
  const source=value&&Array.isArray(value.tasks)?value:{};
  state=normalize({...base,...source,filters:{...base.filters,...(source.filters||{})},goals:source.goals||base.goals});
  _id=maxSuffix(state.tasks,"id")+1;
  _gid=maxSuffix(state.goals.weekly.concat(state.goals.monthly,state.goals.yearly),"id")+1;
  _tid=maxSuffix(state.trash,"tid")+1;
}
export function maxSuffix(list,key){return list.reduce((m,x)=>Math.max(m,parseInt(String(x[key]??"").replace(/\D/g,""),10)||0),0);}
export function taskById(id){return state.tasks.find(t=>t.id===id);}
