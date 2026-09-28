/* 目标聚合：三档目标（周/月/年）与任务的归属关系。零 DOM。 */
import { GOAL_LEVELS } from "./constants.js";
import { state } from "./schema.js";
import { statsPool } from "./recur.js";
import { tasksOn } from "./selectors.js";

export function goalsOf(level){return state.goals[level]||[];}
export function goalLevel(id){const e=GOAL_LEVELS.find(([k])=>goalsOf(k).some(g=>g.id===id));return e?e[0]:"";}
export function goalById(id){const k=goalLevel(id);return k?goalsOf(k).find(g=>g.id===id):null;}
export function goalTasks(id){return state.tasks.filter(t=>t.goalId===id);}
export function goalTasksOn(id,dates){return goalTasks(id).filter(t=>dates.some(ds=>tasksOn(ds,[t]).length));}
export function goalVisibleThisWeek(g,dates){return !goalTasks(g.id).length||goalTasksOn(g.id,dates).length||goalTasks(g.id).some(t=>!t.recur&&t.status!=="done");}
export function taskGoal(t){return t&&t.goalId?goalById(t.goalId):null;}
export function goalProgress(id,list){
  list=list||goalTasks(id);const plain=statsPool(list); // 循环任务不进进度：它没有单一进度值可平均
  return {total:list.length,plain:plain.length,done:plain.filter(t=>t.status==="done").length,
    pct:plain.length?Math.round(plain.reduce((a,t)=>a+(+t.progress||0),0)/plain.length):0,
    recur:list.length-plain.length};
}
