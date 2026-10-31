import {
  type DataCatalogRegistration,
  type DataFabricActor,
  type DataFabricService,
  type DataPolicy,
  type DataSkill,
  type Dataset,
  type QueryRun,
  type SemanticMetric,
} from "dsh-collab-data-fabric";
import {
  DEFAULT_ORDER_FIELD_MAPPING,
  DEFAULT_ORDER_VALUE_MAPPINGS,
  ORDER_CONNECTION_ID,
  ORDER_CONNECTOR_MANIFEST,
  ORDER_CONNECTOR_TYPE,
  ORDER_DATASET_ID,
  ORDER_MCP_ASSET_ID,
  ORDER_SEMANTIC_VERSION,
  ORDER_SKILL_ID,
  ORDER_METRIC_IDS,
  orderMigrationSchema,
  orderSourceConfigSchema,
  type OrderMigration,
  type OrderSourceConfig,
} from "./models.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface OrderDataTables {
  readonly sourceConfigs: KvTableLike<OrderSourceConfig>;
  readonly migrations: KvTableLike<OrderMigration>;
}

export interface OrderWorkbenchMetric {
  readonly id: "otif";
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly trend: string;
  readonly trendClass: "up" | "down";
  readonly target: string;
  readonly description: string;
  readonly spark: readonly number[];
  readonly metricId: string;
  readonly metricVersion: string;
  readonly queryRunId?: string | undefined;
  readonly dataMode: "demo" | "production" | "unavailable";
  readonly dataCutoffAt?: string | undefined;
}

interface WorkbenchQueryEvidence {
  readonly value: number | undefined;
  readonly run: QueryRun | undefined;
  readonly demo: boolean;
}

export interface OrderDataFabricQuery {
  query(
    actor: DataFabricActor,
    workspaceId: string,
    input: {
      readonly datasetId: string;
      readonly metricIds: readonly string[];
      readonly timeRange: { readonly from: string; readonly to: string };
      readonly filters: Readonly<Record<string, readonly string[]>>;
      readonly groupBy: readonly string[];
      readonly limit: number;
    },
    trace?: {
      readonly intentSummary?: string | undefined;
      readonly asOf?: Date | undefined;
    },
  ): Promise<{
    readonly run: QueryRun;
    readonly result: {
      readonly rows: readonly Readonly<Record<string, string | number | boolean | null>>[];
      readonly evidence: readonly string[];
    };
  }>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function iso(now: () => Date): string {
  return now().toISOString();
}

function dataKey(workspaceId: string, id: string): string {
  return `${workspaceId}:${id}`;
}

function sourceConfig(
  workspaceId: string,
  now: () => Date,
): OrderSourceConfig {
  return orderSourceConfigSchema.parse({
    workspaceId,
    mode: "demo",
    transport: "mcp",
    mcpAssetId: ORDER_MCP_ASSET_ID,
    mcpToolName: "orders_query",
    manifestVersion: ORDER_CONNECTOR_MANIFEST.version,
    semanticVersion: ORDER_SEMANTIC_VERSION,
    fieldMapping: DEFAULT_ORDER_FIELD_MAPPING,
    valueMappings: DEFAULT_ORDER_VALUE_MAPPINGS,
    revision: 1,
    updatedAt: iso(now),
    updatedBy: "platform-demo-seed",
  });
}

function orderDataset(input: {
  readonly workspaceId: string;
  readonly config: OrderSourceConfig;
  readonly now: string;
}): Dataset {
  const dimension = (id: string, label: string) => ({
    id,
    fieldId: id,
    label,
  });
  return {
    id: ORDER_DATASET_ID,
    workspaceId: input.workspaceId,
    projectIds: [],
    connectionId: ORDER_CONNECTION_ID,
    name:
      input.config.mode === "demo"
        ? "订单 Mock MCP 数据集（非生产）"
        : "订单事实数据集",
    description:
      input.config.mode === "demo"
        ? "通过资源市场 MCP 注册的第三方 Mock OMS 数据（非生产），覆盖支付、取消与履约异常。所有结果必须标注演示来源，不得作为生产结论。"
        : "受治理的订单只读事实数据，覆盖订单、支付、取消、履约、退款和金额。",
    physicalName: "orders",
    timeField: "ordered_at",
    defaultGranularity: "day",
    freshnessMinutes: input.config.mode === "demo" ? 0 : 10,
    fields: [
      {
        id: "order_id",
        physicalName: input.config.fieldMapping.orderId,
        label: "订单 ID",
        dataType: "string",
        role: "identifier",
        sensitivity: "internal",
        description: "订单唯一标识。",
      },
      {
        id: "ordered_at",
        physicalName: input.config.fieldMapping.orderedAt,
        label: "下单时间",
        dataType: "datetime",
        role: "time",
        sensitivity: "internal",
        description: "订单创建时间，订单量类指标的默认时间字段。",
      },
      {
        id: "paid_at",
        physicalName: input.config.fieldMapping.paidAt,
        label: "支付时间",
        dataType: "datetime",
        role: "time",
        sensitivity: "internal",
        description: "支付成功时间；未支付为空。",
      },
      {
        id: "order_status",
        physicalName: input.config.fieldMapping.orderStatus,
        label: "订单状态",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "规范订单状态。",
      },
      {
        id: "payment_status",
        physicalName: input.config.fieldMapping.paymentStatus,
        label: "支付状态",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "pending / succeeded / failed。",
      },
      {
        id: "region",
        physicalName: input.config.fieldMapping.region,
        label: "区域",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "订单归属区域，用于行级权限和下钻。",
      },
      {
        id: "category",
        physicalName: input.config.fieldMapping.category,
        label: "品类",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "订单商品品类。",
      },
      {
        id: "payment_method",
        physicalName: input.config.fieldMapping.paymentMethod,
        label: "支付方式",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "支付渠道类型。",
      },
      {
        id: "channel",
        physicalName: input.config.fieldMapping.channel,
        label: "渠道",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "下单渠道。",
      },
      {
        id: "merchant",
        physicalName: input.config.fieldMapping.merchant,
        label: "商家",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "商家或店铺。",
      },
      {
        id: "promised_fulfillment_at",
        physicalName: input.config.fieldMapping.promisedFulfillmentAt,
        label: "承诺履约时间",
        dataType: "datetime",
        role: "time",
        sensitivity: "internal",
        description: "履约超时判定使用该时间。",
      },
      {
        id: "actual_fulfillment_at",
        physicalName: input.config.fieldMapping.actualFulfillmentAt,
        label: "实际履约时间",
        dataType: "datetime",
        role: "time",
        sensitivity: "internal",
        description: "实际完成履约时间；未履约为空。",
      },
      {
        id: "refund_status",
        physicalName: input.config.fieldMapping.refundStatus,
        label: "退款状态",
        dataType: "string",
        role: "dimension",
        sensitivity: "internal",
        description: "退款状态；不进入 MVP 默认订单异常口径。",
      },
      {
        id: "amount",
        physicalName: input.config.fieldMapping.amount,
        label: "订单金额",
        dataType: "number",
        role: "measure",
        sensitivity: "sensitive",
        description: "订单金额，按列权限和策略输出。",
      },
    ],
    dimensions: [
      dimension("region", "区域"),
      dimension("category", "品类"),
      dimension("order_status", "订单状态"),
      dimension("payment_method", "支付方式"),
      dimension("channel", "渠道"),
      dimension("merchant", "商家"),
    ],
    semanticModelVersion: input.config.semanticVersion,
    status: "active",
    isFixture: input.config.mode === "demo",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function orderMetrics(
  workspaceId: string,
  now: string,
): SemanticMetric[] {
  const common = {
    workspaceId,
    datasetId: ORDER_DATASET_ID,
    formulaVersion: "orders-metric-v1",
    certified: true,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
  return [
    {
      ...common,
      id: ORDER_METRIC_IDS.orderCount,
      name: "订单量",
      synonyms: ["订单数", "订单总量", "order count"],
      definition:
        "指定下单时间范围内创建的订单数，行级权限过滤后计算。",
      aggregation: "count",
      timeField: "ordered_at",
      unit: "单",
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.paidOrderCount,
      name: "支付成功订单数",
      synonyms: ["已支付订单", "支付成功", "paid orders"],
      definition: "下单时间范围内支付状态为成功或已履约的订单数。",
      aggregation: "count-where",
      timeField: "ordered_at",
      unit: "单",
      filter: { payment_status: ["succeeded"] },
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.paymentFailureRate,
      name: "支付失败率",
      synonyms: ["支付失败", "付款失败率"],
      definition:
        "支付失败订单 / 已结束支付尝试订单，已结束支付尝试仅含成功或失败，不含 pending。",
      aggregation: "rate",
      timeField: "ordered_at",
      unit: "%",
      numeratorFilter: { payment_status: ["failed"] },
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.cancelRate,
      name: "取消率",
      synonyms: ["订单取消率", "取消订单"],
      definition: "取消订单 / 下单时间范围内创建的订单。",
      aggregation: "rate",
      timeField: "ordered_at",
      unit: "%",
      numeratorFilter: { order_status: ["cancelled"] },
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.fulfillmentTimeoutRate,
      name: "履约超时率",
      synonyms: ["履约超时", "超时订单", "延迟履约"],
      definition:
        "超过承诺履约时间仍未履约的订单 / 截至数据截止时间已应履约订单；取消和支付失败订单不计入应履约。",
      aggregation: "rate",
      timeField: "promised_fulfillment_at",
      unit: "%",
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.orderExceptionCount,
      name: "订单异常量",
      synonyms: ["订单异常", "异常订单数"],
      definition:
        "订单异常 MVP v1：支付失败 + 取消 + 履约超时的去重订单数；退款和金额异常不混入。",
      aggregation: "count-where",
      timeField: "ordered_at",
      unit: "单",
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.orderExceptionRate,
      name: "订单异常率",
      synonyms: ["订单异常占比", "异常率"],
      definition:
        "订单异常量 / 订单量。默认异常口径仅含支付失败、取消和履约超时。",
      aggregation: "rate",
      timeField: "ordered_at",
      unit: "%",
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.fulfillmentOnTimeRate,
      name: "订单准时履约率",
      synonyms: ["履约准时率", "OTIF", "准时履约"],
      definition:
        "已应履约订单中，实际履约不晚于承诺履约时间的订单占比；不含取消和支付失败。",
      aggregation: "rate",
      timeField: "promised_fulfillment_at",
      unit: "%",
    },
    {
      ...common,
      id: ORDER_METRIC_IDS.orderAmountSum,
      name: "订单金额",
      synonyms: ["订单总额", "GMV", "订单金额合计"],
      definition: "下单时间范围内授权订单金额合计。",
      aggregation: "sum",
      fieldId: "amount",
      timeField: "ordered_at",
      unit: "元",
    },
  ];
}

function orderPolicy(workspaceId: string, now: string): DataPolicy {
  return {
    id: "orders-member-region-scope",
    workspaceId,
    datasetId: ORDER_DATASET_ID,
    subjectType: "workspace-role",
    subjectId: "member",
    rowFilter: { region: ["east", "south"] },
    deniedFields: [],
    coverageNote: "当前授权：华东、华南；未覆盖：华北、西南",
    maxRows: 500,
    timeoutMs: 15_000,
    version: "orders-policy-v1",
    createdAt: now,
    updatedAt: now,
  };
}

function orderSkill(workspaceId: string, now: string): DataSkill {
  return {
    id: ORDER_SKILL_ID,
    workspaceId,
    datasetId: ORDER_DATASET_ID,
    name: "订单异常分析 MVP",
    version: "v1.0",
    triggers: [
      "订单",
      "异常",
      "支付",
      "取消",
      "履约",
      "超时",
      "退款",
      "华东",
      "华南",
      "生鲜",
      "品类",
      "渠道",
      "商家",
    ],
    instructions: [
      "# Order Exception Analysis Skill v1.0",
      "",
      "## 固定口径",
      "- 认证订单异常 v1 = 支付失败 + 取消 + 履约超时，按订单 ID 去重。",
      "- 退款、金额异常和人工标记不得混入默认“订单异常”。用户明确问退款时必须单列为“退款状态”，不能改称默认异常。",
      "- order_count 按 ordered_at；payment/cancel 同样以 ordered_at 范围圈定订单。",
      "- 履约超时使用 promised_fulfillment_at 与 actual_fulfillment_at，在查询截止时间判断；取消和支付失败订单不计入应履约分母。",
      "- 时间默认使用工作区时区。“今天”从当地 00:00 到查询时刻，不把权限外区域当作 0。",
      "",
      "## 问询与下钻",
      "- “今天有没有订单异常”优先直接查询，不先要求用户选卡片。",
      "- 查询至少覆盖 order_count、order_exception_count、order_exception_rate，并按需要拆分支付失败、取消、履约超时，以及区域/品类驱动。",
      "- “查看华东生鲜”等追问沿用上一轮时间范围和口径，仅增加 region=华东、category=生鲜 过滤后重新查询。",
      "- 用户要求“全国/全部”但 permissionSummary 显示 coverage 未覆盖部分区域时，明确说结果仅覆盖授权区域，不推断未覆盖区域为零。",
      "- 命中多个可能口径且会实质改变结论时才使用原生 ask_user_question；默认异常口径无需澄清即可执行。",
      "",
      "## brief 输出契约",
      "普通问询必须输出简洁 Markdown brief，并包含：",
      "1. 结论：异常量/率及最重要驱动；",
      "2. 范围：工作区、区域/品类、时间范围、演示或生产状态；",
      "3. 口径：订单异常 v1，以及实际使用的指标版本；",
      "4. 截止时间：QueryResult.dataCutoffAt；",
      "5. 权限覆盖：QueryResult.permissionSummary，部分授权必须明确；",
      "6. QueryRun 证据：queryRunId、datasetId、指标 ID 与版本；",
      "7. 不确定性：无数据、截断、超时、连接失败或未覆盖范围。",
      "- 不得编造 QueryRun 或数据；工具失败时说明失败阶段和下一步。",
      "- 只有用户明确要求正式报告时才使用报告结构。正式报告必须复用已执行 QueryRun 的 QueryResult；HTML 只能从同一报告快照派生，不得重新查询。",
    ].join("\n"),
    preferredMetricIds: [
      ORDER_METRIC_IDS.orderExceptionRate,
      ORDER_METRIC_IDS.orderExceptionCount,
      ORDER_METRIC_IDS.fulfillmentTimeoutRate,
      ORDER_METRIC_IDS.paymentFailureRate,
      ORDER_METRIC_IDS.cancelRate,
    ],
    defaultTimeRange: "today",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export class OrderDataService {
  private readonly registeredCatalog = new Map<string, string>();

  constructor(
    private readonly tables: OrderDataTables,
    private readonly dataFabric: DataFabricService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  config(workspaceId: string): OrderSourceConfig {
    return (
      this.tables.sourceConfigs.get(workspaceId) ??
      sourceConfig(workspaceId, this.now)
    );
  }

  async ensureWorkspace(workspaceId: string): Promise<OrderSourceConfig> {
    const existing = this.tables.sourceConfigs.get(workspaceId);
    let config = existing ?? this.config(workspaceId);
    if (existing === undefined) {
      await this.tables.sourceConfigs.put(workspaceId, config);
      await this.recordMigration(
        workspaceId,
        "unprovisioned",
        config.manifestVersion,
      );
    } else if (
      existing.manifestVersion !== ORDER_CONNECTOR_MANIFEST.version ||
      existing.semanticVersion !== ORDER_SEMANTIC_VERSION
    ) {
      const fromVersion = existing.manifestVersion;
      const migrateDemoToMcp =
        existing.mode === "demo" &&
        existing.updatedBy === "platform-demo-seed" &&
        existing.mcpAssetId === undefined;
      config = orderSourceConfigSchema.parse({
        ...existing,
        ...(migrateDemoToMcp
          ? {
              transport: "mcp",
              mcpAssetId: ORDER_MCP_ASSET_ID,
              mcpToolName: "orders_query",
            }
          : {}),
        manifestVersion: ORDER_CONNECTOR_MANIFEST.version,
        semanticVersion: ORDER_SEMANTIC_VERSION,
        fieldMapping: {
          ...DEFAULT_ORDER_FIELD_MAPPING,
          ...existing.fieldMapping,
        },
        valueMappings: {
          ...DEFAULT_ORDER_VALUE_MAPPINGS,
          ...existing.valueMappings,
        },
        revision: existing.revision + 1,
        updatedAt: iso(this.now),
        updatedBy: "platform-order-migration",
      });
      await this.tables.sourceConfigs.put(workspaceId, config);
      await this.recordMigration(
        workspaceId,
        fromVersion,
        config.manifestVersion,
      );
    }
    const catalogSignature = [
      config.revision,
      config.mode,
      config.manifestVersion,
      config.semanticVersion,
      config.updatedAt,
    ].join(":");
    if (this.registeredCatalog.get(workspaceId) === catalogSignature) {
      return config;
    }
    const timestamp = iso(this.now);
    const registration: DataCatalogRegistration = {
      connection: {
        id: ORDER_CONNECTION_ID,
        workspaceId,
        name:
          config.mode === "demo"
            ? "Mock OMS MCP 只读连接"
            : "订单生产只读连接",
        connectorType: ORDER_CONNECTOR_TYPE,
        status:
          config.mode === "production" &&
          ((config.transport === "http-json" &&
            (config.endpointRef === undefined ||
              config.credentialRef === undefined)) ||
            (config.transport === "mcp" &&
              (config.mcpAssetId === undefined ||
                config.mcpToolName === undefined)))
            ? "error"
            : "active",
        readOnly: true,
        maxRows: 500,
        timeoutMs: 15_000,
        description:
          config.mode === "demo"
            ? "通过平台资源市场注册的 Mock OMS MCP 连接；不代表任何生产订单。"
            : "生产订单只读连接，端点和凭据仅保存环境引用。",
        ...(config.endpointRef === undefined
          ? {}
          : { configRef: config.endpointRef }),
        ...(config.mcpAssetId === undefined
          ? {}
          : { configRef: `mcp:${config.mcpAssetId}` }),
        ...(config.credentialRef === undefined
          ? {}
          : { credentialRef: config.credentialRef }),
        isFixture: config.mode === "demo",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      dataset: orderDataset({ workspaceId, config, now: timestamp }),
      metrics: orderMetrics(workspaceId, timestamp),
      policies: [orderPolicy(workspaceId, timestamp)],
      skills: [orderSkill(workspaceId, timestamp)],
      replace: true,
    };
    await this.dataFabric.registerCatalog(registration);
    this.registeredCatalog.set(workspaceId, catalogSignature);
    return config;
  }

  migrations(workspaceId: string): OrderMigration[] {
    return [...this.tables.migrations.entries()]
      .map(([, migration]) => migration)
      .filter((migration) => migration.workspaceId === workspaceId)
      .sort((left, right) => left.appliedAt.localeCompare(right.appliedAt));
  }

  async configure(
    workspaceId: string,
    actorUserId: string,
    input: {
      readonly mode: "demo" | "production";
      readonly transport?: "fixture" | "http-json" | "mcp" | undefined;
      readonly endpointRef?: string | undefined;
      readonly credentialRef?: string | undefined;
      readonly mcpAssetId?: string | undefined;
      readonly mcpToolName?: string | undefined;
      readonly fieldMapping?:
        | Readonly<Record<string, string | undefined>>
        | undefined;
      readonly valueMappings?:
        | Readonly<Record<string, Readonly<Record<string, string>> | undefined>>
        | undefined;
    },
  ): Promise<OrderSourceConfig> {
    const current = await this.ensureWorkspace(workspaceId);
    const next = orderSourceConfigSchema.parse({
      ...current,
      mode: input.mode,
      transport:
        input.transport ??
        (input.mode === "demo" ? current.transport : "http-json"),
      fieldMapping: orderSourceConfigSchema.shape.fieldMapping.parse({
        ...current.fieldMapping,
        ...Object.fromEntries(
          Object.entries(input.fieldMapping ?? {}).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      }),
      valueMappings: orderSourceConfigSchema.shape.valueMappings.parse({
        ...current.valueMappings,
        ...Object.fromEntries(
          Object.entries(input.valueMappings ?? {}).filter(
            (
              entry,
            ): entry is [string, Readonly<Record<string, string>>] =>
              entry[1] !== undefined,
          ),
        ),
      }),
      ...(input.mode === "demo"
        ? {
            endpointRef: undefined,
            credentialRef: undefined,
            disabledReason: undefined,
            ...(input.mcpAssetId === undefined
              ? current.mcpAssetId === undefined
                ? {}
                : { mcpAssetId: current.mcpAssetId }
              : { mcpAssetId: input.mcpAssetId }),
            ...(input.mcpToolName === undefined
              ? current.mcpToolName === undefined
                ? {}
                : { mcpToolName: current.mcpToolName }
              : { mcpToolName: input.mcpToolName }),
          }
        : {
            ...(input.endpointRef === undefined
              ? current.endpointRef === undefined
                ? {}
                : { endpointRef: current.endpointRef }
              : { endpointRef: input.endpointRef }),
            ...(input.credentialRef === undefined
              ? current.credentialRef === undefined
                ? {}
                : { credentialRef: current.credentialRef }
              : { credentialRef: input.credentialRef }),
            ...(input.mcpAssetId === undefined
              ? current.mcpAssetId === undefined
                ? {}
                : { mcpAssetId: current.mcpAssetId }
              : { mcpAssetId: input.mcpAssetId }),
            ...(input.mcpToolName === undefined
              ? current.mcpToolName === undefined
                ? {}
                : { mcpToolName: current.mcpToolName }
              : { mcpToolName: input.mcpToolName }),
            disabledReason: undefined,
          }),
      revision: current.revision + 1,
      updatedAt: iso(this.now),
      updatedBy: actorUserId,
    });
    await this.tables.sourceConfigs.put(workspaceId, next);
    await this.ensureWorkspace(workspaceId);
    return next;
  }

  status(workspaceId: string): {
    readonly manifest: typeof ORDER_CONNECTOR_MANIFEST;
    readonly config: {
      readonly mode: "demo" | "production";
      readonly transport: "fixture" | "http-json" | "mcp";
      readonly revision: number;
      readonly endpointConfigured: boolean;
      readonly credentialConfigured: boolean;
      readonly mcpAssetId?: string | undefined;
      readonly mcpToolName?: string | undefined;
      readonly disabledReason?: string | undefined;
    };
    readonly migrations: readonly OrderMigration[];
  } {
    const config = this.config(workspaceId);
    return {
      manifest: ORDER_CONNECTOR_MANIFEST,
      config: {
        mode: config.mode,
        transport: config.transport,
        revision: config.revision,
        endpointConfigured: config.endpointRef !== undefined,
        credentialConfigured: config.credentialRef !== undefined,
        ...(config.mcpAssetId === undefined
          ? {}
          : { mcpAssetId: config.mcpAssetId }),
        ...(config.mcpToolName === undefined
          ? {}
          : { mcpToolName: config.mcpToolName }),
        ...(config.disabledReason === undefined
          ? {}
          : { disabledReason: config.disabledReason }),
      },
      migrations: this.migrations(workspaceId),
    };
  }

  async workbenchMetric(input: {
    readonly workspaceId: string;
    readonly actor: DataFabricActor;
    readonly asOf?: Date | undefined;
  }): Promise<OrderWorkbenchMetric> {
    const config = await this.ensureWorkspace(input.workspaceId);
    const now = input.asOf ?? this.now();
    const currentFrom = new Date(now.getTime() - 7 * DAY_MS);
    const previousFrom = new Date(now.getTime() - 14 * DAY_MS);
    const current = await this.queryWorkbenchMetric(
      input.actor,
      input.workspaceId,
      currentFrom.toISOString(),
      now.toISOString(),
      now,
    );
    const previous = await this.queryWorkbenchMetric(
      input.actor,
      input.workspaceId,
      previousFrom.toISOString(),
      currentFrom.toISOString(),
      now,
    );
    const value = current.value;
    const delta =
      value === undefined || previous.value === undefined
        ? undefined
        : Math.round((value - previous.value) * 10) / 10;
    const dataMode =
      value === undefined
        ? "unavailable"
        : config.mode === "demo"
          ? "demo"
          : "production";
    return {
      id: "otif",
      label: "订单准时履约率",
      value: value === undefined ? "--" : value.toFixed(1),
      unit: value === undefined ? "" : "%",
      trend:
        delta === undefined
          ? "暂无对比"
          : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pt`,
      trendClass:
        delta === undefined ? "up" : delta >= 0 ? "up" : "down",
      target:
        dataMode === "demo"
          ? "演示数据 · 近 7 天 · 非生产"
          : dataMode === "unavailable"
            ? "暂无授权或可用订单数据"
            : "近 7 天 · Data Fabric 认证指标",
      description: "已应履约订单的准时履约情况",
      spark: [],
      metricId: ORDER_METRIC_IDS.fulfillmentOnTimeRate,
      metricVersion: "orders-metric-v1",
      ...(current.run === undefined
        ? {}
        : { queryRunId: current.run.id }),
      dataMode,
      ...(current.run?.dataCutoffAt === undefined
        ? {}
        : { dataCutoffAt: current.run.dataCutoffAt }),
    };
  }

  private async queryWorkbenchMetric(
    actor: DataFabricActor,
    workspaceId: string,
    from: string,
    to: string,
    asOf: Date,
  ): Promise<WorkbenchQueryEvidence> {
    try {
      const result = await this.dataFabric.query(
        actor,
        workspaceId,
        {
          datasetId: ORDER_DATASET_ID,
          metricIds: [ORDER_METRIC_IDS.fulfillmentOnTimeRate],
          timeRange: { from, to },
          filters: {},
          groupBy: [],
          limit: 1,
        },
        {
          intentSummary: "工作台订单准时履约率",
          asOf,
        },
      );
      const raw = result.result.rows[0]?.[
        ORDER_METRIC_IDS.fulfillmentOnTimeRate
      ];
      return {
        value: typeof raw === "number" && Number.isFinite(raw) ? raw : undefined,
        run: result.run,
        demo: configIsDemo(result.result.evidence),
      };
    } catch {
      return { value: undefined, run: undefined, demo: false };
    }
  }

  private async recordMigration(
    workspaceId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<void> {
    const migration = orderMigrationSchema.parse({
      id: `migration-${fromVersion}-${toVersion}`,
      workspaceId,
      fromVersion,
      toVersion,
      appliedAt: iso(this.now),
    });
    await this.tables.migrations.put(
      dataKey(workspaceId, migration.id),
      migration,
    );
  }
}

function configIsDemo(evidence: readonly string[]): boolean {
  return evidence.some((item) => item.startsWith("demo:"));
}

export const ORDER_WORKBENCH_DISPLAY_CONFIG = {
  pluginId: "pluginmax.kpi-overview",
  cardId: "otif",
  metricId: ORDER_METRIC_IDS.fulfillmentOnTimeRate,
  label: "订单准时履约率",
  timeRange: "7d",
  demoBadge: "演示数据 · 非生产",
} as const;

export function createOrderWorkbenchMetricProvider(
  dataFabric: OrderDataFabricQuery,
  now: () => Date = () => new Date(),
): {
  workbenchMetric(input: {
    readonly workspaceId: string;
    readonly actor: DataFabricActor;
  }): Promise<OrderWorkbenchMetric>;
  readonly display: typeof ORDER_WORKBENCH_DISPLAY_CONFIG;
} {
  const queryEvidence = async (
    actor: DataFabricActor,
    workspaceId: string,
    from: Date,
    to: Date,
  ): Promise<WorkbenchQueryEvidence> => {
    try {
      const result = await dataFabric.query(
        actor,
        workspaceId,
        {
          datasetId: ORDER_DATASET_ID,
          metricIds: [ORDER_METRIC_IDS.fulfillmentOnTimeRate],
          timeRange: { from: from.toISOString(), to: to.toISOString() },
          filters: {},
          groupBy: [],
          limit: 1,
        },
        { intentSummary: "工作台订单准时履约率" },
      );
      const raw = result.result.rows[0]?.[
        ORDER_METRIC_IDS.fulfillmentOnTimeRate
      ];
      return {
        value: typeof raw === "number" && Number.isFinite(raw) ? raw : undefined,
        run: result.run,
        demo: configIsDemo(result.result.evidence),
      };
    } catch {
      return { value: undefined, run: undefined, demo: false };
    }
  };
  return {
    display: ORDER_WORKBENCH_DISPLAY_CONFIG,
    async workbenchMetric(input) {
      const currentTime = now();
      const currentFrom = new Date(currentTime.getTime() - 7 * DAY_MS);
      const previousFrom = new Date(currentTime.getTime() - 14 * DAY_MS);
      const current = await queryEvidence(
        input.actor,
        input.workspaceId,
        currentFrom,
        currentTime,
      );
      const previous = await queryEvidence(
        input.actor,
        input.workspaceId,
        previousFrom,
        currentFrom,
      );
      const value = current.value;
      const delta =
        value === undefined || previous.value === undefined
          ? undefined
          : Math.round((value - previous.value) * 10) / 10;
      const dataMode =
        value === undefined
          ? "unavailable"
          : current.demo
            ? "demo"
            : "production";
      return {
        id: "otif",
        label: "订单准时履约率",
        value: value === undefined ? "--" : value.toFixed(1),
        unit: value === undefined ? "" : "%",
        trend:
          delta === undefined
            ? "暂无对比"
            : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pt`,
        trendClass:
          delta === undefined ? "up" : delta >= 0 ? "up" : "down",
        target:
          dataMode === "demo"
            ? "演示数据 · 近 7 天 · 非生产"
            : dataMode === "unavailable"
              ? "暂无授权或可用订单数据"
              : "近 7 天 · Data Fabric 认证指标",
        description: "已应履约订单的准时履约情况",
        spark: [],
        metricId: ORDER_METRIC_IDS.fulfillmentOnTimeRate,
        metricVersion: "orders-metric-v1",
        ...(current.run === undefined ? {} : { queryRunId: current.run.id }),
        dataMode,
        ...(current.run?.dataCutoffAt === undefined
          ? {}
          : { dataCutoffAt: current.run.dataCutoffAt }),
      };
    },
  };
}
