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
| 看板 | 桌面拖拽跨列流转状态；移动端用卡片内三态分段控件；一列超过 5 条折叠成"展开其余 N 条" |

**任务与目标**

- 任务字段：标题、分类、优先级（P1 重要紧急 → P4 不紧急不重要）、状态（未开始 / 进行中 / 已完成）、起止时间、计划/实际耗时、进度、关联目标、备注。
- 目标分周 / 月 / 年三级；任务通过 `goalId` 挂到目标下。桌面端靠拖拽关联或解除，移动端在任务编辑面板里选"关联目标"——两条路最终都走 `core/mutations.applyDrop` / `saveTask`，落点语义只有一份实现。
- **每月复盘**（`state.goals.reviews`）：一月一篇，条目形如 `{m:"2026-09", text}`，**业务键就是月份本身，没有 id**。写入在 `core/mutations.saveReview`（同月覆盖、写完按月份排序）与 `deleteReview`（返回 `{m,text,undo}`，撤销回到原下标而不是追加末尾）。入口两处：桌面年视图那张卡（"写复盘"+ 每条的编辑/删除，弹窗 `#reviewModal`），移动"我的"页的"每月复盘"卡（整行点开编辑、`×` 删除带 6 秒撤销，面板经 `app.sheet()` 出口，平板上落进右栏）。
  历史上这张卡只读不写（渲染着但全局没有任何写入路径），`normalize()` 于是也只 `Array.isArray` 一下就原样透传。开放入口的同时补了钳位：**只收 `m` 为非空字符串的条目，`text` 非字符串归空串，条目重建成只剩 `m`/`text` 两字段**——手改云端行或旧缓存塞进缺字段的东西时，页面不该渲染出 `undefined`。

**重复规则**（`RECUR_RULES`）

- 每天重复
- 每个法定工作日 — 周一至周五，扣除法定节假日、含调休补班的周末
- 每周固定几天（多选星期）
- 每月固定一天（短月自动钳到月末）

循环任务按"发生日"逐次打卡，整体状态由每日勾选决定而非单一 status 字段。节假日口径内置 2025/2026 兜底数据，运行时从 holiday-cn 的 CDN 同步当年安排。

**交互**

- 双主题："E 人 · 明快"（日光图标）与 "I 人 · 安静"（月亮图标），选择随状态一起持久化。
- 搜索支持中文、英文与**拼音首字母**（输入 `xzb` 可命中"写周报"）。
- 逾期 / 迟完筛选芯片（桌面在 banner 尾部，移动端在"我的"的筛选面板里，开启后今日与看板顶部出现胶囊）。
- **看板列内折叠**：不论按状态还是按类型分列，一列超过 5 条只露前 5 张卡，其余收进"展开其余 N 条"，点一下铺全、再点"收起"；列头计数始终是全量，恰好 5 条不出按钮。跨列拖拽（桌面）与卡片内改状态（移动端）之后，被挪走的那条若落在折叠区里就当场展开目标列——否则看着就像没操作成功。展开态只活在页面内存：刷新回到默认折叠，两种分列模式各存一份、互不串。
- 删除任务、删除目标与批量操作后出现 6 秒撤销浮条，可精确还原。
- 批量选择（完成切换 / 删除）只在"当天这一屏"提供：桌面是日视图三张列表，移动端是今日 tab；选中态是临时视图态，不进 state、切走即退出。
- 手机 / 平板走独立的移动壳（底部 4 tab、显式控件而非拖拽），详见[移动端与平板](#移动端与平板)。

## 架构分层

```
src/core/     业务核心：零 DOM。状态模型、日期、循环展开、节假日与农历、筛选、
              目标聚合、分组几何、写操作与撤销、同步与装载决策、认证文案与连错处置
src/endpoint.js  一处决定"Supabase 请求发到哪"（部署态走同域代理，dev 直连）
src/planner.js   桌面壳：渲染模板、事件绑定、拖拽、DOM 交互、云端传输
src/mobile/      移动壳：路由、tab、登录、编辑器与筛选面板、自己的会话水管
function/index.ts 同域反向代理（Edge 函数）
```

依赖方向是单向的 `壳 → core`，core 不得 import 任何浏览器 API。这条约束有硬判据，不靠自觉：`npm test` 现在直接 `import` core 模块跑断言，core 一旦碰了 `document` 测试就会挂。

几个刻意的设计决定：

- **`planner.js` 在顶层绑 DOM 事件是允许的**。它是桌面壳，小程序和移动壳都只 import `src/core/*`，永远不会加载它。把桌面壳改成"无 DOM"换不到任何复用，只会引入绑定时机变化的风险。
- **写操作只在 core 一处**。`mutations.js` 改 `state` 并返回撤销所需数据（`undo` 闭包 + 文案字段），不调 `save()`、不碰 DOM、不维护视图态。`applyDrop` 额外返回 `applied` 与 `autoExpandGid`：前者让壳复刻"这类落点不改动数据，因此既不持久化也不重绘"的原行为，后者把 `expandedGoals`（视图态）留在壳里。
- **同步决策与传输分离**。`core/sync.js` 只有判定（`decidePush` / `decidePull` / `decideInitialSource` / `remoteUpdatedAt` / `buildPushPayload`），实际的 Supabase 调用与 keepalive 留在各壳。小程序换 `wx.request` 时判定口径不用重写。
- **分组几何下沉**。课表分格、日/周/月分组、进度表周切分、甘特条几何、年矩阵、看板分列与列内折叠原先都写在模板字符串中间，现在由 `selectors.js` 出数据（32 个导出），HTML 仍由壳拼。移动壳和小程序复用同一套分组结果。
- **看板的列内展开态不进 `state`**。它是纯显示偏好：进 state 就等于每点一次"展开"都 `save()` 一次——打时间戳、防抖整包 upsert，还会让另一台设备因本地更旧而采纳云端、丢掉自己那份未推的改动。所以规则（哪 5 条露出、被挪走的卡片是否落在折叠区）在 core 的 `foldKanbanCols` / `kanbanFoldReveal`，两壳共用；"哪些列已展开"的 Set 留在各壳内存里，与 `expandedGoals` 同类。

## 移动端与平板

入口 `mobile.html`，与桌面 `index.html` 一起由 `vite.config.js` 配成多页构建。两个入口互不加载对方代码。

**分流规则**在 `index.html` 的 head 内联脚本里（必须内联，否则要等模块加载才跳转，会先闪一下桌面页）：判据是 `max-width:760px and pointer:coarse`，**不做 UA 嗅探**；偏好存 `localStorage` 的 `planner.ui`，两端各有手动切换入口，回桌面会写入 `desktop` 以免被反复弹回。

**信息架构按手机上要做的事重排**，不是桌面七视图的缩略：

| tab | 内容 |
| --- | --- |
| 今日 | 日/周 两种看法 + 日期切换；日=今日任务（打卡 / 进度 / 批量选择）/ 每日习惯 / 今天的课，周=七天单列 |
| 目标 | 周 / 月 / 年三档目标与关联任务进度，可折叠 |
| 看板 | 按状态或类型分列，卡片内直接改状态；一列超过 5 条折叠，点开才铺全 |
| 我的 | 概览数字、目标进度、搜索筛选、主题、账号与切桌面 |

**"今日"页的 日/周 分段控件**：日视图是"这一天的事"，周视图回答"这周哪天有安排"。周视图**不是桌面七列并排的缩略**，而是七天分组单列——每天一段段头（日号 + 周几 + 完成数），条目压成单行（去掉"分类 · 进度"那行 meta，字号仍是正文 `.95rem`，靠去行而不是缩字把整周从 2248px 降到 1617px）。周视图里只能打卡，不给 `⋯`：编辑、排序、删除回到日视图做，批量选择也只属于日视图（与桌面同口径）。段头与副标题的计数单位是**项次**——一条任务跨本周 3 天就计 3 次，写清单位免得被读成"7 条完成 / 22 条任务"。看法存 `state.todayMode`（与 `kanbanMode` 同类的持久化视图偏好）。

**筛选收在"我的"里，不铺开**。六个条件（年 / 月 / 优先级 / 状态 / 分类 / 时间段）加逾期、迟完两个开关放在一个动作面板里（`src/mobile/filters.js`），"我的"卡片只留关键词输入和一条写着当前生效条件的按钮。理由是小屏一屏塞六个下拉直接撞"一屏只给一个主操作区"。
- 摘要文案不在移动壳再写一份：`core/filters.filterSummary()` 出片段数组，桌面 banner 与移动胶囊共用，顺序即桌面 banner 原有顺序（关键词 → 年 → 月 → 优先级 → 状态 → 分类 → 时段 → 逾期 → 迟完）。
- 生效时"今日 / 看板"顶部挂一条"筛选中 · ……"胶囊，带一键清除；清除有三处入口（我的卡片、胶囊、面板内"清除全部"），全部走 `clearFilters()`，免得出现"清了下拉但逾期还开着"的半套。
- 逾期与迟完**互斥**，且开启即跳到看板 tab —— 这两条是桌面的原行为（桌面点芯片会 `state.view="kanban"`），因为逾期项按定义不在"今天"，在今日页开筛选只会得到空列表。

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

**平板（≥700px）用同一套移动壳，但换成两栏**。判据只有一处：`src/mobile/layout.js` 的 `isWide()` 与 CSS 的 `@media(min-width:700px)` 是同一个值，改断点必须两边一起改。

- **tab 上移为顶部条**：图标与文字并排，栏高 52px；`--tab-h` 在宽屏归零，于是 FAB、撤销浮条、批量底栏这些写成 `calc(... + var(--tab-h))` 的定位自动贴回屏幕下沿，不用逐个重算。
- **主内容两栏 master-detail**：`.m-cols` 在宽屏变 grid（实测 820px 视口下两列分别 361px / 415px），右栏 `.m-detail` 是 sticky 栏，顶边落在 tab 条与头部之下（头部实测 61px，`--head-h` 取 64px 留余量，免得右栏被头部盖住那 9px）。
- **右栏承接所有面板**。移动壳"弹一层"的出口只有一个 `app.sheet()`，所以只在它出口处分一次流：宽屏渲染成 `.m-detailCard` 放进右栏，窄屏仍是贴底面板。编辑器、`⋯` 动作面板、目标编辑、筛选面板因此一次性获得两栏形态，视图模块不认识"宽屏"这件事。
- **今日条目在宽屏可单击**：主体区域（打卡按钮与 `⋯` 之外）一点就在右栏展开它的详情/编辑器，选中行高亮。窄屏刻意不绑这条——手机上单击就开面板会误触，编辑仍走 `⋯` 这个有意识的二次动作。`cursor:pointer` 由媒体查询给，不是 JS 加 class。
- **右栏空着的提示写在 CSS 里**（`.m-detail:empty::before`），不由 JS 填占位：隐藏页里 `matchMedia` 的 change 事件与 `resize` 事件都可能不派发（实测踩过），把版式挂在事件上会出现"CSS 已经是两栏、JS 还以为是窄屏"。事件只当加速，`render()` 里再按"面板开出时的形态 ≠ 当前形态"收口兜底。
- **跨断点即收口当前面板**：带着贴底面板拉到平板宽（或反过来）时表单内容会丢，这是刻意的重开而不是把表单从一边搬到另一边——两个形态的容器语义不同，搬家只会带出半开状态。切 tab 同样收口，与批量态"只属于当前这一屏"一致。

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
- 函数用 `redirect:"manual"` 不自动跟随上游重定向，因此 `location` 必须在响应头回传白名单里。邮箱链接登录的验证页（`/auth/v1/verify`）正是靠上游 303 的 `Location` 把浏览器送回站点页，丢了它手机点邮件链接会停在空白/错误页。

**邮箱链接（Magic Link）必须改 Supabase 邮件模板**（2026-09-30 已在后台改好并保存）：Supabase 默认模板里的 `{{ .ConfirmationURL }}` 永远指向 `*.supabase.co`，手机网络打不开。要在 Supabase 后台 Authentication → Email Templates → Magic Link（文档里这一项的标签写作 Magic link or OTP）把链接换成走本站代理的同形 URL：

```
https://journal-planner-rfjj5zmttgr.qoder.zone/functions/v1/app/auth/v1/verify?token={{ .TokenHash }}&type=magiclink&redirect_to={{ .RedirectTo }}
```

注意 `token` 要用 `{{ .TokenHash }}`（URL 里的验证令牌，= 带前缀的哈希），不是 `{{ .Token }}`（那是 6 位数字验证码）。另外 PKCE 的 `code_verifier` 存在发起登录那个浏览器的 localStorage 里，邮件链接必须在**同一个浏览器**打开才能完成交换（微信内置浏览器收到链接时，先点右上角"用系统浏览器打开"，且登录页也要在该系统浏览器里发起）。

**重置密码邮件模板同一处理**，但**后台这一项还没改**（2026-10-01 只动了代码，没动 Supabase 后台）。默认模板的链接同样指向 `*.supabase.co`，桌面端所在网络能直达、用得着；手机点了就是打不开的那一页。

后台里这一项的标签按文档是 **Reset password**，**不叫 Recovery** —— `recovery` 只是 GoTrue 内部的消息类型名，出现在验证 URL 的 `type=` 参数里（2026-10-01 就照内部名去后台找过一圈，找不到）。菜单层级官方文档只写到"the Email Templates page in the dashboard"没给逐字路径；本项目 2026-09-30 改 Magic Link 时走的是 Supabase 左侧 **Authentication → Email Templates**，重置这一项就在同一个列表里，按 **Reset password** 这个字面找（文档列出的标签还有 Confirm sign up / Invite user / Magic link or OTP / Change email address / Reauthentication / Password changed 等）。选中它，链接换成：

```
https://journal-planner-rfjj5zmttgr.qoder.zone/functions/v1/app/auth/v1/verify?token={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}
```

保存前先看该页列出的可用变量里有没有 `.RedirectTo`：各消息类型的变量集合不完全一样，没有它就退回把 `redirect_to` 写死成本站页面 URL。

与 Magic Link 那条只差 `type` 一个字面量（GoTrue 的 recovery 模板对应 `type=recovery`）。代理侧不用改：`/auth/v1/*` 整段前缀本就在放行名单里（`function/index.ts:13`），`location` 响应头回传也已经在（`function/index.ts:24`）。改完后的实测手法与 magiclink 同形：`curl -i "…/functions/v1/app/auth/v1/verify?token=<真令牌>&type=recovery&redirect_to=<本站 index.html>"` 该回 303 并带 `location`。

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

**同一邮箱连续输错密码 5 次**会停下密码这条路，把另外三条出路摆到眼前：登录卡片里出现一块虚线引导区，含"发送重置密码邮件"与"发送邮箱登录链接"两颗按钮（都点一下就当场发信，各自带 60 秒重发冷却），并指向已有的 Google / GitHub 登录；同时密码提交禁用 60 秒，面板标题逐秒倒数，到点自动放开、引导区留着继续指路。

两颗按钮都**只在人点的时候发信**，第 5 次失败本身不触发发信 —— 计数键就是被输错的那个邮箱，自动发信等于让别人拿你的地址乱试密码就能往你邮箱里刷信。"发送邮箱登录链接"这颗是**切模式 + 发信一步到位**：早先它只切模式（标题、密码行、提交按钮都在面板上方变化），面板里一个字没动，用户点了以为没反应（2026-10-01 实测反馈），所以现在冷却倒计时同时挂在它和提交按钮上。

口径与分工：

- 判定全在 `src/core/auth.js`（`createPasswordFailGuard` / `isPasswordFailure`，纯规则 + 由壳注入 storage），桌面 `src/planner.js` 与移动 `src/mobile/login.js` 只管读写与展示，两端不会各写一套。
- 只统计"凭证不对"（`invalid_credentials`）。网络失败、邮箱未确认、发信过频都不计入 —— 否则断网点重试会被当成猜密码，锁错人。
- 计数键按邮箱归一（trim + 小写）存 `localStorage` 的 `planner.authFail.<邮箱>`。桌面与移动同域，所以两端共用同一份；登录成功或走完重置流程即清零。换邮箱各计各的，输入框一改邮箱就重判面板与按钮状态。`localStorage` 不可用（无痕 / 将来的小程序）时整体降级为"不锁"，绝不把登录挡死。
- 冷却到期后再错一次就重新计时 60 秒，不按 5 的倍数另起一轮。冷却内提交不出网（本地拦掉），避免白撞 Supabase 自己的频率限制。
- 走完重置邮件里的链接回来时，auth-js 发的是 `PASSWORD_RECOVERY` 而不是 `SIGNED_IN`，两端都停在"设置新密码"表单（提交走 `updateUser`）而不是直接放进主界面 —— 否则旧密码依旧是错的，下次还是连错五次。

## 数据与持久化

单个 `planner_states` 表，`user_id` 主键 + `state` jsonb 整包，RLS 策略限定每个用户只能读写自己的行。

- 登录后先读云端；云端无记录时回退到本地缓存 `journalPlanner.v3.<uid>`，并把本机缓存迁移上云（云端已有数据时不再回写，避免旧缓存覆盖）。
- 每次变更写 localStorage，并以 500ms 防抖对云端整行 upsert；每次变更同时打上编辑时刻 `state.updatedAt` 时间戳。
- 多设备同步：推送前先比较云端 `updatedAt`，云端更新则放弃本次覆盖并采纳云端；页面重新可见/窗口聚焦/每 60s 自动拉取云端更新（弹窗编辑、拖拽、批量选择进行中推迟）；页面关闭时若有未同步改动，用 keepalive 请求兜底推送（请求体上限 64KB）。
- 仍是**整包时间戳比较**（后编辑者赢），无字段级合并：两台设备在极短窗口内同时编辑，落败一方的整包改动会丢失。

## 测试

```bash
npm test          # 353 条断言：node _recur_test.js src/planner.js
npm run golden    # 渲染金样本：16 段 innerHTML 落盘 _golden.json（已 gitignore）
```

**`_recur_test.js`** 用 `vm` 在桩化 DOM 中执行桌面壳，但断言打到的是 **core 的真实实现**：`_core_seed.mjs` 从壳的 import 语句反推需要哪些符号（含别名，如 `deleteTask as deleteTaskData`），并用访问器挂进 vm 全局 —— 必须用访问器而不是取值，否则 ESM 的 live binding 会被冻结成快照，`state` 被 `setState` 重新赋值后壳读不到。覆盖范围：重复展开引擎、节假日口径、日历字标与底色、拼音检索、逾期/迟完边界、看板列内折叠（`foldKanbanCols` 的前 5 切分与 `kanbanFoldReveal` 的"被挪走的卡片是否落在折叠区"，以及壳里点展开/收起后的实际渲染）、写操作与撤销、同步与装载决策、认证文案与密码连错计数分支（`createPasswordFailGuard` 的 storage 由壳注入，core 不认识 `localStorage`，所以能在 Node 里拿假对象连冷却和降级一起测）、`index.html` 与 JS 之间的选择器 id 对账；壳里的纯函数也直接 `import` 进来断言（如移动壳 `editor.js` 的 `goalOptions` / `goalOptionValue`，它不碰 DOM，所以能脱离浏览器测）。

**`npm run golden`** 是重构期间的等价门：固定夹具（含循环 / 课程 / 逾期 / 迟完 / 跨周跨月 / 带成员目标）渲染 7 视图 × 2 看板模式 + 导航 + banner，共 16 段 `innerHTML` 落盘，改动前后逐字节比对。它的价值已被验证过一次：把 `yearSplit` 返回的 `recurCount` 在壳里按 `recurCnt` 解构（漏了重命名）导致年视图少渲染 107 字符，`npm test` 全绿也没发现，金样本一眼可见。

**断言有效性用变异测试抽查过**，不是只看"跑绿了"：删掉 `occursOn` 的月末钳位 → 3 条变红；把 `isOverdue` 的 `end<today` 改成 `<=` → 当时全绿，说明缺边界断言，补了 5 条后该变异体被杀死。改坏 `deleteTask` 撤销的插回索引 → 立刻变红。

`_mobile_frame.html` / `_mobile_probe.html` 是免登录渲染移动壳的 dev 探针（桩会话，不验证登录链路）。它能量的两件事是**几何**（字号、触控目标高度、横向溢出、一屏条目数——`getBoundingClientRect` 在隐藏页也照常工作）和**处理链**（`element.click()` 派发的是走完整监听器链的真实 click 事件）。它测不到的是**指针输入**：命中测试、遮挡、滚动位置、动画手感都不在其中，所以"探针里点通了"不等于真机点得中——那一步只能上真机，或等有可用 surface 的浏览器。

`_desktop_boot.js` + 一份生成的 `_desktop_frame.html` 是桌面版的同类探针，区别在于它绕的是**登录**：副本由 `index.html` 生成（去掉移动分流 shim，把入口换成 `_desktop_boot.js`），后者用一份假 Supabase client 调 `window.bootstrapPlanner`——链式查询恒回空行、`upsert` 收下来当成功，于是走完整装载时序但不出网、不落真实存储。副本**不进仓库**（`.gitignore` 里挡掉，提交只会跟 `index.html` 漂移），要用时现生成：

```bash
sed -e '6,17d' -e 's|import("/src/main.js")|import("/_desktop_boot.js")|' index.html > _desktop_frame.html
```

删的是头部那段移动分流 shim（第 6–17 行），留着它，探针在窄视口下会被 `location.replace` 弹去 `/mobile.html`。

加 `?probe=login` 时同一份假 client 改走**登录链路**：`getSession` 先回空（停在登录页）、`signInWithPassword` 默认必回 `invalid_credentials`、`resetPasswordForEmail` / `updateUser` 回成功，并把 `onAuthStateChange` 的回调留在 `window.__probeAuth` 上，于是连错计数、60 秒冷却、面板指路、`PASSWORD_RECOVERY` 进"设置新密码"都能在浏览器里跑真实监听器链；冷却不必干等 60 秒，把 `localStorage` 里的 `unlockAt` 改到过去即可。移动壳对应的是 `_mobile_login_probe.html` + `_mobile_login_probe.js`（桩会话直接驱动 `renderLogin`）与 `_mobile_login_frame.html`（390px iframe，用来量登录页在窄视口下的几何 —— 内置浏览器没有可见 surface，顶层 `innerWidth` 恒为 0，量不到）。这三份是验证工具，不参与构建。

2026-10-01 用这套探针实测过的链路（两端各自跑过）：连错 5 次第 5 次弹面板并禁用提交、第 6 次不出网、点面板"发送邮箱登录链接"后当场发信且提交按钮与它一起进入 60 秒重发冷却（冷却内再点不出网、切回密码模式时倒计时收掉而密码锁定重新接管）、发重置邮件后按钮进入 60 秒重发冷却、改 `unlockAt` 到过去后计时器自己放开并抹掉"暂停中"那行、登录成功清零计数、`PASSWORD_RECOVERY` 停在"设置新密码"且保存后进主界面。移动壳 390px 下 `overflowX=0`、面板两个按钮高 48px。**没测到的**：真机指针命中与观感、真发一封重置邮件（假 client 不碰 Supabase），以及 Reset password 模板未改前手机点邮件链接的实际表现。

桌面批量选择这条壳路径的断言（34 条）原先单独立在 `_bulk_test.js` 里，2026-09-30 已并入 `_recur_test.js`：那份脚本用的是自己的装载层，只重写了 `pinyin-pro` 一条 import，而 `planner.js` 现在 import 了 13 个模块，`vm` 里加载必炸、又被它自己的 `try/catch` 吞成一行提示，于是所有断言在 undefined 上整片失效——它挂在 npm scripts 之外太久，实际早就不是可用测试。并入后走 `_core_seed.mjs` 那套 seed（剥全部 import + `defineProperties` 挂 live getter），顺带去掉两份脚本各写一遍的 id 对账。

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
_mobile_login_probe.html/.js    移动壳登录页探针（桩会话驱动连错计数与重置密码链路）
_mobile_login_frame.html        把上面那份装进 390px iframe 量几何
_desktop_boot.js                桌面探针的假 client 入口（副本 _desktop_frame.html 现生成、不提交；?probe=login 走登录链路）
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
