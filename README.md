# 手帐风时间管理台

一个手帐风格的时间管理与日程规划单页应用。原生 HTML/CSS/JS + Vite，数据层用 Supabase，没有前端框架。

支持课表、日、周、月历、月进度、年、看板七种视图，任务可按法定工作日等规则自动展开，全部状态以单个 JSON 文档随登录用户在云端持久化。

## 功能特性

**视图**

| 视图 | 用途 |
| --- | --- |
| 课表 | 按星期几 + 时间段排布课程任务（课程/教室/教师） |
| 日 | 三张列表（未开始 / 进行中 / 已完成），支持批量选择 |
| 周 | 周一至周日七天并排 |
| 月历 | 月网格，标注农历、节气、节假日 |
| 月进度 | 当月任务进度表 + 按周甘特图 |
| 年 | 12 个月迷你月历、年度目标、每月复盘、年度统计与图表 |
| 看板 | 列间拖拽流转状态 |

**任务与目标**

- 任务字段：标题、分类、优先级（P1 重要紧急 → P4 不紧急不重要）、状态（未开始 / 进行中 / 已完成）、起止时间、计划/实际耗时、进度、关联目标、备注。
- 目标分周 / 月 / 年三级，另有"每月复盘"记录；任务通过 `goalId` 挂到目标下，可跨列表拖拽关联或解除。

**重复规则**（`RECUR_RULES`）

- 每天重复
- 每个法定工作日 — 周一至周五，扣除法定节假日、含调休补班的周末
- 每周固定几天（多选星期）
- 每月固定一天（短月自动钳到月末）

循环任务按"发生日"逐次打卡，整体状态由每日勾选决定而非单一 status 字段。节假日口径内置 2025/2026 兜底数据，运行时从 holiday-cn 的 CDN 同步当年安排。

**交互**

- 双主题："E 人 · 明快"（日光图标）与 "I 人 · 安静"（月亮图标），选择随状态一起持久化。
- 搜索支持中文、英文与**拼音首字母**（输入 `xzb` 可命中"写周报"）。
- 逾期 / 迟完筛选芯片。
- 删除任务、删除目标与批量操作后出现 6 秒撤销浮条，可精确还原。
- 批量选择（完成切换 / 删除）目前仅在日视图提供。

## 技术栈

- [Vite](https://vite.dev/) — 开发服务器与构建
- 原生 HTML + CSS + JavaScript — 无框架，UI 与逻辑集中在 `index.html` 和 `src/planner.js`
- `@supabase/supabase-js` — 认证与数据层
- `lunar-javascript` — 农历与节气计算
- `pinyin-pro` — 拼音首字母检索

## 快速开始

前置条件：一个 Supabase 项目（需要 Auth 与 Postgres）。

```bash
npm install
cp .env.example .env      # 填入下面两个变量
npm run dev
```

首次运行前，在 Supabase SQL 编辑器里执行 `supabase/migrations/001_planner_states.sql` 建表并开启 RLS。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `VITE_SUPABASE_URL` | 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |

两者缺一应用会锁在登录页并提示配置——**没有纯本地免登录模式**，登录是进入应用的必要条件。

登录方式：邮箱魔法链接（OTP）、邮箱密码，以及 Google / GitHub OAuth。OAuth 需要在 Supabase 后台先配好对应 Provider。

## 数据与持久化

单个 `planner_states` 表，`user_id` 主键 + `state` jsonb 整包，RLS 策略限定每个用户只能读写自己的行。

- 登录后先读云端；云端无记录时回退到本地缓存 `journalPlanner.v3.<uid>`。
- 每次变更写 localStorage，并以 500ms 防抖对云端整行 upsert。
- 多设备并发时**后写覆盖**（last-write-wins）：没有 updated_at 比较，也没有字段级合并。同一账号在两个标签页同时编辑会互相覆盖。

## 测试

```bash
npm test        # 等价于 node _recur_test.js src/planner.js
```

脚本零依赖：用 `vm` 在桩化 DOM 中执行 `planner.js`，取出真实引擎函数做断言，并交叉校验 `index.html` 与 JS 之间的选择器 id 一致性（桩 DOM 不会因为 id 不存在而抛错，只能静态比对）。

`_recur_test.js` 覆盖重复展开引擎（各频率的发生日、`nextOccurrence` / `prevOccurrence`）、节假日口径同步、日历字标与底色、拼音首字母检索。`argv[2]` 是 `planner.js` 路径，`argv[3]` 可选，覆盖 `index.html` 路径（默认由前者推导）。

`_bulk_test.js` 是批量选择与撤销的同类断言脚本，尚未挂进 npm scripts。

## 项目结构

```
index.html                      唯一 HTML 入口，内联全部 CSS 与页面骨架
src/main.js                     Supabase 客户端装配与环境变量守卫
src/planner.js                  全部业务逻辑（视图渲染、重复展开、同步、交互）
supabase/migrations/            建表 + RLS 策略
_recur_test.js / _bulk_test.js  桩 DOM 断言脚本
.env.example                    环境变量模板
.手帐风时间管理台.qoder.site     Qoder Sites 发布清单（见下）
```

## 构建与部署

```bash
npm run build     # 产出 dist/，纯静态资源
npm run preview   # 本地预览构建结果
```

产物是静态站，任何能托管 `dist/` 并注入 `VITE_*` 构建时变量的平台都可以部署。本项目当前通过 Qoder Sites 发布。

`.手帐风时间管理台.qoder.site` 是 Qoder Sites 的**发布清单**，不是源码副本：`projectId` / `siteId` / `deploymentId` / `releaseId` 记下发布目标，Qoder Sites 工具靠它把本地目录对应到线上站点（`get_local_context` 读的就是这份）；`artifactSha256` / `indexSha256` 与内嵌的 base64 页面记下发出去的到底是哪一版产物——注意内嵌的是 `dist/index.html` 的逐字节副本，与源码 `index.html` 本来就不会相等。由于 `dist/` 不入版本库，这份清单是仓库里唯一留存"线上实际跑的页面"的地方，故意保留跟踪状态。

注意 `VITE_*` 变量在**构建时**内联进产物，改环境需要重新构建。
