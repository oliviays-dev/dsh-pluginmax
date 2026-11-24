import type {
  ProjectAlertRecord,
  ProjectBusinessChainBinding,
  ProjectRecord,
  ProjectReportRecord,
  ProjectTemplateRecord,
} from "./types.js";
import type {
  ProgressSourceRegistryLike,
  ProgressSourceResult,
  ProgressSourceStatus,
} from "./progress-sources.js";

interface ProgressExternalRef {
  readonly system: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly required?: boolean | undefined;
}

interface ProgressNodeLike {
  readonly id: string;
  readonly name: string;
  readonly type?: string | undefined;
  readonly executor?: {
    readonly kind?: string | undefined;
    readonly id?: string | undefined;
    readonly label?: string | undefined;
  };
  readonly responsible?: {
    readonly kind?: string | undefined;
    readonly id?: string | undefined;
    readonly label?: string | undefined;
  };
  readonly businessChain?: {
    readonly sequence?: number | undefined;
    readonly stageCode?: string | undefined;
    readonly summaryMetric?: string | undefined;
    readonly externalRefs?: readonly ProgressExternalRef[] | undefined;
    readonly fields?:
      | readonly {
          readonly key: string;
          readonly label: string;
          readonly bindings: readonly {
            readonly system: string;
            readonly objectId: string;
            readonly path: string;
          }[];
        }[]
      | undefined;
  };
}

interface ProgressDefinitionLike {
  readonly id: string;
  readonly key?: string | undefined;
  readonly version: number;
  readonly name: string;
  readonly kind?: string | undefined;
  readonly businessChain?: {
    readonly chainKey?: string | undefined;
    readonly displayName?: string | undefined;
    readonly allowUnboundExternalNodes?: boolean | undefined;
  };
  readonly graph?: {
    readonly nodes: readonly ProgressNodeLike[];
    readonly edges?: readonly {
      readonly from: string;
      readonly to: string;
    }[];
  };
}

interface ProgressInstanceLike {
  readonly id: string;
  readonly workspaceId?: string | undefined;
  readonly title: string;
  readonly status: string;
  readonly updatedAt?: string | undefined;
  readonly nodes?: Readonly<
    Record<
      string,
      {
        readonly status?: string | undefined;
        readonly assignedTo?: string | undefined;
        readonly enteredAt?: string | undefined;
        readonly completedAt?: string | undefined;
        readonly taskIds?: readonly string[] | undefined;
        readonly note?: string | undefined;
      }
    >
  >;
  readonly assignmentBindings?: Readonly<
    Record<
      string,
      {
        readonly primaryAssignee?: {
          readonly name?: string | undefined;
          readonly id?: string | undefined;
        };
        readonly source?: {
          readonly label?: string | undefined;
        };
      }
    >
  >;
}

interface ProgressTaskLike {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly receiverType: string;
  readonly receiverName?: string | undefined;
  readonly due?: string | undefined;
  readonly updatedAt: string;
  readonly receiverState?: string | undefined;
  readonly queueState?: string | undefined;
  readonly needsInput?: boolean | undefined;
  readonly reassignmentReason?: string | undefined;
  readonly executionAnomaly?:
    | {
        readonly code?: string | undefined;
        readonly message: string;
        readonly at?: string | undefined;
      }
    | undefined;
  readonly workflow?:
    | {
        readonly instanceId?: string | undefined;
        readonly nodeId?: string | undefined;
      }
    | undefined;
}

interface WorkflowEventLike {
  readonly id: string;
  readonly nodeId?: string | undefined;
  readonly kind: string;
  readonly message: string;
  readonly at: string;
  readonly actorName?: string | undefined;
  readonly data?: Record<string, unknown>;
}

export interface ProgressOverviewNode {
  readonly id: string;
  readonly stageCode: string;
  readonly code: string;
  readonly name: string;
  readonly type?: string | undefined;
  readonly sequence: number;
  readonly status: string;
  readonly statusLabel: string;
  readonly tone?: "done" | "progress" | "warn" | "notice" | undefined;
  readonly owner: string;
  readonly plannedLabel: string;
  readonly revisedLabel: string;
  readonly actualLabel: string;
  readonly alertCount: number;
  readonly taskCount: number;
  readonly exceptionText: string;
  readonly exceptionFromDemoData?: boolean | undefined;
  readonly isAnomaly: boolean;
  readonly taskIds: readonly string[];
  readonly alerts: readonly ProjectAlertView[];
  readonly fields: readonly {
    readonly key: string;
    readonly label: string;
    readonly value: string;
  }[];
  readonly sourceRefs: readonly {
    readonly system: string;
    readonly document: string;
    readonly objectId: string;
    readonly revision?: string | undefined;
    readonly observedAt?: string | undefined;
    readonly status: ProgressSourceStatus;
  }[];
}

export interface ProjectAlertView extends ProjectAlertRecord {
  readonly kind: string;
  readonly type: string;
  readonly source: string;
  readonly at: string;
  readonly stateLabel: string;
  readonly taskIds: readonly string[];
}

export interface ProjectProgressOverview {
  readonly schemaVersion: "project-progress-overview-v1";
  readonly generatedAt: string;
  readonly workspaceId: string;
  readonly businessChain: {
    readonly projectTemplateId: string;
    readonly businessChainTemplateId: string;
    readonly definitionId: string;
    readonly definitionVersion: number;
    readonly instanceId?: string | undefined;
    readonly chainKey: string;
    readonly bindingMode: ProjectBusinessChainBinding["bindingMode"];
    readonly sourceTemplateRevision: number;
  } | null;
  readonly compatibility: {
    readonly useClientFallback: boolean;
    readonly reason?: string | undefined;
  };
  readonly coverage: {
    readonly status: "complete" | "partial" | "stale" | "error";
    readonly sources: readonly {
      readonly system: string;
      readonly status: ProgressSourceStatus | "missing";
      readonly observedAt?: string | undefined;
      readonly message?: string | undefined;
      readonly isMock?: boolean | undefined;
    }[];
  };
  readonly keyProgress: {
    readonly progress: readonly string[];
    readonly attention: readonly string[];
    readonly latestReportAt?: string | undefined;
  };
  readonly nodes: readonly ProgressOverviewNode[];
  readonly changeEvents: readonly {
    readonly id: string;
    readonly category: string;
    readonly categoryLabel: string;
    readonly at: string;
    readonly time: string;
    readonly description: string;
    readonly source: string;
    readonly linkedNodeIds: readonly string[];
  }[];
  readonly alerts: readonly ProjectAlertView[];
  readonly tasksByNode: Record<string, readonly ProgressTaskLike[]>;
  readonly instance: ProgressInstanceLike | null;
  readonly definition: ProgressDefinitionLike | null;
}

export type ProjectAlertCandidate = Omit<
  ProjectAlertRecord,
  "alertId" | "workspaceId" | "firstSeenAt" | "lastSeenAt" | "followTargetId"
>;

export interface ProgressOverviewBuildResult {
  readonly overview: ProjectProgressOverview;
  readonly alertCandidates: readonly ProjectAlertCandidate[];
  readonly staleConditionKeys: ReadonlySet<string>;
  readonly sourceStatuses: Readonly<
    Record<string, ProgressSourceStatus | "missing">
  >;
}

export interface ProgressOverviewInput {
  readonly project: ProjectRecord;
  readonly template: ProjectTemplateRecord | undefined;
  readonly definition: ProgressDefinitionLike | undefined;
  readonly instance: ProgressInstanceLike | undefined;
  readonly tasks: readonly ProgressTaskLike[];
  readonly reports: readonly ProjectReportRecord[];
  readonly events?: readonly WorkflowEventLike[] | undefined;
  readonly memberNames?: Readonly<Record<string, string>> | undefined;
  readonly signal?: AbortSignal | undefined;
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "未开始",
  ready: "待执行",
  running: "进行中",
  blocked: "阻塞",
  completed: "已完成",
  skipped: "已跳过",
  failed: "失败",
};

const EVENT_LABEL: Record<string, string> = {
  order: "订单变更",
  supply: "供给变更",
  external: "外部影响",
  capacity: "产能变更",
  quality: "质量变更",
};

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function numberValue(value: unknown): number | undefined {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object",
      )
    : [];
}

function valueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function objectById(
  value: unknown,
  objectId: string,
  visited = new Set<unknown>(),
): unknown {
  if (value === null || typeof value !== "object") return undefined;
  if (visited.has(value)) return undefined;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = objectById(item, objectId, visited);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.entries(record).some(
      ([key, item]) =>
        /(?:^id$|Id$)/.test(key) &&
        (typeof item === "string" || typeof item === "number") &&
        String(item) === objectId,
    )
  ) {
    return record;
  }
  for (const item of Object.values(record)) {
    const found = objectById(item, objectId, visited);
    if (found !== undefined) return found;
  }
  return undefined;
}

function fieldValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "未记录";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function dateLabel(value: unknown): string {
  const candidate = text(value);
  const match = /^\d{4}-\d{2}-\d{2}/.exec(candidate);
  return match?.[0] ?? candidate;
}

function timeLabel(value: unknown): string {
  const candidate = text(value);
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(candidate);
  return match === null ? candidate || "时间未记录" : `${match[1]} ${match[2]}`;
}

function factLabel(
  fact:
    | {
        readonly value?: number | string | undefined;
        readonly date?: string | undefined;
      }
    | undefined,
): string {
  const value =
    fact?.value === undefined || fact.value === ""
      ? "数量未记录"
      : String(fact.value);
  const date =
    fact?.date === undefined || fact.date === ""
      ? "日期未记录"
      : dateLabel(fact.date);
  return `${value} · ${date}`;
}

function sourceMap(
  results: readonly ProgressSourceResult[],
): ReadonlyMap<string, ProgressSourceResult> {
  return new Map(results.map((result) => [result.system, result]));
}

function documentRecords(
  result: ProgressSourceResult | undefined,
  key: string,
): readonly Record<string, unknown>[] {
  return arrayValue(result?.data?.[key]);
}

function planNodeFor(
  refs: readonly ProgressExternalRef[],
  planning: ProgressSourceResult | undefined,
): Record<string, unknown> | undefined {
  const ids = new Set(
    refs
      .filter((ref) => ref.system.toUpperCase().includes("PLANNING"))
      .map((ref) => ref.objectId),
  );
  return documentRecords(planning, "businessChainPlan").find((item) =>
    ids.has(text(item.planNodeId)),
  );
}

function planFact(
  record: Record<string, unknown> | undefined,
  kind: "baseline" | "confirmed",
): { value?: number | string; date?: string } {
  const fact = objectValue(record?.[kind]);
  const value = numberValue(fact.quantity);
  const date = text(fact.finishDate);
  return {
    ...(value === undefined ? {} : { value }),
    ...(date === "" ? {} : { date }),
  };
}

function taskAnomaly(task: ProgressTaskLike): boolean {
  return (
    task.status === "abnormal" ||
    task.executionAnomaly !== undefined ||
    task.receiverState === "needs_reassignment" ||
    task.queueState === "blocked"
  );
}

function taskAnomalyText(task: ProgressTaskLike): string {
  return (
    task.executionAnomaly?.message ??
    task.reassignmentReason ??
    (task.queueState === "blocked"
      ? "依赖未满足"
      : task.needsInput === true
        ? "等待补充信息"
        : "任务需要人工处理")
  );
}

function parseReportItems(content: string, headings: ReadonlySet<string>) {
  const items: string[] = [];
  let collecting = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      collecting = headings.has(line.slice(3).trim());
      continue;
    }
    if (!collecting || line === "") continue;
    if (line.startsWith("- ")) {
      items.push(
        line
          .slice(2)
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .trim(),
      );
    }
  }
  return items.filter(Boolean);
}

function keyProgress(reports: readonly ProjectReportRecord[]) {
  const sorted = [...reports].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.date.localeCompare(left.date) ||
      right.generatedAt.localeCompare(left.generatedAt),
  );
  const latest = sorted.find((report) => report.generationMode === "agent");
  if (latest === undefined) {
    return { progress: [], attention: [] };
  }
  return {
    progress: parseReportItems(
      latest.content,
      new Set([
        "关键结果",
        "关键进展",
        "已完成",
        "正在推进",
        "目标与里程碑进展",
      ]),
    ),
    attention: parseReportItems(
      latest.content,
      new Set([
        "推进异常",
        "业务数据异常",
        "阻塞、依赖与需决策事项",
        "风险与依赖",
        "风险与异常",
        "需要关注",
        "风险",
      ]),
    ),
    latestReportAt: latest.generatedAt,
  };
}

export class ProjectProgressOverviewService {
  constructor(
    private readonly options: {
      readonly sources: ProgressSourceRegistryLike;
      readonly now?: () => Date;
      readonly timeoutMs?: number;
    },
  ) {}

  async build(input: ProgressOverviewInput): Promise<ProjectProgressOverview> {
    return (await this.buildDetailed(input)).overview;
  }

  async buildDetailed(
    input: ProgressOverviewInput,
  ): Promise<ProgressOverviewBuildResult> {
    const now = this.options.now?.() ?? new Date();
    const generatedAt = now.toISOString();
    const binding = input.project.businessChainBinding;
    if (binding === undefined) {
      return {
        overview: emptyOverview(input.project.workspaceId, generatedAt, true),
        alertCandidates: [],
        staleConditionKeys: new Set(),
        sourceStatuses: {},
      };
    }
    const definition = input.definition;
    const graphNodes = definition?.graph?.nodes ?? [];
    if (
      definition === undefined ||
      definition.kind !== "business-chain" ||
      graphNodes.length === 0
    ) {
      return {
        overview: {
          ...emptyOverview(input.project.workspaceId, generatedAt, false),
          businessChain: {
            projectTemplateId: binding.projectTemplateId,
            businessChainTemplateId: binding.businessChainTemplateId,
            definitionId: binding.workflowDefinitionId,
            definitionVersion: binding.workflowDefinitionVersion,
            ...(binding.workflowInstanceId === undefined
              ? {}
              : { instanceId: binding.workflowInstanceId }),
            chainKey:
              binding.chainKey ?? definition?.businessChain?.chainKey ?? "",
            bindingMode: binding.bindingMode,
            sourceTemplateRevision: binding.sourceTemplateRevision,
          },
          coverage: {
            status: "error",
            sources: [
              {
                system: "workflow",
                status: "error",
                message: "业务链路定义缺失或不是 business-chain",
              },
            ],
          },
        },
        alertCandidates: [],
        staleConditionKeys: new Set(),
        sourceStatuses: {},
      };
    }

    const nodes = graphNodes.map((node) => ({
      ...node,
      businessChain: {
        ...node.businessChain,
        externalRefs:
          node.businessChain?.externalRefs?.map((ref) => ({
            ...ref,
            required: ref.required ?? true,
          })) ??
          binding.nodeBindings.find((item) => item.nodeId === node.id)
            ?.externalRefs ??
          [],
      },
    }));
    const refs = nodes.flatMap((node) => node.businessChain.externalRefs ?? []);
    let results: readonly ProgressSourceResult[];
    try {
      results = await this.options.sources.read({
        workspaceId: input.project.workspaceId,
        projectCode: input.project.code,
        refs,
        signal: input.signal,
        timeoutMs: this.options.timeoutMs ?? 1_500,
      });
    } catch (error) {
      results = [...new Set(refs.map((ref) => ref.system))].map((system) => ({
        system,
        document: "",
        status: "error" as const,
        error: error instanceof Error ? error.message : "场景数据源读取失败",
        isMock: true,
      }));
    }
    const sources = sourceMap(results);
    const refsBySystem = new Map<string, ProgressExternalRef[]>();
    for (const ref of refs) {
      const current = refsBySystem.get(ref.system) ?? [];
      current.push(ref);
      refsBySystem.set(ref.system, current);
    }
    const coverageSources = Array.from(refsBySystem.keys()).map((system) => {
      const result = sources.get(system);
      return result === undefined
        ? { system, status: "missing" as const }
        : {
            system,
            status: result.status,
            ...(result.observedAt === undefined
              ? {}
              : { observedAt: result.observedAt }),
            ...(result.error === undefined ? {} : { message: result.error }),
            ...(result.isMock ? { isMock: true } : {}),
          };
    });
    const coverageStatus =
      coverageSources.length === 0
        ? "complete"
        : coverageSources.some(
              (source) =>
                source.status === "error" || source.status === "missing",
            )
          ? "partial"
          : coverageSources.some((source) => source.status === "stale")
            ? "stale"
            : "complete";
    const instance = input.instance;
    const tasksByNode: Record<string, ProgressTaskLike[]> = {};
    for (const task of input.tasks) {
      const workflow = task.workflow;
      if (workflow === undefined || workflow.instanceId !== instance?.id) {
        continue;
      }
      const nodeId = workflow.nodeId;
      if (nodeId === undefined) continue;
      const current = tasksByNode[nodeId] ?? [];
      current.push(task);
      tasksByNode[nodeId] = current;
    }
    const planning = sources.get("APS-PLANNING");
    const order = sources.get("OMS");
    const inventory = sources.get("WMS");
    const capacity = sources.get("MES");
    const orderLines = documentRecords(order, "lines");
    const orderLine = orderLines[0];
    const delivery = objectValue(order?.data?.delivery);
    const capacityExecution = documentRecords(capacity, "nodeExecution");
    const capacityResources = documentRecords(capacity, "resources");
    const inventoryComponents = documentRecords(inventory, "components");
    const alertCandidates: ProjectAlertCandidate[] = [];
    const sortedNodes = [...nodes].sort(
      (left, right) =>
        (left.businessChain.sequence ?? Number.MAX_SAFE_INTEGER) -
          (right.businessChain.sequence ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
    const viewNodes = sortedNodes.map((node, index) => {
      const state = instance?.nodes?.[node.id];
      const assignment = instance?.assignmentBindings?.[node.id];
      const nodeTasks = [
        ...new Map(
          [
            ...(tasksByNode[node.id] ?? []),
            ...(state?.taskIds ?? [])
              .map((taskId) => input.tasks.find((task) => task.id === taskId))
              .filter((task): task is ProgressTaskLike => task !== undefined),
          ].map((task) => [task.id, task]),
        ).values(),
      ];
      const demoNode = input.project.demoDataConfig?.data.nodes[node.id];
      const demoFields = demoNode?.fields ?? {};
      const demoException = text(demoNode?.exception);
      const effectiveStatus = demoNode?.status ?? state?.status ?? "waiting";
      const planningNode = planNodeFor(
        node.businessChain.externalRefs ?? [],
        planning,
      );
      const baseline = planFact(planningNode, "baseline");
      const confirmed = planFact(planningNode, "confirmed");
      let actual: { value?: number | string; date?: string } = {};
      const nodeRefs = node.businessChain.externalRefs ?? [];
      const hasOrderRef = nodeRefs.some(
        (ref) => ref.system.toUpperCase() === "OMS",
      );
      const hasInventoryRef = nodeRefs.some(
        (ref) => ref.system.toUpperCase() === "WMS",
      );
      const summaryMetric = node.businessChain.summaryMetric ?? "";
      if (
        (summaryMetric === "order-quantity" || hasOrderRef) &&
        orderLine !== undefined &&
        node.businessChain.stageCode !== "PACK_AND_SHIP"
      ) {
        actual = {
          value: numberValue(orderLine.currentQuantity) ?? "未记录",
          ...(text(orderLine.requestedDeliveryDate) === ""
            ? {}
            : { date: text(orderLine.requestedDeliveryDate) }),
        };
      } else if (
        summaryMetric === "shipment-quantity" ||
        node.businessChain.stageCode === "PACK_AND_SHIP"
      ) {
        actual = {
          value: numberValue(delivery.shippedQuantity) ?? "未记录",
          ...(text(delivery.lastShipmentAt) === ""
            ? {}
            : { date: text(delivery.lastShipmentAt) }),
        };
      } else {
        const execution =
          capacityExecution.find(
            (item) =>
              item.workflowNodeId === node.id ||
              item.stageCode === node.businessChain.stageCode,
          ) ?? undefined;
        if (execution !== undefined) {
          actual = {
            value: numberValue(execution.actualCompletedQuantity) ?? "未记录",
            ...(text(execution.actualCompletedAt) === ""
              ? {}
              : { date: text(execution.actualCompletedAt) }),
          };
        } else if (summaryMetric === "kit-readiness" || hasInventoryRef) {
          const timingGap = inventoryComponents.find(
            (component) => objectValue(component.timingGap).exists === true,
          );
          if (timingGap !== undefined) {
            const gap = objectValue(timingGap.timingGap);
            actual = {
              value: `影响 ${text(gap.affectedServers) || "未记录"} 台`,
              ...(text(gap.availableFrom) === ""
                ? {}
                : { date: text(gap.availableFrom) }),
            };
          }
        }
      }
      const nodeAlerts: ProjectAlertCandidate[] = [];
      if (effectiveStatus === "blocked" || effectiveStatus === "failed") {
        nodeAlerts.push({
          conditionKey: `workflow:${instance?.id ?? binding.workflowInstanceId ?? binding.workflowDefinitionId}:${node.id}:${
            state?.status ?? effectiveStatus
          }`,
          sourceSystem: "workflow",
          sourceObjectId: node.id,
          sourceRevision: String(
            input.definition?.version ?? binding.workflowDefinitionVersion,
          ),
          nodeId: node.id,
          alertType: "workflow-status",
          severity: effectiveStatus === "failed" ? "P0" : "P1",
          title: `${node.name} · ${
            STATUS_LABEL[effectiveStatus] ?? effectiveStatus
          }`,
          description:
            state?.note ??
            `${node.name}当前${
              STATUS_LABEL[effectiveStatus] ?? effectiveStatus
            }，需要确认解除条件。`,
          lifecycle: "open",
          linkedTaskIds: [
            ...new Set([
              ...(state?.taskIds ?? []),
              ...nodeTasks.map((task) => task.id),
            ]),
          ],
        });
      }
      for (const event of (input.events ?? []).filter(
        (candidate) =>
          candidate.nodeId === node.id &&
          /failed|blocked|denied|rejected|missing/.test(candidate.kind),
      )) {
        nodeAlerts.push({
          conditionKey: `workflow:${instance?.id ?? binding.workflowInstanceId ?? binding.workflowDefinitionId}:${node.id}:${event.kind}`,
          sourceSystem: "workflow",
          sourceObjectId: node.id,
          sourceRevision: String(
            input.definition?.version ?? binding.workflowDefinitionVersion,
          ),
          nodeId: node.id,
          alertType: "workflow-event",
          severity: /denied|rejected/.test(event.kind) ? "P0" : "P1",
          title: `${node.name} · 流程异常`,
          description: event.message,
          lifecycle: "open",
          linkedTaskIds: nodeTasks.map((task) => task.id),
        });
      }
      for (const task of nodeTasks.filter(taskAnomaly)) {
        nodeAlerts.push({
          conditionKey: `task:${task.id}:${task.executionAnomaly?.code ?? task.status}`,
          sourceSystem: "task",
          sourceObjectId: task.id,
          sourceRevision: task.updatedAt,
          nodeId: node.id,
          alertType: "task-anomaly",
          severity:
            task.priority === "P1"
              ? "P0"
              : task.priority === "P2"
                ? "P1"
                : "P2",
          title: task.title,
          description: taskAnomalyText(task),
          lifecycle: "open",
          linkedTaskIds: [task.id],
        });
      }
      const timingGap =
        summaryMetric === "kit-readiness" || hasInventoryRef
          ? inventoryComponents.find(
              (component) => objectValue(component.timingGap).exists === true,
            )
          : undefined;
      if (timingGap !== undefined) {
        const gap = objectValue(timingGap.timingGap);
        nodeAlerts.push({
          conditionKey: `WMS:${text(timingGap.componentCode)}:timing-gap`,
          sourceSystem: "WMS",
          sourceObjectId: text(timingGap.componentCode),
          sourceRevision: inventory?.revision ?? "",
          nodeId: node.id,
          alertType: "supply_delay",
          severity: "P1",
          title: `${text(timingGap.componentName) || text(timingGap.componentCode) || "组件"}到货晚于阶段需求`,
          description: text(gap.message) || "组件到货时间存在缺口",
          lifecycle: "open",
          linkedTaskIds: nodeTasks.map((task) => task.id),
        });
      }
      const capacityConstraint = capacityResources
        .filter((resource) => text(resource.status) === "bottleneck")
        .find((resource) => {
          const resourceId = text(resource.resourceId);
          return nodeRefs.some(
            (ref) =>
              ref.system.toUpperCase() === "MES" && ref.objectId === resourceId,
          );
        });
      if (capacityConstraint !== undefined) {
        nodeAlerts.push({
          conditionKey: `MES:${text(capacityConstraint.resourceId)}:capacity-reduction`,
          sourceSystem: "MES",
          sourceObjectId: text(capacityConstraint.resourceId),
          sourceRevision: capacity?.revision ?? "",
          nodeId: node.id,
          alertType: "capacity_reduction",
          severity: "P1",
          title: `${text(capacityConstraint.resourceName) || "资源"}能力下降`,
          description:
            text(capacityConstraint.message) ||
            "资源处于瓶颈状态，需要确认恢复时间。",
          lifecycle: "open",
          linkedTaskIds: nodeTasks.map((task) => task.id),
        });
      }
      alertCandidates.push(...nodeAlerts);
      const temporaryViews = nodeAlerts.map((alert) =>
        toAlertView(
          {
            ...alert,
            alertId: `pending:${stableKey(alert.conditionKey)}`,
            workspaceId: input.project.workspaceId,
            firstSeenAt: generatedAt,
            lastSeenAt: generatedAt,
            followTargetId: `pending:${stableKey(alert.conditionKey)}`,
          },
          state,
        ),
      );
      const sourceRefs = (node.businessChain.externalRefs ?? []).map((ref) => {
        const result = sources.get(ref.system);
        return {
          system: ref.system,
          document: result?.document ?? "",
          objectId: ref.objectId,
          ...(result?.revision === undefined
            ? {}
            : { revision: result.revision }),
          ...(result?.observedAt === undefined
            ? {}
            : { observedAt: result.observedAt }),
          status: result?.status ?? ("error" as const),
        };
      });
      const fields = (node.businessChain.fields ?? []).map((field) => ({
        key: field.key,
        label: field.label,
        value:
          demoFields[field.key] === undefined
            ? field.bindings
                .map((binding) => {
                  const result = sources.get(binding.system);
                  const sourceObject = objectById(
                    result?.data,
                    binding.objectId,
                  );
                  return fieldValue(
                    valueAtPath(sourceObject ?? result?.data, binding.path),
                  );
                })
                .join(" · ")
            : fieldValue(demoFields[field.key]),
      }));
      return {
        id: node.id,
        stageCode: node.businessChain.stageCode ?? node.id.toUpperCase(),
        code: String(index + 1),
        name: node.name,
        ...(node.type === undefined ? {} : { type: node.type }),
        sequence: node.businessChain.sequence ?? index + 1,
        status: effectiveStatus,
        statusLabel: STATUS_LABEL[effectiveStatus] ?? "未开始",
        ...(toneForStatus(effectiveStatus) === undefined
          ? {}
          : { tone: toneForStatus(effectiveStatus) }),
        owner:
          text(demoNode?.owner) ||
          text(input.memberNames?.[state?.assignedTo ?? ""]) ||
          text(state?.assignedTo) ||
          text(assignment?.primaryAssignee?.name) ||
          text(assignment?.primaryAssignee?.id) ||
          text(assignment?.source?.label) ||
          text(node.responsible?.label) ||
          text(node.executor?.label) ||
          text(node.executor?.id) ||
          "未指派",
        plannedLabel: factLabel(baseline),
        revisedLabel: factLabel(confirmed),
        actualLabel:
          effectiveStatus === "completed"
            ? factLabel(actual)
            : `${actual.value === undefined ? "" : `${actual.value} · `}未完成`,
        alertCount: nodeAlerts.length,
        taskCount: nodeTasks.length,
        exceptionText:
          demoNode?.exception !== undefined
            ? demoException || "无"
            : temporaryViews.length === 0
              ? "无"
              : [...new Set(temporaryViews.map((alert) => alert.title))].join(
                  " · ",
                ),
        ...(demoNode?.exception === undefined
          ? {}
          : { exceptionFromDemoData: true }),
        isAnomaly:
          effectiveStatus === "blocked" ||
          effectiveStatus === "failed" ||
          (demoException !== "" && demoException !== "无") ||
          nodeAlerts.length > 0 ||
          state?.status === "blocked" ||
          state?.status === "failed",
        taskIds: nodeTasks.map((task) => task.id),
        alerts: temporaryViews,
        fields,
        sourceRefs,
      };
    });
    const syncHealth = objectValue(order?.data?.syncHealth);
    if (text(syncHealth.status) === "delayed") {
      const node = sortedNodes.find((candidate) =>
        (candidate.businessChain.externalRefs ?? []).some(
          (ref) => ref.system.toUpperCase() === "OMS",
        ),
      );
      alertCandidates.push({
        conditionKey: `OMS:${text(order?.data?.salesOrderId) || input.project.code}:sync-sla`,
        sourceSystem: "OMS",
        sourceObjectId: text(order?.data?.salesOrderId) || input.project.code,
        sourceRevision: order?.revision ?? "",
        ...(node === undefined ? {} : { nodeId: node.id }),
        alertType: "source_sync",
        severity: "P1",
        title: "库存回传超过 SLA",
        description: text(syncHealth.message) || "订单来源同步延迟",
        lifecycle: "open",
        linkedTaskIds:
          node === undefined
            ? []
            : (tasksByNode[node.id] ?? []).map((task) => task.id),
      });
    }
    const demoChangeEvents = input.project.demoDataConfig?.data.changeEvents;
    const changeEvents =
      demoChangeEvents === undefined
        ? normalizedChangeEvents(results, nodes)
        : demoChangeEvents.map((event, index) => ({
            id: event.id ?? `demo:${stableKey(`${event.at}:${index}`)}`,
            category: event.category,
            categoryLabel:
              event.categoryLabel ??
              EVENT_LABEL[event.category] ??
              event.category,
            at: event.at,
            time: timeLabel(event.at),
            description: event.description,
            source: event.source,
            linkedNodeIds: event.linkedNodeIds,
          }));
    const staleConditionKeys = new Set(
      alertCandidates
        .filter(
          (candidate) =>
            sources.get(candidate.sourceSystem)?.status === "stale",
        )
        .map((candidate) => candidate.conditionKey),
    );
    return {
      overview: {
        schemaVersion: "project-progress-overview-v1",
        generatedAt,
        workspaceId: input.project.workspaceId,
        businessChain: {
          projectTemplateId: binding.projectTemplateId,
          businessChainTemplateId: binding.businessChainTemplateId,
          definitionId: binding.workflowDefinitionId,
          definitionVersion: binding.workflowDefinitionVersion,
          ...(instance === undefined ? {} : { instanceId: instance.id }),
          chainKey:
            definition.businessChain?.chainKey ?? binding.chainKey ?? "",
          bindingMode: binding.bindingMode,
          sourceTemplateRevision: binding.sourceTemplateRevision,
        },
        compatibility: { useClientFallback: false },
        coverage: { status: coverageStatus, sources: coverageSources },
        keyProgress: keyProgress(input.reports),
        nodes: viewNodes,
        changeEvents,
        alerts: [],
        tasksByNode,
        instance: instance ?? null,
        definition,
      },
      alertCandidates,
      staleConditionKeys,
      sourceStatuses: Object.fromEntries(
        coverageSources.map((source) => [source.system, source.status]),
      ),
    };
  }
}

function toneForStatus(
  status: string | undefined,
): "done" | "progress" | "warn" | "notice" | undefined {
  if (status === "completed") return "done";
  if (status === "running" || status === "ready") return "progress";
  if (status === "blocked" || status === "failed") return "warn";
  if (status === "waiting") return "notice";
  return undefined;
}

function toAlertView(
  alert: ProjectAlertRecord,
  state: { readonly status?: string | undefined } | undefined,
): ProjectAlertView {
  return {
    ...alert,
    kind: alert.alertType,
    type:
      alert.sourceSystem === "task"
        ? "任务异常"
        : alert.sourceSystem === "workflow"
          ? "流程异常"
          : "外部异常",
    source:
      alert.sourceSystem === "workflow"
        ? "工作流"
        : alert.sourceSystem === "task"
          ? "任务"
          : alert.sourceSystem,
    at: alert.lastSeenAt,
    stateLabel:
      alert.lifecycle === "stale"
        ? "来源延迟"
        : alert.lifecycle === "acknowledged"
          ? "已确认"
          : alert.lifecycle === "in_progress"
            ? "处理中"
            : alert.lifecycle === "resolved"
              ? "已解决"
              : alert.lifecycle === "suppressed"
                ? "已抑制"
                : (STATUS_LABEL[state?.status ?? ""] ?? "待处理"),
    taskIds: alert.linkedTaskIds,
  };
}

function emptyOverview(
  workspaceId: string,
  generatedAt: string,
  useClientFallback: boolean,
): ProjectProgressOverview {
  return {
    schemaVersion: "project-progress-overview-v1",
    generatedAt,
    workspaceId,
    businessChain: null,
    compatibility: {
      useClientFallback,
      ...(useClientFallback ? { reason: "项目尚未保存业务链路快照" } : {}),
    },
    coverage: {
      status: "error",
      sources: [
        {
          system: "workflow",
          status: "missing",
          message: "当前项目还没有业务链路",
        },
      ],
    },
    keyProgress: { progress: [], attention: [] },
    nodes: [],
    changeEvents: [],
    alerts: [],
    tasksByNode: {},
    instance: null,
    definition: null,
  };
}

function normalizedChangeEvents(
  results: readonly ProgressSourceResult[],
  nodes: readonly ProgressNodeLike[],
): ProjectProgressOverview["changeEvents"] {
  const events: Array<ProjectProgressOverview["changeEvents"][number]> = [];
  const nodeByStage = new Map(
    nodes.map((node) => [node.businessChain?.stageCode ?? "", node.id]),
  );
  const planning = results.find((result) => result.system === "APS-PLANNING");
  for (const item of documentRecords(planning, "planChanges")) {
    const changeType = text(item.changeType);
    if (text(item.status) !== "confirmed") continue;
    const category = changeType.includes("order")
      ? "order"
      : changeType.includes("supply")
        ? "supply"
        : "external";
    const planNodeId = text(item.planNodeId);
    const planNode = documentRecords(planning, "businessChainPlan").find(
      (node) => text(node.planNodeId) === planNodeId,
    );
    const at = text(item.changedAt);
    events.push({
      id:
        text(item.changeId) ||
        `plan-change:${stableKey(`${at}:${planNodeId}`)}`,
      category,
      categoryLabel: EVENT_LABEL[category] ?? category,
      at,
      time: timeLabel(at),
      description: text(item.reason) || "计划发生变更",
      source: text(item.changedBy) || "计划系统",
      linkedNodeIds: [nodeByStage.get(text(planNode?.stageCode)) ?? ""].filter(
        Boolean,
      ),
    });
  }
  const order = results.find((result) => result.system === "OMS");
  const orderNode = nodes.find((node) =>
    (node.businessChain?.externalRefs ?? []).some(
      (ref) => ref.system.toUpperCase() === "OMS",
    ),
  );
  for (const item of documentRecords(order, "revisionHistory")) {
    const at = text(item.changedAt);
    events.push({
      id: text(item.revisionId) || `order-change:${stableKey(at)}`,
      category: "order",
      categoryLabel: EVENT_LABEL.order ?? "订单变更",
      at,
      time: timeLabel(at),
      description: text(item.reason) || "订单发生变更",
      source: text(item.source) || "订单系统",
      linkedNodeIds: [orderNode?.id ?? ""].filter(Boolean),
    });
  }
  const inventory = results.find((result) => result.system === "WMS");
  for (const warehouse of documentRecords(inventory, "warehouseHealth")) {
    if (text(warehouse.status) === "healthy") continue;
    const at = text(warehouse.lastSuccessfulSyncAt);
    const linkedNode =
      nodes.find((node) =>
        (node.businessChain?.externalRefs ?? []).some(
          (ref) =>
            ref.system.toUpperCase() === "WMS" &&
            ref.objectId === text(warehouse.warehouseId),
        ),
      ) ??
      nodes.find((node) =>
        (node.businessChain?.externalRefs ?? []).some(
          (ref) => ref.system.toUpperCase() === "WMS",
        ),
      );
    events.push({
      id: `warehouse:${text(warehouse.warehouseId)}:${stableKey(at)}`,
      category: "external",
      categoryLabel: EVENT_LABEL.external ?? "外部影响",
      at,
      time: timeLabel(at),
      description: text(warehouse.message) || "仓储来源同步异常",
      source: `库存系统 · ${text(warehouse.warehouseId)}`,
      linkedNodeIds: [linkedNode?.id ?? ""].filter(Boolean),
    });
  }
  const capacity = results.find((result) => result.system === "MES");
  for (const item of documentRecords(capacity, "constraintEvents")) {
    const at = text(item.occurredAt);
    const linkedNode =
      nodes.find((node) =>
        (node.businessChain?.externalRefs ?? []).some(
          (ref) =>
            ref.system.toUpperCase() === "MES" &&
            ref.objectId === text(item.resourceId),
        ),
      ) ??
      nodes.find((node) =>
        (node.businessChain?.externalRefs ?? []).some(
          (ref) => ref.system.toUpperCase() === "MES",
        ),
      );
    events.push({
      id: text(item.constraintId) || `capacity:${stableKey(at)}`,
      category: "capacity",
      categoryLabel: EVENT_LABEL.capacity ?? "产能变更",
      at,
      time: timeLabel(at),
      description: text(item.reason) || "产能发生变更",
      source: `产能系统 · ${text(item.resourceId)}`,
      linkedNodeIds: [linkedNode?.id ?? ""].filter(Boolean),
    });
  }
  return events
    .filter((event) => event.at !== "")
    .sort(
      (left, right) =>
        left.at.localeCompare(right.at) ||
        left.description.localeCompare(right.description),
    );
}

export function alertView(alert: ProjectAlertRecord): ProjectAlertView {
  return toAlertView(alert, undefined);
}

export function hydrateOverviewAlerts(
  overview: ProjectProgressOverview,
  alerts: readonly ProjectAlertRecord[],
): ProjectProgressOverview {
  const active = alerts
    .filter(
      (alert) =>
        alert.lifecycle !== "resolved" && alert.lifecycle !== "suppressed",
    )
    .map((alert) => alertView(alert))
    .sort((left, right) => {
      const rank = { P0: 0, P1: 1, P2: 2 };
      return (
        (rank[left.severity] ?? 9) - (rank[right.severity] ?? 9) ||
        right.lastSeenAt.localeCompare(left.lastSeenAt)
      );
    });
  const nodes = overview.nodes.map((node) => {
    const nodeAlerts = active.filter((alert) => alert.nodeId === node.id);
    return {
      ...node,
      alertCount: nodeAlerts.length,
      exceptionText:
        node.exceptionFromDemoData === true
          ? node.exceptionText || "无"
          : nodeAlerts.length === 0
            ? node.exceptionText === ""
              ? "无"
              : node.exceptionText
            : [...new Set(nodeAlerts.map((alert) => alert.title))].join(" · "),
      isAnomaly: node.isAnomaly || nodeAlerts.length > 0,
      alerts: nodeAlerts,
    };
  });
  return { ...overview, nodes, alerts: active };
}
