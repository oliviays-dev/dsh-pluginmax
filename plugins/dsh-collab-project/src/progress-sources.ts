import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { BusinessChainExternalRef } from "./types.js";

export type ProgressSourceStatus = "fresh" | "stale" | "error";

export interface ProgressSourceResult {
  readonly system: string;
  readonly document: string;
  readonly status: ProgressSourceStatus;
  readonly observedAt?: string;
  readonly revision?: string;
  readonly data?: Record<string, unknown>;
  readonly error?: string;
  readonly isMock: boolean;
}

export interface ProgressSourceRegistryLike {
  read(input: {
    readonly workspaceId: string;
    readonly projectCode: string;
    readonly refs: readonly BusinessChainExternalRef[];
    readonly signal?: AbortSignal | undefined;
    readonly timeoutMs?: number | undefined;
  }): Promise<readonly ProgressSourceResult[]>;
}

interface MockAdapterConfig {
  readonly system: string;
  readonly aliases: readonly string[];
  readonly document: string;
  readonly schema: z.ZodType<Record<string, unknown>>;
}

const sourceHealthSchema = z
  .object({
    status: z.string().optional(),
    lastSuccessfulSyncAt: z.string().optional(),
    slaMinutes: z.number().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const planningSnapshotSchema = z
  .object({
    sourceSystem: z.string(),
    observedAt: z.string(),
    planRevision: z.string().optional(),
    projectCode: z.string(),
    businessChainKey: z.string().optional(),
    businessChainPlan: z.array(z.record(z.string(), z.unknown())).default([]),
    planChanges: z.array(z.record(z.string(), z.unknown())).default([]),
    workPackages: z.array(z.record(z.string(), z.unknown())).default([]),
    sourceHealth: sourceHealthSchema.optional(),
  })
  .passthrough();

const orderSnapshotSchema = z
  .object({
    sourceSystem: z.string(),
    observedAt: z.string(),
    orderRevision: z.string().optional(),
    projectCode: z.string(),
    salesOrderId: z.string().optional(),
    lines: z.array(z.record(z.string(), z.unknown())).default([]),
    revisionHistory: z.array(z.record(z.string(), z.unknown())).default([]),
    delivery: z.record(z.string(), z.unknown()).optional(),
    syncHealth: sourceHealthSchema.optional(),
  })
  .passthrough();

const inventorySnapshotSchema = z
  .object({
    sourceSystem: z.string(),
    observedAt: z.string(),
    inventoryRevision: z.string().optional(),
    projectCode: z.string(),
    components: z.array(z.record(z.string(), z.unknown())).default([]),
    warehouseHealth: z.array(z.record(z.string(), z.unknown())).default([]),
    sourceHealth: sourceHealthSchema.optional(),
  })
  .passthrough();

const capacitySnapshotSchema = z
  .object({
    sourceSystem: z.string(),
    observedAt: z.string(),
    capacityRevision: z.string().optional(),
    projectCode: z.string(),
    resources: z.array(z.record(z.string(), z.unknown())).default([]),
    nodeExecution: z.array(z.record(z.string(), z.unknown())).default([]),
    constraintEvents: z.array(z.record(z.string(), z.unknown())).default([]),
    outputHistory: z.array(z.record(z.string(), z.unknown())).default([]),
    sourceHealth: sourceHealthSchema.optional(),
  })
  .passthrough();

const ADAPTERS: readonly MockAdapterConfig[] = [
  {
    system: "APS-PLANNING",
    aliases: ["APS-PLANNING", "APS", "PLANNING"],
    document: "01-planning-system-mcp.md",
    schema: planningSnapshotSchema,
  },
  {
    system: "OMS",
    aliases: ["OMS", "ORDER"],
    document: "02-order-management-system-mcp.md",
    schema: orderSnapshotSchema,
  },
  {
    system: "WMS",
    aliases: ["WMS", "INVENTORY"],
    document: "03-inventory-system-mcp.md",
    schema: inventorySnapshotSchema,
  },
  {
    system: "MES",
    aliases: ["MES", "CAPACITY"],
    document: "04-capacity-system-mcp.md",
    schema: capacitySnapshotSchema,
  },
];

export function extractMockSnapshot(markdown: string): unknown {
  const match =
    /```json\s+mock-mcp-snapshot\s*\r?\n([\s\S]*?)\r?\n```/.exec(markdown);
  if (match === null) {
    throw new Error("mock-mcp-snapshot code block is missing");
  }
  return JSON.parse(match[1]!);
}

function adapterFor(system: string): MockAdapterConfig | undefined {
  const normalized = system.trim().toUpperCase();
  return ADAPTERS.find((adapter) => adapter.aliases.includes(normalized));
}

function statusFromHealth(
  health: unknown,
): ProgressSourceStatus {
  const value = String(
    health !== null && typeof health === "object"
      ? (health as Record<string, unknown>).status ?? ""
      : "",
  ).toLowerCase();
  return value === "healthy" || value === "" ? "fresh" : "stale";
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal | undefined,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            Object.assign(new Error("source timeout"), { code: "timeout" }),
          ),
        ),
      timeoutMs,
    );
    const abort = () =>
      finish(() =>
        reject(
          Object.assign(new Error("source aborted"), { code: "aborted" }),
        ),
      );
    if (signal?.aborted === true) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

/**
 * Mock 场景注册表。每个 adapter 只读取自己的 Markdown 快照，
 * 生产环境可替换为服务端 MCP client，项目模块不感知具体供应链系统。
 */
export class MockScenarioSourceRegistry implements ProgressSourceRegistryLike {
  constructor(
    private readonly options: {
      readonly docsRoot: string;
      readonly timeoutMs?: number;
      readonly now?: () => Date;
    },
  ) {}

  async read(input: {
    readonly workspaceId: string;
    readonly projectCode: string;
    readonly refs: readonly BusinessChainExternalRef[];
    readonly signal?: AbortSignal | undefined;
    readonly timeoutMs?: number | undefined;
  }): Promise<readonly ProgressSourceResult[]> {
    const systems = [
      ...new Set(
        input.refs.map(
          (ref) => adapterFor(ref.system)?.system ?? ref.system.trim().toUpperCase(),
        ),
      ),
    ].filter(Boolean);
    return Promise.all(
      systems.map((system) => this.readOne(system, input)),
    );
  }

  private async readOne(
    system: string,
    input: {
      readonly projectCode: string;
      readonly signal?: AbortSignal | undefined;
      readonly timeoutMs?: number | undefined;
    },
  ): Promise<ProgressSourceResult> {
    const adapter = ADAPTERS.find((candidate) => candidate.system === system);
    if (adapter === undefined) {
      return {
        system,
        document: "",
        status: "error",
        error: "未注册对应的场景数据源",
        isMock: true,
      };
    }
    try {
      const content = await withTimeout(
        readFile(join(this.options.docsRoot, adapter.document), "utf8"),
        input.timeoutMs ?? this.options.timeoutMs ?? 1_500,
        input.signal,
      );
      const parsed = adapter.schema.safeParse(extractMockSnapshot(content));
      if (!parsed.success) {
        return {
          system,
          document: adapter.document,
          status: "error",
          error: "来源快照不符合 schema",
          isMock: true,
        };
      }
      if (
        parsed.data.projectCode !== undefined &&
        parsed.data.projectCode !== input.projectCode
      ) {
        return {
          system,
          document: adapter.document,
          status: "error",
          error: "来源对象不属于当前项目",
          isMock: true,
        };
      }
      const health: unknown =
        adapter.system === "OMS"
          ? orderSnapshotSchema.parse(parsed.data).syncHealth
          : parsed.data.sourceHealth;
      const observedAt =
        typeof parsed.data.observedAt === "string"
          ? parsed.data.observedAt
          : undefined;
      return {
        system,
        document: adapter.document,
        status: statusFromHealth(health),
        ...(observedAt === undefined
          ? {}
          : { observedAt }),
        ...(String(
          parsed.data.planRevision ??
            parsed.data.orderRevision ??
            parsed.data.inventoryRevision ??
            parsed.data.capacityRevision ??
            "",
        ) === ""
          ? {}
          : {
              revision: String(
                parsed.data.planRevision ??
                  parsed.data.orderRevision ??
                  parsed.data.inventoryRevision ??
                  parsed.data.capacityRevision,
              ),
            }),
        data: parsed.data as Record<string, unknown>,
        isMock: true,
      };
    } catch (error) {
      return {
        system,
        document: adapter.document,
        status: "error",
        error:
          error instanceof Error ? error.message : "场景数据源读取失败",
        isMock: true,
      };
    }
  }
}

export function mockSourceHealthLabel(status: string): string {
  if (status === "fresh") return "正常";
  if (status === "stale") return "延迟";
  if (status === "missing") return "未接入";
  return "异常";
}

