# Data Agent Data Fabric 第一阶段实现说明

> 日期：2026-10-30  
> 阶段：产品模块能力建设  
> 不包含：订单 MVP、生产数据库 Connector、自由 SQL

> 后续订单领域实现：[data-agent-orders-phase2-implementation.md](./data-agent-orders-phase2-implementation.md)

## 1. 已实现范围

### 1.1 独立 Data Fabric 插件

新增 `dsh-collab-data-fabric`：

- 独立存储域 `collab_data_fabric`；
- DataConnection；
- Dataset；
- SemanticMetric；
- DataPolicy；
- QueryRun；
- QueryResult；
- Fixture Connector；
- 权限感知 Catalog / Describe / Explain / Query。

### 1.2 Fixture 数据能力

第一阶段使用通用“运营事件”Fixture，不包含订单业务语义。

数据集包含：

- event_id；
- occurred_at；
- region；
- category；
- channel；
- status；
- amount。

认证指标：

- event_count；
- failure_rate；
- cancelled_rate；
- timeout_rate；
- anomaly_count；
- anomaly_rate；
- amount_sum。

Fixture 用于验证平台能力，不代表生产数据。

### 1.3 Agent 工具

Data Agent 已注册真实工具：

- `data_catalog_search`
- `dataset_describe`
- `query_explain`
- `metric_query`
- `dataset_query_readonly`

工具从当前 Agent Runtime session 反查 Data Agent Conversation、工作区和请求用户，不接受模型自行声明用户身份。

### 1.4 ContextPack

无选区时新增 `data-capability` section，向模型提供：

- 当前工作区 / 默认项目；
- 时区；
- 默认时间范围；
- 澄清模式；
- 单次查询行数上限；
- 可用数据工具；
- 是否存在可查询数据；
- 是否仅 Fixture。

ContextPack 不注入完整数据目录，数据集和指标通过工具按权限发现。

### 1.5 权限

当前实现：

- 工作区 owner/member 才可发现和查询数据；
- guest 拒绝；
- Runtime Profile `dataConnectionIds` 可限制连接；
- Dataset project scope；
- 用户级 row filter；
- 列字段 deny；
- maxRows；
- query timeout；
- metric version snapshot；
- policy version snapshot；
- QueryRun 与 AgentRun / Conversation 关联。

第一阶段未实现生产级 SQL RLS 改写；Fixture Connector 在服务端按结构化 row filter 过滤。

### 1.6 API

- `GET /api/collab/data-fabric/bootstrap`
- `GET /api/collab/data-fabric/catalog`
- `GET /api/collab/data-fabric/dataset`
- `GET /api/collab/data-fabric/query-runs`
- `POST /api/collab/data-fabric/query/explain`
- `POST /api/collab/data-fabric/query`

所有 API 要求同源和 Bearer token。

### 1.7 设置页

新增 Data Fabric 设置页：

- 工作区数据范围；
- 查询能力状态；
- 只读连接、数据集和指标数量；
- Fixture / Connector 模式；
- 可发现数据集及认证指标；
- 最近 QueryRun。

## 2. Data Agent 配置接入

### Runtime Profile

新增允许工具：

- data.catalog.search；
- dataset.describe；
- query.explain；
- metric.query；
- dataset.query.readonly。

### 智能体模版

系统模版自动修复为 v1.3：

- 补齐通用数据工具；
- 增加“无选区先发现授权数据”的 SOUL 原则；
- 保留受保护身份和既有扩展工具。

### AI伙伴工作区配置

新增并生效：

- `clarificationMode`；
- `maxRowsPerQuery`；
- `queryTimeoutMs`。

原有配置已开始参与 Context / 工具：

- `dataConnectionIds`；
- `defaultProjectId`；
- `defaultTimeRange`；
- `timezone`；
- `preferredMetricIds`。

## 3. 已验证

### 单元/契约

- Fixture seed 幂等；
- Catalog 搜索；
- Dataset describe 隐藏 deny 字段；
- 用户 row filter；
- anomaly rate；
- QueryRun / QueryResult；
- guest 拒绝；
- project scope 拒绝；
- Data Agent 工具注册；
- ContextPack `data-capability`；
- 系统模版 v1.3 修复。

### GUI

- 无选区问“今天有没有异常”；
- Agent 实际调用 `data_catalog_search`、`dataset_describe`、`metric_query`；
- 输出今日总量、异常量、异常率和 Fixture 提醒；
- QueryRun 记录 72 行扫描、指标版本、权限摘要和数据截止时间；
- Data Fabric 设置页展示数据集、指标和最近 QueryRun；
- Console 与失败响应为空。

证据：

- `.tmp/data-fabric-general-query.png`
- `.tmp/data-fabric-settings.png`

## 4. 未完成

- 生产数据库 / 数仓 Connector；
- Dataset / Metric 的可视化新增和编辑；
- SQL 编译器和数据库层 RLS 注入；
- 成本预估、扫描字节限制和熔断；
- QueryResult Artifact 持久化；
- 多数据集 join；
- 订阅和定时报告；
- 订单领域 Dataset、Metric 和 Skill。

这些属于第一阶段后续或第二步订单 MVP，不在本次实现中伪造。
