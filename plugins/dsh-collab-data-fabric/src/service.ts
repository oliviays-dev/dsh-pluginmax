import { randomUUID } from "node:crypto";
import {
  FIXTURE_CONNECTION_ID,
  FIXTURE_DATASET_ID,
  FIXTURE_METRIC_IDS,
  dataConnectionSchema,
  dataPolicySchema,
  dataSkillSchema,
  datasetSchema,
  queryResultSchema,
  queryRunSchema,
  semanticMetricSchema,
  semanticQueryInputSchema,
  type DataConnection,
  type DataPolicy,
  type DataSkill,
  type Dataset,
  type DatasetDimension,
  type DatasetField,
  type QueryResult,
  type QueryRun,
  type SemanticMetric,
  type SemanticQueryInput,
} from "./models.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export type DataFabricErrorCode =
  | "invalid_input"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unavailable"
  | "query_failed";

export class DataFabricError extends Error {
  constructor(
    readonly code: DataFabricErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DataFabricError";
  }
}

export interface DataFabricActor {
  readonly userId: string;
  readonly name?: string | undefined;
  readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
  readonly projectId?: string | undefined;
  readonly connectionIds?: readonly string[] | undefined;
  readonly maxRows?: number | undefined;
  readonly queryTimeoutMs?: number | undefined;
}

export interface DataFabricTables {
  readonly connections: KvTableLike<DataConnection>;
  readonly datasets: KvTableLike<Dataset>;
  readonly metrics: KvTableLike<SemanticMetric>;
  readonly policies: KvTableLike<DataPolicy>;
  readonly queryRuns: KvTableLike<QueryRun>;
  readonly queryResults: KvTableLike<QueryResult>;
  readonly skills: KvTableLike<DataSkill>;
}

export interface CompileContext {
  readonly actor: DataFabricActor;
  readonly asOf: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly policy: DataPolicy | undefined;
  readonly query: SemanticQueryInput;
  readonly dataset: Dataset;
  readonly metrics: readonly SemanticMetric[];
  readonly filters: Readonly<Record<string, readonly string[]>>;
  readonly rowPolicy: Readonly<Record<string, readonly string[]>>;
  readonly limit: number;
}

export interface ConnectorQueryResult {
  readonly rows: readonly Readonly<Record<string, string | number | boolean | null>>[];
  readonly scannedRows: number;
  readonly dataCutoffAt: string;
  readonly freshness: string;
  readonly evidence: readonly string[];
}

export interface DataConnector {
  readonly type: string;
  query(context: CompileContext): Promise<ConnectorQueryResult>;
}

export interface CatalogDatasetSummary {
  readonly datasetId: string;
  readonly name: string;
  readonly description: string;
  readonly metrics: readonly {
    readonly id: string;
    readonly name: string;
    readonly definition: string;
    readonly certified: boolean;
  }[];
  readonly dimensions: readonly DatasetDimension[];
  readonly freshness: string;
  readonly isFixture: boolean;
}

export interface DatasetDescription {
  readonly dataset: Omit<Dataset, "fields"> & {
    readonly fields: readonly DatasetField[];
  };
  readonly metrics: readonly SemanticMetric[];
  readonly connection: DataConnection;
  readonly policy: DataPolicy | undefined;
  readonly skills: readonly DataSkill[];
  readonly permissionSummary: string;
}

export interface QueryExplanation {
  readonly datasetId: string;
  readonly metricIds: readonly string[];
  readonly normalizedQuery: Record<string, unknown>;
  readonly filters: Readonly<Record<string, readonly string[]>>;
  readonly rowPolicy: Readonly<Record<string, readonly string[]>>;
  readonly groupBy: readonly string[];
  readonly limit: number;
  readonly estimatedScanRows: number;
  readonly clarificationRequired: boolean;
  readonly clarificationReason?: string | undefined;
}

export interface DataFabricCapabilities {
  readonly dataQueryAvailable: boolean;
  readonly connectionCount: number;
  readonly datasetCount: number;
  readonly metricCount: number;
  readonly fixtureOnly: boolean;
}

export interface DataCatalogRegistration {
  readonly connection: DataConnection;
  readonly dataset: Dataset;
  readonly metrics: readonly SemanticMetric[];
  readonly policies?: readonly DataPolicy[] | undefined;
  readonly skills?: readonly DataSkill[] | undefined;
  readonly replace?: boolean | undefined;
}

export interface DataSkillMatch {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly datasetId?: string | undefined;
  readonly instructions: string;
  readonly preferredMetricIds: readonly string[];
  readonly defaultTimeRange?: "today" | "7d" | "30d" | "month" | undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function iso(value: Date): string {
  return value.toISOString();
}

function key(workspaceId: string, id: string): string {
  return `${workspaceId}:${id}`;
}

function valuesByWorkspace<V extends { readonly workspaceId: string }>(
  table: KvTableLike<V>,
  workspaceId: string,
): V[] {
  return [...table.entries()]
    .map(([, value]) => value)
    .filter((value) => value.workspaceId === workspaceId);
}

function normalizeFilters(
  dataset: Dataset,
  filters: SemanticQueryInput["filters"],
): Record<string, string[]> {
  const allowed = new Set(dataset.dimensions.map((dimension) => dimension.id));
  const normalized: Record<string, string[]> = {};
  for (const [dimensionId, value] of Object.entries(filters)) {
    if (!allowed.has(dimensionId)) {
      throw new DataFabricError(
        "invalid_input",
        `unsupported dataset dimension: ${dimensionId}`,
      );
    }
    normalized[dimensionId] = Array.isArray(value) ? [...value] : [value];
  }
  return normalized;
}

function intersectRowFilters(
  left: Readonly<Record<string, readonly string[]>>,
  right: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const source of [left, right]) {
    for (const [dimensionId, values] of Object.entries(source)) {
      const current = result[dimensionId];
      result[dimensionId] =
        current === undefined
          ? [...values]
          : current.filter((value) => values.includes(value));
    }
  }
  return result;
}

function rowMatches(
  row: Readonly<Record<string, unknown>>,
  filters: Readonly<Record<string, readonly string[]>>,
): boolean {
  for (const [fieldId, values] of Object.entries(filters)) {
    if (!values.includes(String(row[fieldId] ?? ""))) return false;
  }
  return true;
}

function aggregateMetric(
  metric: SemanticMetric,
  rows: readonly Readonly<Record<string, unknown>>[],
): number {
  const filteredRows =
    metric.filter === undefined
      ? rows
      : rows.filter((row) => rowMatches(row, metric.filter ?? {}));
  if (metric.aggregation === "count") return filteredRows.length;
  if (metric.aggregation === "count-where") return filteredRows.length;
  if (metric.aggregation === "sum") {
    if (metric.fieldId === undefined) {
      throw new DataFabricError(
        "invalid_input",
        `sum metric requires fieldId: ${metric.id}`,
      );
    }
    return filteredRows.reduce((total, row) => {
      const value = Number(row[metric.fieldId ?? ""] ?? 0);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
  }
  const numerator =
    metric.numeratorFilter === undefined
      ? rows
      : rows.filter((row) => rowMatches(row, metric.numeratorFilter ?? {}));
  return rows.length === 0 ? 0 : (numerator.length / rows.length) * 100;
}

function metricValue(
  metric: SemanticMetric,
  rows: readonly Readonly<Record<string, unknown>>[],
): number {
  const value = aggregateMetric(metric, rows);
  return metric.aggregation === "rate" || metric.id.includes("_rate")
    ? Math.round(value * 100) / 100
    : Math.round(value * 1000) / 1000;
}

function compileFixtureQuery(context: CompileContext): ConnectorQueryResult {
  const rows = fixtureRows(context);
  const timeField = context.dataset.timeField;
  const from = Date.parse(context.query.timeRange.from);
  const to = Date.parse(context.query.timeRange.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    throw new DataFabricError("invalid_input", "invalid query time range");
  }
  const base = rows.filter((row) => {
    const at = Date.parse(String(row[timeField] ?? ""));
    return (
      Number.isFinite(at) &&
      at >= from &&
      at <= to &&
      rowMatches(row, context.filters) &&
      rowMatches(row, context.rowPolicy)
    );
  });
  const groups = new Map<string, Readonly<Record<string, unknown>>[]>();
  if (context.query.groupBy.length === 0) {
    groups.set("all", base);
  } else {
    for (const row of base) {
      const groupKey = context.query.groupBy
        .map((dimensionId) => String(row[dimensionId] ?? ""))
        .join("\u0000");
      const group = groups.get(groupKey) ?? [];
      group.push(row);
      groups.set(groupKey, group);
    }
  }
  const orderedGroups = [...groups.entries()].slice(0, context.limit);
  const resultRows = orderedGroups.map(([, groupRows]) => {
    const row: Record<string, string | number | boolean | null> = {};
    const first = groupRows[0] ?? {};
    for (const dimensionId of context.query.groupBy) {
      row[dimensionId] = String(first[dimensionId] ?? "");
    }
    for (const metric of context.metrics) {
      row[metric.id] = metricValue(metric, groupRows);
    }
    return row;
  });
  const cutoff = new Date().toISOString();
  return {
    rows: resultRows,
    scannedRows: base.length,
    dataCutoffAt: cutoff,
    freshness: `${context.dataset.freshnessMinutes} 分钟`,
    evidence: [
      `dataset:${context.dataset.id}@${context.dataset.semanticModelVersion}`,
      `metrics:${context.metrics.map((metric) => `${metric.id}@${metric.formulaVersion}`).join(",")}`,
      `scannedRows:${base.length}`,
    ],
  };
}

function fixtureRows(context: CompileContext): Record<string, unknown>[] {
  const now = Date.parse(context.asOf);
  const regions = ["east", "south", "north"];
  const categories = ["fresh", "digital", "apparel"];
  const channels = ["web", "app"];
  const statuses = ["succeeded", "failed", "cancelled", "timeout"];
  const rows: Record<string, unknown>[] = [];
  for (let day = 0; day < 14; day += 1) {
    for (const region of regions) {
      for (const category of categories) {
        for (const channel of channels) {
          for (const [statusIndex, status] of statuses.entries()) {
            const sequence =
              day * 100 + rows.length + statusIndex + region.length;
            rows.push({
              event_id: `fixture-${day}-${region}-${category}-${channel}-${status}`,
              occurred_at: new Date(
                now - day * DAY_MS - sequence * MINUTE_MS,
              ).toISOString(),
              region,
              category,
              channel,
              status,
              amount: 20 + (sequence % 17) * 3.5,
            });
          }
        }
      }
    }
  }
  return rows;
}

export class FixtureConnector implements DataConnector {
  readonly type = "fixture";

  async query(context: CompileContext): Promise<ConnectorQueryResult> {
    return compileFixtureQuery(context);
  }
}

export class DataFabricService {
  private readonly connectors = new Map<string, DataConnector>();
  private readonly catalogProviders = new Set<
    (workspaceId: string) => Promise<void>
  >();

  constructor(
    private readonly tables: DataFabricTables,
    options: {
      readonly now?: () => Date;
    } = {},
  ) {
    this.options = {
      now: options.now ?? (() => new Date()),
    };
    this.registerConnector(new FixtureConnector());
  }

  private readonly options: {
    readonly now: () => Date;
  };

  registerConnector(connector: DataConnector): () => void {
    if (this.connectors.has(connector.type)) {
      throw new DataFabricError(
        "conflict",
        `data connector already registered: ${connector.type}`,
      );
    }
    this.connectors.set(connector.type, connector);
    return () => {
      if (this.connectors.get(connector.type) === connector) {
        this.connectors.delete(connector.type);
      }
    };
  }

  registerCatalogProvider(
    provider: (workspaceId: string) => Promise<void>,
  ): () => void {
    this.catalogProviders.add(provider);
    return () => {
      this.catalogProviders.delete(provider);
    };
  }

  async registerCatalog(input: DataCatalogRegistration): Promise<void> {
    const connection = dataConnectionSchema.parse(input.connection);
    const dataset = datasetSchema.parse(input.dataset);
    const metrics = input.metrics.map((metric) =>
      semanticMetricSchema.parse(metric),
    );
    const policies = (input.policies ?? []).map((policy) =>
      dataPolicySchema.parse(policy),
    );
    const skills = (input.skills ?? []).map((skill) =>
      dataSkillSchema.parse(skill),
    );
    const workspaceId = dataset.workspaceId;
    this.requireWorkspace(workspaceId);
    if (connection.workspaceId !== workspaceId) {
      throw new DataFabricError(
        "invalid_input",
        "connection and dataset workspaces must match",
      );
    }
    if (dataset.connectionId !== connection.id) {
      throw new DataFabricError(
        "invalid_input",
        "dataset must reference the registered connection",
      );
    }
    if (
      metrics.some(
        (metric) =>
          metric.workspaceId !== workspaceId ||
          metric.datasetId !== dataset.id,
      )
    ) {
      throw new DataFabricError(
        "invalid_input",
        "metrics must belong to the registered dataset",
      );
    }
    if (
      policies.some(
        (policy) =>
          policy.workspaceId !== workspaceId ||
          policy.datasetId !== dataset.id,
      )
    ) {
      throw new DataFabricError(
        "invalid_input",
        "policies must belong to the registered dataset",
      );
    }
    if (
      skills.some(
        (skill) =>
          skill.workspaceId !== workspaceId ||
          (skill.datasetId !== undefined && skill.datasetId !== dataset.id),
      )
    ) {
      throw new DataFabricError(
        "invalid_input",
        "skills must belong to the registered workspace and dataset",
      );
    }
    const replace = input.replace === true;
    const putIfChanged = async <V extends { readonly id: string }>(
      table: KvTableLike<V>,
      value: V,
    ): Promise<void> => {
      const existing = table.get(key(workspaceId, value.id));
      if (existing !== undefined && !replace) return;
      if (existing !== undefined && JSON.stringify(existing) === JSON.stringify(value)) {
        return;
      }
      await table.put(key(workspaceId, value.id), value);
    };
    await putIfChanged(this.tables.connections, connection);
    await putIfChanged(this.tables.datasets, dataset);
    for (const metric of metrics) {
      await putIfChanged(this.tables.metrics, metric);
    }
    for (const policy of policies) {
      await putIfChanged(this.tables.policies, policy);
    }
    for (const skill of skills) {
      await putIfChanged(this.tables.skills, skill);
    }
  }

  async skills(
    actor: DataFabricActor,
    workspaceId: string,
    input: {
      readonly query: string;
      readonly datasetIds?: readonly string[] | undefined;
    },
  ): Promise<readonly DataSkillMatch[]> {
    this.access(actor, workspaceId);
    await this.ensureCatalogProviders(workspaceId);
    const query = input.query.trim().toLocaleLowerCase("zh-Hans-CN");
    const datasetIds =
      input.datasetIds === undefined ? undefined : new Set(input.datasetIds);
    return valuesByWorkspace(this.tables.skills, workspaceId)
      .filter((skill) => {
        if (skill.status !== "active") return false;
        if (
          skill.datasetId !== undefined &&
          !this.datasetVisible(actor, workspaceId, skill.datasetId)
        )
          return false;
        if (
          datasetIds !== undefined &&
          skill.datasetId !== undefined &&
          !datasetIds.has(skill.datasetId)
        ) {
          return false;
        }
        if (skill.triggers.length === 0) return true;
        return skill.triggers.some((trigger) =>
          query.includes(trigger.toLocaleLowerCase("zh-Hans-CN")),
        );
      })
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        version: skill.version,
        ...(skill.datasetId === undefined ? {} : { datasetId: skill.datasetId }),
        instructions: skill.instructions,
        preferredMetricIds: [...skill.preferredMetricIds],
        ...(skill.defaultTimeRange === undefined
          ? {}
          : { defaultTimeRange: skill.defaultTimeRange }),
      }));
  }

  async ensureWorkspaceFixture(workspaceId: string): Promise<void> {
    this.requireWorkspace(workspaceId);
    const now = iso(this.options.now());
    const connectionId = key(workspaceId, FIXTURE_CONNECTION_ID);
    if (this.tables.connections.get(connectionId) === undefined) {
      await this.tables.connections.put(
        connectionId,
        dataConnectionSchema.parse({
          id: FIXTURE_CONNECTION_ID,
          workspaceId,
          name: "通用运营事件 Fixture",
          connectorType: "fixture",
          status: "active",
          readOnly: true,
          maxRows: 1_000,
          timeoutMs: 15_000,
          description: "用于第一步平台能力验证的只读测试连接。",
          isFixture: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    if (
      findById(
        valuesByWorkspace(this.tables.datasets, workspaceId),
        FIXTURE_DATASET_ID,
      ) === undefined
    ) {
      await this.tables.datasets.put(
        key(workspaceId, FIXTURE_DATASET_ID),
        datasetSchema.parse({
          id: FIXTURE_DATASET_ID,
          workspaceId,
          projectIds: [],
          connectionId: FIXTURE_CONNECTION_ID,
          name: "运营事件 Fixture",
          description:
            "用于验证通用数据发现、筛选和聚合的平台测试数据集。",
          physicalName: "fixture_operations_events",
          timeField: "occurred_at",
          defaultGranularity: "day",
          freshnessMinutes: 5,
          fields: [
            {
              id: "event_id",
              physicalName: "event_id",
              label: "事件 ID",
              dataType: "string",
              role: "identifier",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "occurred_at",
              physicalName: "occurred_at",
              label: "发生时间",
              dataType: "datetime",
              role: "time",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "region",
              physicalName: "region",
              label: "区域",
              dataType: "string",
              role: "dimension",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "category",
              physicalName: "category",
              label: "品类",
              dataType: "string",
              role: "dimension",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "channel",
              physicalName: "channel",
              label: "渠道",
              dataType: "string",
              role: "dimension",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "status",
              physicalName: "status",
              label: "状态",
              dataType: "string",
              role: "dimension",
              sensitivity: "internal",
              description: "",
            },
            {
              id: "amount",
              physicalName: "amount",
              label: "金额",
              dataType: "number",
              role: "measure",
              sensitivity: "sensitive",
              description: "",
            },
          ],
          dimensions: [
            { id: "region", fieldId: "region", label: "区域" },
            { id: "category", fieldId: "category", label: "品类" },
            { id: "channel", fieldId: "channel", label: "渠道" },
            { id: "status", fieldId: "status", label: "状态" },
          ],
          semanticModelVersion: "fixture-v1",
          status: "active",
          isFixture: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    const metricSeeds = [
      {
        id: FIXTURE_METRIC_IDS.eventCount,
        name: "事件总量",
        synonyms: ["数量", "总量", "count"],
        definition: "时间范围内的事件行数。",
        aggregation: "count" as const,
      },
      {
        id: FIXTURE_METRIC_IDS.failureRate,
        name: "失败率",
        synonyms: ["失败", "错误率"],
        definition: "status=failed 的事件占全部事件的比例。",
        aggregation: "rate" as const,
        numeratorFilter: { status: ["failed"] },
      },
      {
        id: FIXTURE_METRIC_IDS.cancelledRate,
        name: "取消率",
        synonyms: ["取消"],
        definition: "status=cancelled 的事件占全部事件的比例。",
        aggregation: "rate" as const,
        numeratorFilter: { status: ["cancelled"] },
      },
      {
        id: FIXTURE_METRIC_IDS.timeoutRate,
        name: "超时率",
        synonyms: ["超时", "延迟"],
        definition: "status=timeout 的事件占全部事件的比例。",
        aggregation: "rate" as const,
        numeratorFilter: { status: ["timeout"] },
      },
      {
        id: FIXTURE_METRIC_IDS.anomalyCount,
        name: "异常量",
        synonyms: ["异常", "异常数量"],
        definition: "failed、cancelled、timeout 的事件总数。",
        aggregation: "count-where" as const,
        filter: { status: ["failed", "cancelled", "timeout"] },
      },
      {
        id: FIXTURE_METRIC_IDS.anomalyRate,
        name: "异常率",
        synonyms: ["异常率", "anomaly"],
        definition: "异常事件占全部事件的比例。",
        aggregation: "rate" as const,
        numeratorFilter: {
          status: ["failed", "cancelled", "timeout"],
        },
      },
      {
        id: FIXTURE_METRIC_IDS.amountSum,
        name: "金额合计",
        synonyms: ["金额", "总额"],
        definition: "amount 字段求和。",
        aggregation: "sum" as const,
        fieldId: "amount",
      },
    ];
    for (const seed of metricSeeds) {
      if (
        findById(
          valuesByWorkspace(this.tables.metrics, workspaceId),
          seed.id,
        ) !== undefined
      ) {
        continue;
      }
      await this.tables.metrics.put(
        key(workspaceId, seed.id),
        semanticMetricSchema.parse({
          ...seed,
          workspaceId,
          datasetId: FIXTURE_DATASET_ID,
          formulaVersion: "v1.0",
          certified: true,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
  }

  async capabilities(
    actor: DataFabricActor,
    workspaceId: string,
  ): Promise<DataFabricCapabilities> {
    const access = this.access(actor, workspaceId);
    if (!access.allowed) {
      return {
        dataQueryAvailable: false,
        connectionCount: 0,
        datasetCount: 0,
        metricCount: 0,
        fixtureOnly: true,
      };
    }
    await this.ensureCatalogProviders(workspaceId);
    await this.ensureWorkspaceFixture(workspaceId);
    const datasets = valuesByWorkspace(this.tables.datasets, workspaceId).filter(
      (dataset) => dataset.status === "active",
    );
    const metrics = valuesByWorkspace(this.tables.metrics, workspaceId).filter(
      (metric) => metric.status === "active",
    );
    const connections = valuesByWorkspace(
      this.tables.connections,
      workspaceId,
    ).filter((connection) => connection.status === "active");
    return {
      dataQueryAvailable: datasets.length > 0 && connections.length > 0,
      connectionCount: connections.length,
      datasetCount: datasets.length,
      metricCount: metrics.length,
      fixtureOnly: datasets.every((dataset) => dataset.isFixture),
    };
  }

  async catalogSearch(
    actor: DataFabricActor,
    workspaceId: string,
    input: {
      readonly query?: string | undefined;
      readonly projectId?: string | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<readonly CatalogDatasetSummary[]> {
    this.access(actor, workspaceId);
    await this.ensureCatalogProviders(workspaceId);
    await this.ensureWorkspaceFixture(workspaceId);
    const queryText = (input.query ?? "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
    const datasets = valuesByWorkspace(this.tables.datasets, workspaceId)
      .filter(
        (dataset) =>
          dataset.status === "active" &&
          this.connectionAllowed(actor, dataset.connectionId) &&
          (dataset.projectIds.length === 0 ||
            (input.projectId !== undefined &&
              dataset.projectIds.includes(input.projectId))),
      )
      .flatMap((dataset) => {
        const metrics = this.metricValues(workspaceId, dataset.id);
        const searchable = [
          dataset.name,
          dataset.description,
          ...metrics.flatMap((metric) => [metric.name, ...metric.synonyms]),
        ]
          .join(" ")
          .toLowerCase();
        if (queryText !== "" && !searchable.includes(queryText)) return [];
        const policy = this.policyFor(
          actor,
          workspaceId,
          dataset.id,
        );
        const denied = new Set(policy?.deniedFields ?? []);
        return [
          {
            datasetId: dataset.id,
            name: dataset.name,
            description: dataset.description,
            metrics: metrics
              .filter(
                (metric) =>
                  metric.status === "active" &&
                  metric.certified &&
                  (metric.fieldId === undefined || !denied.has(metric.fieldId)),
              )
              .map((metric) => ({
                id: metric.id,
                name: metric.name,
                definition: metric.definition,
                certified: metric.certified,
              })),
            dimensions: dataset.dimensions.filter(
              (dimension) => !denied.has(dimension.fieldId),
            ),
            freshness: `${dataset.freshnessMinutes} 分钟`,
            isFixture: dataset.isFixture,
          },
        ];
      });
    return datasets.slice(0, limit);
  }

  async describe(
    actor: DataFabricActor,
    workspaceId: string,
    datasetId: string,
  ): Promise<DatasetDescription> {
    this.access(actor, workspaceId);
    await this.ensureCatalogProviders(workspaceId);
    const dataset = this.requireDataset(workspaceId, datasetId);
    if (!this.connectionAllowed(actor, dataset.connectionId)) {
      throw new DataFabricError("forbidden", "data connection access is denied");
    }
    const connection = this.requireConnection(
      workspaceId,
      dataset.connectionId,
    );
    const policy = this.policyFor(actor, workspaceId, dataset.id);
    const denied = new Set(policy?.deniedFields ?? []);
    return {
      dataset: {
        ...dataset,
        fields: dataset.fields.filter((field) => !denied.has(field.id)),
      },
      metrics: this.metricValues(workspaceId, dataset.id).filter(
        (metric) =>
          metric.status === "active" &&
          (metric.fieldId === undefined || !denied.has(metric.fieldId)),
      ),
      connection,
      policy,
      skills: this.skillValues(workspaceId, dataset.id)
        .filter((skill) => skill.status === "active")
        .sort((left, right) => left.id.localeCompare(right.id)),
      permissionSummary: this.permissionSummary(actor, policy),
    };
  }

  async explain(
    actor: DataFabricActor,
    workspaceId: string,
    input: SemanticQueryInput,
  ): Promise<QueryExplanation> {
    const plan = await this.plan(actor, workspaceId, input);
    return {
      datasetId: plan.dataset.id,
      metricIds: plan.metrics.map((metric) => metric.id),
      normalizedQuery: {
        datasetId: plan.dataset.id,
        metricIds: plan.metrics.map((metric) => metric.id),
        timeRange: plan.query.timeRange,
        filters: plan.filters,
        groupBy: plan.query.groupBy,
      },
      filters: plan.filters,
      rowPolicy: plan.rowPolicy,
      groupBy: plan.query.groupBy,
      limit: plan.limit,
      estimatedScanRows: 4 * 3 * 3 * 2 * 14,
      clarificationRequired: false,
    };
  }

  async query(
    actor: DataFabricActor,
    workspaceId: string,
    input: SemanticQueryInput,
    trace: {
      readonly projectId?: string | undefined;
      readonly agentProfileId?: string | undefined;
      readonly conversationId?: string | undefined;
      readonly agentRunId?: string | undefined;
      readonly intentSummary?: string | undefined;
      /** Replay boundary for deterministic snapshot queries; audit time stays current. */
      readonly asOf?: Date | undefined;
    } = {},
  ): Promise<{
    readonly run: QueryRun;
    readonly result: QueryResult;
  }> {
    const plan = await this.plan(actor, workspaceId, input, trace.asOf);
    const connector = this.connectors.get(
      this.requireConnection(workspaceId, plan.dataset.connectionId)
        .connectorType,
    );
    if (connector === undefined) {
      throw new DataFabricError(
        "unavailable",
        `data connector is unavailable: ${plan.dataset.connectionId}`,
      );
    }
    const startedAt = this.options.now();
    const createdAt = iso(startedAt);
    const runId = `query-${randomUUID()}`;
    const planned = queryRunSchema.parse({
      id: runId,
      workspaceId,
      ...(trace.projectId === undefined ? {} : { projectId: trace.projectId }),
      actorUserId: actor.userId,
      ...(trace.agentProfileId === undefined
        ? {}
        : { agentProfileId: trace.agentProfileId }),
      ...(trace.conversationId === undefined
        ? {}
        : { conversationId: trace.conversationId }),
      ...(trace.agentRunId === undefined
        ? {}
        : { agentRunId: trace.agentRunId }),
      intentSummary:
        trace.intentSummary ??
        `读取 ${plan.dataset.name} 的 ${plan.metrics.map((metric) => metric.name).join("、")}`,
      connectionId: plan.dataset.connectionId,
      datasetId: plan.dataset.id,
      metricIds: plan.metrics.map((metric) => metric.id),
      metricVersionSnapshot: Object.fromEntries(
        plan.metrics.map((metric) => [metric.id, metric.formulaVersion]),
      ),
      normalizedQuery: {
        timeRange: plan.query.timeRange,
        filters: plan.filters,
        groupBy: plan.query.groupBy,
        limit: plan.limit,
      },
      policyVersionSnapshot:
        plan.policy === undefined ? [] : [plan.policy.version],
      permissionSummary: this.permissionSummary(actor, plan.policy),
      status: "planned",
      createdAt,
    });
    await this.tables.queryRuns.put(runId, planned);
    try {
      const connectorResult = await withTimeout(
        connector.query(plan.context),
        plan.timeoutMs,
      );
      const result = queryResultSchema.parse({
        queryRunId: runId,
        columns: [
          ...plan.query.groupBy.map((dimensionId) => ({
            id: dimensionId,
            label:
              plan.dataset.dimensions.find(
                (dimension) => dimension.id === dimensionId,
              )?.label ?? dimensionId,
            type: "string",
          })),
          ...plan.metrics.map((metric) => ({
            id: metric.id,
            label: metric.name,
            type: metric.aggregation === "rate" ? "number" : "number",
          })),
        ],
        rows: [...connectorResult.rows],
        rowCount: connectorResult.rows.length,
        scannedRows: connectorResult.scannedRows,
        truncated:
          plan.query.groupBy.length > 0 &&
          connectorResult.rows.length >= plan.limit,
        dataCutoffAt: connectorResult.dataCutoffAt,
        freshness: connectorResult.freshness,
        evidence: [...connectorResult.evidence],
        permissionSummary: this.permissionSummary(actor, plan.policy),
        createdAt: iso(this.options.now()),
      });
      await this.tables.queryResults.put(runId, result);
      const completed = queryRunSchema.parse({
        ...planned,
        status: "succeeded",
        rowCount: result.rowCount,
        scannedRows: result.scannedRows,
        truncated: result.truncated,
        dataCutoffAt: result.dataCutoffAt,
        durationMs: Math.max(0, this.options.now().getTime() - startedAt.getTime()),
        endedAt: iso(this.options.now()),
      });
      await this.tables.queryRuns.put(runId, completed);
      return { run: completed, result };
    } catch (cause) {
      const timedOut =
        cause instanceof DataFabricError &&
        cause.message === "data query timed out";
      const failed = queryRunSchema.parse({
        ...planned,
        status: timedOut ? "timeout" : "failed",
        errorCode:
          timedOut
            ? "query_timeout"
            : cause instanceof DataFabricError
              ? cause.code
              : "query_failed",
        errorMessage:
          cause instanceof Error ? cause.message.slice(0, 2_000) : "query failed",
        durationMs: Math.max(0, this.options.now().getTime() - startedAt.getTime()),
        endedAt: iso(this.options.now()),
      });
      await this.tables.queryRuns.put(runId, failed);
      throw cause;
    }
  }

  queryRuns(
    actor: DataFabricActor,
    workspaceId: string,
    limit = 20,
  ): QueryRun[] {
    this.access(actor, workspaceId);
    return valuesByWorkspace(this.tables.queryRuns, workspaceId)
      .filter(
        (run) =>
          run.actorUserId === actor.userId ||
          actor.workspaceRole === "owner",
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 100)));
  }

  queryRunsForAgentRun(
    actor: DataFabricActor,
    workspaceId: string,
    agentRunId: string,
  ): QueryRun[] {
    this.access(actor, workspaceId);
    return valuesByWorkspace(this.tables.queryRuns, workspaceId)
      .filter(
        (run) =>
          run.agentRunId === agentRunId &&
          (run.actorUserId === actor.userId ||
            actor.workspaceRole === "owner"),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  queryRunsForConversation(
    actor: DataFabricActor,
    workspaceId: string,
    conversationId: string,
    limit = 20,
  ): QueryRun[] {
    this.access(actor, workspaceId);
    return valuesByWorkspace(this.tables.queryRuns, workspaceId)
      .filter(
        (run) =>
          run.conversationId === conversationId &&
          (run.actorUserId === actor.userId ||
            actor.workspaceRole === "owner"),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-Math.max(1, Math.min(limit, 100)));
  }

  queryResultForRun(
    actor: DataFabricActor,
    workspaceId: string,
    queryRunId: string,
  ): QueryResult {
    this.access(actor, workspaceId);
    const run = [...this.tables.queryRuns.entries()]
      .map(([, value]) => value)
      .find(
        (candidate) =>
          candidate.id === queryRunId &&
          candidate.workspaceId === workspaceId,
      );
    if (
      run === undefined ||
      (run.actorUserId !== actor.userId && actor.workspaceRole !== "owner")
    ) {
      throw new DataFabricError("not_found", "query run not found");
    }
    const result = [...this.tables.queryResults.entries()]
      .map(([, value]) => value)
      .find(
        (candidate) =>
          candidate.queryRunId === queryRunId,
      );
    if (result === undefined) {
      throw new DataFabricError("not_found", "query result not found");
    }
    return result;
  }

  private async plan(
    actor: DataFabricActor,
    workspaceId: string,
    input: SemanticQueryInput,
    asOf?: Date | undefined,
  ) {
    this.access(actor, workspaceId);
    await this.ensureCatalogProviders(workspaceId);
    const query = semanticQueryInputSchema.parse(input);
    const dataset = this.requireDataset(workspaceId, query.datasetId);
    if (dataset.status !== "active") {
      throw new DataFabricError("not_found", "dataset is not active");
    }
    if (
      dataset.projectIds.length > 0 &&
      (actor.projectId === undefined ||
        !dataset.projectIds.includes(actor.projectId))
    ) {
      throw new DataFabricError("forbidden", "project data access is denied");
    }
    if (!this.connectionAllowed(actor, dataset.connectionId)) {
      throw new DataFabricError("forbidden", "data connection access is denied");
    }
    const connection = this.requireConnection(
      workspaceId,
      dataset.connectionId,
    );
    if (connection.status !== "active") {
      throw new DataFabricError("unavailable", "data connection is not active");
    }
    const policy = this.policyFor(actor, workspaceId, dataset.id);
    const metrics = this.metricValues(workspaceId, dataset.id).filter(
      (metric) => query.metricIds.includes(metric.id),
    );
    if (metrics.length !== query.metricIds.length) {
      throw new DataFabricError(
        "not_found",
        "one or more metrics are unavailable",
      );
    }
    const denied = new Set(policy?.deniedFields ?? []);
    if (
      metrics.some(
        (metric) => metric.fieldId !== undefined && denied.has(metric.fieldId),
      )
    ) {
      throw new DataFabricError("forbidden", "metric field is redacted");
    }
    const allowedDimensions = new Set(
      dataset.dimensions
        .filter((dimension) => !denied.has(dimension.fieldId))
        .map((dimension) => dimension.id),
    );
    for (const dimensionId of query.groupBy) {
      if (!allowedDimensions.has(dimensionId)) {
        throw new DataFabricError(
          "invalid_input",
          `unsupported or redacted groupBy dimension: ${dimensionId}`,
        );
      }
    }
    const filters = normalizeFilters(dataset, query.filters);
    const rowPolicy = policy?.rowFilter ?? {};
    const limit = Math.max(
      1,
      Math.min(
        query.limit,
        actor.maxRows ?? connection.maxRows,
        policy?.maxRows ?? connection.maxRows,
        connection.maxRows,
      ),
    );
    const timeoutMs = Math.max(
      1,
      Math.min(
        actor.queryTimeoutMs ?? connection.timeoutMs,
        policy?.timeoutMs ?? connection.timeoutMs,
        connection.timeoutMs,
      ),
    );
    return {
      dataset,
      connection,
      policy,
      query,
      metrics,
      filters,
      rowPolicy,
      limit,
      timeoutMs,
      context: {
        actor,
        asOf: iso(asOf ?? this.options.now()),
        workspaceId,
        ...(actor.projectId === undefined ? {} : { projectId: actor.projectId }),
        policy,
        query,
        dataset,
        metrics,
        filters: intersectRowFilters(filters, rowPolicy),
        rowPolicy,
        limit,
      } satisfies CompileContext,
    };
  }

  private access(
    actor: DataFabricActor,
    workspaceId: string,
  ): { readonly allowed: true } {
    this.requireWorkspace(workspaceId);
    if (
      actor.workspaceRole !== "owner" &&
      actor.workspaceRole !== "member"
    ) {
      throw new DataFabricError("forbidden", "workspace data access is denied");
    }
    return { allowed: true };
  }

  private requireWorkspace(workspaceId: string): void {
    if (workspaceId.trim() === "") {
      throw new DataFabricError("invalid_input", "workspaceId is required");
    }
  }

  private async ensureCatalogProviders(workspaceId: string): Promise<void> {
    for (const provider of this.catalogProviders) {
      await provider(workspaceId);
    }
  }

  private requireDataset(workspaceId: string, datasetId: string): Dataset {
    const dataset = findById(
      valuesByWorkspace(this.tables.datasets, workspaceId),
      datasetId,
    );
    if (dataset === undefined) {
      throw new DataFabricError("not_found", "dataset not found");
    }
    return dataset;
  }

  private datasetVisible(
    actor: DataFabricActor,
    workspaceId: string,
    datasetId: string,
  ): boolean {
    const dataset = findById(
      valuesByWorkspace(this.tables.datasets, workspaceId),
      datasetId,
    );
    if (
      dataset === undefined ||
      dataset.status !== "active" ||
      !this.connectionAllowed(actor, dataset.connectionId)
    ) {
      return false;
    }
    return (
      dataset.projectIds.length === 0 ||
      (actor.projectId !== undefined &&
        dataset.projectIds.includes(actor.projectId))
    );
  }

  private requireConnection(
    workspaceId: string,
    connectionId: string,
  ): DataConnection {
    const connection = findById(
      valuesByWorkspace(this.tables.connections, workspaceId),
      connectionId,
    );
    if (connection === undefined) {
      throw new DataFabricError("not_found", "data connection not found");
    }
    return connection;
  }

  private metricValues(workspaceId: string, datasetId: string): SemanticMetric[] {
    return valuesByWorkspace(this.tables.metrics, workspaceId).filter(
      (metric) => metric.datasetId === datasetId,
    );
  }

  private skillValues(workspaceId: string, datasetId: string): DataSkill[] {
    return valuesByWorkspace(this.tables.skills, workspaceId).filter(
      (skill) => skill.datasetId === datasetId,
    );
  }

  private policyFor(
    actor: DataFabricActor,
    workspaceId: string,
    datasetId: string,
  ): DataPolicy | undefined {
    const policies = valuesByWorkspace(this.tables.policies, workspaceId).filter(
      (policy) => policy.datasetId === datasetId,
    );
    return (
      policies.find(
        (policy) =>
          policy.subjectType === "user" && policy.subjectId === actor.userId,
      ) ??
      policies.find(
        (policy) =>
          policy.subjectType === "workspace-role" &&
          policy.subjectId === actor.workspaceRole,
      )
    );
  }

  private permissionSummary(
    actor: DataFabricActor,
    policy: DataPolicy | undefined,
  ): string {
    const scope = Object.entries(policy?.rowFilter ?? {})
      .map(([dimension, values]) => `${dimension}=${values.join("|")}`)
      .join("; ");
    return [
      `workspaceRole:${actor.workspaceRole ?? "unknown"}`,
      scope === "" ? "rowScope:workspace-authorized" : `rowScope:${scope}`,
      policy === undefined
        ? "policy:default-workspace"
        : `policy:${policy.version}`,
      ...(policy?.coverageNote === undefined
        ? []
        : [`coverage:${policy.coverageNote}`]),
    ].join(" · ");
  }

  private connectionAllowed(
    actor: DataFabricActor,
    connectionId: string,
  ): boolean {
    return (
      actor.connectionIds === undefined ||
      actor.connectionIds.length === 0 ||
      actor.connectionIds.includes(connectionId)
    );
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DataFabricError("query_failed", "data query timed out"));
    }, timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function findById<T extends { readonly id: string }>(
  values: readonly T[],
  id: string,
): T | undefined {
  return values.find((value) => value.id === id);
}
