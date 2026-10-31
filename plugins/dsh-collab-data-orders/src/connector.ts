import {
  DataFabricError,
  type CompileContext,
  type ConnectorQueryResult,
  type DataConnector,
} from "dsh-collab-data-fabric";
import {
  ORDER_CONNECTOR_TYPE,
  ORDER_DEMO_SOURCE_ID,
  ORDER_METRIC_IDS,
  type OrderFieldMapping,
  type OrderSourceConfig,
  type OrderValueMappings,
} from "./models.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SOURCE_SCAN_ROWS = 10_000;

type DimensionId =
  | "region"
  | "category"
  | "order_status"
  | "payment_method"
  | "channel"
  | "merchant";

interface NormalizedOrder {
  orderId: string;
  orderedAt: string;
  paidAt: string | null;
  orderStatus: string;
  paymentStatus: string;
  region: string;
  category: string;
  paymentMethod: string;
  channel: string;
  merchant: string;
  promisedFulfillmentAt: string;
  actualFulfillmentAt: string | null;
  refundStatus: string;
  amount: number;
}

export interface OrderSourceBatch {
  readonly records: readonly Readonly<Record<string, unknown>>[];
  readonly scannedRows: number;
  readonly dataCutoffAt: string;
  readonly freshness: string;
}

export interface OrderTransportRequest {
  readonly config: OrderSourceConfig;
  readonly userId: string;
  readonly from: string;
  readonly to: string;
  readonly filters: Readonly<Record<string, readonly string[]>>;
  readonly limit: number;
}

export interface OrderReadonlyTransport {
  query(request: OrderTransportRequest): Promise<OrderSourceBatch>;
}

const DISPLAY_ALIASES: Record<DimensionId, Record<string, readonly string[]>> = {
  region: {
    east: ["华东", "东区"],
    south: ["华南", "南区"],
    north: ["华北", "北区"],
    west: ["西南", "西区"],
  },
  category: {
    fresh: ["生鲜"],
    digital: ["数码", "数码家电"],
    apparel: ["服饰", "服装"],
  },
  order_status: {
    pending_payment: ["待支付"],
    paid: ["已支付"],
    fulfilled: ["已履约", "已完成"],
    cancelled: ["已取消", "取消"],
    payment_failed: ["支付失败"],
  },
  payment_method: {
    wallet: ["钱包", "余额"],
    card: ["银行卡", "信用卡"],
    transfer: ["转账"],
  },
  channel: {
    web: ["官网", "网页"],
    app: ["App", "APP", "应用"],
    store: ["门店"],
  },
  merchant: {
    flagship: ["旗舰店"],
    marketplace: ["平台商家", "三方"],
    direct: ["自营"],
  },
};

function valueAt(
  record: Readonly<Record<string, unknown>>,
  path: string,
): unknown {
  let current: unknown = record;
  for (const part of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringValue(
  record: Readonly<Record<string, unknown>>,
  path: string,
): string {
  const value = valueAt(record, path);
  return value === undefined || value === null ? "" : String(value).trim();
}

function nullableString(
  record: Readonly<Record<string, unknown>>,
  path: string,
): string | null {
  const value = stringValue(record, path);
  return value === "" ? null : value;
}

function canonicalMappedValue(
  value: string,
  mapping: Readonly<Record<string, string>>,
): string {
  return mapping[value] ?? value;
}

function dimensionValue(
  dimensionId: DimensionId,
  value: string,
  mappings: OrderValueMappings,
): string {
  const mapping =
    dimensionId === "order_status"
      ? mappings.orderStatus
      : dimensionId === "payment_method"
        ? mappings.paymentMethod
        : mappings[dimensionId];
  const mapped = canonicalMappedValue(value, mapping);
  const normalized = mapped.toLocaleLowerCase("zh-Hans-CN");
  const aliases = DISPLAY_ALIASES[dimensionId];
  for (const [canonical, names] of Object.entries(aliases)) {
    if (
      normalized === canonical ||
      names.some(
        (name) => name.toLocaleLowerCase("zh-Hans-CN") === normalized,
      )
    ) {
      return canonical;
    }
  }
  return mapped;
}

function normalizeOrder(
  record: Readonly<Record<string, unknown>>,
  mapping: OrderFieldMapping,
  values: OrderValueMappings,
): NormalizedOrder | undefined {
  const orderId = stringValue(record, mapping.orderId);
  const orderedAt = stringValue(record, mapping.orderedAt);
  const promisedFulfillmentAt = stringValue(
    record,
    mapping.promisedFulfillmentAt,
  );
  if (
    orderId === "" ||
    !Number.isFinite(Date.parse(orderedAt)) ||
    !Number.isFinite(Date.parse(promisedFulfillmentAt))
  ) {
    return undefined;
  }
  const amount = Number(valueAt(record, mapping.amount));
  return {
    orderId,
    orderedAt: new Date(orderedAt).toISOString(),
    paidAt: nullableString(record, mapping.paidAt),
    orderStatus: dimensionValue(
      "order_status",
      stringValue(record, mapping.orderStatus),
      values,
    ),
    paymentStatus: canonicalMappedValue(
      stringValue(record, mapping.paymentStatus),
      values.paymentStatus,
    ).toLocaleLowerCase("en-US"),
    region: dimensionValue(
      "region",
      stringValue(record, mapping.region),
      values,
    ),
    category: dimensionValue(
      "category",
      stringValue(record, mapping.category),
      values,
    ),
    paymentMethod: dimensionValue(
      "payment_method",
      stringValue(record, mapping.paymentMethod),
      values,
    ),
    channel: dimensionValue(
      "channel",
      stringValue(record, mapping.channel),
      values,
    ),
    merchant: dimensionValue(
      "merchant",
      stringValue(record, mapping.merchant),
      values,
    ),
    promisedFulfillmentAt: new Date(promisedFulfillmentAt).toISOString(),
    actualFulfillmentAt: nullableString(record, mapping.actualFulfillmentAt),
    refundStatus: canonicalMappedValue(
      stringValue(record, mapping.refundStatus),
      values.refundStatus,
    ).toLocaleLowerCase("en-US"),
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

function normalizedFilters(
  filters: Readonly<Record<string, readonly string[]>>,
  values: OrderValueMappings,
): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(filters).map(([dimensionId, requested]) => [
      dimensionId,
      requested.map((value) =>
        value in DISPLAY_ALIASES
          ? value
          : dimensionValue(dimensionId as DimensionId, value, values),
      ),
    ]),
  );
}

function rowMatchesDimensionFilters(
  row: NormalizedOrder,
  filters: Readonly<Record<string, readonly string[]>>,
): boolean {
  for (const [dimensionId, values] of Object.entries(filters)) {
    const actual = row[dimensionId as keyof NormalizedOrder];
    if (!values.includes(String(actual ?? ""))) return false;
  }
  return true;
}

function rounds(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : rounds((numerator / denominator) * 100);
}

function isPaymentFailure(row: NormalizedOrder): boolean {
  return (
    row.paymentStatus === "failed" || row.orderStatus === "payment_failed"
  );
}

function isCancelled(row: NormalizedOrder): boolean {
  return row.orderStatus === "cancelled";
}

function isFulfillmentTimeout(row: NormalizedOrder, cutoffMs: number): boolean {
  if (isCancelled(row) || isPaymentFailure(row)) return false;
  const promised = Date.parse(row.promisedFulfillmentAt);
  if (!Number.isFinite(promised) || promised > cutoffMs) return false;
  if (row.actualFulfillmentAt === null) return true;
  const actual = Date.parse(row.actualFulfillmentAt);
  return !Number.isFinite(actual) || actual > promised;
}

function isDue(row: NormalizedOrder, cutoffMs: number): boolean {
  if (isCancelled(row) || isPaymentFailure(row)) return false;
  const promised = Date.parse(row.promisedFulfillmentAt);
  return Number.isFinite(promised) && promised <= cutoffMs;
}

function metricValues(
  rows: readonly NormalizedOrder[],
  cutoffMs: number,
  metricId: string,
): number {
  const count = (predicate: (row: NormalizedOrder) => boolean): number =>
    rows.filter(predicate).length;
  const paymentCompleted = count(
    (row) =>
      row.paymentStatus === "succeeded" || row.paymentStatus === "failed",
  );
  const due = count((row) => isDue(row, cutoffMs));
  const timeout = count((row) => isFulfillmentTimeout(row, cutoffMs));
  const exceptions = count(
    (row) =>
      isPaymentFailure(row) ||
      isCancelled(row) ||
      isFulfillmentTimeout(row, cutoffMs),
  );
  switch (metricId) {
    case ORDER_METRIC_IDS.orderCount:
      return rows.length;
    case ORDER_METRIC_IDS.paidOrderCount:
      return count(
        (row) =>
          row.paymentStatus === "succeeded" ||
          (row.orderStatus === "fulfilled" && row.paidAt !== null),
      );
    case ORDER_METRIC_IDS.paymentFailureRate:
      return rate(
        count((row) => row.paymentStatus === "failed"),
        paymentCompleted,
      );
    case ORDER_METRIC_IDS.cancelRate:
      return rate(count(isCancelled), rows.length);
    case ORDER_METRIC_IDS.fulfillmentTimeoutRate:
      return rate(timeout, due);
    case ORDER_METRIC_IDS.orderExceptionCount:
      return exceptions;
    case ORDER_METRIC_IDS.orderExceptionRate:
      return rate(exceptions, rows.length);
    case ORDER_METRIC_IDS.fulfillmentOnTimeRate:
      return rate(due - timeout, due);
    case ORDER_METRIC_IDS.orderAmountSum:
      return rounds(
        rows.reduce((total, row) => total + row.amount, 0),
        2,
      );
    default:
      throw new DataFabricError(
        "invalid_input",
        `unsupported order metric: ${metricId}`,
      );
  }
}

function aggregateBatch(
  context: CompileContext,
  batch: OrderSourceBatch,
  config: OrderSourceConfig,
): ConnectorQueryResult {
  const fromMs = Date.parse(context.query.timeRange.from);
  const toMs = Date.parse(context.query.timeRange.to);
  const cutoffMs = Date.parse(context.asOf);
  if (
    !Number.isFinite(fromMs) ||
    !Number.isFinite(toMs) ||
    !Number.isFinite(cutoffMs) ||
    fromMs >= toMs
  ) {
    throw new DataFabricError("invalid_input", "invalid order time range");
  }
  const normalized = batch.records
    .map((record) =>
      normalizeOrder(record, config.fieldMapping, config.valueMappings),
    )
    .filter((row): row is NormalizedOrder => row !== undefined);
  // Data Fabric already intersected request filters with the server-side row
  // policy. Re-merging rowPolicy here would overwrite an empty intersection
  // and turn a denied drill-down into an allowed broader query.
  const filters = normalizedFilters(
    context.filters,
    config.valueMappings,
  );
  const selected = normalized.filter((row) => {
    const orderedAt = Date.parse(row.orderedAt);
    return (
      Number.isFinite(orderedAt) &&
      orderedAt >= fromMs &&
      orderedAt <= toMs &&
      rowMatchesDimensionFilters(row, filters)
    );
  });
  if (selected.length === 0) {
    return {
      rows: [],
      scannedRows: batch.scannedRows,
      dataCutoffAt: batch.dataCutoffAt,
      freshness: batch.freshness,
      evidence: [
        `connector:${ORDER_CONNECTOR_TYPE}@${config.manifestVersion}`,
        `dataset:${context.dataset.id}@${context.dataset.semanticModelVersion}`,
        `metrics:${context.metrics.map((metric) => `${metric.id}@${metric.formulaVersion}`).join(",")}`,
        `scannedRows:${batch.scannedRows}`,
        `timeSemantics:orderedAt;fulfillmentDueAt`,
        `transport:${config.transport}`,
        ...(config.mode === "demo"
          ? [`demo:${ORDER_DEMO_SOURCE_ID}`]
          : ["source:production-readonly"]),
      ],
    };
  }
  const groups = new Map<string, NormalizedOrder[]>();
  if (context.query.groupBy.length === 0) {
    groups.set("all", [...selected]);
  } else {
    for (const row of selected) {
      const groupKey = context.query.groupBy
        .map((dimensionId) => String(row[dimensionId as keyof NormalizedOrder] ?? ""))
        .join("\u0000");
      const group = groups.get(groupKey) ?? [];
      group.push(row);
      groups.set(groupKey, group);
    }
  }
  const rows = [...groups.values()].slice(0, context.limit).map((group) => {
    const output: Record<string, string | number> = {};
    const first = group[0];
    if (first !== undefined) {
      for (const dimensionId of context.query.groupBy) {
        output[dimensionId] = String(
          first[dimensionId as keyof NormalizedOrder] ?? "",
        );
      }
    }
    for (const metric of context.metrics) {
      output[metric.id] = metricValues(group, cutoffMs, metric.id);
    }
    return output;
  });
  return {
    rows,
    scannedRows: batch.scannedRows,
    dataCutoffAt: batch.dataCutoffAt,
    freshness: batch.freshness,
    evidence: [
      `connector:${ORDER_CONNECTOR_TYPE}@${config.manifestVersion}`,
      `dataset:${context.dataset.id}@${context.dataset.semanticModelVersion}`,
      `metrics:${context.metrics.map((metric) => `${metric.id}@${metric.formulaVersion}`).join(",")}`,
      `scannedRows:${batch.scannedRows}`,
      `selectedOrders:${selected.length}`,
      `timeSemantics:orderedAt;fulfillmentDueAt`,
      `transport:${config.transport}`,
      ...(config.mode === "demo"
        ? [`demo:${ORDER_DEMO_SOURCE_ID}`]
        : ["source:production-readonly"]),
    ],
  };
}

function resolveEnvironmentRef(ref: string, label: string): string {
  const match = /^env:([A-Z][A-Z0-9_]*)$/.exec(ref);
  if (match === null) {
    throw new DataFabricError(
      "unavailable",
      `${label} must use an env:VARIABLE reference`,
    );
  }
  const value = process.env[match[1] ?? ""];
  if (value === undefined || value.trim() === "") {
    throw new DataFabricError(
      "unavailable",
      `${label} is not configured on the server`,
    );
  }
  return value;
}

function safeProductionEndpoint(value: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new DataFabricError("unavailable", "order endpoint is invalid");
  }
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new DataFabricError(
      "unavailable",
      "order endpoint must use http or https",
    );
  }
  if (endpoint.username !== "" || endpoint.password !== "") {
    throw new DataFabricError(
      "unavailable",
      "order endpoint must not embed credentials",
    );
  }
  const hostname = endpoint.hostname.toLocaleLowerCase("en-US");
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    throw new DataFabricError(
      "unavailable",
      "order endpoint must not target a local network",
    );
  }
  return endpoint;
}

export class HttpJsonOrderTransport implements OrderReadonlyTransport {
  async query(request: OrderTransportRequest): Promise<OrderSourceBatch> {
    if (
      request.config.endpointRef === undefined ||
      request.config.credentialRef === undefined
    ) {
      throw new DataFabricError(
        "unavailable",
        "production order source is not configured",
      );
    }
    const endpoint = safeProductionEndpoint(
      resolveEnvironmentRef(request.config.endpointRef, "order endpoint"),
    );
    const token = resolveEnvironmentRef(
      request.config.credentialRef,
      "order credential",
    );
    endpoint.searchParams.set("from", request.from);
    endpoint.searchParams.set("to", request.to);
    endpoint.searchParams.set("limit", String(request.limit));
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new DataFabricError(
        response.status === 401 || response.status === 403
          ? "forbidden"
          : "unavailable",
        `order source returned HTTP ${response.status}`,
      );
    }
    const body = (await response.json()) as {
      readonly orders?: unknown;
      readonly dataCutoffAt?: unknown;
      readonly freshness?: unknown;
      readonly scannedRows?: unknown;
    };
    if (!Array.isArray(body.orders)) {
      throw new DataFabricError(
        "query_failed",
        "order source response must contain an orders array",
      );
    }
    return {
      records: body.orders.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      ),
      scannedRows:
        typeof body.scannedRows === "number" &&
        Number.isFinite(body.scannedRows)
          ? Math.max(0, Math.floor(body.scannedRows))
          : body.orders.length,
      dataCutoffAt:
        typeof body.dataCutoffAt === "string" &&
        Number.isFinite(Date.parse(body.dataCutoffAt))
          ? new Date(body.dataCutoffAt).toISOString()
          : new Date().toISOString(),
      freshness:
        typeof body.freshness === "string" && body.freshness.trim() !== ""
          ? body.freshness.trim().slice(0, 200)
          : "生产只读连接",
    };
  }
}

function demoRecords(asOfMs: number): Record<string, unknown>[] {
  const regions = ["east", "south", "north"];
  const categories = ["fresh", "digital", "apparel"];
  const channels = ["web", "app", "store"];
  const merchants = ["flagship", "marketplace", "direct"];
  const paymentMethods = ["wallet", "card", "transfer"];
  const records: Record<string, unknown>[] = [];
  let sequence = 0;
  for (let day = 0; day < 21; day += 1) {
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      for (
        let categoryIndex = 0;
        categoryIndex < categories.length;
        categoryIndex += 1
      ) {
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
          const variant = (day + regionIndex + categoryIndex + channelIndex) % 8;
          const orderedAtMs =
            asOfMs -
            day * DAY_MS -
            (15 + ((sequence * 17) % (18 * 60))) * 60_000;
          const promisedFulfillmentMs =
            orderedAtMs + ((variant % 3) + 1) * 2 * HOUR_MS;
          const actualFulfillmentMs =
            variant === 0
              ? promisedFulfillmentMs - 20 * 60_000
              : variant === 1 || variant === 6
                ? promisedFulfillmentMs + 90 * 60_000
                : variant === 2
                  ? undefined
                  : promisedFulfillmentMs - 15 * 60_000;
          const orderStatus =
            variant === 3
              ? "cancelled"
              : variant === 4
                ? "payment_failed"
                : variant === 7
                  ? "pending_payment"
                  : actualFulfillmentMs === undefined
                    ? "paid"
                    : "fulfilled";
          const paymentStatus =
            variant === 4
              ? "failed"
              : variant === 7
                ? "pending"
                : variant === 3
                  ? "succeeded"
                  : "succeeded";
          const paidAt =
            paymentStatus === "succeeded"
              ? new Date(orderedAtMs + 8 * 60_000).toISOString()
              : null;
          records.push({
            order_id: `DEMO-${String(sequence + 1).padStart(6, "0")}`,
            ordered_at: new Date(orderedAtMs).toISOString(),
            paid_at: paidAt,
            order_status: orderStatus,
            payment_status: paymentStatus,
            region: regions[regionIndex],
            category: categories[categoryIndex],
            payment_method: paymentMethods[(sequence + channelIndex) % 3],
            channel: channels[channelIndex],
            merchant: merchants[(sequence + regionIndex) % 3],
            promised_fulfillment_at: new Date(
              promisedFulfillmentMs,
            ).toISOString(),
            actual_fulfillment_at:
              actualFulfillmentMs === undefined
                ? null
                : new Date(actualFulfillmentMs).toISOString(),
            refund_status: variant === 6 ? "refunded" : "none",
            amount: rounds(69 + ((sequence * 37) % 1_900) / 10, 2),
            demo: true,
          });
          sequence += 1;
        }
      }
    }
  }
  return records;
}

export class OrderReadonlyConnector implements DataConnector {
  readonly type = ORDER_CONNECTOR_TYPE;

  constructor(
    private readonly configFor: (
      workspaceId: string,
    ) => OrderSourceConfig | undefined,
    private readonly transport: OrderReadonlyTransport =
      new HttpJsonOrderTransport(),
    private readonly now: () => Date = () => new Date(),
    private readonly mcpTransport?: OrderReadonlyTransport | undefined,
  ) {}

  async query(context: CompileContext): Promise<ConnectorQueryResult> {
    const config = this.configFor(context.workspaceId);
    if (config === undefined) {
      throw new DataFabricError(
        "unavailable",
        "order source is not provisioned for this workspace",
      );
    }
    if (config.disabledReason !== undefined) {
      throw new DataFabricError("unavailable", config.disabledReason);
    }
    if (
      Object.values(context.filters).some((values) => values.length === 0)
    ) {
      return {
        rows: [],
        scannedRows: 0,
        dataCutoffAt: context.asOf,
        freshness: "权限交集为空，未执行外部查询",
        evidence: [
          "policy:denied-empty-intersection",
          `dataset:${context.dataset.id}`,
        ],
      };
    }
    const sourceFilters = normalizedFilters(
      context.filters,
      config.valueMappings,
    );
    const batch =
      config.transport === "fixture"
        ? {
            records: demoRecords(this.now().getTime()),
            scannedRows: 21 * 3 * 3 * 3,
            dataCutoffAt: this.now().toISOString(),
            freshness: "演示数据 · 非生产 · 实时生成",
          }
        : await (config.transport === "mcp"
            ? this.mcpTransport
            : this.transport)?.query({
            config,
            userId: context.actor.userId,
            from: context.query.timeRange.from,
            to: context.query.timeRange.to,
            filters: sourceFilters,
            limit: MAX_SOURCE_SCAN_ROWS,
          });
    if (batch === undefined) {
      throw new DataFabricError(
        "unavailable",
        config.transport === "mcp"
          ? "order MCP transport is unavailable"
          : "order HTTP transport is unavailable",
      );
    }
    return aggregateBatch(context, batch, config);
  }
}
