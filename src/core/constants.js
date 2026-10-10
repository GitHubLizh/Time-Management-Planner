"use strict";
/* 领域常量：分类、优先级、状态、循环规则、星期。
   core 层任何模块都不得依赖 DOM 或浏览器 API，只依赖本目录内的其它 core 模块。 */
export const TYPES=["生活居家","饮食健康","运动健身","形象管理","心灵成长","工作项目","财务管理","学习成长","签到奖励"];
export const PRIO_NAMES={1:"P1 重要紧急",2:"P2 重要不紧急",3:"P3 紧急不重要",4:"P4 不紧急不重要"};
export const STATUS_NAMES={todo:"未开始",doing:"进行中",done:"已完成"};
export const RECUR_RULES={daily:"每天重复",workday:"每个法定工作日（周一至周五，扣除节假日·含调休补班）",weekly:"每周固定几天",monthly:"每月固定一天"};
export const DOW_NAMES=["周日","周一","周二","周三","周四","周五","周六"];
export const GOAL_LEVELS=[["weekly","周"],["monthly","月"],["yearly","年"]];
/* 回收站保留策略（两个数都要能对上真实约束，不是随手取的）：
   - 条数上限 100：一条快照约 300 字节，100 条约 30KB。页面卸载时的 keepalive 兜底请求体上限是 64KB
     （见 planner.js flushRemoteSync 与 function/index.ts 的 MAX_BODY），整包 state 要留足任务本体的余量。
   - 保留 30 天：与"删除后还能反悔"的实际窗口匹配，超期即视为放弃。 */
export const TRASH_LIMIT=100;
export const TRASH_KEEP_DAYS=30;
