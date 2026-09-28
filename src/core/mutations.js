/* 业务写操作的唯一入口。core 只改 state 并返回"撤销所需的数据"，
   不碰 localStorage、不碰 DOM、不调 renderAll —— 持久化与重绘由壳在调用后自己做。
   视图态（如目标展开集合 expandedGoals）也不进 core：需要它的地方通过返回值
   告知壳"该展开哪个"，由壳自己维护。 */
import { state, taskById, mk, newGoalId } from "./schema.js";
import { syncDoneAt, splitId } from "./selectors.js";
import { toggleOcc } from "./recur.js";
import { goalById, goalLevel, goalsOf } from "./goals.js";

/* ---------- 完成状态 ---------- */
export function toggleTaskDone(t){
  t.status=t.status==="done"?"todo":"done";
  t.progress=t.status==="done"?100:0;
  syncDoneAt(t);
}

/* ---------- 复制：内容照抄（含起止日期），状态/进度/完成日/实际耗时归零，紧跟源任务之后 ---------- */
export function duplicateTask(src){
  const t=mk(Object.assign({},src,{status:"todo",progress:0,doneAt:"",actualTime:0,doneOn:{}})); // 副本的循环规则照抄，但打卡记录从零开始
  const i=state.tasks.findIndex(x=>x.id===src.id);
  if(i>=0)state.tasks.splice(i+1,0,t);else state.tasks.push(t);
  return t;
}

/* ---------- 删除单条：返回撤销数据，壳自己决定浮条文案与时长 ---------- */
export function deleteTask(id){
  const t=taskById(id);if(!t)return null;
  const i=state.tasks.findIndex(x=>x.id===id);
  const snap=JSON.parse(JSON.stringify(t));
  const occCount=Object.keys(snap.doneOn||{}).length;
  state.tasks=state.tasks.filter(x=>x.id!==id);
  return {title:snap.title,isRecur:!!snap.recur,occCount,
    undo(){state.tasks.splice(Math.min(i,state.tasks.length),0,snap);}};
}

/* ---------- 批量：逐条走与单条相同的翻转语义（循环实例只作用于当天） ---------- */
export function bulkToggleDone(keys){
  const snaps=[];
  for(const k of keys){
    const {task:t,date:ds}=splitId(k);if(!t)continue;
    if(ds){
      snaps.push({id:t.id,occ:ds,prev:(t.doneOn||{})[ds]});
      toggleOcc(t,ds);
    }else{
      snaps.push({id:t.id,prev:{status:t.status,progress:t.progress,doneAt:t.doneAt}});
      toggleTaskDone(t);
    }
  }
  return {count:snaps.length,undo(){
    for(const s of snaps){
      const t=taskById(s.id);if(!t)continue;
      if(s.occ){if(s.prev===undefined)delete t.doneOn[s.occ];else t.doneOn[s.occ]=s.prev;}
      else Object.assign(t,s.prev);
    }
  }};
}
/* 批量删除：循环实例归并回整条定义（与单条删除语义一致）；快照按原数组索引升序插回，次序精确还原 */
export function bulkDelete(keys){
  const ids=[...new Set(keys.map(k=>{const {task:t}=splitId(k);return t&&t.id;}).filter(Boolean))];
  const snaps=ids.map(id=>{
    const i=state.tasks.findIndex(x=>x.id===id);
    return i<0?null:{i,snap:JSON.parse(JSON.stringify(state.tasks[i]))};
  }).filter(Boolean).sort((a,b)=>a.i-b.i);
  const gone=new Set(snaps.map(s=>s.snap.id));
  state.tasks=state.tasks.filter(t=>!gone.has(t.id));
  return {count:snaps.length,undo(){
    for(const s of snaps)state.tasks.splice(Math.min(s.i,state.tasks.length),0,s.snap);
  }};
}

/* ---------- 新增 / 编辑任务 ---------- */
export function saveTask(id,data){
  let t;
  if(id){t=taskById(id);Object.assign(t,data);}
  else{t=mk(data);state.tasks.push(t);}
  if(!t.recur)t.doneOn={}; // 取消循环时丢掉打卡痕迹，避免它悄悄影响以后的重开
  syncDoneAt(t);
  return t;
}

/* ---------- 排序与关联（顺序即数组顺序，不另设排序字段） ---------- */
export function moveTask(dragId,refId,after){
  const from=state.tasks.findIndex(t=>t.id===dragId);if(from<0)return;
  const [t]=state.tasks.splice(from,1);
  const to=state.tasks.findIndex(x=>x.id===refId);
  state.tasks.splice(to<0?state.tasks.length:(after?to+1:to),0,t);
}
export function moveGoal(dragId,refId,level,after){ // 目标顺序即其档位数组顺序；跨卡放置即改档位
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
/* 落点语义：桌面 HTML5 DnD、触屏 Pointer 层、移动端的显式菜单都走这里。
   applied 表示"这次落点确实改动了 state"——原实现里 goal 拖到非目标行、或任务已不存在时
   是直接返回、既不持久化也不重绘的，壳要靠这个标记复刻该行为。
   autoExpandGid 告诉壳该展开哪个目标（expandedGoals 是视图态，不进 core）。 */
export function applyDrop(item,z){
  if(!item||!z)return {applied:false};
  if(z.type==="moveGoal"){moveGoal(item.id,z.ref,z.level,z.after);return {applied:true};}
  if(item.kind!=="task")return {applied:false};
  const t=taskById(item.id);if(!t)return {applied:false};
  let autoExpandGid="";
  if(z.type==="link"){if(t.goalId!==z.gid){t.goalId=z.gid;autoExpandGid=z.gid;}}
  else if(z.type==="move"){
    moveTask(item.id,z.ref,z.after);
    if(z.gid&&t.goalId!==z.gid){t.goalId=z.gid;autoExpandGid=z.gid;} // 插进某目标的成员清单即归属该目标
  }
  else t.goalId="";
  return autoExpandGid?{applied:true,autoExpandGid}:{applied:true};
}

/* 看板落点：改状态或改分类。done 与 progress 的联动口径在此，是唯一一份。 */
export function applyKanbanDrop(t,colKey,mode,changed){
  if(mode==="status"){
    t.status=colKey;
    if(t.status==="done")t.progress=100;
    else if(t.status==="todo"&&t.progress===100)t.progress=0;
    syncDoneAt(t);
    if(changed)return {hintSeen:true};
  }else t.type=colKey;
  return {};
}

/* ---------- 目标增删改 ---------- */
export function saveGoal(id,title,level){
  if(id){
    const g=goalById(id),from=goalLevel(id);
    g.title=title;
    if(from!==level){state.goals[from]=goalsOf(from).filter(x=>x.id!==id);goalsOf(level).push(g);}
  }else goalsOf(level).push({id:newGoalId(),title});
}
export function deleteGoal(id){
  const g=goalById(id);if(!g)return null;
  const lv=goalLevel(id);
  const gi=goalsOf(lv).findIndex(x=>x.id===id);
  const snap=JSON.parse(JSON.stringify(g));
  const affected=state.tasks.filter(t=>t.goalId===id).map(t=>t.id);
  state.goals[lv]=goalsOf(lv).filter(x=>x.id!==id);
  state.tasks.forEach(t=>{if(t.goalId===id)t.goalId="";}); // 解除关联，避免悬空 goalId
  return {title:snap.title,affectedCount:affected.length,affected,
    undo(){
      goalsOf(lv).splice(Math.min(gi,goalsOf(lv).length),0,snap);
      affected.forEach(tid=>{const t=taskById(tid);if(t&&!t.goalId)t.goalId=id;}); // 只恢复仍未归属的任务，不覆盖撤销前手动改的关联
    }};
}
