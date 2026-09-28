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
- 触屏设备用**拖拽把手**（条目左侧 `⠿`）起拖，详见 [手机端适配](#手机端适配)。

## 手机端适配

同一套代码做响应式，没有独立的移动端入口。新增规则集中在 `index.html` 样式块末尾的三层：`@media(hover:none)`（按能力给触屏常显控件）、`@media(max-width:900px)` 与 `@media(max-width:640px)`（按宽度排布局）。上方既有的 9 处 `@media`（560–1000px，语义是平板收列）保持原样，靠级联顺序在小屏胜出。

**拖拽是双轨的**：鼠标继续走原有 HTML5 Drag & Drop（`dragstart`/`dragover`/`drop` 处理器未改动），触屏由 `initPointerDrag()` 的 Pointer 层接管，判据是 `e.pointerType!=="mouse"`。两轨共用同一份落点语义——`applyDrop(item, z)`（排序 / 关联目标 / 取消关联）与 `applyKanbanDrop(t, colKey, mode, changed)`（看板改状态、改分类）。

> 以后改"落到某处意味着什么"，只改这两个函数。改在任一处理器内部，就会出现"桌面能用、手机不认"的分歧。

- **只有把手可拖**：`.grip` 是唯一设 `touch-action:none` 的元素，卡片主体保留默认值，页面滚动与横向滚动容器不受拖拽影响。长按 220ms 或移动超过 6px 起拖。
- 跟手预览 `.drag-ghost` 必须保持 `pointer-events:none`，否则 `elementFromPoint` 恒命中它自身，`dropZone()` 永远返回 null（表现为"拖得动但落不下"）。
- 触屏拖拽期间 `dragLock` 挂起 `pullRemote()`，松手后补拉一次——否则云端轮询触发的 `renderAll()` 会销毁被 pointer capture 抓住的元素。
- 看板卡片在小屏**单击即编辑**（桌面 `dblclick` 保留）；原本靠 hover 显现的编辑按钮在 `@media(hover:none)` 下常显。
- 小屏密度调整：日视图塌单列后按"今日任务 → 目标 → 日历/概览/逾期"重排（任务与目标相邻，跨列拖拽不必跨越整块日历）；课表与月进度表首列吸住；周视图与看板改为一屏一天 / 一屏一列的吸附横滚；月历每格只列 1 条任务（`narrow()`，其余折进"+N 更多"）；弹窗改为贴底抽屉并用 `dvh` 适应软键盘高度；输入控件字号提到 16px，避免 iOS Safari 聚焦时自动放大整页。

**已知限制**

- 承载说明信息的原生 `title` 提示（拼音搜索规则、优先级色含义等）在触屏上不显示；界面对小屏用户看不懂的三处已另有可见文案（循环任务不入看板的原因、按时率口径、取消关联提示）。
- 把手只在 `@media(hover:none)` 下显现。带触屏的桌面设备（浏览器判定为有 hover）拿不到把手，仍走鼠标拖拽。

**真机验证**：`npx vite --host --port 5173`，手机与电脑连同一 Wi-Fi 后访问命令打印的局域网地址（默认 `npm run dev` 只监听 localhost，手机连不上）。DevTools 设备仿真能验布局，但验不了长按起拖、`pointercancel`、软键盘与安全区；仿真时还必须点亮"触摸"图标，否则 `pointerType` 仍是 mouse，测到的是桌面那套旧路径。

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

- 登录后先读云端；云端无记录时回退到本地缓存 `journalPlanner.v3.<uid>`，并把本机缓存迁移上云（云端已有数据时不再回写，避免旧缓存覆盖）。
- 每次变更写 localStorage，并以 500ms 防抖对云端整行 upsert；每次变更同时打上编辑时刻 `state.updatedAt` 时间戳。
- 多设备同步：推送前先比较云端 `updatedAt`，云端更新则放弃本次覆盖并采纳云端；页面重新可见/窗口聚焦/每 60s 自动拉取云端更新（弹窗编辑、拖拽、批量选择进行中推迟）；页面关闭时若有未同步改动，用 keepalive 请求兜底推送（请求体上限 64KB）。
- 仍是**整包时间戳比较**（后编辑者赢），无字段级合并：两台设备在极短窗口内同时编辑，落败一方的整包改动会丢失。

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
