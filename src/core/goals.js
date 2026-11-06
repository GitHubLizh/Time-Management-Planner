/* 目标聚合：三档目标（周/月/年）与任务的归属关系。零 DOM。 */
import { GOAL_LEVELS } from "./constants.js";
import { pad } from "./dates.js";
import { state } from "./schema.js";
import { statsPool } from "./recur.js";
import { tasksOn } from "./selectors.js";

export function goalsOf(level){return state.goals[level]||[];}
export function goalLevel(id){const e=GOAL_LEVELS.find(([k])=>goalsOf(k).some(g=>g.id===id));return e?e[0]:"";}
export function goalById(id){const k=goalLevel(id);return k?goalsOf(k).find(g=>g.id===id):null;}
export function goalTasks(id){return state.tasks.filter(t=>t.goalId===id);}
export function goalTasksOn(id,dates){return goalTasks(id).filter(t=>dates.some(ds=>tasksOn(ds,[t]).length));}
export function goalVisibleThisWeek(g,dates){return !goalTasks(g.id).length||goalTasksOn(g.id,dates).length||goalTasks(g.id).some(t=>!t.recur&&t.status!=="done");}
/* 月卡可见性：以成员任务的最晚截止日为基准——只要还没在所看月份之前整体收尾就继续显示
   （跨到未来月份的长期目标不消失），才轮不到"上个月的目标"来占本月卡。
   循环任务的 end 即循环窗口末天（recur.js 的约定），照常参与；课程没有截止概念
   （selectors.tasksOn 对课程不看 end），挂着课程的目标视为长期驻留；空目标照常显示等挂任务。 */
export function goalVisibleThisMonth(g,y,m){
  const list=goalTasks(g.id);
  if(!list.length)return true;
  const mStart=`${y}-${pad(m+1)}-01`;
  return list.some(t=>t.course||t.end>=mStart);
}
export function taskGoal(t){return t&&t.goalId?goalById(t.goalId):null;}
export function goalProgress(id,list){
  list=list||goalTasks(id);const plain=statsPool(list); // 循环任务不进进度：它没有单一进度值可平均
  return {total:list.length,plain:plain.length,done:plain.filter(t=>t.status==="done").length,
    pct:plain.length?Math.round(plain.reduce((a,t)=>a+(+t.progress||0),0)/plain.length):0,
    recur:list.length-plain.length};
}
