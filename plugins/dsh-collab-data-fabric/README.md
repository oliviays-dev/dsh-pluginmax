# dsh-collab-data-fabric

受治理的只读数据目录与查询基础层。

Phase 1 提供：

- DataConnection / Dataset / SemanticMetric / DataPolicy；
- Fixture Connector；
- 权限感知 Catalog 和 Dataset Describe；
- Query Explain、Metric Query、Dataset Query；
- QueryRun / QueryResult；
- 面向 Data Agent 的工具数据服务；
- 基础诊断 UI。

本阶段不包含订单专用逻辑、自由 SQL 或生产数据库写入。
