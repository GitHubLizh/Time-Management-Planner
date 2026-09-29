# 手帐风时间管理台

一个手帐风格的时间管理与日程规划应用。原生 HTML/CSS/JS + Vite，数据层用 Supabase，没有前端框架。

同一仓库里有**两个壳**：桌面版 `index.html` 与移动版 `mobile.html`。它们共用一份不含 DOM 的业务核心 `src/core/`，各自只实现视图与交互。这么分是因为桌面那套七视图的信息架构搬到手机上会过于拥挤（真机实测反馈），而移动端形态又是将来小程序 / APP 的直接参照物。

支持课表、日、周、月历、月进度、年、看板七种视图，任务可按法定工作日等规则自动展开，全部状态以单个 JSON 文档随登录用户在云端持久化。

## 功能特性

**视图**（桌面版；移动端按 4 个 tab 重新组织，见[移动端与平板](#移动端与平板)）

| 视图 | 用途 |
| --- | --- |
| 课表 | 按星期几 + 时间段排布课程任务（课程/教室/教师） |
| 日 | 三张列表（今日任务 / 今日课程 / 今日循环），支持批量选择 |
| 周 | 周一至周日七天并排 |
| 月历 | 月网格，标注农历、节气、节假日 |
| 月进度 | 当月任务进度表 + 按周甘特图 |
| 年 | 12 个月迷你月历、年度目标、每月复盘、年度统计与图表 |
| 看板 | 桌面拖拽跨列流转状态；移动端用卡片内三态分段控件 |

**任务与目标**

- 任务字段：标题、分类、优先级（P1 重要紧急 → P4 不紧急不重要）、状态（未开始 / 进行中 / 已完成）、起止时间、计划/实际耗时、进度、关联目标、备注。
- 目标分周 / 月 / 年三级，另有"每月复盘"记录；任务通过 `goalId` 挂到目标下。桌面端靠拖拽关联或解除，移动端在任务编辑面板里选"关联目标"——两条路最终都走 `core/mutations.applyDrop` / `saveTask`，落点语义只有一份实现。

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
- 批量选择（完成切换 / 删除）只在"当天这一屏"提供：桌面是日视图三张列表，移动端是今日 tab；选中态是临时视图态，不进 state、切走即退出。
- 手机 / 平板走独立的移动壳（底部 4 tab、显式控件而非拖拽），详见[移动端与平板](#移动端与平板)。

## 架构分层

```
src/core/     业务核心：零 DOM。状态模型、日期、循环展开、节假日与农历、筛选、
              目标聚合、分组几何、写操作与撤销、同步与装载决策、认证文案
src/endpoint.js  一处决定"Supabase 请求发到哪"（部署态走同域代理，dev 直连）
src/planner.js   桌面壳：渲染模板、事件绑定、拖拽、DOM 交互、云端传输
src/mobile/      移动壳：路由、tab、登录、编辑器面板、自己的会话水管
function/index.ts 同域反向代理（Edge 函数）
```

依赖方向是单向的 `壳 → core`，core 不得 import 任何浏览器 API。这条约束有硬判据，不靠自觉：`npm test` 现在直接 `import` core 模块跑断言，core 一旦碰了 `document` 测试就会挂。

几个刻意的设计决定：

- **`planner.js` 在顶层绑 DOM 事件是允许的**。它是桌面壳，小程序和移动壳都只 import `src/core/*`，永远不会加载它。把桌面壳改成"无 DOM"换不到任何复用，只会引入绑定时机变化的风险。
- **写操作只在 core 一处**。`mutations.js` 改 `state` 并返回撤销所需数据（`undo` 闭包 + 文案字段），不调 `save()`、不碰 DOM、不维护视图态。`applyDrop` 额外返回 `applied` 与 `autoExpandGid`：前者让壳复刻"这类落点不改动数据，因此既不持久化也不重绘"的原行为，后者把 `expandedGoals`（视图态）留在壳里。
- **同步决策与传输分离**。`core/sync.js` 只有判定（`decidePush` / `decidePull` / `decideInitialSource` / `remoteUpdatedAt` / `buildPushPayload`），实际的 Supabase 调用与 keepalive 留在各壳。小程序换 `wx.request` 时判定口径不用重写。
- **分组几何下沉**。课表分格、日/周/月分组、进度表周切分、甘特条几何、年矩阵、看板分列原先都写在模板字符串中间，现在由 `selectors.js` 出数据（29 个导出），HTML 仍由壳拼。移动壳和小程序复用同一套分组结果。

## 移动端与平板

入口 `mobile.html`，与桌面 `index.html` 一起由 `vite.config.js` 配成多页构建。两个入口互不加载对方代码。

**分流规则**在 `index.html` 的 head 内联脚本里（必须内联，否则要等模块加载才跳转，会先闪一下桌面页）：判据是 `max-width:760px and pointer:coarse`，**不做 UA 嗅探**；偏好存 `localStorage` 的 `planner.ui`，两端各有手动切换入口，回桌面会写入 `desktop` 以免被反复弹回。

**信息架构按手机上要做的事重排**，不是桌面七视图的缩略：

| tab | 内容 |
| --- | --- |
| 今日 | 日期切换、今日任务（打卡 / 进度 / 批量选择）、今日课程、今日循环实例 |
| 目标 | 周 / 月 / 年三档目标与关联任务进度，可折叠 |
| 看板 | 按状态或类型分列，卡片内直接改状态 |
| 我的 | 概览数字、目标进度、搜索筛选、主题、账号与切桌面 |

**版式基线**（真机反馈是"布局拥挤、字太小"，所以这些值是定的而不是调出来的）：根字号 `16px`（桌面 15px）、正文 `.95rem`、次要信息单行截断、触控目标 ≥ 44px、单列、一屏只给一个主操作区。

**移动端取消拖拽**。四种落点语义全部换成显式控件：改状态用卡片内三态分段控件、其余走条目右侧 `⋯` 的动作面板（`src/mobile/actions.js`）。原因除了触屏拖拽难用，还因为小程序里拖拽本就是弱能力，这套映射可以直接带走。

动作面板与桌面拖拽一一对应，且调的是 `core/mutations` 里同一批函数，不另立规则：

| 条目 | 面板项 | 落到 |
| --- | --- | --- |
| 今日任务 | 编辑 / 复制（循环任务不给）/ 上移 / 下移 / 取消关联 / 删除 | `moveTask`、`duplicateTask`、`applyDrop({type:"unlink"})`、`deleteTask` |
| 目标 | 编辑 / 上移 / 下移 / 删除，每档底部另有"新增×目标" | `moveGoal`、`saveGoal`、`deleteGoal` |

- **复制比桌面多走一步**：`duplicateTask` 出副本后立即把编辑面板开在副本上（手机上重填字段成本太高），原任务不受影响；这一条路径同时覆盖桌面弹窗里"另存为副本"的用法。

- **可排序范围照抄桌面**：只有"今日任务"卡内的单次任务能上下移（桌面 `[data-reorder]` 就是 `#dayNormal`），循环与课程条目面板里根本不出现这两项。相邻判定取 `dayGroups().normal`，即屏幕上看到的上下邻条。
- **顺序就是 `state.tasks` 数组顺序**，不另设排序字段。
- 删除有 6 秒撤销浮条，排序没有——桌面拖拽本来也不能撤销，保持一致。
- **批量选择**：任务卡右上角"选择"进入多选，之后整行即选中热区（打卡按钮与 `⋯` 让位，避免"想选中却改了数据"），底栏固定给 全选 / 已选 N 条 / 切换完成 / 删除 / 退出。口径与桌面一致：只作用于当天看得见的条目，被筛选隐藏或已删的选中项自动失效；走 `bulkToggleDone` / `bulkDelete`，结果同样可 6 秒撤销。`bulkMode` 与选中集是临时视图态，不进 `state`，切走 tab 即退出，且期间推迟云端拉取。

**登录流程不抽共享**：小程序是 `wx.login`，可移植的不是登录 UI，而是"拿到会话之后"如何装载、持久化、合并状态——那部分已经在 `core/sync.js`。所以 `src/mobile/session.js` 是移动壳自带的一薄层水管，判定全部委托 core。

**平板**（≥700px）用同一套移动壳：tab 上移为顶部条，主内容改两栏 master-detail，动作面板变成浮层卡片。

## 同域反向代理

**为什么需要**：实测手机移动网络到不了 `*.supabase.co`（浏览器报 `Failed to fetch`，属 DNS/TLS/路由层失败，早于任何 HTTP 响应），而手机访问本站正常；同时本站 Edge 函数运行时**可以**出网到 Supabase。所以让浏览器只访问同域，由函数转发。将来做小程序也是这个形态（微信要求备案域名白名单）。

**路径**：浏览器请求 `/functions/v1/app/auth/v1/*` 与 `/functions/v1/app/rest/v1/*`，函数转发到 Secret 里的上游地址。`src/endpoint.js` 决定基址：只有 `*.qoder.zone` 走代理，本地 dev 直连。

**安全边界**（三条都是硬约束）：

1. 上游地址只来自服务端 Secret，调用方无法指定目标 —— 避免变成带凭据的任意中继。
2. 只放行 `/auth/v1/`、`/rest/v1/` 两个前缀，其余 404；请求体上限 2MB；超时 15s；不回显上游异常原文。
3. **只转发客户端本就持有的 anon key 与用户 JWT，不注入任何提权凭据** —— 行级安全仍由 Supabase 判定。

**Secret**（在 Qoder Sites 站点设置的「环境变量」里填，CLI 无写值入口，值也不会出现在代码或对话里）：

| 名字 | 对应 `.env` 里的 |
| --- | --- |
| `PLANNER_UPSTREAM_URL` | `VITE_SUPABASE_URL` |
| `PLANNER_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |

注意 `SUPABASE_`、`QODER_`、`POSTGRES_` 前缀与 `DATABASE_URL` 是平台保留名，不能用作应用 Secret 名。

**两个踩过的坑**，改函数时注意：

- 函数**收到**的路径首段是物理名 `app-<部署号>`，既没有 `/functions/v1` 前缀、名字又每次部署都变。只能"剥掉首段"取子路径（`function/index.ts:34`），不可按 `app` 字面量或三段前缀匹配。
- 网关对**写操作要求同源**。`curl` 不带 `Origin` 时 POST 会被挡（403），所以登录 POST 这类路径没法用 curl 验证，必须浏览器实测。

**排查**：任何 URL 加 `?direct=1` 强制直连 Supabase（偏好记在 `sessionStorage`），可立刻区分"是代理的问题还是别的问题"。

## 技术栈

- [Vite](https://vite.dev/) — 开发服务器与多页构建（桌面 + 移动两个入口）
- 原生 HTML + CSS + JavaScript — 无框架；业务核心在 `src/core/`，视图在 `src/planner.js`（桌面）与 `src/mobile/`（移动）
- `@supabase/supabase-js` — 认证与数据层
- `lunar-javascript` — 农历与节气计算
- `pinyin-pro` — 拼音首字母检索（由壳注入 core，小程序阶段可换实现或不注入，届时首字母匹配降级）
- Deno Edge Function — 同域反向代理到 Supabase

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
npm test          # 259 条断言：node _recur_test.js src/planner.js
npm run golden    # 渲染金样本：16 段 innerHTML 落盘 _golden.json（已 gitignore）
```

**`_recur_test.js`** 用 `vm` 在桩化 DOM 中执行桌面壳，但断言打到的是 **core 的真实实现**：`_core_seed.mjs` 从壳的 import 语句反推需要哪些符号（含别名，如 `deleteTask as deleteTaskData`），并用访问器挂进 vm 全局 —— 必须用访问器而不是取值，否则 ESM 的 live binding 会被冻结成快照，`state` 被 `setState` 重新赋值后壳读不到。覆盖范围：重复展开引擎、节假日口径、日历字标与底色、拼音检索、逾期/迟完边界、写操作与撤销、同步与装载决策、认证文案分支、`index.html` 与 JS 之间的选择器 id 对账；壳里的纯函数也直接 `import` 进来断言（如移动壳 `editor.js` 的 `goalOptions` / `goalOptionValue`，它不碰 DOM，所以能脱离浏览器测）。

**`npm run golden`** 是重构期间的等价门：固定夹具（含循环 / 课程 / 逾期 / 迟完 / 跨周跨月 / 带成员目标）渲染 7 视图 × 2 看板模式 + 导航 + banner，共 16 段 `innerHTML` 落盘，改动前后逐字节比对。它的价值已被验证过一次：把 `yearSplit` 返回的 `recurCount` 在壳里按 `recurCnt` 解构（漏了重命名）导致年视图少渲染 107 字符，`npm test` 全绿也没发现，金样本一眼可见。

**断言有效性用变异测试抽查过**，不是只看"跑绿了"：删掉 `occursOn` 的月末钳位 → 3 条变红；把 `isOverdue` 的 `end<today` 改成 `<=` → 当时全绿，说明缺边界断言，补了 5 条后该变异体被杀死。改坏 `deleteTask` 撤销的插回索引 → 立刻变红。

`_mobile_frame.html` / `_mobile_probe.html` 是免登录渲染移动壳的 dev 探针（桩会话，不验证登录链路）。它能量的两件事是**几何**（字号、触控目标高度、横向溢出、一屏条目数——`getBoundingClientRect` 在隐藏页也照常工作）和**处理链**（`element.click()` 派发的是走完整监听器链的真实 click 事件）。它测不到的是**指针输入**：命中测试、遮挡、滚动位置、动画手感都不在其中，所以"探针里点通了"不等于真机点得中——那一步只能上真机，或等有可用 surface 的浏览器。

`_bulk_test.js` 是批量选择与撤销的同类断言脚本，尚未挂进 npm scripts。

## 项目结构

```
index.html                      桌面入口：内联全部 CSS 与页面骨架 + 分流 shim
mobile.html                     移动入口：只挂 #mRoot，样式与逻辑都在 src/mobile/
vite.config.js                  多页构建（main + mobile 两个 input）
src/core/                       业务核心，零 DOM（12 个模块 / 见架构分层）
src/endpoint.js                 Supabase 基址决策（代理 or 直连）
src/main.js                     桌面装配：客户端创建与环境变量守卫
src/planner.js                  桌面壳：视图模板、事件绑定、拖拽、传输
src/mobile/                     移动壳：boot / shell / login / editor / session / tabs / ui-pref / styles.css / views
function/index.ts               同域反向代理（Edge 函数）
supabase/migrations/            建表 + RLS 策略
_recur_test.js / _core_seed.mjs 断言与 core 符号装载
_golden_render.mjs              渲染金样本
_mobile_frame.html              移动壳版式探针（免登录，桩会话）
.env.example                    环境变量模板
.手帐风时间管理台.qoder.site     Qoder Sites 发布清单（见下）
```

## 构建与部署

```bash
npm run build     # 产出 dist/index.html 与 dist/mobile.html，纯静态资源
npm run preview   # 本地预览构建结果
```

产物是静态站，任何能托管 `dist/` 并注入 `VITE_*` 构建时变量的平台都可以部署。本项目当前通过 Qoder Sites 发布，同时上传 `function/` 目录作为 Edge 函数（见[同域反向代理](#同域反向代理)）。

**手机真机联调**：`npx vite --host --port 5173`，手机与电脑连同一 Wi-Fi 后访问命令打印的局域网地址。默认 `npm run dev` 只监听 localhost，手机连不上——这是最常见的"以为在测手机、其实在测桌面"来源。注意本地 dev 走直连，不经代理，所以代理相关问题只能在部署态复现。

`.手帐风时间管理台.qoder.site` 是 Qoder Sites 的**发布清单**，不是源码副本：`projectId` / `siteId` / `deploymentId` / `releaseId` 记下发布目标，Qoder Sites 工具靠它把本地目录对应到线上站点（`get_local_context` 读的就是这份）；`artifactSha256` / `indexSha256` 与内嵌的 base64 页面记下发出去的到底是哪一版产物——注意内嵌的是 `dist/index.html` 的逐字节副本，与源码 `index.html` 本来就不会相等。由于 `dist/` 不入版本库，这份清单是仓库里唯一留存"线上实际跑的页面"的地方，故意保留跟踪状态。

注意 `VITE_*` 变量在**构建时**内联进产物，改环境需要重新构建。
