# 工作台 2.0 与资源市场技术设计

> 版本：v1.1  
> 日期：2026-10-28  
> 状态：实现中（2026-10-29 更新）  
> 本版修订：将工作台面板统一到 DSH 原生客户端插件与 typed slot，移除自定义
> `window` 级面板注册表；明确工作台实例与 DSH 插件激活不是同一生命周期对象。
> 输入：
>
> - [工作台 2.0：可插拔工作台与资源市场 PRD](./workbench-plugin-market-prd.md)
> - [交互 Demo](./demos/workbench-plugin-market-demo.html)
> - [平台交互与视觉设计规范](./platform-interaction-design-guideline.md)
> - 现有 `dsh-collab-shell`、`dsh-collab-workbench` 实现

---

## 1. 结论

本次采用“**单一工作台入口、旧工作台转模板、资源市场独立成页**”的兼容方案。

核心决定：

1. 旧路由 `workbench`、旧菜单“工作台”、旧布局键
   `dsh-workbench-layouts-v1`、旧七个模块及现有 API 全部保留，不改写旧页面。
2. 左侧只保留一个“工作台”入口，进入 `workbench-new`，由新插件
   `dsh-collab-workbench-v2` 承接。旧 `workbench` 页面源码保留用于兼容，
   同时把原七模块布局发布为资源市场中的“经典工作台（旧版）”模板。
3. 新增全局路由 `resource-market` 和菜单“资源市场”，由新插件
   `dsh-collab-resource-market` 承接。
4. 新工作台使用独立存储域 `collab_workbench_v2`，不复用、不升级旧
   `collab_workbench` 存储域，避免影响旧工作台。
5. 面板提供方统一采用 DSH 原生客户端插件：通过 `dsh.client` 加载 bundle，并用
   `ctx.slots.register()` 注册到工作台声明的 `workbench.canvas.panel` keyed slot。
   不再实现与 DSH Client Modules 平行的 `window` 级面板注册表。
6. 工作台实例、面板实例、布局和市场授权属于工作台业务域，不是 DSH 插件生命周期
   对象。一个面板 DSH 插件可被多个工作台、多个面板实例引用。
7. 首版不做远端任意 JavaScript 执行。第三方面板插件必须由平台/profile 预先装配，
   普通用户的“安装”表示启用 entitlement 并创建面板引用，不表示浏览器动态下载并
   执行代码。
8. 资源市场首版采用服务端版本化资产目录 + 用户启用状态。Skill / MCP 的数据源
   通过 provider 接口接入；当前仓库没有现成 Skill / MCP 治理服务，首版允许使用
   与 Demo 对齐的官方种子资产，但接口和权限字段按正式模型设计。

默认落地页仍是旧 `workbench`，不自动把用户带到 New 版本。用户可以随时切回旧
工作台，符合“先保留原有工作台功能和菜单”的硬约束。

---

## 2. 现状与约束

### 2.1 现有实现

| 模块       | 现状                                                       | 本次处理                                     |
| ---------- | ---------------------------------------------------------- | -------------------------------------------- |
| 全局壳层   | `dsh-collab-shell/client/index.js` 维护 `route` 与左侧菜单 | 只增量增加菜单、路由辅助和工作台切换桥接     |
| 旧工作台   | `dsh-collab-workbench/client/index.js` 中单页实现          | 保持原页面、原行为、原测试                   |
| 旧布局     | `localStorage["dsh-workbench-layouts-v1"]`                 | 不删除、不改结构；仅由 V2 用户主动迁移时读取 |
| 旧业务 API | `/api/collab/workbench/summary`、`/module` 等              | 原样复用                                     |
| 旧存储域   | `collab_workbench` v1                                      | 不新增表、不升级版本、不改写                 |
| 平台路由   | `pluginmax.global` 按 `shellRoute` 分派页面                | New 工作台与资源市场继续注册到该槽位         |

### 2.2 路由约束

当前 Web Server 只注册 `kind: "exact"` 路由，不支持路径参数。因此 PRD 中的
`/api/collab/workbenches/:id` 不能机械照搬，应改为 exact path + query/body 参数：

```text
PRD 概念接口                             仓库可实现接口
GET    /workbenches/:id                  GET   /api/collab/workbenches/detail?id=...
PATCH  /workbenches/:id                  PATCH /api/collab/workbenches
PUT    /workbenches/:id/draft            PUT   /api/collab/workbenches/draft
POST   /workbenches/:id/duplicate        POST  /api/collab/workbenches/duplicate
DELETE /workbenches/:id                  POST  /api/collab/workbenches/delete
```

资源 ID 统一放在 query、body 或 `Idempotency-Key` 请求头中，不改变业务语义。

### 2.3 不可破坏的兼容边界

- 不修改旧菜单“工作台”的 key、label、顺序和选中逻辑。
- 不把旧路由 `workbench` 重定向到 New。
- 不改变旧工作台七个模块的 API 路径、返回字段和排序。
- 不删除或重命名 `dsh-workbench-layouts-v1`。
- 不把旧布局数据后台迁移后清空。
- 旧工作台测试、项目深链、会议深链、关注状态和简报流必须继续通过。
- New 初始化失败时，旧工作台仍可正常进入，不得出现全壳层白屏。

---

## 3. 范围

### 3.1 首版范围

对应 PRD M1-M3 和 P0 主链路：

- 多工作台实例：创建、切换、重命名、复制、删除、设常用、删除后回退。
- 三种新建方式：空白、市场方案、复制现有。
- 每个工作台独立保存面板顺序、宽度、实例配置和最后使用状态。
- New 工作台编辑态：添加、移除、拖拽排序、宽度 1/6～6/6、撤销/重做、保存、
  未保存离开确认。
- 内置面板 DSH 客户端插件、typed `workbench.canvas.panel` slot 与面板清单。
- 单面板错误边界、未知插件降级、禁用插件占位。
- 资源市场全局页及 `Skill / MCP / 工作台市场` 三页签。
- 工作台市场中的“工作台方案 / 功能插件”两类资产。
- 搜索、分类、详情、权限说明、复制方案、添加插件。
- 私有工作台和团队只读分享；Owner 可编辑，Viewer 只能复制后编辑。
- 乐观并发、幂等启用/复制、审计记录。

### 3.2 首版不包含

- 任意第三方上传并即时运行 JavaScript。
- 多人实时协同编辑。
- 真正付费、分成和公开交易。
- 自动订阅方案更新并覆盖用户配置。
- 团队 Editor 协作、审批发布流和完整治理后台。
- 把 Skill / MCP 的凭据管理重写进工作台插件。

### 3.3 团队范围假设

现有身份模型以 `workspaceId` 为成员边界，没有独立的“团队”对象。因此首版定义：

- `visibility=private`：仅 Owner 可见。
- `visibility=team`：必须选择至少一个 `sharedWorkspaceIds`，只有这些工作区的成员可
  查看；创建者仍为 Owner，其他人默认 Viewer。
- 工作台可见性不改变任何项目、任务、会议或指标 ACL。

这是技术设计假设，PRD 评审时需确认“团队”是否等同工作区成员集合。

---

## 4. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ dsh-collab-shell                                             │
│ 左侧菜单 / 全局 route / New 工作台名称与切换器桥接            │
└───────────────┬───────────────────────────┬──────────────────┘
                │ workbench-new             │ resource-market
                ▼                           ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│ dsh-collab-workbench-v2       │  │ dsh-collab-resource-market   │
│ • 多工作台实例                │  │ • Skill / MCP 页面           │
│ • 6 列编辑态                  │  │ • 工作台方案市场             │
│ • 声明 panel slot             │  │ • 功能插件市场               │
│ • 草稿 / 撤销 / 错误边界      │  │ • 搜索 / 分类 / 详情         │
│ • 独立存储 collab_workbench_v2│  │ • 用户启用状态               │
└───────────────┬───────────────┘  └──────────────┬───────────────┘
                │ renderSlot(key=pluginId)          │ 查询模板 / 插件 / 资源
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│ workbench.canvas.panel（DSH typed keyed slot）               │
│  内置 panel provider                                      │
│  第三方面板 DSH 客户端插件                                 │
└───────────────────────────────┬──────────────────────────────┘
                                │ 面板数据读取
                                ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│ dsh-collab-workbench（旧）    │  │ provider / seed catalog      │
│ 旧页面、旧布局、旧模块 API     │  │ Skill / MCP / 市场资产       │
└───────────────────────────────┘  └──────────────────────────────┘
```

### 4.1 DSH 插件与工作台面板的关系

DSH 原生“一切皆插件”指的是 Cordis 插件包及其服务、存储、Web 路由和客户端
bundle 生命周期；工作台“功能面板插件”是产品层的 UI 能力描述。两者不是同一个
对象，但运行时必须使用同一套 DSH 扩展机制。

| 维度     | DSH 插件                             | 工作台面板插件                               |
| -------- | ------------------------------------ | -------------------------------------------- |
| 激活边界 | Cordis fiber、`inject`、`dsh.client` | 已激活 DSH 客户端插件贡献的 keyed slot entry |
| 生命周期 | 安装、激活、卸载、加载失败           | 被工作台引用、排序、调整宽度、配置、移除     |
| 实例数量 | 一个插件包只有一个宿主生命周期       | 同一 `pluginId` 可有多个 `PanelInstance`     |
| 持久化   | 插件自有 storage domain              | 面板引用和配置存入 Workbench 文档            |
| UI 注册  | `ctx.slots.register()`               | `workbench.canvas.panel` 的 keyed entry      |

统一原则：

- 面板提供方必须是一个 DSH 客户端插件，使用 `dsh.client` 加载 bundle。
- 面板 UI 通过 `ctx.slots.inject("workbench.canvas.panel", ...)` 注册。
- 工作台保存的是面板 `pluginId`、`pluginVersion`、实例配置和布局，不保存组件代码。
- 插件激活一次，面板实例可复用多次；卸载插件不删除用户保存的布局引用。
- 市场目录元数据由服务端 manifest 提供；slot 只负责 UI 注册和渲染，不承担市场、
  安装状态或布局数据。
- DSH Client Modules 已经负责 bundle 发现、版本图、加载和 HMR。工作台不得再实现
  第二套客户端模块注册、加载和生命周期机制。

### 4.2 为什么拆分宿主插件和面板提供方

- `dsh-collab-workbench-v2` 是工作台宿主：拥有实例、编辑、布局、错误边界和 slot
  声明，保持旧工作台插件低风险。
- `dsh-collab-resource-market` 是平台级市场宿主：拥有三类资源发现和市场详情，
  不依附于某个工作台实例。
- `dsh-collab-workbench-panels` 是首版内置面板提供方：将七个存量模块及新增面板
  注册到统一的 `workbench.canvas.panel` slot。后续可继续拆成独立面板插件包。
- 第三方只需新增一个 DSH 客户端插件包并注册同名 keyed slot，不修改工作台主代码。
- 工作台宿主、市场宿主和面板提供方均使用 DSH 插件生命周期，可独立装配、灰度和
  回滚。

### 4.3 插件装配

新增：

```text
plugins/dsh-collab-workbench-v2
plugins/dsh-collab-resource-market
plugins/dsh-collab-workbench-panels
```

修改：

```text
plugins/dsh-collab-shell/client/index.js
plugins/dsh-collab-shell/src/client-nav.test.ts
tsconfig.json
README.md（仅补充插件说明）
```

新插件通过各自 `cordis.patch.yml` 装配。旧工作台的 `cordis.patch.yml` 不改。

---

## 5. 导航与路由

### 5.1 菜单

首版菜单顺序：

```text
工作台
项目
任务
工作流
沟通
AI伙伴
资源市场
```

规则：

- 唯一“工作台”入口进入 `route=workbench-new`。
- “资源市场”进入 `route=resource-market`。
- 点击“资源市场”后，左侧导航仍可见；主内容区整体切换为市场页。
- 再点“工作台”回到当前实例，保留当前实例和滚动位置。
- 原工作台改由“资源市场 → 工作台市场 → 经典工作台（旧版）”复制使用。

### 5.2 New 工作台名称与切换器

壳层不应读取 V2 存储。壳层与 V2 页面通过一个很小的全局桥接对象通信：

```ts
interface WorkbenchNavBridge {
  getSnapshot(): {
    activeName: string;
    loaded: boolean;
  };
  subscribe(listener: () => void): () => void;
  publish(input: { activeName: string; workbenches: WorkbenchNavItem[] }): void;
  command(
    action: "open-switcher" | "switch" | "create" | "manage",
    payload?: { id?: string },
  ): void;
}
```

职责：

- V2 页面发布当前实例名称、常用/最近工作台摘要。
- 壳层在新菜单行内渲染名称和下拉按钮。
- 切换器与新版工作台标题合并为同一个标题按钮，popover 锚定标题位置，不挤压
  主画布；页头不再另设切换按钮。
- 点击项后由 V2 页面处理脏数据守卫和并行请求取消。
- V2 插件未加载或加载失败时，菜单仍显示“工作台”文字；点击后 New 页面
  给出可重试错误，不阻塞其他菜单。

> 为避免两个同级入口造成歧义，工作台切换器不再出现在左侧菜单，统一放到工作台
> 页头右上角。

### 5.3 路由守卫

New 页面存在未保存编辑时：

- 壳层菜单点击先调用全局异步 `beforeRouteChange` guard。
- guard 弹出三按钮确认框：保存并离开、放弃并离开、取消。
- guard resolve `true` 后才修改 `shell.route`。
- 直接点击旧工作台、资源市场或其他全局菜单均受同一 guard 保护。
- 旧页面不注册 guard，因此现有行为不变。

实现只接管壳层的“用户导航入口”和 `pluginmax:navigate` 事件。为了兼容现有深层
链接，`window.__pluginmaxShell.setRoute()` 保持同步语义；New 编辑态下禁用面板内的
跨页深链，避免绕过 guard。

---

## 6. 数据模型

### 6.1 工作台

```ts
type WorkbenchVisibility = "private" | "team";

type WorkbenchV2 = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  icon: string;
  color?: string;
  visibility: WorkbenchVisibility;
  sharedWorkspaceIds: string[];
  layout: {
    columns: 6;
    density: "comfortable" | "compact";
  };
  panels: PanelInstance[];
  sourceTemplate?: {
    id: string;
    version: string;
  };
  revision: number;
  publishedRevision: number;
  createdAt: string;
  updatedAt: string;
};

type PanelInstance = {
  id: string;
  pluginId: string;
  pluginVersion: string;
  title?: string;
  span: 1 | 2 | 3 | 4 | 5 | 6;
  order: number;
  /** 兼容旧工作台的高度偏好；首版仅存量模块迁移时使用。 */
  height?: number | null;
  config: Record<string, unknown>;
  visibilityCondition?: {
    workspaceIds?: string[];
    projectIds?: string[];
    roles?: string[];
  };
};
```

### 6.2 用户偏好

```ts
type WorkbenchPreference = {
  userId: string;
  activeWorkbenchId?: string;
  defaultWorkbenchId?: string;
  favoriteIds: string[];
  order: string[];
  updatedAt: string;
};
```

规则：

- 常用最多 5 个。
- 每个用户最多创建 20 个私有工作台。
- 删除当前实例后，按“默认 → 最近使用 → 系统默认”的顺序回退。
- 最近滚动位置按 `userId + workbenchId` 存在客户端本地，不写入服务端业务记录。

### 6.3 面板插件清单

```ts
type PanelPluginManifest = {
  id: string;
  name: string;
  version: string;
  publisher: {
    id: string;
    name: string;
    verified: boolean;
  };
  category: string;
  icon: string;
  description: string;
  defaultSpan: PanelInstance["span"];
  minSpan: PanelInstance["span"];
  maxSpan: PanelInstance["span"];
  capabilities: string[];
  dataScopes: string[];
  compatibleHost: string;
  configSchema?: Record<string, unknown>;
  /** 提供 keyed slot entry 的 DSH 客户端插件包名。 */
  providerPluginId: string;
  /** 首版固定为 workbench.canvas.panel。 */
  panelSlotKey: "workbench.canvas.panel";
};
```

`providerPluginId` 用于平台装配和诊断，不替代面板 ID。面板 ID 是用户工作台引用的
稳定业务标识；DSH 包名是运行时装配标识。两者可以相同，但生命周期和用途不同。

首版内置插件：

| 面板       | 插件 ID                       | 首版提供方包                  | 数据来源                              |
| ---------- | ----------------------------- | ----------------------------- | ------------------------------------- |
| 核心指标   | `pluginmax.kpi-overview`      | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 每日简报   | `pluginmax.daily-brief`       | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 我的待办   | `pluginmax.task-focus`        | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 重点关注   | `pluginmax.following`         | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 会议纪要   | `pluginmax.meeting-insights`  | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 供给例外   | `pluginmax.supply-exceptions` | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 供应商风险 | `pluginmax.supplier-risk`     | `dsh-collab-workbench-panels` | 旧工作台 API                          |
| 工作流运行 | `pluginmax.workflow-runs`     | `dsh-collab-workbench-panels` | V2 聚合适配器                         |
| 团队负载   | `pluginmax.team-load`         | `dsh-collab-workbench-panels` | V2 聚合适配器                         |
| 行业雷达   | `pluginmax.industry-radar`    | `dsh-collab-workbench-panels` | 情报 provider；无 provider 时明确空态 |

后续若把“团队负载”拆成独立包，只改变 `providerPluginId` 和装配关系，
`pluginmax.team-load` 面板 ID 不变，已有工作台无需迁移。

### 6.4 市场资产

```ts
type MarketAssetType = "skill" | "mcp" | "workbench-template" | "panel-plugin";

type Publisher = {
  id: string;
  name: string;
  verified: boolean;
  kind: "official" | "certified" | "community";
};

type WorkbenchTemplate = {
  id: string;
  version: string;
  name: string;
  description: string;
  preview: string;
  category: string;
  tags: string[];
  requiredPlugins: {
    id: string;
    versionRange: string;
  }[];
  panelPlan: Array<Omit<PanelInstance, "id">>;
  permissions: string[];
  publisher: Publisher;
  visibility: "official" | "team" | "public";
  updatedAt: string;
};

type MarketAssetSummary = {
  id: string;
  type: MarketAssetType;
  name: string;
  description: string;
  publisher: Publisher;
  version: string;
  category: string;
  tags: string[];
  updatedAt: string;
  status:
    | "available"
    | "not_packaged"
    | "not_enabled"
    | "enabled"
    | "installed"
    | "connected"
    | "pending"
    | "disabled"
    | "incompatible";
  permissions: string[];
};
```

### 6.5 市场版本不可变

- 模板详情和安装记录必须带 `templateId + version`。
- 复制工作台只保存弱引用 `sourceTemplate`，不保存强关联。
- 市场升级模板时生成新版本，不修改旧版本快照。
- 已复制工作台不会因模板更新自动变化。

---

## 7. 持久化设计

### 7.1 独立 V2 存储域

```ts
const workbenchV2DomainSpec = {
  name: "collab_workbench_v2",
  version: 1,
  tables: {
    workbenches: { valueSchema: workbenchV2RecordSchema },
    preferences: { valueSchema: workbenchPreferenceSchema },
    panel_entitlements: { valueSchema: panelEntitlementSchema },
    idempotency: { valueSchema: idempotencyRecordSchema },
    audit: { valueSchema: workbenchAuditRecordSchema },
  },
};
```

Key 约定：

```text
workbenches:      workbenchId
preferences:      userId
panel_entitlements: userId + "\0" + pluginId
idempotency:      userId + "\0" + operation + "\0" + idempotencyKey
audit:            createdAt + "\0" + randomId
```

### 7.2 市场存储域

```ts
const resourceMarketDomainSpec = {
  name: "collab_resource_market",
  version: 1,
  tables: {
    installs: { valueSchema: resourceInstallSchema },
    audit: { valueSchema: marketAuditRecordSchema },
  },
};
```

官方市场资产本身是随代码发布的不可变目录，不在用户存储域里复制。DSH 插件包由
平台/profile 装配，用户存储域不能触发客户端 bundle 下载或激活。存储表只记录：

- 用户是否启用某个 Skill / 面板能力；
- MCP 连接状态引用，不存 token、密码或 secret；
- 市场方案复制次数等非敏感计数。

`panel_entitlements` 记录 `userId + pluginId -> enabled`，不记录 DSH 安装状态。
真正的平台插件状态以 DSH Loader / Client Modules 的实时组合为准。市场响应需同时
区分：

- `not_packaged`：DSH 插件包未装配到宿主；
- `not_enabled`：插件已装配，但用户尚未启用；
- `enabled`：用户可添加该面板；
- `disabled`：平台管理员禁用；
- `incompatible`：面板版本与宿主不兼容。

### 7.3 旧布局迁移

迁移必须是用户可见、一次性、可回滚的兼容动作，不在服务端隐式读取浏览器数据。

流程：

1. 首次进入 New 工作台且服务端返回 0 个实例时，读取
   `dsh-workbench-layouts-v1`。
2. 客户端把旧 layout 转成 V2 `panelPlan`：旧 `cols` 映射为 `span`，旧 `height` 写入
   `PanelInstance.height`。
3. 调用 `POST /api/collab/workbenches/bootstrap`，请求带
   `Idempotency-Key=legacy-layout-v1:<hash>`。
4. 服务端按当前用户只执行一次创建；重复请求返回已有结果。
5. 成功后写本地标记 `dsh-workbench-v2-bootstrap-v1`。
6. 旧键不删除、不改写；用户仍可回到旧工作台使用原布局。

如果没有旧布局或旧布局解析失败，创建系统默认 New 工作台，只使用七个存量模块。

---

## 8. 服务端 API

### 8.1 工作台实例

| 方法  | 路径                                 | 说明                       |
| ----- | ------------------------------------ | -------------------------- |
| GET   | `/api/collab/workbenches`            | 我的、共享给我的、最近使用 |
| GET   | `/api/collab/workbenches/detail?id=` | 单个工作台和权限           |
| POST  | `/api/collab/workbenches`            | 创建空白/复制现有          |
| POST  | `/api/collab/workbenches/bootstrap`  | 旧布局一次性迁移           |
| PATCH | `/api/collab/workbenches`            | 名称、图标、描述、可见范围 |
| PUT   | `/api/collab/workbenches/draft`      | 保存完整布局草稿           |
| POST  | `/api/collab/workbenches/publish`    | 团队工作台发布             |
| POST  | `/api/collab/workbenches/duplicate`  | 复制工作台                 |
| POST  | `/api/collab/workbenches/delete`     | 删除工作台                 |
| PUT   | `/api/collab/workbenches/preference` | 当前、默认、常用、排序     |

请求/响应关键字段：

```ts
type SaveDraftInput = {
  workbenchId: string;
  expectedRevision: number;
  panels: PanelInstance[];
  name?: string;
  description?: string;
  visibility?: WorkbenchVisibility;
};

type RevisionConflictResponse = {
  ok: false;
  error: {
    code: "revision_conflict";
    message: string;
    currentRevision: number;
  };
};
```

规则：

- 所有写入必须鉴权并校验 Owner。
- 所有写请求支持 `Idempotency-Key`，至少覆盖创建、复制、安装和迁移。
- `expectedRevision` 不匹配返回 `409 revision_conflict`。
- 名称 trim 后 1～40 字符；冲突时复制接口自动追加 ` (2)` 等序号。
- 不允许客户端写入 `ownerId / createdAt / revision / publishedRevision`。
- 配置递归扫描禁用字段名：`token`、`password`、`secret`、`authorization`、
  `apiKey`、`cookie`。

### 8.2 面板数据

| 方法 | 路径                             | 说明                                 |
| ---- | -------------------------------- | ------------------------------------ |
| GET  | `/api/collab/workbench/summary`  | 旧接口，保持原样，供七个存量面板使用 |
| GET  | `/api/collab/workbench/module`   | 旧接口，保持原样，供单面板刷新       |
| GET  | `/api/collab/workbench-v2/panel` | V2 新增面板数据                      |

V2 面板接口：

```text
GET /api/collab/workbench-v2/panel
  ?pluginId=pluginmax.workflow-runs
  &instanceId=pi-...
  &tzOffset=480
  &scope=joined|all
```

响应沿用旧模块风格：

```ts
type PanelDataResponse = {
  ok: true;
  panel: {
    id: string;
    pluginId: string;
    title: string;
    updatedAt: string;
    source: "live" | "seed" | "empty";
    refreshable: boolean;
    error?: string;
    data?: unknown;
  };
};
```

七个存量模块不复制业务聚合逻辑。V2 客户端仍请求旧
`/api/collab/workbench/summary` 或 `/module`，再通过面板定义把 payload 渲染到新卡片。
面板 DSH 客户端插件可以自行请求这些 API，也可以通过宿主注入的只读数据 hook 请求；
无论采用哪种方式，服务端都必须重新鉴权，不能信任组件传入的用户或工作区身份。

### 8.3 工作台市场

| 方法 | 路径                                                         | 说明                                 |
| ---- | ------------------------------------------------------------ | ------------------------------------ |
| GET  | `/api/collab/workbench-market/templates`                     | 模板列表、搜索、分类、发布者、兼容性 |
| GET  | `/api/collab/workbench-market/templates/detail?id=&version=` | 模板详情                             |
| POST | `/api/collab/workbench-market/templates/install`             | 复制为独立工作台                     |
| GET  | `/api/collab/workbench-market/plugins`                       | 插件目录及运行时装配状态             |
| POST | `/api/collab/workbench-market/plugins/install`               | 为用户启用已装配的面板能力           |
| POST | `/api/collab/workbenches/panels`                             | 添加已启用插件实例到当前工作台       |

复制模板响应允许部分降级：

```ts
type InstallTemplateResponse = {
  ok: true;
  workbench: WorkbenchV2;
  missingPlugins: {
    id: string;
    reason: "not_packaged" | "not_enabled" | "disabled" | "incompatible";
  }[];
};
```

若必需插件不可用：

- 配置声明为必需时阻止复制，返回依赖清单。
- 配置声明为可降级时复制工作台，但缺失面板生成“能力不可用”占位。
- 不用假数据填充缺失插件。

“安装插件”接口的语义是：

1. 检查对应 DSH 客户端插件是否已在当前宿主组合中加载；
2. 检查当前用户是否有权启用该能力；
3. 写入 `panel_entitlements`；
4. 可选地在该请求中为当前工作台创建面板实例。

它不调用 `dsh plugin add`，不下载 bundle，不修改 Client Modules 图。若插件未装配，
返回 `not_packaged` 并提示由平台管理员安装，而不是在前端伪造安装成功。

### 8.4 资源市场

| 方法 | 路径                                    | 说明               |
| ---- | --------------------------------------- | ------------------ |
| GET  | `/api/collab/resources/skills`          | Skill 列表         |
| GET  | `/api/collab/resources/mcps`            | MCP 列表           |
| POST | `/api/collab/resources/skills/install`  | 安装 Skill 偏好    |
| POST | `/api/collab/resources/mcps/connect`    | 发起 MCP 连接流程  |
| POST | `/api/collab/resources/mcps/disconnect` | 断开前走治理与审计 |

Skill / MCP provider：

```ts
interface SkillCatalogProvider {
  list(principal: WorkbenchPrincipal): Promise<MarketAssetSummary[]>;
  install?(
    principal: WorkbenchPrincipal,
    skillId: string,
  ): Promise<InstallResult>;
}

interface McpCatalogProvider {
  list(principal: WorkbenchPrincipal): Promise<MarketAssetSummary[]>;
  connect?(
    principal: WorkbenchPrincipal,
    mcpId: string,
  ): Promise<ConnectResult>;
}
```

仓库当前没有 Skill / MCP 治理服务，因此首版：

- 目录由版本化官方种子提供，界面字段与 Demo 一致。
- Skill 安装状态可持久化。
- MCP 不以“点击即连接”伪造真实连接；未接治理 provider 时按钮进入明确说明态，
  不生成假 token、不谎报 connected。
- 后续接入真实 provider 时不改前端页面协议。

---

## 9. 权限与安全

### 9.1 三层权限取交集

```text
工作台权限 ∩ 插件权限 ∩ 业务数据权限
```

- 工作台权限只控制布局的查看/编辑/复制。
- DSH 插件由平台/profile 装配；用户侧启用只控制当前用户能否引用该能力。
- 每个面板数据请求仍由原有业务 API 鉴权。
- 市场可见、启用面板、复制方案都不扩大项目或工作区权限。

### 9.2 可见性

| 范围    | 查看           | 编辑  | 复制             |
| ------- | -------------- | ----- | ---------------- |
| private | Owner          | Owner | Owner            |
| team    | 指定工作区成员 | Owner | 有数据权限的成员 |

共享工作台复制规则：

- 新实例归复制者所有。
- `sourceTemplate` 可保留来源，工作台间的分享来源可保留只读引用。
- 原 Owner 的筛选值、私有项目 ID、只属于原 Owner 的面板配置不复制。
- 复制后 `visibility` 回到 `private`。
- 复制后 `revision=1`，与源工作台互不影响。

### 9.3 客户端安全

- 面板渲染只允许来自平台/profile 已装配并审核过的 DSH 客户端插件。
- 不执行市场返回的字符串代码、HTML 或脚本。
- 详情富文本必须按纯文本渲染；预览图使用本地静态资源。
- 面板错误边界只记录错误码和安全摘要，不打印面板配置全文。
- 所有服务端响应按最小字段原则返回；无权限对象不泄露名称和统计。
- DSH slot 是同一页面内的 React 组合机制，不是安全沙箱。社区不可信面板若未来
  开放，必须另行引入 iframe / worker 等隔离运行时，不能只依赖错误边界。

### 9.4 审计

记录：

- `workbench_created`
- `workbench_updated`
- `workbench_deleted`
- `workbench_published`
- `workbench_duplicated`
- `panel_added` / `panel_removed`
- `template_installed`
- `panel_plugin_enabled`
- `skill_installed`
- `mcp_connect_requested` / `mcp_disconnected`

审计字段只保存 ID、动作、结果、来源、时间和版本，不保存面板完整配置或凭据。

---

## 10. 前端设计

### 10.1 插件目录

```text
plugins/dsh-collab-workbench-v2/
├── client/
│   └── index.js
├── src/
│   ├── index.ts
│   ├── models.ts
│   ├── service.ts
│   ├── catalog.ts
│   ├── routes.ts
│   ├── service.test.ts
│   └── routes.test.ts
├── cordis.patch.yml
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── README.md

plugins/dsh-collab-resource-market/
├── client/
│   └── index.js
├── src/
│   ├── index.ts
│   ├── models.ts
│   ├── catalog.ts
│   ├── service.ts
│   ├── routes.ts
│   ├── service.test.ts
│   └── routes.test.ts
├── cordis.patch.yml
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── README.md

plugins/dsh-collab-workbench-panels/
├── client/
│   ├── index.js
│   ├── builtin-panels.js
│   └── panel-data.js
├── src/
│   ├── manifests.ts
│   ├── manifests.test.ts
│   └── index.ts
├── cordis.patch.yml
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── README.md
```

`dsh-collab-workbench-panels` 的 `package.json` 必须声明 `dsh.client`，并在
`exports["./client"]` 指向构建后的单文件 bundle。它是面板提供方，不是工作台页面
宿主，不能直接读写 `collab_workbench_v2`。

### 10.2 New 工作台组件树

```text
WorkbenchV2GlobalPage
└── WorkbenchV2Provider
    ├── WorkbenchHeader
    │   ├── WorkbenchIdentity
    │   ├── EditAction
    │   ├── ResourceMarketAction
    │   ├── AddPanelAction
    │   ├── RefreshAction
    │   └── MoreAction
    ├── EditBanner
    │   ├── Undo / Redo
    │   ├── Cancel
    │   └── Save
    ├── WorkbenchCanvas
    │   ├── PanelHost
    │   │   ├── PanelHeader
    │   │   ├── PanelErrorBoundary
    │   │   └── WorkbenchPanelSlot(entryKey=pluginId)
    │   └── UnknownPluginPlaceholder
    ├── EmptyWorkbench
    ├── PanelLibraryDrawer
    ├── PanelSettingsDrawer
    ├── WorkbenchManagerModal
    ├── NewWorkbenchModal
    ├── LeaveDraftConfirm
    └── Toast
```

### 10.3 资源市场组件树

```text
ResourceMarketGlobalPage
├── MarketHeader
│   ├── Brand
│   ├── Tabs: Skill / MCP / 工作台市场
│   ├── Search
│   └── Close
├── SkillView
├── McpView
├── WorkbenchMarketView
│   ├── MarketCategoryNav
│   ├── AssetTypeTabs
│   ├── FilterBar
│   ├── FeaturedTemplate
│   ├── TemplateGrid / PluginGrid
│   ├── EmptyState
│   └── MarketDetailPanel
└── Toast
```

### 10.4 面板 slot 注册与渲染

工作台宿主先为该 slot 增加类型声明：

```ts
declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface SlotMap {
    "workbench.canvas.panel": {
      kind: "keyed";
      scope: "root";
      owner: WorkbenchCanvasPanelProps;
    };
  }
}
```

再在 `pluginmax.global` 注册项中声明 keyed child slot：

```ts
ctx.slots.register(
  {
    name: "pluginmax.global",
    id: "pluginmax-workbench-v2",
    order: 21,
    children: {
      "workbench.canvas.panel": {
        kind: "keyed",
        scope: "root",
      },
    },
  },
  WorkbenchV2GlobalPage,
);
```

面板提供方插件：

```ts
ctx.slots.inject("workbench.canvas.panel", () =>
  ctx.slots.register(
    {
      name: "workbench.canvas.panel",
      key: "pluginmax.kpi-overview",
    },
    KpiPanel,
  ),
);
```

面板宿主按每个持久化实例渲染：

```ts
renderSlot(
  "workbench.canvas.panel",
  {
    workbenchId,
    instanceId,
    pluginId,
    pluginVersion,
    config,
    editing,
    readOnly,
  },
  {
    entryKey: pluginId,
    fallback: unavailablePanel,
  },
);
```

规则：

- `pluginId` 是 keyed slot 的稳定 key，不由用户或实例 ID 生成。
- `pluginmax.global` 组件把 slot owner 提供的 `renderSlot` 传给 `PanelHost`，不能从
  `window` 或 React context 自行获取 slot renderer。
- 同一 keyed entry 可以被多个 `PanelHost` 以不同 owner props 渲染，因此支持多个面板
  实例；DSH 插件本身仍只激活一次。
- 面板组件只接收该实例需要的 owner props 与显式 inject faces，不接收 Cordis `ctx`、
  存储句柄或认证 token。
- 面板宿主和面板提供方之间的共享数据、callback、hook 通过 slot 的 `inject` 声明，
  不通过 `window` 全局对象。
- 未注册 key、插件卸载或加载失败时，`renderSlot` 使用工作台提供的 fallback。
- 插件被管理员禁用时，宿主主动渲染只读占位，不依赖组件内部判断。
- 市场、版本、权限和默认宽度属于服务端 manifest，不由 slot registry 兼任。
- `workbench.canvas.panel` 只存在于 Workbench V2 页面生命周期内；页面卸载时其
  child slot 和所有贡献随之折叠，符合 DSH slot 生命周期。

### 10.5 DSH 装配与服务边界

- 面板提供方通过 `dsh.client` 进入 DSH Client Modules 图，不在插件运行时另建模块
  加载器。
- 面板如需宿主侧能力，应注册自己的服务或 HTTP 路由，并由服务端重新鉴权。
- 工作台宿主不直接 import 面板提供方的实现模块。
- 面板提供方不直接 import 工作台宿主的实现模块。
- 市场宿主通过服务端 manifest 和工作台公开 API 协作，不共享私有存储表。
- 需要数据共享时，使用版本化的服务接口或 HTTP 合约；需要 UI 组合时使用 slot。

### 10.6 编辑状态机

```text
view
  └─ startEdit → editing(clean)
       ├─ add/remove/reorder/resize → editing(dirty)
       ├─ undo / redo → editing(dirty|clean)
       ├─ cancel → confirmDiscard → view
       ├─ save → saving → view | saveError
       └─ navigate → leaveGuard
            ├─ saveAndLeave → saving → previousRequestedRoute
            ├─ discardAndLeave → previousRequestedRoute
            └─ cancel → editing(dirty)
```

约束：

- 进入编辑时做一次深拷贝快照。
- 撤销/重做栈最多保留 20 个布局快照。
- 拖拽经过节流，只在 drop 或 resize 结束时写历史，避免每个 pointermove 生成快照。
- `saving` 中阻止重复提交。
- 保存失败保留整个本地编辑快照，并写 `localStorage` 恢复副本。
- 刷新页面恢复未提交草稿时提示“恢复上次未保存编辑”，由用户确认。

### 10.7 面板运行态

每个面板维护：

```ts
type PanelRuntimeState =
  | { status: "activating"; source: "dsh-client-module" }
  | { status: "ready"; updatedAt: string; source: "live" | "seed" | "empty" }
  | { status: "refreshing" }
  | { status: "error"; code: string; message: string; retryable: boolean }
  | {
      status: "unavailable";
      reason: "not_packaged" | "not_enabled" | "disabled" | "incompatible";
    };
```

- DSH Client Modules 负责 bundle 装载；宿主只观察 slot entry 是否存在并渲染 fallback。
- 首屏同时请求各面板，单个失败只更新自身状态。
- 刷新单面板不重新加载整页。
- 切换工作台时使用 `AbortController` 取消上一实例请求，避免响应串台。
- 列表数据必须带来源和更新时间；`source=seed` 在 UI 明示“演示数据”。
- React 错误边界只隔离渲染错误，不提供 JS 进程或页面安全隔离。第三方面板必须是
  经过审核的可信 DSH 客户端插件。

### 10.8 响应式

- `> 900px`：6 列。
- `640～900px`：2 列，`span > 2` 的面板压到 2 列。
- `< 640px`：1 列。
- 编辑抽屉在桌面上占右侧轨道；小于 640px 时改为全屏抽屉。
- 资源市场详情在桌面上从右侧展开；小于 640px 时覆盖市场主区。
- 所有面板控件在 320px 宽度下不横向滚动。

---

## 11. 资源市场行为

### 11.1 页签

- 默认 `Skill`。
- 切页签关闭详情面板。
- 搜索词切页签时清空，行为固定且可预测。
- 只有进入“工作台市场”页签时才请求模板和插件目录。
- 目录请求按 `tab + query + category + publisher + compatibility` 缓存。

### 11.2 工作台市场

分类与筛选：

- 工作台方案：全部、运营、项目、管理、情报、团队共享。
- 功能插件：全部、AI、任务、数据、流程、协作、供应链、管理、研究、已添加。
- 发布者：官方、认证团队、社区。
- 兼容性：当前宿主兼容、需升级。

方案详情必须展示：

- 真实布局预览；
- 面板数量、宽度和标题；
- 版本、发布者、更新时间、复制量；
- 必需插件和兼容范围；
- 数据权限说明；
- “复制不会扩大数据权限”。

插件详情必须展示：

- 发布者、版本、兼容宿主；
- 默认/最小/最大宽度；
- 数据范围；
- DSH 插件包是否已装配；
- 当前用户是否已启用、是否已在当前工作台。

### 11.3 安装和复制

- 复制模板成功后关闭市场，切换到新工作台，提示“已复制为独立工作台”。
- 方案名称冲突时追加序号。
- 市场中的“安装插件”实际执行“检查 DSH 插件装配状态 → 写入用户 entitlement”；
  不触发客户端 bundle 下载。
- 产品界面可以继续沿用 PRD/Demo 的“安装”文案，但服务端状态、审计和错误码统一用
  entitlement/启用语义，避免把用户操作误记为 DSH 宿主安装。
- 插件包未装配时，按钮改为“需由管理员安装”并返回 `not_packaged`。
- 启用插件但当前工作台只读时，操作改为“复制后可编辑”。
- 添加插件成功后，面板出现在画布底部并滚动到可见位置。
- 同一插件允许多个独立实例，`instanceId` 必须重新生成。
- 若插件已装配但用户未启用或被禁用，不静默添加成功，分别返回
  `not_enabled` / `disabled` 占位原因。

---

## 12. 兼容与迁移

### 12.1 旧工作台不变

验收时先跑旧用例：

- `/api/collab/workbench/summary` 与 `/module` 字段不变。
- 旧七模块顺序、拖拽、宽高、布局保存/切换仍可用。
- 旧“我的工作台 / 管理驾驶舱”分段不变。
- 旧布局管理弹窗不变。
- 任务、工作流、会议深链与关注状态不变。
- 旧页面不出现新菜单状态或 V2 请求错误。

### 12.2 新菜单加入后的壳层兼容

- 原 `navItems` 测试更新为包含新增两项，同时明确旧项顺序不变。
- `workbench`、`projects`、`task`、`workflow`、`meetings`、`teammates`
  六个既有 key 不改名。
- `activeGlobal` 逻辑继续对 `workbench-new`、`resource-market` 生效。
- 移动端全局路由 rail 折叠规则不变。

### 12.3 旧布局迁移失败策略

- 迁移失败不阻塞 New 页面，创建系统默认工作台。
- 本地标记仅在服务端明确成功后写入。
- 用户可在“管理工作台”中手动再次“从旧工作台导入”。
- 导入是新增实例，不覆盖已有 V2 工作台。

### 12.4 DSH 原生装配兼容

- 面板提供方必须声明 `dsh.client`，由 DSH Client Modules 装载。
- 面板组件必须通过 `workbench.canvas.panel` keyed slot 注册，不允许写入
  `window.__pluginmax*PanelRegistry`。
- 工作台宿主必须声明 child slot，面板提供方通过 `ctx.slots.inject()` 等待其生命周期。
- 面板 DSH 插件未激活时，持久化 `PanelInstance` 不删除，页面显示可恢复占位。
- 市场“安装”不改变 profile、Loader 配置或 Client Modules 图。
- 一个 DSH 面板插件可服务多个 `PanelInstance`，不得用 `instanceId` 作为 slot key。

---

## 13. 可观测性

### 13.1 客户端事件

- `workbench_v2_created`
- `workbench_v2_switched`
- `workbench_v2_edit_started`
- `workbench_v2_panel_added` / `removed` / `reordered` / `resized`
- `workbench_v2_saved`
- `workbench_v2_save_failed`
- `workbench_v2_plugin_render_failed`
- `resource_market_opened`
- `resource_market_asset_viewed`
- `workbench_template_installed`
- `panel_plugin_enabled`

### 13.2 健康指标

- V2 首屏加载时间 P50/P95。
- 工作台切换成功率。
- 草稿保存冲突率。
- 单面板渲染失败率。
- 未知/禁用插件占位比例。
- 模板复制成功率及部分失败率。

### 13.3 日志边界

- 不记录 token、面板配置原文、用户私有筛选值。
- 错误日志记录 `pluginId + pluginVersion + workbenchId + errorCode`。
- 服务端审计与客户端埋点分离；审计以合规为主，不做产品分析替代。

---

## 14. 测试设计

### 14.1 服务端单元测试

工作台：

1. 创建 20 个成功，第 21 个拒绝。
2. 名称 0/41 字符拒绝，1/40 字符成功。
3. 多工作台布局互不污染。
4. `expectedRevision` 冲突返回 409。
5. 非 Owner 编辑/删除返回 403。
6. 工作区成员可读取 team 工作台，非成员不可见。
7. 删除当前工作台后按默认/最近顺序回退。
8. 复制生成全新 panel `instanceId`，之后双方修改互不影响。
9. 旧布局 bootstrap 幂等。
10. 配置含 secret/token 字段时拒绝保存。

市场：

11. 模板复制建立弱引用，不修改源模板。
12. 必需插件缺失时阻止或明确降级。
13. 面板启用接口幂等，且不改变 DSH 插件装配状态。
14. 分类、关键词、发布者、兼容性筛选正确。
15. 无权限业务对象名称不出现在市场响应中。
16. Skill / MCP 未接 provider 时不伪造 connected。
17. 面板 DSH 包未装配时返回 `not_packaged`，用户启用请求不能伪造成功。
18. 同一个 `pluginId` 可被多个工作台和多个面板实例引用；停止用户启用不删除布局。

### 14.2 客户端测试

- 菜单顺序断言：

```text
工作台 → 项目 → 任务 → 工作流 → 沟通 → AI伙伴 → 资源市场
```

- 旧 `workbench` 路由仍渲染旧页面组件。
- `workbench-new` 只渲染 V2 页面。
- `resource-market` 只渲染市场页面。
- 切换工作台取消旧请求，不把旧实例数据渲染到新实例。
- 未知插件显示占位且其他面板仍渲染。
- V2 页面注册时声明 `workbench.canvas.panel` keyed child slot。
- 内置面板提供方为每个 `pluginId` 注册唯一的 keyed slot entry。
- 同一个 keyed entry 在不同 `PanelHost` 中可用不同实例配置渲染两次。
- 面板提供方卸载后，保存的工作台仍保留 `PanelInstance` 并显示 fallback。
- 工作台不包含自定义 `window` 级组件注册表或第二套 bundle 加载器。
- 编辑历史最多 20 步；undo/redo 后 dirty 状态正确。
- 6/2/1 列断点映射正确。
- 离开编辑三按钮流程正确。
- 资源市场切页签清空搜索并延迟请求工作台市场。

### 14.3 API 合约测试

- 所有错误统一 `{ ok:false, error:{ code,message } }`。
- 写接口必须带 bearer token。
- `Idempotency-Key` 重复请求返回同一结果。
- `revision` 必填且为整数。
- 响应不包含未知敏感字段。

### 14.4 GUI 验收

桌面：

- 1440×900、1280×800 按 Demo 路径完整走通。
- 旧工作台仍可进入并操作七模块。
- New 工作台切换、编辑、保存、刷新恢复。
- 资源市场三页签、详情、复制、添加。

移动：

- 390×844 无横向溢出。
- 菜单可打开 New 工作台切换器。
- 面板单列、编辑抽屉全屏。
- 市场卡片和详情可滚动操作。

无障碍：

- Tab 顺序与视觉顺序一致。
- 切换器、页签、抽屉、弹窗有正确 role/aria 状态。
- Esc 关闭 popover / 抽屉 / 无未保存修改的弹窗。
- 键盘可完成打开菜单、切换、进入市场、关闭和返回。

### 14.5 回归命令

实现阶段完成后至少执行：

```bash
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
corepack pnpm run contract
```

---

## 15. 实施顺序

### Phase 0：壳层兼容骨架

- 合并原工作台入口为单一“工作台”，新增 `workbench-new` / `resource-market`
  路由。
- 增加 New 工作台名称桥接和路由 guard 接口。
- 更新菜单顺序测试。
- 此阶段两个页面插件可返回最小占位页面，旧工作台不回归。

退出条件：旧菜单与旧页面全部现有测试通过；新菜单可进入占位页。

### Phase 1：V2 多工作台底座

- 新存储域、模型、CRUD、偏好、ACL 和 revision。
- 旧布局 bootstrap。
- New 页面使用态、切换器、管理工作台。

退出条件：至少 3 个工作台切换且布局完全隔离；刷新和重新登录后恢复当前实例。

### Phase 2：面板宿主与编辑态

- 声明 `workbench.canvas.panel` typed keyed slot。
- 新建 `dsh-collab-workbench-panels` DSH 客户端插件。
- 将七个存量模块和新增面板注册为 keyed slot entries。
- 编辑抽屉、添加/移除/排序/宽度、撤销/重做、保存。
- 错误边界、未知插件、版本不兼容占位。

退出条件：一个面板插件可被多个实例引用；面板插件卸载后布局引用保留并显示 fallback；
单个面板失败不阻塞整页；编辑保存成功率与修复恢复路径通过测试。

### Phase 3：资源市场

- 三页签、搜索、分类、详情。
- 工作台方案和功能插件目录。
- 模板复制、用户启用 entitlement、添加到当前工作台。
- 明确面板包未装配时的管理员安装提示。

退出条件：从市场复制方案并继续编辑的闭环通过。

### Phase 4：共享、审计与灰度

- team 只读分享、复制规则、审计。
- 观测事件和灰度开关。
- 桌面/移动 GUI 验收。

退出条件：权限用例、旧工作台回归和 PRD P0 验收项全部通过。

---

## 16. 风险与对策

| 风险                             | 影响                     | 对策                                                                      |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| 新路由误接管旧 `workbench`       | 旧工作台回归             | 新插件只处理 `workbench-new`；增加旧页面仍指向旧组件的测试                |
| 新存储版本影响旧数据             | 旧布局打不开             | 使用独立 `collab_workbench_v2` 域，不升级旧域                             |
| 七模块渲染逻辑重复               | 行为分叉                 | 面板提供方只复用旧 API 数据；通过统一 slot 注册，不复制业务聚合逻辑       |
| 自定义面板运行时与 DSH 分叉      | 双加载器、生命周期不一致 | 统一使用 `dsh.client` + Client Modules + typed slot，不建 window registry |
| 用户级“安装”被误解为动态执行代码 | 安全与运维风险           | 安装只写 entitlement；bundle 必须由平台/profile 预先装配                  |
| slot 同页执行                    | 第三方面板可访问页面环境 | 只允许审核过的插件；未来不可信社区面板另做 iframe / worker 隔离           |
| 编辑态切换工作台丢草稿           | 用户数据损失             | 三按钮离开守卫 + 本地恢复快照                                             |
| 异步请求串台                     | A 的数据出现在 B         | 切换时 AbortController + request generation token                         |
| Skill / MCP 当前无治理服务       | 假连接或安全风险         | provider 抽象；首版不伪造 connected；凭据只走治理服务                     |
| 第三方插件导致白屏               | 主入口不可用             | keyed slot fallback + React 错误边界 + 版本清单；禁止远程任意 JS          |
| 团队定义不明确                   | 权限越界                 | 首版以 `sharedWorkspaceIds` 成员为准，并在评审中确认                      |
| 详情预览数据泄露                 | 越权认知                 | 预览只含布局，不含业务数据；权限文案固定展示                              |

---

## 17. 待确认事项

以下默认采用文档中的建议值，不阻塞设计评审：

1. “团队”是否等同于一个或多个工作区成员集合？建议首版采用
   `sharedWorkspaceIds`。
2. New 工作台是否作为默认落地页？建议首版仍默认旧 `workbench`，后续灰度再切换。
3. 官方 Skill / MCP 首版是否允许使用种子目录？建议允许，但必须标 `source=seed`，MCP
   不得伪造已连接状态。
4. 面板高度是否继续作为用户配置？建议 V2 只迁移旧高度，首版编辑 UI 暂不开放高度，
   避免 Demo 与 PRD 对高度交互没有定义。
5. 团队工作台首版是否需要 Editor？建议仅 Owner/Viewer，Editor 留到 P1。
6. 是否允许不可信社区面板同页运行？建议首版不允许，只开放官方/认证 DSH 客户端插件。

---

## 18. 验收映射

| PRD / 约束         | 本设计覆盖                                        |
| ------------------ | ------------------------------------------------- |
| 保留旧工作台与菜单 | 独立 `workbench` 路由、旧插件不改页面、独立存储域 |
| 合并工作台入口     | 单一“工作台”菜单、`workbench-new`、旧版工作台模板 |
| 多实例与独立布局   | V2 实例模型、偏好表、revision                     |
| 切换与草稿保护     | 壳层名称桥、popover、异步 route guard             |
| 6 列编辑           | PanelInstance.span、编辑状态机、keyed panel slot  |
| 面板异常隔离       | PanelHost + slot fallback + ErrorBoundary         |
| 市场三类页签       | `resource-market` 独立插件                        |
| 方案复制制         | 模板不可变版本 + install 复制 + 弱引用            |
| 插件安装与添加     | DSH 装配状态 + entitlement + panel instance       |
| 权限不扩大         | 工作台 ACL / 插件能力 / 业务 API 三重校验         |
| Demo 交互基线      | 两端页面、抽屉、详情、空态、响应式均按 Demo 定义  |
| 不直接开发         | 本文档仅设计，不含业务代码变更                    |
