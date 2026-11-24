# 资源市场资源下架与操作权限设计方案

> 文档版本：v0.2  
> 文档状态：P0 已实现  
> 日期：2026-11-17  
> 适用模块：`dsh-collab-resource-market`  
> 关联文档：
>
> - [工作台 2.0 与资源市场技术设计](./technical-design-workbench-plugin-market.md)
> - [工作台 2.0：可插拔工作台与资源市场 PRD](./workbench-plugin-market-prd.md)
> - [平台治理：上线初期范围、目标与能力建设方案](./platform-governance-launch-plan.md)
> - [平台身份与权限方案：Principal、账号与 AI 伙伴](./platform-principal-rbac-design.md)

---

## 1. 结论

资源市场需要支持“下架”，但下架不能等同于删除，也不能和用户卸载、管理员停用混为一谈。

本方案采用四项核心设计：

1. **资源来源和共享范围分开建模。**  
   `origin=platform|user` 表示资源由谁提供；`sharingScope=private|team|platform` 表示资源向谁开放。不能通过发布者名称、`ownerId` 字符串或前端标签推断权限。

2. **市场生命周期与用户安装状态分开。**  
   资源是否有市场可见性，与某个用户是否已安装、是否已连接不是同一个状态。下架资源不能直接删除用户的安装记录。

3. **操作权限由“角色 + 资源归属 + 当前状态”共同决定。**  
   平台管理员可以下架平台资源和用户共享资源；平台成员只能下架自己上传并共享的资源；普通成员不能下架其他成员的资源。

4. **下架优先，删除受限。**  
   平台资源和用户共享资源不提供硬删除。下架后从资源市场默认列表、搜索和推荐中移除，并阻止新安装或新连接；已有安装、已有工作台引用和审计记录保留。

一句话规则：

> 平台资源由平台管理员治理，用户共享资源由资源所有者自行下架，平台管理员保留强制下架和风险处置权。

P0 实现范围：

- 平台资源、用户共享资源的 `delist` 与 `relist`。
- 平台管理员、资源所有者、其他成员和访客的服务端权限判断。
- 生命周期覆盖记录与结构化审计。
- 市场默认隐藏、新安装阻断、已安装 Skill 继续解析。
- 桌面端与移动端操作入口、状态展示和确认弹窗。

---

## 2. 当前实现与本次要解决的问题

### 2.1 当前现状

| 现状                                                                 | 影响                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| 平台 Skill 通过 `ownerId === "platform"` 识别                        | 只能表达一个特殊归属值，无法表达共享范围、发布状态和治理锁定 |
| 用户自定义资源只按 `ownerId === principal.userId` 查询               | 当前没有真正的用户共享资源目录                               |
| `DELETE /api/collab/resources/custom` 直接删除记录                   | 删除会同时影响目录、安装和审计，不适合作为共享资源下架动作   |
| `removeCustomResource` 允许管理员删除任意用户资源                    | 管理员治理权可能越界进入用户私有资源                         |
| `canManage` 仅按 `user.role === "admin"` 返回                        | 页面无法判断某个资源是否允许当前用户下架                     |
| 资源列表状态主要表示 `enabled/available/connected/pending`           | 这些是用户安装或连接状态，不是市场发布状态                   |
| 功能插件已使用 `runtimeStatus` 表示 `packaged/not_packaged/disabled` | 治理状态不能复用同名字段，否则“已装配”和“被管理员停用”会混淆 |
| seed/provider 资源通常是不可变目录                                   | 下架不能修改源数据，需要独立的生命周期覆盖记录               |

### 2.2 本次要补的能力

- 平台资源下架与重新上架。
- 用户上传共享资源下架与重新上架。
- 管理员强制下架用户共享资源。
- 服务端统一判断资源操作权限。
- 下架后的列表、搜索、详情、安装、连接行为。
- 已安装用户的兼容策略。
- 操作审计、并发控制和存量数据迁移。

---

## 3. 概念与状态模型

### 3.1 资源来源

```ts
type ResourceOrigin = "platform" | "user";
```

| 来源       | 定义                                     | 示例                                                 |
| ---------- | ---------------------------------------- | ---------------------------------------------------- |
| `platform` | 平台官方、平台预置或经平台目录接入的资源 | 官方 Skill、seed MCP、官方工作台方案、已装配功能插件 |
| `user`     | 用户自行上传或注册的资源                 | 用户上传的 Skill、MCP、工作台方案和功能插件          |

判定原则：

- `origin` 来自服务端规范化字段或迁移规则。
- `publisher.kind=certified` 只是认证等级，不改变 `origin`。
- 发布者显示名不参与权限判断。
- 认证、官方徽标、发布者名称都不是授权依据。

### 3.2 共享范围

```ts
type SharingScope = "private" | "team" | "platform";
```

| 共享范围   | 可见对象                 | 是否属于“共享资源” |
| ---------- | ------------------------ | ------------------ |
| `private`  | 资源所有者本人           | 否                 |
| `team`     | 指定工作区成员           | 是                 |
| `platform` | 平台内符合可见条件的成员 | 是                 |

本方案中的“用户上传共享资源”指：

```text
origin = user
sharingScope = team | platform
publicationStatus = published
```

用户私有资源不属于平台治理目录。平台管理员默认不能查看、下架或删除用户的私有资源。

### 3.3 市场生命周期

市场生命周期使用独立字段 `publicationStatus`：

```ts
type PublicationStatus = "draft" | "published" | "delisted" | "archived";
```

| 状态        | 含义                 | 默认市场可见 | 允许新安装 |
| ----------- | -------------------- | -----------: | ---------: |
| `draft`     | 草稿或待发布         |           否 |         否 |
| `published` | 已上架               |           是 |         是 |
| `delisted`  | 已下架               |           否 |         否 |
| `archived`  | 长期归档，仅保留历史 |           否 |         否 |

`archived` 作为后续能力保留，不纳入本次 P0 主流程。

### 3.4 运行可用性

下架不代表立即阻断已有用户。平台管理员还需要一个独立的风险处置动作：

```ts
type AvailabilityStatus = "active" | "suspended";
```

| 状态        | 含义                                         |
| ----------- | -------------------------------------------- |
| `active`    | 已安装用户可继续使用                         |
| `suspended` | 新安装和现有运行均阻断，但配置与安装记录保留 |

本方案建议：

- 普通下架只修改 `publicationStatus=delisted`，不修改 `availabilityStatus`。
- 只有平台管理员可以执行 `suspended`。
- 紧急安全事件才使用停用，不作为普通下架按钮的默认行为。

### 3.5 用户安装状态

现有安装和连接状态继续保留：

| 资源类型   | 用户侧状态                                                           |
| ---------- | -------------------------------------------------------------------- |
| Skill      | `available`、`enabled`                                               |
| MCP        | `off`、`pending`、`connected`                                        |
| 工作台方案 | 未复制、已复制                                                       |
| 功能插件   | `not_enabled`、`enabled`、`not_packaged`、`disabled`、`incompatible` |

它们的含义只回答“当前用户是否安装、连接或启用”，不能代替 `publicationStatus`。

---

## 4. 角色与权限规则

### 4.1 角色映射

当前平台账号角色为 `admin | owner | member | guest`。本方案按以下方式映射：

| 平台角色 | 本方案身份 | 资源市场写权限                       |
| -------- | ---------- | ------------------------------------ |
| `admin`  | 平台管理员 | 可管理平台资源和全部用户共享资源     |
| `owner`  | 平台成员   | 按资源所有者身份管理自己的资源       |
| `member` | 平台成员   | 按资源所有者身份管理自己的资源       |
| `guest`  | 访客       | 只读，不可上传、共享、下架或重新上架 |

说明：

- 此处的 `owner` 是平台账号角色，不等于“资源所有者”。
- 工作区 Owner 不是平台管理员。
- 若后续接入 Principal Grant，仍以资源 Owner Principal 和平台角色 Grant 为准，不能只看工作区角色。

### 4.2 权限矩阵

| 操作                   | 资源来源/范围          | 平台管理员 |   资源所有者（成员） |   其他成员 |         访客 |
| ---------------------- | ---------------------- | ---------: | -------------------: | ---------: | -----------: |
| 查看已上架资源         | 平台资源               |         是 |                   是 |         是 | 按现有可见性 |
| 查看已上架资源         | 用户共享资源           |         是 |                   是 | 按共享范围 | 按现有可见性 |
| 查看已下架资源         | 平台资源               |         是 |                   否 |         否 |           否 |
| 查看已下架资源         | 用户共享资源           |         是 |                   是 |         否 |           否 |
| 下架平台资源           | 平台资源               |         是 |                   否 |         否 |           否 |
| 下架自己的共享资源     | 用户共享资源           |         是 |                   是 |         否 |           否 |
| 下架他人的共享资源     | 用户共享资源           |         是 |                   否 |         否 |           否 |
| 重新上架平台资源       | 平台资源               |         是 |                   否 |         否 |           否 |
| 重新上架自己的共享资源 | 用户共享资源           |         是 | 是，未被管理员锁定时 |         否 |           否 |
| 管理用户私有资源       | 用户私有资源           |         否 |   是，仅限自己的资源 |         否 |           否 |
| 停用资源运行           | 平台资源或用户共享资源 |         是 |                   否 |         否 |           否 |
| 删除资源记录           | 私有资源               |         否 |   是，仅限自己的资源 |         否 |           否 |
| 删除资源记录           | 共享或平台资源         |         否 |                   否 |         否 |           否 |

### 4.3 管理员治理边界

平台管理员可以：

- 下架平台资源。
- 下架任何用户共享资源。
- 重新上架被下架资源。
- 锁定资源，禁止资源所有者自行重新上架。
- 停用高风险资源。

平台管理员不可以：

- 通过资源市场查看或管理用户私有资源。
- 修改用户私有资源内容。
- 借管理员身份读取资源运行中产生的业务数据。

### 4.4 所有者判断

用户共享资源的可管理所有者只来自服务端资源记录：

```text
resource.ownerPrincipalId === actor.userId
```

以下字段均不能作为授权依据：

- 前端传来的 `ownerId`。
- `publisherName`。
- `publisher.kind`。
- 资源卡片上的发布者标签。
- 客户端计算出的 `canDelist`。

---

## 5. 下架、停用、卸载和删除的区别

| 动作 | 执行者                 | 作用对象           | 结果                             | 是否可恢复 |
| ---- | ---------------------- | ------------------ | -------------------------------- | ---------- |
| 卸载 | 任意已安装用户         | 当前账号的安装关系 | 当前用户不再使用资源             | 可重新安装 |
| 下架 | 资源所有者或平台管理员 | 资源市场发布状态   | 市场不可发现，禁止新安装或新连接 | 可重新上架 |
| 停用 | 平台管理员             | 资源运行策略       | 现有安装也停止使用               | 管理员恢复 |
| 删除 | 私有资源所有者         | 资源记录           | 资源内容被删除                   | 不可恢复   |

产品文案中必须避免把“卸载”写成“下架”，也不能把“下架”写成“删除”。

### 5.1 下架后的统一行为

资源下架后：

1. 从默认市场列表、推荐、搜索结果和公开详情入口移除。
2. 阻止新安装、新连接或新复制。
3. 资源所有者可在“我的资源 > 已下架”中查看。
4. 平台管理员可在治理筛选视图中查看。
5. 已有安装关系、工作台引用和配置保留。
6. 写入生命周期审计。
7. 不删除资源正文、版本、权限声明和历史审计。

### 5.2 各资源类型的表现

| 资源类型   | 下架后新用户 | 已安装用户           | 已有工作台或 AI 伙伴                     |
| ---------- | ------------ | -------------------- | ---------------------------------------- |
| Skill      | 不可安装     | 默认可继续使用       | 保留绑定                                 |
| MCP        | 不可新连接   | 默认保留已有连接     | 保留连接配置                             |
| 工作台方案 | 不可复制     | 已复制工作台不受影响 | 保留                                     |
| 功能插件   | 不可新添加   | 已有引用保留         | 显示“来源已下架”只读占位，不删除布局引用 |

若资源存在安全风险，应使用管理员“停用”，而不是只做普通下架。

---

## 6. 状态流转

### 6.1 发布状态流转

```text
draft
  -> published
  -> delisted
      -> published
      -> archived

published
  -> archived
```

| 当前状态    | 动作     | 目标状态    | 允许角色       |
| ----------- | -------- | ----------- | -------------- |
| `draft`     | 发布     | `published` | 所有者或管理员 |
| `published` | 下架     | `delisted`  | 所有者或管理员 |
| `delisted`  | 重新上架 | `published` | 所有者或管理员 |
| `delisted`  | 归档     | `archived`  | 所有者或管理员 |
| `archived`  | 恢复     | `published` | 仅管理员       |

重新上架时：

- 重新执行基础 Schema 校验。
- 检查资源是否被平台锁定。
- 平台资源必须仍满足当前宿主与版本兼容要求。
- 用户共享资源必须仍满足共享范围和安全扫描。
- 版本和内容是否变化写入审计。

### 6.2 运行状态流转

```text
active
  -> suspended
  -> active
```

只有平台管理员可以执行该状态流转，并且必须填写原因。停用不会删除用户的安装记录或工作台配置。

---

## 7. 交互设计

### 7.1 资源卡片

资源卡片增加两个信息位：

1. 来源标签：
   - `平台资源`
   - `用户共享`
2. 状态标签：
   - `已下架`
   - `已停用`
   - `管理员已锁定`

普通已上架资源不增加额外状态色，避免市场列表充满标签。

`用户共享` 标签旁继续显示实际发布者名称，例如：

```text
用户共享 · Alice
```

### 7.2 详情页操作

详情页操作区按服务端返回的 `actions` 渲染：

```ts
interface ResourceActions {
  canInstall: boolean;
  canDelist: boolean;
  canRelist: boolean;
  canSuspend: boolean;
  canDelete: boolean;
}
```

| 场景                   | 主操作                   | 更多操作       |
| ---------------------- | ------------------------ | -------------- |
| 平台成员查看平台资源   | 安装                     | 无             |
| 平台管理员查看平台资源 | 安装                     | 下架、停用     |
| 成员查看自己的共享资源 | 安装到自己的资源库或管理 | 下架           |
| 管理员查看用户共享资源 | 安装                     | 强制下架、停用 |
| 成员查看他人的共享资源 | 安装                     | 无             |
| 已下架资源             | 重新上架或恢复           | 查看审计信息   |

“下架”属于低频危险操作，不放在卡片主按钮上。详情页使用更多操作菜单，或放在管理区域的危险操作分组中。

### 7.3 下架确认弹窗

确认弹窗必须展示：

- 资源名称和来源。
- 当前状态。
- 下架影响。
- 是否影响已有安装。
- 操作原因。
- 取消和确认按钮。

平台成员下架自己的资源：

```text
下架后，该资源将不再出现在资源市场，其他成员无法新安装。
已安装该资源的用户仍可继续使用。
你可以之后重新上架。
```

平台管理员下架平台资源：

```text
下架后，该资源将从市场移除并停止新的安装或连接。
已有安装和配置会保留。
如存在安全风险，请在下架后执行停用。
```

管理员强制下架用户共享资源：

```text
该操作会立即隐藏资源并阻止新安装。
资源所有者将看到下架状态和治理原因，且无法在管理员解锁前自行重新上架。
```

### 7.4 管理入口

建议增加两个轻量入口，不新建复杂治理后台：

1. **我的资源**
   - 展示自己上传的私有资源和共享资源。
   - 支持 `在架 / 已下架` 筛选。
   - 支持重新上架。

2. **平台资源管理**
   - 仅平台管理员可见。
   - 支持 `平台资源 / 用户共享 / 已下架` 筛选。
   - 支持强制下架、恢复和停用。

首期不做批量下架。批量操作涉及影响范围计算、并发控制和误操作恢复，放到后续版本。

---

## 8. 服务端授权设计

### 8.1 统一能力计算

新增统一授权方法：

```ts
function resourceCapabilities(
  principal: MarketPrincipal,
  resource: ResourceDescriptor,
): ResourceActions;
```

至少返回：

```ts
{
  (canView, canInstall, canDelist, canRelist, canSuspend, canDelete);
}
```

权限判断顺序：

```text
1. 资源是否存在
2. 当前用户是否有权查看资源
3. 资源是否处于可操作状态
4. 用户是否为平台管理员
5. 用户是否为资源所有者
6. 资源是否被管理员锁定
7. 返回动作能力
```

### 8.2 下架鉴权伪代码

```ts
function assertCanDelist(
  principal: MarketPrincipal,
  resource: ResourceDescriptor,
): void {
  if (resource.publicationStatus !== "published") {
    throw new ResourceMarketError("conflict", "资源当前不可下架");
  }

  if (principal.role === "admin") {
    return;
  }

  if (
    resource.origin === "user" &&
    resource.sharingScope !== "private" &&
    resource.ownerPrincipalId === principal.userId
  ) {
    return;
  }

  throw new ResourceMarketError("forbidden", "无权下架该资源");
}
```

### 8.3 列表与详情返回

资源列表和详情接口需要返回：

- `origin`
- `sharingScope`
- `publicationStatus`
- `availabilityStatus`
- `ownerPrincipalId`
- `adminLocked`
- `actions`

不应只在页面顶层返回一个 `canManage`。不同资源的权限不同，必须逐资源计算 `actions`。

### 8.4 已下架资源可见性

默认接口行为：

```text
GET /api/collab/resources/skills
GET /api/collab/resources/mcps
GET /api/collab/workbench-market/templates
GET /api/collab/workbench-market/plugins
```

只返回 `publicationStatus=published` 且运行状态允许展示的资源。

管理查询行为：

```text
includeDelisted=true
```

服务端根据当前用户范围过滤：

- 管理员：平台资源和用户共享资源。
- 普通成员：自己拥有的资源。
- 访客：不返回已下架资源。

### 8.5 现有安装的解析

用户安装查询和运行解析不能简单复用市场目录逻辑，否则资源下架会导致已安装用户突然不可用。

建议拆分三个读取口：

| 读取口             | 作用                     |                               是否包含已下架 |
| ------------------ | ------------------------ | -------------------------------------------: |
| `marketCatalog`    | 市场发现、搜索、安装入口 |                                           否 |
| `installedCatalog` | 当前用户已安装资源       |                           是，带来源下架状态 |
| `resolvedCatalog`  | AI 伙伴运行时解析        | 是，但 `availabilityStatus=suspended` 时拒绝 |

已安装 Skill 下架后，可以返回：

```ts
{
  id,
  status: "enabled",
  publicationStatus: "delisted",
  availabilityMessage: "来源已下架，当前安装继续可用"
}
```

若管理员执行停用：

```ts
{
  status: "enabled",
  publicationStatus: "delisted",
  availabilityStatus: "suspended",
  availabilityMessage: "资源已停用"
}
```

### 8.6 删除保护

现有 `removeCustomResource` 需要增加保护：

| 资源类型                      | 删除行为                                 |
| ----------------------------- | ---------------------------------------- |
| 用户私有 Skill 或其他私有资源 | 所有者可以删除                           |
| 用户共享资源                  | 禁止直接删除，先下架；归档由后续能力处理 |
| 平台资源                      | 禁止资源市场删除                         |
| seed/provider 资源            | 禁止修改源数据，只允许写生命周期覆盖记录 |

管理员删除用户私有资源不应作为默认治理能力。若合规场景确需删除，应走单独的数据治理流程，不放在资源市场操作中。

---

## 9. 数据模型

### 9.1 资源来源字段

建议在统一资源 DTO 中增加：

```ts
interface ResourceIdentity {
  id: string;
  resourceType: "skill" | "mcp" | "workbench-template" | "panel-plugin";
  origin: "platform" | "user";
  ownerPrincipalId: string;
  sharingScope: "private" | "team" | "platform";
  publisherId: string;
  publisherName: string;
  version: string;
}
```

### 9.2 生命周期覆盖表

新增独立存储表，避免修改 seed/provider 原始资源：

```ts
interface ResourceLifecycleRecord {
  resourceType: ResourceType;
  resourceId: string;
  origin: "platform" | "user";
  ownerPrincipalId: string;
  sharingScope: "private" | "team" | "platform";
  publicationStatus: "draft" | "published" | "delisted" | "archived";
  availabilityStatus: "active" | "suspended";
  adminLocked: boolean;
  revision: number;
  statusReasonCode?: string;
  statusNote?: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}
```

存储键：

```text
resourceType + "\u0000" + resourceId
```

设计原因：

1. 平台 seed 和 provider 资源可能不可变。
2. 同一个生命周期机制覆盖 Skill、MCP、工作台方案和功能插件。
3. 下架不会污染资源内容版本。
4. 恢复时可以清晰比较变更前后状态。

### 9.3 用户共享资源字段

用户自定义资源记录需要补充：

```ts
interface CustomResourceRecord {
  ownerId: string;
  ownerPrincipalId: string;
  origin: "user";
  sharingScope: "private" | "team" | "platform";
  sharedWorkspaceIds?: string[];
  publicationStatus: "draft" | "published" | "delisted";
}
```

兼容说明：

- `ownerId` 保留用于历史兼容。
- 新权限统一读取 `ownerPrincipalId`。
- 若历史记录没有 `ownerPrincipalId`，迁移时使用 `ownerId`。

### 9.4 审计记录

下架相关动作必须写入结构化审计：

```ts
interface ResourceLifecycleAudit {
  eventId: string;
  action:
    | "resource.delist"
    | "resource.relist"
    | "resource.suspend"
    | "resource.resume"
    | "resource.lock"
    | "resource.unlock";
  actorPrincipalId: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  resourceVersion: string;
  origin: string;
  sharingScope: string;
  fromPublicationStatus: string;
  toPublicationStatus: string;
  fromAvailabilityStatus: string;
  toAvailabilityStatus: string;
  reasonCode: string;
  note?: string;
  affectedInstallCount?: number;
  occurredAt: string;
}
```

审计中不得保存 Skill 指令正文、MCP 凭据或其他敏感内容。

---

## 10. API 设计

仓库当前只支持 exact route，资源 ID 放在请求体中。

### 10.1 下架

```http
POST /api/collab/resources/lifecycle/delist
Content-Type: application/json
```

```json
{
  "resourceType": "skill",
  "resourceId": "custom-xxx",
  "reasonCode": "owner_withdraw",
  "note": "调整内容后重新发布",
  "expectedRevision": 3
}
```

成功响应：

```json
{
  "ok": true,
  "resource": {
    "resourceType": "skill",
    "resourceId": "custom-xxx",
    "publicationStatus": "delisted",
    "availabilityStatus": "active",
    "revision": 4
  },
  "auditId": "audit-xxx"
}
```

### 10.2 重新上架

```http
POST /api/collab/resources/lifecycle/relist
Content-Type: application/json
```

```json
{
  "resourceType": "skill",
  "resourceId": "custom-xxx",
  "reasonCode": "owner_republish",
  "expectedRevision": 4
}
```

### 10.3 管理员停用与恢复

```http
POST /api/collab/resources/lifecycle/suspend
POST /api/collab/resources/lifecycle/resume
```

```json
{
  "resourceType": "mcp",
  "resourceId": "mcp-xxx",
  "reasonCode": "security_risk",
  "note": "上游连接存在未授权访问风险",
  "expectedRevision": 7
}
```

### 10.4 管理列表

复用现有资源列表，增加：

```text
includeDelisted=true
publicationStatus=published|delisted
availabilityStatus=active|suspended
origin=platform|user
```

服务端根据角色二次收窄范围，不能相信客户端传入的 `origin` 就扩大可见范围。

### 10.5 错误码

| HTTP | 业务码                         | 场景                         |
| ---: | ------------------------------ | ---------------------------- |
|  400 | `invalid_input`                | 参数缺失或非法               |
|  401 | `unauthorized`                 | 未登录或会话失效             |
|  403 | `forbidden`                    | 无权下架或资源被锁定         |
|  404 | `not_found`                    | 资源不存在或对当前用户不可见 |
|  409 | `resource_delisted`            | 对已下架资源重复执行安装     |
|  409 | `stale_revision`               | 资源状态已被其他操作修改     |
|  409 | `invalid_lifecycle_transition` | 当前状态不允许该动作         |

对无权查看的资源返回 `404`，避免泄露其他用户私有资源是否存在。

---

## 11. 前端实现要点

### 11.1 不再使用全局 `canManage`

当前 Skill 接口只返回 `canManage: user.role === "admin"`，不足以支持资源级权限。

建议保留该字段一个版本用于兼容，但页面新增：

```ts
resource.actions;
```

页面按钮只读取 `resource.actions.canDelist`、`canRelist` 等字段。

### 11.2 下架与安装按钮分离

按钮职责：

| 按钮        | 含义                           |
| ----------- | ------------------------------ |
| 安装        | 当前用户建立安装关系           |
| 卸载        | 当前用户解除安装关系           |
| 连接 / 断开 | 当前用户管理 MCP 连接          |
| 下架        | 资源所有者或管理员改变市场状态 |
| 重新上架    | 资源所有者或管理员恢复市场状态 |
| 停用        | 管理员阻断运行                 |

卡片主按钮只保留高频动作。下架放在详情页更多操作或管理区。

### 11.3 状态刷新

下架成功后前端需要同步更新：

- 当前详情状态。
- 当前列表中的资源项。
- 管理视图计数。
- 相关搜索和筛选结果。

不应依赖重新加载整个页面才能看到状态变化。

### 11.4 无权限用户

无权限用户不显示不可用按钮，也不显示含义不明的灰色“下架”。直接不渲染该动作。

### 11.5 已安装但来源已下架

AI 伙伴 Skill 选择器、资源库和 MCP 页需要显示：

```text
来源已下架，当前安装继续可用
```

若运行状态为 `suspended`：

```text
资源已停用，暂不可使用
```

---

## 12. 兼容与迁移

### 12.1 存量资源映射

启动迁移时按以下规则补齐字段：

| 存量数据                       | `origin`   | `sharingScope`     | `publicationStatus` | `availabilityStatus` |
| ------------------------------ | ---------- | ------------------ | ------------------- | -------------------- |
| `ownerId=platform` 的 Skill    | `platform` | `platform`         | `published`         | `active`             |
| seed Skill / MCP / 模板 / 插件 | `platform` | `platform`         | `published`         | `active`             |
| provider 返回资源              | `platform` | 按 provider 元数据 | `published`         | `active`             |
| 用户私有自定义资源             | `user`     | `private`          | `published`         | `active`             |

对于暂时无法判断来源的 provider 资源：

- 不得默认授予普通成员下架权。
- 使用 `origin=platform`、`ownerPrincipalId=platform` 保守迁移。
- 后续由 provider 元数据补全。

### 12.2 API 兼容

- 保留现有安装、卸载、连接、断开接口。
- 新增生命周期接口，不把下架塞进现有 DELETE 接口。
- 现有 `DELETE /api/collab/resources/custom` 对共享资源返回冲突，提示使用下架。
- 列表响应新增字段，不删除旧字段。
- 现有用户资源默认仍然是私有，不因升级自动公开。

### 12.3 与现有 `removeCustomResource` 的关系

改造后：

```text
removeCustomResource
  -> 仅允许删除当前用户拥有的 private 资源

delistResource
  -> 平台管理员或共享资源所有者

archiveResource
  -> 后续版本
```

管理员不能再通过资源市场接口删除任意用户私有资源。

---

## 13. 关键边界与异常场景

| 场景                        | 处理                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| 成员下架平台资源            | 返回 403，不渲染按钮                                             |
| 成员下架他人共享资源        | 返回 404，避免泄露资源归属                                       |
| 成员下架自己的私有资源      | 不叫下架，走取消共享或删除                                       |
| 管理员查看用户私有资源      | 默认不可见                                                       |
| 资源已被管理员锁定          | 所有者重新上架返回 403                                           |
| 两个管理员同时操作          | 使用 `expectedRevision`，后提交者返回 409                        |
| 重复点击下架                | 当前状态已为目标状态时返回幂等成功，或者 409，需保持前端行为一致 |
| 下架时仍有运行任务          | 普通下架不中断；管理员停用按风险策略阻断                         |
| 已下架 Skill 被 AI 伙伴引用 | 保留引用，市场标记来源已下架                                     |
| 共享资源被所有者删除        | 不允许，必须下架并保留审计                                       |
| provider 资源下架           | 写生命周期覆盖记录，不修改 provider                              |
| 搜索命中已下架资源          | 默认过滤；管理视图可显示                                         |
| 下架后卸载                  | 用户仍可卸载当前安装                                             |
| 下架后重新安装              | 返回 `resource_delisted`                                         |
| 资源被停用后恢复            | 管理员恢复运行时，已有安装重新可用                               |

---

## 14. 验收标准

### 14.1 权限验收

- [ ] 平台成员不能下架平台资源。
- [ ] 平台成员可以下架自己拥有的用户共享资源。
- [ ] 平台成员不能下架其他成员的用户共享资源。
- [ ] 平台管理员可以下架平台资源。
- [ ] 平台管理员可以强制下架用户共享资源。
- [ ] 平台管理员不能查看或下架用户私有资源。
- [ ] 访客不能执行任何生命周期写操作。
- [ ] 被管理员锁定的资源，所有者不能自行重新上架。

### 14.2 下架行为验收

- [ ] 下架后默认市场列表不再显示。
- [ ] 下架后搜索结果不再显示。
- [ ] 下架后新安装请求被拒绝。
- [ ] 下架后 MCP 新连接请求被拒绝。
- [ ] 已安装用户仍能看到安装记录。
- [ ] 普通下架后已有 Skill 安装仍可解析。
- [ ] 功能插件下架后已有工作台引用保留并显示只读占位。
- [ ] 重新上架后资源重新进入市场。
- [ ] 下架不会删除资源版本、权限声明和审计。

### 14.3 数据与审计验收

- [ ] 每次下架、重新上架、停用都产生审计记录。
- [ ] 审计包含操作者、角色、资源、前后状态和原因。
- [ ] 使用过期 `expectedRevision` 的操作不会修改状态。
- [ ] 存量平台资源和用户资源迁移后权限正确。
- [ ] provider 资源下架不修改 provider 原始目录。

### 14.4 前端验收

- [ ] 资源卡片区分“平台资源”和“用户共享”。
- [ ] 无权限用户看不到下架入口。
- [ ] 平台管理员能看到平台资源的下架入口。
- [ ] 成员能在“我的资源 > 已下架”中看到自己的资源。
- [ ] 确认弹窗明确说明已有安装是否保留。
- [ ] 操作成功后列表和详情同步更新。
- [ ] 移动端下架弹窗和操作菜单不溢出、不遮挡。

---

## 15. 分阶段落地

### P0：完成最小下架闭环

1. 增加 `origin`、`sharingScope`、`publicationStatus`、`availabilityStatus` 字段。
2. 增加生命周期覆盖表和审计。
3. 实现平台资源、用户共享资源的下架与重新上架。
4. 实现统一 `resourceCapabilities`。
5. 市场列表、搜索、详情和安装接口过滤已下架资源。
6. 已安装资源继续可读，避免下架造成现有用户不可用。
7. 增加“我的资源 > 已下架”和管理员查看入口。
8. 补充权限、状态和兼容测试。

### P1：治理增强

1. 管理员停用与恢复。
2. 管理员锁定与解锁。
3. 影响范围统计，例如安装数、工作台引用数、近 30 天调用数。
4. 批量下架和批量恢复。
5. 下架到期自动归档。
6. 资源所有者治理通知。

### P2：完整资源治理后台

- 风险队列。
- 发布审批。
- 版本回滚。
- 生命周期看板。
- 资源 Owner SLA。
- 跨租户或团队共享策略。

---

## 16. 实施影响文件

预计需要改动：

| 文件/模块                                                        | 改动                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `plugins/dsh-collab-resource-market/src/service.ts`              | 资源来源、共享范围、生命周期、能力计算、安装过滤 |
| `plugins/dsh-collab-resource-market/src/index.ts`                | 生命周期 API、管理查询、能力 DTO                 |
| `plugins/dsh-collab-resource-market/src/catalog.ts`              | 平台资源来源和安全默认值                         |
| `plugins/dsh-collab-resource-market/client/index.js`             | 来源标签、状态标签、操作菜单、下架弹窗、管理筛选 |
| `plugins/dsh-collab-resource-market/src/service.test.ts`         | 权限矩阵、状态流转、审计、幂等和并发             |
| `plugins/dsh-collab-resource-market/src/client-contract.test.ts` | 前端按钮、文案和接口契约                         |
| `plugins/dsh-collab-teammate`                                    | 已下架 Skill 在 AI 伙伴中的只读提示              |
| `plugins/dsh-collab-workbench-v2`                                | 已下架方案和插件的占位与复制限制                 |

---

## 17. 需要评审确认的产品决策

1. 用户共享资源普通下架后，已安装用户是否继续可用。  
   本方案默认继续可用，只有管理员停用才阻断运行。

2. 用户删除自己的共享资源是否一律禁止。  
   本方案建议禁止直接删除，先下架；资源内容长期清理使用 `archived`。

3. `team` 共享范围是否首期开放。  
   本方案按现有工作区成员模型支持，但若首期只做平台级共享，可先只实现 `private | platform`。

4. 管理员强制下架用户共享资源时，是否默认锁定。  
   本方案建议管理员强制下架的默认原因具有治理属性，默认锁定，避免所有者在问题未修复时立即重新上架。

5. 已下架平台资源是否保留公开详情链接。  
   本方案默认不保留公开详情，只有资源所有者或管理员可访问管理详情和审计信息。
