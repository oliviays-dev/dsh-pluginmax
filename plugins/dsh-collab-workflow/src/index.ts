import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { z } from "zod";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { parseWorkflowMarkdown, evaluateExpression } from "./parser.js";
import {
  nodeStateSchema,
  workflowDefinitionSchema,
  workflowEventSchema,
  workflowGraphSchema,
  workflowInstanceSchema,
  workflowSubmissionSchema,
  type Approver,
  type DeliverableRequirement,
  type DeliverableState,
  type Executor,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowInstance,
  type WorkflowEvent,
  type WorkflowNode,
  type WorkflowNodeState,
  type WorkflowSubmission,
  type WorkflowVariable,
} from "./types.js";

export type {
  Approver,
  Executor,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowEvent,
  WorkflowGraph,
  WorkflowInstance,
  WorkflowNode,
  WorkflowNodeState,
  WorkflowSubmission,
  WorkflowVariable,
};

export const name = "dsh-collab-workflow";
export const inject = ["storageDomain", "commands", "tools", "webServer"];

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  keys(): IterableIterator<string>;
  get size(): number;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface DomainSpecLike {
  readonly name: string;
  readonly version: number;
  readonly compatibleVersions?: readonly number[];
  readonly tables: Record<string, { readonly valueSchema: z.ZodType<unknown> }>;
}

export interface WorkflowDomainLike {
  table(name: "definitions"): KvTableLike<WorkflowDefinition>;
  table(name: "instances"): KvTableLike<WorkflowInstance>;
  table(name: "events"): KvTableLike<WorkflowEvent>;
  table(name: "submissions"): KvTableLike<WorkflowSubmission>;
  close(): Promise<void>;
}

export interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

export interface TeamMemberLike {
  readonly userId: string;
  readonly name?: string;
  readonly memberRole?: "owner" | "member" | "guest";
}

export interface TeamServiceLike {
  resolveToken(token: string):
    | {
        readonly userId: string;
        readonly role: "admin" | "owner" | "member" | "guest";
      }
    | undefined;
  members(workspaceId: string): readonly TeamMemberLike[];
}

export interface WorkflowActor {
  readonly kind: "user" | "agent";
  readonly id: string;
  readonly name?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly globalRole?: "admin" | "owner" | "member" | "guest" | undefined;
  readonly workspaceRole?: "owner" | "member" | "guest" | undefined;
}

interface CommandInvocationLike {
  readonly rawInput: string;
}

interface ToolExecLike {
  signal: { throwIfAborted(): void };
  session?: { readonly id?: string };
}

interface ToolOutputLike {
  readonly schema: { readonly type: "string" };
  render(args: unknown, value: string): Array<{ type: "text"; text: string }>;
}

const stringToolOutput: ToolOutputLike = {
  schema: { type: "string" },
  render: (_args, value) => [{ type: "text", text: value }],
};

interface WorkflowContext {
  storageDomain: { open(spec: DomainSpecLike): Promise<WorkflowDomainLike> };
  commands: { register(definition: unknown): unknown };
  tools: { register(definition: unknown): unknown };
  webServer: { register(route: WebRouteLike): unknown };
  provide(key: "collabWorkflow", service: WorkflowService): void;
  effect(operation: () => () => void): void;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: WorkflowContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void } | void;
  get(key: "collabTeam"): TeamServiceLike | undefined;
}

export const workflowDomainSpec = {
  name: "collab_workflow",
  version: 1,
  tables: {
    definitions: {
      valueSchema: workflowDefinitionSchema as unknown as z.ZodType<unknown>,
    },
    instances: {
      valueSchema: workflowInstanceSchema as unknown as z.ZodType<unknown>,
    },
    events: {
      valueSchema: workflowEventSchema as unknown as z.ZodType<unknown>,
    },
    submissions: {
      valueSchema: workflowSubmissionSchema as unknown as z.ZodType<unknown>,
    },
  },
} as const satisfies DomainSpecLike;

export class WorkflowError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "missing_deliverables"
      | "method_not_allowed",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function parseDefinitionFixture(
  sourceMd: string,
): ReturnType<typeof parseWorkflowMarkdown> {
  return parseWorkflowMarkdown(sourceMd);
}

function values<V>(table: KvTableLike<V>): V[] {
  return [...table.entries()].map(([, value]) => value);
}

function iso(now: Date): string {
  return now.toISOString();
}

function isManager(actor: WorkflowActor): boolean {
  return (
    actor.kind === "user" &&
    (actor.globalRole === "admin" || actor.workspaceRole === "owner")
  );
}

function actorMatchesApprover(
  actor: WorkflowActor,
  approver: Approver,
): boolean {
  return (
    actor.kind === (approver.kind === "user" ? "user" : "agent") &&
    actor.id === approver.id
  );
}

function graphContext(
  instance: WorkflowInstance,
): Record<string, string | number | boolean> {
  return { ...instance.context };
}

function safeEvaluate(
  expression: string,
  context: Record<string, string | number | boolean>,
): boolean {
  try {
    return evaluateExpression(expression, context);
  } catch {
    return false;
  }
}

export interface ValidationIssue {
  readonly level: "error" | "warning";
  readonly message: string;
}

function dedupeIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.level}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateRuntimeGraph(
  graph: WorkflowGraph,
  activeDefinitions: readonly Pick<
    WorkflowDefinition,
    "key" | "version" | "status"
  >[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = graph.warnings.map((message) => ({
    level: "warning" as const,
    message,
  }));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.push({
        level: "error",
        message: `edge references unknown node: ${edge.from} -> ${edge.to}`,
      });
    }
    for (const expression of [edge.condition, edge.breakCondition]) {
      if (expression === undefined) continue;
      try {
        evaluateExpression(
          expression,
          Object.fromEntries(
            graph.variables.map((variable) => [variable.name, variable.value]),
          ),
        );
      } catch (error) {
        issues.push({
          level: "error",
          message: `${expression}: ${error instanceof Error ? error.message : "invalid expression"}`,
        });
      }
    }
  }
  if (graph.startNodeIds.length === 0) {
    issues.push({ level: "error", message: "workflow has no start node" });
  }
  for (const node of graph.nodes) {
    if (node.type !== "subworkflow" || node.subworkflowKey === undefined)
      continue;
    const found = activeDefinitions.some(
      (definition) =>
        definition.key === node.subworkflowKey &&
        (node.subworkflowVersion === undefined ||
          definition.version === node.subworkflowVersion) &&
        definition.status === "active",
    );
    if (!found)
      issues.push({
        level: "error",
        message: `unknown active subworkflow: ${node.subworkflowKey}`,
      });
  }
  return issues;
}

export function validateWorkspaceActorReferences(
  graph: Pick<WorkflowGraph, "nodes">,
  members: readonly TeamMemberLike[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const memberIds = new Set(members.map((member) => member.userId));
  const seen = new Set<string>();
  const check = (
    nodeId: string,
    nodeName: string,
    role: string,
    id: string,
  ) => {
    const key = `${nodeId}:${role}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!memberIds.has(id)) {
      issues.push({
        level: "error",
        message: `节点「${nodeName}」的${role} ${id} 不是当前工作区成员`,
      });
    }
  };
  for (const node of graph.nodes) {
    if (node.executor.kind === "user") {
      check(node.id, node.name, "执行人", node.executor.id);
    }
    if (node.responsible?.kind === "user") {
      check(node.id, node.name, "负责人", node.responsible.id);
    }
    if (node.type === "approval") {
      for (const approver of node.approvers) {
        if (approver.kind === "user") {
          check(node.id, node.name, "审批人", approver.id);
        }
      }
    }
  }
  return issues;
}

export interface WorkflowServiceTables {
  definitions: KvTableLike<WorkflowDefinition>;
  instances: KvTableLike<WorkflowInstance>;
  events: KvTableLike<WorkflowEvent>;
  submissions: KvTableLike<WorkflowSubmission>;
}

export interface StartWorkflowInput {
  readonly workspaceId: string;
  readonly definitionId?: string | undefined;
  readonly title: string;
  readonly sessionId?: string | undefined;
  readonly relatedSessionIds?: readonly string[] | undefined;
  readonly context?: Record<string, string | number | boolean> | undefined;
}

export class WorkflowService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly tables: WorkflowServiceTables,
    private readonly options: {
      readonly now?: () => Date;
      readonly artifactRoot?: string;
      readonly team?: () => TeamServiceLike | undefined;
    } = {},
  ) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  validate(
    sourceMd: string,
    workspaceId?: string | undefined,
  ): {
    graph?: WorkflowGraph;
    issues: ValidationIssue[];
  } {
    const parsed = parseWorkflowMarkdown(sourceMd);
    const issues: ValidationIssue[] = [
      ...parsed.errors.map((message) => ({ level: "error" as const, message })),
      ...parsed.warnings.map((message) => ({
        level: "warning" as const,
        message,
      })),
    ];
    if (parsed.graph === undefined) return { issues };
    issues.push(
      ...validateRuntimeGraph(parsed.graph, values(this.tables.definitions)),
    );
    if (workspaceId !== undefined) {
      issues.push(...this.actorReferenceIssues(parsed.graph, workspaceId));
    }
    return { graph: parsed.graph, issues: dedupeIssues(issues) };
  }

  private actorReferenceIssues(
    graph: WorkflowGraph,
    workspaceId: string,
  ): ValidationIssue[] {
    const team = this.options.team?.();
    if (team === undefined) return [];
    return validateWorkspaceActorReferences(graph, team.members(workspaceId));
  }

  definitions(workspaceId: string): WorkflowDefinition[] {
    return values(this.tables.definitions)
      .filter((definition) => definition.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) ||
          right.version - left.version ||
          left.createdAt.localeCompare(right.createdAt),
      );
  }

  definition(definitionId: string): WorkflowDefinition | undefined {
    return this.tables.definitions.get(definitionId);
  }

  importDefinition(
    actor: WorkflowActor,
    input: { workspaceId: string; sourceMd: string; activate?: boolean },
  ): Promise<WorkflowDefinition> {
    if (!isManager(actor)) {
      throw new WorkflowError(
        "forbidden",
        "workspace owner or admin is required",
      );
    }
    return this.enqueue(async () => {
      const timestamp = iso(this.now());
      const check = this.validate(input.sourceMd);
      const identityIssues =
        check.graph === undefined
          ? []
          : this.actorReferenceIssues(check.graph, input.workspaceId);
      const errors = [...check.issues, ...identityIssues].filter(
        (issue) => issue.level === "error",
      );
      if (check.graph === undefined || errors.length > 0) {
        throw new WorkflowError(
          "invalid_input",
          errors.map((issue) => issue.message).join("; ") ||
            "workflow is invalid",
        );
      }
      const graph = workflowGraphSchema.parse(check.graph);
      const existing = this.definitions(input.workspaceId).filter(
        (definition) => definition.key === graph.key,
      );
      if (existing.some((definition) => definition.version === graph.version)) {
        throw new WorkflowError(
          "conflict",
          `definition version already exists: ${graph.key} v${graph.version}`,
        );
      }
      const activate = input.activate ?? true;
      if (activate) {
        for (const definition of existing.filter(
          (item) => item.status === "active",
        )) {
          await this.tables.definitions.put(definition.id, {
            ...definition,
            status: "archived",
            updatedAt: timestamp,
          });
        }
      }
      const record: WorkflowDefinition = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        key: graph.key,
        version: graph.version,
        name: graph.name,
        description: graph.description,
        sourceMd: input.sourceMd,
        graph,
        status: activate ? "active" : "archived",
        createdBy: actor.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.tables.definitions.put(record.id, record);
      return record;
    });
  }

  instances(
    workspaceId: string,
    filter: { sessionId?: string } = {},
  ): WorkflowInstance[] {
    return values(this.tables.instances)
      .filter((instance) => instance.workspaceId === workspaceId)
      .filter(
        (instance) =>
          filter.sessionId === undefined ||
          instance.sessionId === filter.sessionId ||
          instance.relatedSessionIds.includes(filter.sessionId),
      )
      .map((instance) => this.refreshStatus(instance))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  instance(instanceId: string): WorkflowInstance | undefined {
    return this.tables.instances.get(instanceId);
  }

  instanceView(instanceId: string): WorkflowInstance | undefined {
    const instance = this.instance(instanceId);
    return instance === undefined ? undefined : this.refreshStatus(instance);
  }

  events(instanceId: string): WorkflowEvent[] {
    return values(this.tables.events)
      .filter((event) => event.instanceId === instanceId)
      .sort(
        (left, right) =>
          left.at.localeCompare(right.at) || left.id.localeCompare(right.id),
      );
  }

  submissions(
    instanceId: string,
    filter: { nodeId?: string } = {},
  ): WorkflowSubmission[] {
    return values(this.tables.submissions)
      .filter(
        (submission) =>
          submission.instanceId === instanceId &&
          (filter.nodeId === undefined || submission.nodeId === filter.nodeId),
      )
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  }

  submission(submissionId: string): WorkflowSubmission | undefined {
    return this.tables.submissions.get(submissionId);
  }

  private async appendEvent(
    instance: Pick<WorkflowInstance, "id" | "workspaceId">,
    event: {
      nodeId?: string;
      kind: string;
      actor: WorkflowActor | { kind: "system"; id: string; name: string };
      message: string;
      data?: Record<string, unknown>;
    },
  ): Promise<void> {
    const actor =
      "kind" in event.actor && event.actor.kind !== "system"
        ? event.actor
        : { kind: "system" as const, id: "workflow", name: "系统" };
    const record: WorkflowEvent = {
      id: randomUUID(),
      workspaceId: instance.workspaceId,
      instanceId: instance.id,
      ...(event.nodeId === undefined ? {} : { nodeId: event.nodeId }),
      kind: event.kind,
      actorId: actor.id,
      actorKind: actor.kind,
      actorName:
        "name" in actor && actor.name !== undefined ? actor.name : actor.id,
      message: event.message,
      data: event.data ?? {},
      at: iso(this.now()),
    };
    await this.tables.events.put(record.id, workflowEventSchema.parse(record));
  }

  private initialState(
    node: WorkflowNode,
    timestamp: string,
  ): WorkflowNodeState {
    const approvals: WorkflowNodeState["approvals"] = {};
    if (node.type === "approval") {
      for (const approver of node.approvers) {
        approvals[`${node.id}:${approver.id}`] = {
          approver,
          status: "pending",
        };
      }
    }
    return nodeStateSchema.parse({
      nodeId: node.id,
      status: "waiting",
      attempts: 1,
      approvals,
      ...(node.type === "approval" || node.type === "task"
        ? { assignedTo: node.executor.label ?? node.executor.id }
        : {}),
      ...(timestamp === "" ? {} : {}),
      deliverables: Object.fromEntries(
        node.deliverables.map((requirement) => [
          requirement.key,
          {
            requirementKey: requirement.key,
            status: "pending",
          },
        ]),
      ),
    });
  }

  private async putInstance(
    instance: WorkflowInstance,
  ): Promise<WorkflowInstance> {
    const next = workflowInstanceSchema.parse({
      ...instance,
      updatedAt: iso(this.now()),
    });
    await this.tables.instances.put(next.id, next);
    return next;
  }

  startInstance(
    actor: WorkflowActor,
    input: StartWorkflowInput,
  ): Promise<WorkflowInstance> {
    if (
      actor.kind !== "user" &&
      actor.workspaceRole === undefined &&
      actor.globalRole !== "admin"
    ) {
      throw new WorkflowError("forbidden", "workspace member is required");
    }
    if (
      actor.kind === "user" &&
      !isManager(actor) &&
      actor.workspaceRole !== "member" &&
      actor.globalRole !== "admin"
    ) {
      throw new WorkflowError("forbidden", "workspace member is required");
    }
    return this.enqueue(async () => {
      const definitions = this.definitions(input.workspaceId);
      const definition =
        input.definitionId === undefined
          ? definitions.find((item) => item.status === "active")
          : definitions.find((item) => item.id === input.definitionId);
      if (definition === undefined) {
        throw new WorkflowError(
          "not_found",
          "active workflow definition not found",
        );
      }
      const identityErrors = this.actorReferenceIssues(
        definition.graph,
        input.workspaceId,
      ).filter((issue) => issue.level === "error");
      if (identityErrors.length > 0) {
        throw new WorkflowError(
          "invalid_input",
          identityErrors.map((issue) => issue.message).join("; "),
        );
      }
      const related = [
        ...new Set([
          ...(input.sessionId === undefined ? [] : [input.sessionId]),
          ...(input.relatedSessionIds ?? []),
        ]),
      ];
      const timestamp = iso(this.now());
      const instance: WorkflowInstance = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        definitionId: definition.id,
        definitionKey: definition.key,
        definitionVersion: definition.version,
        title: input.title,
        status: "running",
        ...(input.sessionId === undefined
          ? {}
          : { sessionId: input.sessionId }),
        relatedSessionIds: related,
        context: {
          ...Object.fromEntries(
            definition.graph.variables.map((item) => [item.name, item.value]),
          ),
          ...input.context,
        },
        nodes: Object.fromEntries(
          definition.graph.nodes.map((node) => [
            node.id,
            this.initialState(node, timestamp),
          ]),
        ),
        createdBy: actor.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      for (const nodeId of definition.graph.startNodeIds) {
        instance.nodes[nodeId] = {
          ...instance.nodes[nodeId]!,
          status: "ready",
          enteredAt: timestamp,
        };
      }
      await this.tables.instances.put(
        instance.id,
        workflowInstanceSchema.parse(instance),
      );
      await this.appendEvent(instance, {
        kind: "instance.started",
        actor,
        message: `启动工作流：${input.title}`,
        data: { definition: `${definition.name} v${definition.version}` },
      });
      const started = await this.putInstance(instance);
      return this.startReadySubworkflows(actor, started);
    });
  }

  private async startReadySubworkflows(
    actor: WorkflowActor,
    instance: WorkflowInstance,
  ): Promise<WorkflowInstance> {
    const definition = this.tables.definitions.get(instance.definitionId);
    if (definition === undefined) return instance;
    let current = instance;
    for (const node of definition.graph.nodes.filter(
      (item) => item.type === "subworkflow",
    )) {
      const state = current.nodes[node.id];
      if (state?.status !== "ready" || node.subworkflowKey === undefined)
        continue;
      const definitions = this.definitions(current.workspaceId);
      const childDefinition = definitions.find(
        (item) =>
          item.key === node.subworkflowKey &&
          item.status === "active" &&
          (node.subworkflowVersion === undefined ||
            item.version === node.subworkflowVersion),
      );
      if (childDefinition === undefined) {
        current.nodes[node.id] = {
          ...state,
          status: "blocked",
          note: "子流程模板不可用",
        };
        current = await this.putInstance(current);
        await this.appendEvent(current, {
          nodeId: node.id,
          kind: "subworkflow.missing",
          actor,
          message: `子流程不可用：${node.subworkflowKey}`,
        });
        continue;
      }
      const child = await this.createChildInstance(
        actor,
        current,
        node,
        childDefinition,
      );
      current.nodes[node.id] = {
        ...current.nodes[node.id]!,
        status: "running",
        childInstanceId: child.id,
      };
      current = await this.putInstance(current);
      await this.appendEvent(current, {
        nodeId: node.id,
        kind: "subworkflow.started",
        actor,
        message: `启动子流程：${child.title}`,
        data: { childInstanceId: child.id },
      });
    }
    return this.refreshStatus(current);
  }

  private async createChildInstance(
    actor: WorkflowActor,
    parent: WorkflowInstance,
    node: WorkflowNode,
    definition: WorkflowDefinition,
  ): Promise<WorkflowInstance> {
    const timestamp = iso(this.now());
    const child: WorkflowInstance = {
      id: randomUUID(),
      workspaceId: parent.workspaceId,
      definitionId: definition.id,
      definitionKey: definition.key,
      definitionVersion: definition.version,
      title: `${parent.title} · ${node.name}`,
      status: "running",
      ...(parent.sessionId === undefined
        ? {}
        : { sessionId: parent.sessionId }),
      relatedSessionIds: [...parent.relatedSessionIds],
      context: Object.fromEntries(
        definition.graph.variables.map((item) => [item.name, item.value]),
      ),
      nodes: Object.fromEntries(
        definition.graph.nodes.map((item) => [
          item.id,
          this.initialState(item, timestamp),
        ]),
      ),
      parentInstanceId: parent.id,
      parentNodeId: node.id,
      createdBy: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    for (const nodeId of definition.graph.startNodeIds) {
      child.nodes[nodeId] = {
        ...child.nodes[nodeId]!,
        status: "ready",
        enteredAt: timestamp,
      };
    }
    await this.tables.instances.put(
      child.id,
      workflowInstanceSchema.parse(child),
    );
    await this.appendEvent(child, {
      kind: "instance.started",
      actor,
      message: `由父流程启动：${parent.title}`,
    });
    return child;
  }

  private incomingEdges(
    definition: WorkflowDefinition,
    nodeId: string,
  ): WorkflowEdge[] {
    return definition.graph.edges.filter((edge) => edge.to === nodeId);
  }

  private outgoingEdges(
    definition: WorkflowDefinition,
    nodeId: string,
  ): WorkflowEdge[] {
    return definition.graph.edges.filter((edge) => edge.from === nodeId);
  }

  private skipUnmatchedBranch(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    edge: WorkflowEdge,
  ): void {
    const target = instance.nodes[edge.to];
    if (target?.status !== "waiting") return;
    const alternativeRoutes = this.incomingEdges(
      definition,
      edge.to,
    ).filter((candidate) => candidate.from !== edge.from);
    if (alternativeRoutes.length > 0) return;
    instance.nodes[edge.to] = {
      ...target,
      status: "skipped",
      note: "当前分支未命中",
      completedAt: iso(this.now()),
    };
  }

  private async advance(
    actor: WorkflowActor,
    instance: WorkflowInstance,
    completedNodeId?: string,
  ): Promise<WorkflowInstance> {
    const definition = this.tables.definitions.get(instance.definitionId);
    if (definition === undefined) return instance;
    let current = instance;
    const context = graphContext(current);
    const completed = new Set(
      Object.values(current.nodes)
        .filter(
          (state) => state.status === "completed" || state.status === "skipped",
        )
        .map((state) => state.nodeId),
    );
    for (const edge of definition.graph.edges.filter(
      (item) => item.from === completedNodeId,
    )) {
      const sourceState = current.nodes[edge.from];
      if (sourceState?.status !== "completed") continue;
      if (
        edge.result !== undefined &&
        edge.result !==
          (sourceState.note?.startsWith("rejected") ? "rejected" : "approved")
      ) {
        continue;
      }
      if (edge.condition !== undefined) {
        try {
          if (!evaluateExpression(edge.condition, context)) {
            this.skipUnmatchedBranch(current, definition, edge);
            continue;
          }
        } catch (error) {
          current.nodes[edge.to] = {
            ...current.nodes[edge.to]!,
            status: "blocked",
            note: error instanceof Error ? error.message : "条件表达式无效",
          };
          continue;
        }
      }
      if (
        !edge.default &&
        edge.result === undefined &&
        edge.condition === undefined
      ) {
        const node = definition.graph.nodes.find(
          (item) => item.id === edge.from,
        );
        if (node?.type === "decision") continue;
      }
      if (edge.default) {
        const sourceNode = definition.graph.nodes.find(
          (item) => item.id === edge.from,
        );
        const hasMatchingCondition =
          sourceNode?.type === "decision" &&
          definition.graph.edges.some(
            (candidate) =>
              candidate.from === edge.from &&
              !candidate.default &&
              candidate.condition !== undefined &&
              safeEvaluate(candidate.condition, context),
          );
        if (hasMatchingCondition) {
          this.skipUnmatchedBranch(current, definition, edge);
          continue;
        }
      }
      if (
        edge.breakCondition !== undefined &&
        safeEvaluate(edge.breakCondition, context)
      ) {
        const breakTarget = current.nodes[edge.to];
        current.nodes[edge.to] = {
          ...breakTarget!,
          status: "blocked",
          note: `已触发 break：${edge.breakCondition}`,
        };
        await this.appendEvent(current, {
          nodeId: edge.to,
          kind: "loop.break",
          actor,
          message: `已触发循环保护：${edge.breakCondition}`,
          data: { edgeId: edge.id },
        });
        continue;
      }
      const blockers = this.incomingEdges(definition, edge.to).filter(
        (candidate) => {
          const source = current.nodes[candidate.from];
          return source?.status !== "waiting" && !completed.has(candidate.from);
        },
      );
      if (blockers.length > 0) continue;
      const target = current.nodes[edge.to];
      const isReworkEdge =
        ["completed", "skipped"].includes(target?.status ?? "");
      if (
        target === undefined ||
        (!isReworkEdge &&
          ["completed", "running", "ready"].includes(target.status))
      ) {
        continue;
      }
      if (isReworkEdge) this.incrementLoopVariables(current, definition, edge);
      const visits = Number(context[`visits.${edge.to}`] ?? 0) + 1;
      context[`visits.${edge.to}`] = visits;
      context[`${edge.to}.attempts`] = visits;
      const targetNode = definition.graph.nodes.find(
        (item) => item.id === edge.to,
      );
      current.nodes[edge.to] = {
        ...target,
        ...(isReworkEdge && targetNode !== undefined
          ? this.initialState(targetNode, "")
          : {}),
        status: "ready",
        attempts: isReworkEdge
          ? Number(target?.attempts ?? 1) + 1
          : visits,
        enteredAt: iso(this.now()),
        note: undefined,
      };
    }
    current = await this.putInstance(current);
    current = await this.putInstance(this.refreshStatus(current));
    return this.startReadySubworkflows(actor, current);
  }

  private incrementLoopVariables(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    edge: WorkflowEdge,
  ): void {
    if (edge.breakCondition === undefined) return;
    const referenced = new Set(
      [...edge.breakCondition.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*/g)].map(
        (match) => match[0],
      ),
    );
    for (const variable of definition.graph.variables) {
      if (!referenced.has(variable.name)) continue;
      const value = instance.context[variable.name];
      if (typeof value === "number") {
        instance.context = {
          ...instance.context,
          [variable.name]: value + 1,
        };
      }
    }
  }

  private nodeCompleted(state: WorkflowNodeState): boolean {
    return state.status === "completed";
  }

  private normalizeDecisionBranches(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
  ): WorkflowInstance {
    const nodes = { ...instance.nodes };
    for (const node of definition.graph.nodes.filter(
      (item) => item.type === "decision",
    )) {
      const sourceState = nodes[node.id];
      if (sourceState?.status !== "completed") continue;
      const context = graphContext(instance);
      for (const edge of this.outgoingEdges(definition, node.id)) {
        if (edge.result !== undefined) continue;
        if (edge.condition !== undefined) {
          if (!safeEvaluate(edge.condition, context)) {
            this.skipUnmatchedBranch({ ...instance, nodes }, definition, edge);
          }
          continue;
        }
        if (!edge.default) continue;
        const hasMatchingCondition = definition.graph.edges.some(
          (candidate) =>
            candidate.from === node.id &&
            !candidate.default &&
            candidate.condition !== undefined &&
            safeEvaluate(candidate.condition, context),
        );
        if (hasMatchingCondition) {
          this.skipUnmatchedBranch({ ...instance, nodes }, definition, edge);
        }
      }
    }
    return { ...instance, nodes };
  }

  private refreshStatus(instance: WorkflowInstance): WorkflowInstance {
    const definition = this.tables.definitions.get(instance.definitionId);
    const normalized =
      definition === undefined
        ? instance
        : this.normalizeDecisionBranches(instance, definition);
    instance = normalized;
    const inconsistentCompletion = definition
      ? Object.entries(instance.nodes).some(([nodeId, state]) => {
          if (state.status !== "completed") return false;
            const incoming = this.incomingEdges(definition, nodeId);
            return (
              incoming.length > 0 &&
                !incoming.some((edge) =>
                  ["completed", "skipped", "ready", "running"].includes(
                    instance.nodes[edge.from]?.status ?? "",
                  ),
                )
            );
        })
      : false;
    if (inconsistentCompletion) return { ...instance, status: "blocked" };
    const states = Object.values(instance.nodes);
    if (states.some((state) => state.status === "blocked")) {
      return { ...instance, status: "blocked" };
    }
    if (states.some((state) => state.status === "failed"))
      return { ...instance, status: "failed" };
    if (
      states.every((state) => ["completed", "skipped"].includes(state.status))
    ) {
      return { ...instance, status: "completed" };
    }
    if (
      states.some((state) =>
        ["ready", "running", "waiting"].includes(state.status),
      )
    ) {
      const pendingApproval = states.some(
        (state) =>
          state.status === "waiting" &&
          Object.values(state.approvals).some(
            (item) => item.status === "pending",
          ),
      );
      return { ...instance, status: pendingApproval ? "waiting" : "running" };
    }
    return { ...instance, status: "running" };
  }

  private canAct(
    actor: WorkflowActor,
    instance: WorkflowInstance,
    node: WorkflowNode,
  ): boolean {
    return this.canSubmit(actor, node);
  }

  private canSubmit(actor: WorkflowActor, node: WorkflowNode): boolean {
    if (actor.kind !== "user") return false;
    if (isManager(actor)) return true;
    if (node.type === "service" || node.type === "subworkflow") return false;
    const responsible = node.responsible;
    if (node.executor.kind === "agent") {
      return responsible !== undefined && responsible.id === actor.id;
    }
    if (node.executor.kind === "user" && node.executor.id === actor.id)
      return true;
    return (
      responsible !== undefined &&
      responsible.kind === "user" &&
      responsible.id === actor.id
    );
  }

  private requireTargetMember(
    instance: WorkflowInstance,
    userId: string,
    action: string,
  ): void {
    const team = this.options.team?.();
    const exists =
      team
        ?.members(instance.workspaceId)
        .some((member) => member.userId === userId) ?? false;
    if (!exists) {
      throw new WorkflowError(
        "invalid_input",
        `${action}目标 ${userId} 不是当前工作区成员`,
      );
    }
  }

  private nodeSubmissions(
    instanceId: string,
    nodeId: string,
  ): WorkflowSubmission[] {
    return this.submissions(instanceId, { nodeId });
  }

  private syncDeliverableStates(instance: WorkflowInstance): WorkflowInstance {
    const definition = this.tables.definitions.get(instance.definitionId);
    if (definition === undefined) return instance;
    const nodes = { ...instance.nodes };
    for (const node of definition.graph.nodes) {
      const state = nodes[node.id];
      if (node.deliverables.length === 0 || state === undefined) continue;
      const latest = new Map(
        this.nodeSubmissions(instance.id, node.id).map((submission) => [
          submission.requirementKey,
          submission,
        ]),
      );
      const deliverables: Record<string, DeliverableState> = {};
      for (const requirement of node.deliverables) {
        const submission = latest.get(requirement.key);
        deliverables[requirement.key] = {
          requirementKey: requirement.key,
          status: submission?.status ?? "pending",
          ...(submission === undefined
            ? {}
            : {
                latestSubmissionId: submission.id,
                submittedAt: submission.submittedAt,
                submittedBy: submission.submittedBy,
                ...(submission.onBehalfOf === undefined
                  ? {}
                  : { onBehalfOf: submission.onBehalfOf }),
              }),
        };
      }
      nodes[node.id] = { ...state, deliverables };
    }
    return { ...instance, nodes };
  }

  private missingDeliverables(
    node: WorkflowNode,
    state: WorkflowNodeState,
  ): DeliverableRequirement[] {
    return node.deliverables.filter((requirement) => {
      if (!requirement.required) return false;
      const current = state.deliverables[requirement.key];
      return current === undefined || current.status !== "submitted";
    });
  }

  artifactRoot(): string {
    if (this.options.artifactRoot !== undefined)
      return this.options.artifactRoot;
    const home = process.env.DSH_HOME;
    if (home === undefined || home === "")
      return resolve(".pluginmax/workflow-artifacts");
    return resolve(home, "pluginmax/workflow-artifacts");
  }

  private async storeArtifact(
    instance: WorkflowInstance,
    nodeId: string,
    submissionId: string,
    file: {
      readonly fileName: string;
      readonly mimeType: string;
      readonly data: Buffer;
    },
  ): Promise<WorkflowSubmission["artifacts"][number]> {
    const root = this.artifactRoot();
    const relativePath = join(
      instance.workspaceId,
      instance.id,
      nodeId,
      submissionId,
      file.fileName,
    );
    const lexical = resolve(root, relativePath);
    if (!isAbsolute(root) || !resolve(root).length) {
      throw new WorkflowError("invalid_input", "artifact root is invalid");
    }
    if (
      !lexical.startsWith(
        resolve(root) + (resolve(root).endsWith("/") ? "" : "/"),
      )
    ) {
      throw new WorkflowError(
        "forbidden",
        "artifact path escapes storage root",
      );
    }
    await mkdir(dirname(lexical), { recursive: true });
    const realRoot = await realpath(root);
    const realParent = await realpath(dirname(lexical));
    if (!realParent.startsWith(realRoot)) {
      throw new WorkflowError(
        "forbidden",
        "artifact path escapes storage root",
      );
    }
    await writeFile(lexical, file.data, { flag: "wx" });
    const realFile = await realpath(lexical);
    if (!realFile.startsWith(realRoot)) {
      throw new WorkflowError(
        "forbidden",
        "artifact path escapes storage root",
      );
    }
    return {
      id: randomUUID(),
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.data.byteLength,
      checksum: createHash("sha256").update(file.data).digest("hex"),
      storagePath: relative(realRoot, realFile),
    };
  }

  submitDeliverable(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      requirementKey: string;
      type: "text" | "link";
      value: string;
      note?: string | undefined;
    },
  ): Promise<WorkflowSubmission> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      const requirement = node.deliverables.find(
        (item) => item.key === input.requirementKey,
      );
      if (requirement === undefined)
        throw new WorkflowError(
          "not_found",
          "deliverable requirement not found",
        );
      if (requirement.type !== input.type)
        throw new WorkflowError(
          "invalid_input",
          "deliverable type does not match",
        );
      const state = instance.nodes[input.nodeId]!;
      if (!["ready", "running", "waiting"].includes(state.status))
        throw new WorkflowError(
          "conflict",
          "node is not accepting deliverables",
        );
      if (!this.canSubmit(actor, node))
        throw new WorkflowError(
          "forbidden",
          "you cannot submit this deliverable",
        );
      const value = input.value.trim();
      if (
        input.type === "text" &&
        value.length < (requirement.minTextLength ?? 1)
      )
        throw new WorkflowError(
          "invalid_input",
          `this deliverable needs at least ${requirement.minTextLength ?? 1} characters`,
        );
      if (input.type === "link") {
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol))
            throw new Error("protocol");
        } catch {
          throw new WorkflowError(
            "invalid_input",
            "a valid http(s) link is required",
          );
        }
      }
      const onBehalfOf =
        node.executor.kind === "agent" ? node.executor.id : undefined;
      const record: WorkflowSubmission = {
        id: randomUUID(),
        workspaceId: instance.workspaceId,
        instanceId: instance.id,
        nodeId: node.id,
        requirementKey: requirement.key,
        requirementTitle: requirement.title,
        type: input.type,
        value,
        artifacts: [],
        submittedBy: actor.id,
        submittedByName: actor.name ?? actor.id,
        ...(onBehalfOf === undefined ? {} : { onBehalfOf }),
        submittedAt: iso(this.now()),
        status: "submitted",
        ...(input.note === undefined ? {} : { note: input.note }),
      };
      const saved = await this.tables.submissions
        .put(record.id, workflowSubmissionSchema.parse(record))
        .then(() => record);
      await this.putInstance(this.syncDeliverableStates(instance));
      await this.appendEvent(instance, {
        nodeId: node.id,
        kind: "deliverable.submitted",
        actor,
        message: `提交交付物：${requirement.title}`,
        data: {
          requirementKey: requirement.key,
          submissionId: saved.id,
          ...(onBehalfOf === undefined ? {} : { onBehalfOf }),
        },
      });
      return saved;
    });
  }

  submitDeliverableFiles(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      requirementKey: string;
      note?: string | undefined;
      files: Array<{
        fileName: string;
        mimeType: string;
        data: Buffer;
      }>;
    },
  ): Promise<WorkflowSubmission> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      const requirement = node.deliverables.find(
        (item) => item.key === input.requirementKey,
      );
      if (requirement === undefined)
        throw new WorkflowError(
          "not_found",
          "deliverable requirement not found",
        );
      if (requirement.type !== "file")
        throw new WorkflowError(
          "invalid_input",
          "deliverable type does not match",
        );
      if (input.files.length === 0 || input.files.length > requirement.maxFiles)
        throw new WorkflowError(
          "invalid_input",
          `upload 1-${requirement.maxFiles} file${requirement.maxFiles === 1 ? "" : "s"}`,
        );
      const state = instance.nodes[input.nodeId]!;
      if (!["ready", "running", "waiting"].includes(state.status))
        throw new WorkflowError(
          "conflict",
          "node is not accepting deliverables",
        );
      if (!this.canSubmit(actor, node))
        throw new WorkflowError(
          "forbidden",
          "you cannot submit this deliverable",
        );
      for (const file of input.files) {
        if (file.data.byteLength > 20 * 1024 * 1024)
          throw new WorkflowError(
            "invalid_input",
            "each file must be 20MB or smaller",
          );
        if (requirement.accept.length > 0) {
          const extension = file.fileName
            .slice(file.fileName.lastIndexOf("."))
            .toLowerCase();
          if (!requirement.accept.includes(extension))
            throw new WorkflowError(
              "invalid_input",
              `allowed file types: ${requirement.accept.join(", ")}`,
            );
        }
      }
      const submissionId = randomUUID();
      const artifacts = [];
      let bytes = 0;
      for (const file of input.files) {
        bytes += file.data.byteLength;
        artifacts.push(
          await this.storeArtifact(instance, node.id, submissionId, file),
        );
      }
      const existingBytes = this.submissions(instance.id).reduce(
        (total, submission) =>
          total +
          submission.artifacts.reduce(
            (sum, artifact) => sum + artifact.size,
            0,
          ),
        0,
      );
      if (existingBytes + bytes > 100 * 1024 * 1024)
        throw new WorkflowError(
          "conflict",
          "workflow artifact storage limit reached",
        );
      const onBehalfOf =
        node.executor.kind === "agent" ? node.executor.id : undefined;
      const record: WorkflowSubmission = {
        id: submissionId,
        workspaceId: instance.workspaceId,
        instanceId: instance.id,
        nodeId: node.id,
        requirementKey: requirement.key,
        requirementTitle: requirement.title,
        type: "file",
        value: "",
        artifacts,
        submittedBy: actor.id,
        submittedByName: actor.name ?? actor.id,
        ...(onBehalfOf === undefined ? {} : { onBehalfOf }),
        submittedAt: iso(this.now()),
        status: "submitted",
        ...(input.note === undefined ? {} : { note: input.note }),
      };
      await this.tables.submissions.put(
        record.id,
        workflowSubmissionSchema.parse(record),
      );
      await this.putInstance(this.syncDeliverableStates(instance));
      await this.appendEvent(instance, {
        nodeId: node.id,
        kind: "deliverable.submitted",
        actor,
        message: `提交交付物：${requirement.title}`,
        data: {
          requirementKey: requirement.key,
          submissionId: record.id,
          fileNames: input.files.map((file) => file.fileName),
          ...(onBehalfOf === undefined ? {} : { onBehalfOf }),
        },
      });
      return record;
    });
  }

  rejectSubmission(
    actor: WorkflowActor,
    input: { submissionId: string; note?: string | undefined },
  ): Promise<WorkflowSubmission> {
    return this.enqueue(async () => {
      if (!isManager(actor))
        throw new WorkflowError(
          "forbidden",
          "workspace owner or admin is required",
        );
      const submission = this.tables.submissions.get(input.submissionId);
      if (submission === undefined)
        throw new WorkflowError("not_found", "submission not found");
      if (submission.status === "rejected")
        throw new WorkflowError("conflict", "submission was already rejected");
      const next: WorkflowSubmission = {
        ...submission,
        status: "rejected",
        ...(input.note === undefined ? {} : { note: input.note }),
      };
      await this.tables.submissions.put(next.id, next);
      const instance = this.instance(submission.instanceId);
      if (instance !== undefined) {
        await this.putInstance(this.syncDeliverableStates(instance));
        await this.appendEvent(instance, {
          nodeId: submission.nodeId,
          kind: "deliverable.rejected",
          actor,
          message: `退回交付物：${submission.requirementTitle}`,
          data: { submissionId: submission.id },
        });
      }
      return next;
    });
  }

  completeNode(
    actor: WorkflowActor,
    input: { instanceId: string; nodeId: string; note?: string | undefined },
  ): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      if (node.type === "approval") {
        return this.decideApproval(actor, {
          instanceId: input.instanceId,
          nodeId: input.nodeId,
          decision: "approved",
          note: input.note,
        });
      }
      const synced = this.syncDeliverableStates(instance);
      const currentState = synced.nodes[input.nodeId]!;
      if (currentState.status !== "ready") {
        throw new WorkflowError(
          "conflict",
          currentState.status === "waiting"
            ? "node is waiting for upstream nodes"
            : "node is not actionable",
        );
      }
      if (!this.canAct(actor, instance, node)) {
        throw new WorkflowError("forbidden", "you cannot complete this node");
      }
      const missing = this.missingDeliverables(node, currentState);
      if (missing.length > 0) {
        throw new WorkflowError(
          "missing_deliverables",
          `缺少 ${missing.length} 项必交交付物：${missing.map((item) => item.title).join("、")}`,
        );
      }
      const timestamp = iso(this.now());
      instance.nodes[input.nodeId] = {
        ...currentState,
        status: "completed",
        completedAt: timestamp,
        note: input.note,
      };
      const saved = await this.putInstance(this.refreshStatus(instance));
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: "node.completed",
        actor,
        message: `完成节点：${node.name}`,
        data: {
          ...(input.note === undefined ? {} : { note: input.note }),
          ...(node.deliverables.length === 0
            ? {}
            : {
                deliverableSnapshot: node.deliverables.map((requirement) => ({
                  key: requirement.key,
                  status: currentState.deliverables[requirement.key]?.status,
                  submissionId:
                    currentState.deliverables[requirement.key]
                      ?.latestSubmissionId,
                })),
              }),
          ...(node.executor.kind === "agent"
            ? { onBehalfOf: node.executor.id }
            : {}),
        },
      });
      await this.resumeParentIfCompleted(actor, saved);
      return this.advance(actor, saved, node.id);
    });
  }

  decideApproval(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      decision: "approved" | "rejected";
      note?: string | undefined;
    },
  ): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      if (node.type !== "approval")
        throw new WorkflowError("invalid_input", "node is not an approval");
      const state = instance.nodes[input.nodeId]!;
      if (state.status !== "ready" && state.status !== "waiting") {
        throw new WorkflowError("conflict", "approval is not actionable");
      }
      const approvalKey = Object.keys(state.approvals).find((key) =>
        actorMatchesApprover(actor, state.approvals[key]!.approver),
      );
      if (approvalKey === undefined && !isManager(actor)) {
        throw new WorkflowError("forbidden", "you are not an approver");
      }
      if (approvalKey === undefined) {
        throw new WorkflowError(
          "forbidden",
          "approval delegation does not grant implicit admin approval",
        );
      }
      if (state.approvals[approvalKey]!.status !== "pending") {
        throw new WorkflowError("conflict", "approval was already decided");
      }
      const timestamp = iso(this.now());
      instance.nodes[input.nodeId] = {
        ...state,
        approvals: {
          ...state.approvals,
          [approvalKey]: {
            ...state.approvals[approvalKey]!,
            status: input.decision === "approved" ? "approved" : "rejected",
            at: timestamp,
            note: input.note,
          },
        },
      };
      const nextState = instance.nodes[input.nodeId]!;
      const decisions = Object.values(nextState.approvals);
      if (
        input.decision === "rejected" ||
        (node.approvalPolicy === "any" &&
          decisions.some((item) => item.status === "approved")) ||
        (node.approvalPolicy === "all" &&
          decisions.every((item) => item.status === "approved"))
      ) {
        instance.nodes[input.nodeId] = {
          ...nextState,
          status: "completed",
          completedAt: timestamp,
          note:
            input.decision === "rejected"
              ? `rejected:${input.note ?? ""}`
              : input.note,
        };
      } else {
        instance.nodes[input.nodeId] = { ...nextState, status: "waiting" };
      }
      const saved = await this.putInstance(this.refreshStatus(instance));
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: `approval.${input.decision}`,
        actor,
        message: `${input.decision === "approved" ? "通过" : "否决"}审批：${node.name}`,
        ...(input.note === undefined ? {} : { data: { note: input.note } }),
      });
      await this.resumeParentIfCompleted(actor, saved);
      return this.advance(actor, saved, node.id);
    });
  }

  delegateApproval(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      toId: string;
      toName: string;
      note?: string | undefined;
    },
  ): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      if (node.type !== "approval")
        throw new WorkflowError("invalid_input", "node is not an approval");
      const state = instance.nodes[input.nodeId]!;
      const key = Object.keys(state.approvals).find((candidate) =>
        actorMatchesApprover(actor, state.approvals[candidate]!.approver),
      );
      if (key === undefined)
        throw new WorkflowError(
          "forbidden",
          "only the current approver can delegate",
        );
      if (state.approvals[key]!.status !== "pending") {
        throw new WorkflowError("conflict", "approval was already decided");
      }
      this.requireTargetMember(instance, input.toId, "转交");
      if (state.approvals[`${node.id}:${input.toId}`] !== undefined) {
        throw new WorkflowError("conflict", "target approver already exists");
      }
      const timestamp = iso(this.now());
      const newApprover: Approver = {
        kind: "user",
        id: input.toId,
        name: input.toName,
      };
      instance.nodes[input.nodeId] = {
        ...state,
        approvals: {
          ...state.approvals,
          [key]: {
            ...state.approvals[key]!,
            status: "delegated",
            at: timestamp,
            note: input.note,
          },
          [`${node.id}:${input.toId}`]: {
            approver: newApprover,
            status: "pending",
          },
        },
      };
      const saved = await this.putInstance(instance);
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: "approval.delegated",
        actor,
        message: `转交审批：${node.name} → ${input.toName}`,
      });
      return saved;
    });
  }

  countersignApproval(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      toId: string;
      toName: string;
      note?: string | undefined;
    },
  ): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      if (node.type !== "approval")
        throw new WorkflowError("invalid_input", "node is not an approval");
      const state = instance.nodes[input.nodeId]!;
      const initiatorKey = Object.keys(state.approvals).find((candidate) => {
        const approval = state.approvals[candidate]!;
        return (
          approval.status === "pending" &&
          actorMatchesApprover(actor, approval.approver)
        );
      });
      if (initiatorKey === undefined) {
        throw new WorkflowError(
          "forbidden",
          "only the current pending approver can countersign",
        );
      }
      this.requireTargetMember(instance, input.toId, "加签");
      if (state.status !== "waiting" && state.status !== "ready") {
        throw new WorkflowError("conflict", "approval is not open");
      }
      const key = `${node.id}:${input.toId}`;
      if (state.approvals[key] !== undefined) {
        throw new WorkflowError("conflict", "approver already exists");
      }
      instance.nodes[input.nodeId] = {
        ...state,
        status: "waiting",
        approvals: {
          ...state.approvals,
          [key]: {
            approver: { kind: "user", id: input.toId, name: input.toName },
            status: "pending",
            note: input.note,
          },
        },
      };
      const saved = await this.putInstance(instance);
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: "approval.countersigned",
        actor,
        message: `加签审批：${node.name} + ${input.toName}`,
      });
      return saved;
    });
  }

  resolveDecision(
    actor: WorkflowActor,
    input: {
      instanceId: string;
      nodeId: string;
      values: Record<string, string | number | boolean>;
      note?: string | undefined;
    },
  ): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const { instance, node } = this.requireNode(
        this.instance(input.instanceId),
        input.nodeId,
      );
      if (node.type !== "decision")
        throw new WorkflowError("invalid_input", "node is not a decision");
      const state = instance.nodes[input.nodeId]!;
      if (!["ready", "waiting"].includes(state.status)) {
        throw new WorkflowError("conflict", "decision is not actionable");
      }
      const timestamp = iso(this.now());
      instance.context = { ...instance.context, ...input.values };
      instance.nodes[input.nodeId] = {
        ...state,
        status: "completed",
        completedAt: timestamp,
        note: input.note,
      };
      const saved = await this.putInstance(instance);
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: "decision.resolved",
        actor,
        message: `完成判断节点：${node.name}`,
        data: input.values,
      });
      return this.advance(actor, saved, node.id);
    });
  }

  async setDefinitionStatus(
    actor: WorkflowActor,
    input: {
      workspaceId: string;
      definitionId: string;
      status: "active" | "archived";
    },
  ): Promise<WorkflowDefinition> {
    if (!isManager(actor)) {
      throw new WorkflowError(
        "forbidden",
        "workspace owner or admin is required",
      );
    }
    return this.enqueue(async () => {
      const definition = this.definition(input.definitionId);
      if (
        definition === undefined ||
        definition.workspaceId !== input.workspaceId
      ) {
        throw new WorkflowError("not_found", "workflow definition not found");
      }
      const timestamp = iso(this.now());
      if (input.status === "active") {
        for (const item of this.definitions(input.workspaceId).filter(
          (candidate) =>
            candidate.key === definition.key &&
            candidate.status === "active" &&
            candidate.id !== definition.id,
        )) {
          await this.tables.definitions.put(item.id, {
            ...item,
            status: "archived",
            updatedAt: timestamp,
          });
        }
      }
      const next = {
        ...definition,
        status: input.status,
        updatedAt: timestamp,
      };
      await this.tables.definitions.put(
        next.id,
        workflowDefinitionSchema.parse(next),
      );
      await this.appendEvent(
        {
          id: next.id,
          workspaceId: next.workspaceId,
        },
        {
          kind: `definition.${input.status}`,
          actor,
          message: `${input.status === "active" ? "启用" : "归档"}模板：${next.name} v${next.version}`,
        },
      );
      return next;
    });
  }

  cancel(actor: WorkflowActor, instanceId: string): Promise<WorkflowInstance> {
    return this.enqueue(async () => {
      const instance = this.instance(instanceId);
      if (instance === undefined)
        throw new WorkflowError("not_found", "workflow instance not found");
      if (
        !isManager(actor) &&
        instance.createdBy !== actor.id &&
        actor.kind !== "agent"
      ) {
        throw new WorkflowError(
          "forbidden",
          "only creator or manager can cancel",
        );
      }
      if (["completed", "cancelled"].includes(instance.status)) {
        throw new WorkflowError("conflict", "workflow is already closed");
      }
      const timestamp = iso(this.now());
      for (const [nodeId, state] of Object.entries(instance.nodes)) {
        if (["completed", "skipped"].includes(state.status)) continue;
        instance.nodes[nodeId] = {
          ...state,
          status: "skipped",
          completedAt: timestamp,
        };
      }
      instance.status = "cancelled";
      const saved = await this.putInstance(instance);
      await this.appendEvent(saved, {
        kind: "instance.cancelled",
        actor,
        message: `取消工作流：${instance.title}`,
      });
      return saved;
    });
  }

  private async resumeParentIfCompleted(
    actor: WorkflowActor,
    child: WorkflowInstance,
  ): Promise<void> {
    if (
      child.parentInstanceId === undefined ||
      child.parentNodeId === undefined
    )
      return;
    if (
      child.status !== "completed" &&
      child.status !== "failed" &&
      child.status !== "cancelled"
    )
      return;
    const parent = this.instance(child.parentInstanceId);
    const definition =
      parent === undefined
        ? undefined
        : this.tables.definitions.get(parent.definitionId);
    const node = definition?.graph.nodes.find(
      (item) => item.id === child.parentNodeId,
    );
    if (parent === undefined || node === undefined) return;
    const state = parent.nodes[child.parentNodeId]!;
    if (state.status !== "running" || state.childInstanceId !== child.id)
      return;
    if (child.status === "completed") {
      parent.nodes[child.parentNodeId] = {
        ...state,
        status: "completed",
        completedAt: iso(this.now()),
        note: "子流程已完成",
      };
      const saved = await this.putInstance(parent);
      await this.appendEvent(saved, {
        nodeId: node.id,
        kind: "subworkflow.completed",
        actor,
        message: `子流程完成：${child.title}`,
      });
      await this.advance(actor, saved, node.id);
      return;
    }
    parent.nodes[child.parentNodeId] = {
      ...state,
      status: "blocked",
      note: child.status === "failed" ? "子流程失败" : "子流程已取消",
    };
    const saved = await this.putInstance(parent);
    await this.appendEvent(saved, {
      nodeId: node.id,
      kind: "subworkflow.blocked",
      actor,
      message: `子流程${child.status === "failed" ? "失败" : "取消"}：${child.title}`,
    });
    await this.putInstance(this.refreshStatus(saved));
  }

  private requireNode(
    instance: WorkflowInstance | undefined,
    nodeId: string,
  ): {
    instance: WorkflowInstance;
    node: WorkflowNode;
  } {
    if (instance === undefined)
      throw new WorkflowError("not_found", "workflow instance not found");
    const definition = this.tables.definitions.get(instance.definitionId);
    const node = definition?.graph.nodes.find((item) => item.id === nodeId);
    const state = instance.nodes[nodeId];
    if (definition === undefined || node === undefined || state === undefined) {
      throw new WorkflowError("not_found", "workflow node not found");
    }
    return { instance, node };
  }
}

function browserActor(
  team: TeamServiceLike,
  request: IncomingMessage,
  workspaceId: string,
): WorkflowActor {
  const headers = request.headers;
  if (
    headers.origin !== undefined &&
    !sameOrigin(headers.origin, headers.host)
  ) {
    throw new WorkflowError("forbidden", "same-origin requests are required");
  }
  const token = bearerToken({
    get: (name) =>
      name === "authorization" ? (headers.authorization ?? null) : null,
  });
  if (token === undefined)
    throw new WorkflowError("unauthorized", "bearer token is required");
  const principal = team.resolveToken(token);
  if (principal === undefined)
    throw new WorkflowError("unauthorized", "invalid bearer token");
  const member = team
    .members(workspaceId)
    .find((candidate) => candidate.userId === principal.userId);
  if (member === undefined && principal.role !== "admin") {
    throw new WorkflowError("forbidden", "workspace member role is required");
  }
  return {
    kind: "user",
    id: principal.userId,
    globalRole: principal.role,
    ...(member?.name === undefined ? {} : { name: member.name }),
    ...(member?.memberRole === undefined
      ? {}
      : { workspaceRole: member.memberRole }),
  };
}

function errorStatus(code: WorkflowError["code"]): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "missing_deliverables") return 409;
  if (code === "method_not_allowed") return 405;
  return 400;
}

async function runHandler(
  operation: () => Promise<void>,
  response: ServerResponse,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof WorkflowError) {
      sendJson(response, errorStatus(error.code), {
        ok: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "workflow operation failed" },
    });
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  try {
    return await readJsonBody(request);
  } catch {
    throw new WorkflowError("invalid_input", "valid JSON body is required");
  }
}

interface MultipartBody {
  fields: Map<string, string>;
  files: Array<{
    fieldName: string;
    fileName: string;
    mimeType: string;
    data: Buffer;
  }>;
}

async function readMultipart(
  request: IncomingMessage,
  maxBytes = 22 * 1024 * 1024,
): Promise<MultipartBody> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string")
    throw new WorkflowError("invalid_input", "multipart body is required");
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const delimiter = `--${boundary?.[1] ?? boundary?.[2]?.trim() ?? ""}`;
  if (delimiter === "--")
    throw new WorkflowError("invalid_input", "multipart boundary is required");
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new WorkflowError("invalid_input", "upload is too large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    size += buffer.byteLength;
    if (size > maxBytes)
      throw new WorkflowError("invalid_input", "upload is too large");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  const result: MultipartBody = { fields: new Map(), files: [] };
  const decoder = new TextDecoder();
  let position = body.indexOf(delimiter);
  while (position >= 0) {
    const lineEnd = body.indexOf("\r\n", position);
    if (lineEnd < 0) break;
    const start = lineEnd + 2;
    const next = body.indexOf(delimiter, start);
    if (next < 0) break;
    const part = body.subarray(start, Math.max(start, next - 2));
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const headers = decoder
        .decode(part.subarray(0, headerEnd))
        .split(/\r\n/)
        .filter(Boolean);
      const disposition = headers.find((item) =>
        item.toLowerCase().startsWith("content-disposition:"),
      );
      const nameMatch = /name="([^"]*)"/.exec(disposition ?? "");
      const fileMatch = /filename="([^"]*)"/.exec(disposition ?? "");
      const data = part.subarray(headerEnd + 4);
      const contentTypeHeader = headers
        .find((item) => item.toLowerCase().startsWith("content-type:"))
        ?.split(":")
        .slice(1)
        .join(":")
        .trim();
      const fieldName = nameMatch?.[1]?.trim() ?? "";
      const uploadedName = fileMatch?.[1];
      if (uploadedName !== undefined && uploadedName !== "") {
        let fileName = uploadedName.replaceAll("\\", "/");
        fileName = fileName.slice(fileName.lastIndexOf("/") + 1).trim();
        if (
          fileName === "" ||
          fileName.startsWith(".") ||
          ["\u0000", "\r", "\n"].some((character) =>
            fileName.includes(character),
          )
        )
          throw new WorkflowError(
            "invalid_input",
            "an uploaded file has an invalid name",
          );
        if (fileName.length > 255) fileName = fileName.slice(-255);
        result.files.push({
          fieldName,
          fileName,
          mimeType: contentTypeHeader || "application/octet-stream",
          data,
        });
      } else if (fieldName !== "") {
        result.fields.set(fieldName, decoder.decode(data));
      }
    }
    position = next;
  }
  return result;
}

function queryParam(
  request: IncomingMessage,
  name: string,
): string | undefined {
  return (
    new URL(request.url ?? "/", "http://localhost").searchParams.get(name) ??
    undefined
  );
}

function requireWorkspace(request: IncomingMessage): string {
  const value = queryParam(request, "workspaceId");
  if (value === undefined || value === "") {
    throw new WorkflowError("invalid_input", "workspaceId is required");
  }
  return value;
}

const actionBodySchema = z
  .object({
    instanceId: z.string().min(1),
    nodeId: z.string().min(1),
  })
  .loose();

export function createWorkflowRoutes(
  service: WorkflowService,
  team: () => TeamServiceLike | undefined,
): WebRouteLike[] {
  const requireTeam = (): TeamServiceLike => {
    const value = team();
    if (value === undefined)
      throw new WorkflowError("not_found", "identity service is unavailable");
    return value;
  };
  const routes: WebRouteLike[] = [
    {
      kind: "exact",
      path: "/api/collab/workflow/definitions",
      handler: (request, response) => {
        assertMethod(request, response, "GET");
        const workspaceId = requireWorkspace(request);
        const actor = browserActor(requireTeam(), request, workspaceId);
        sendJson(response, 200, {
          ok: true,
          definitions: service.definitions(workspaceId),
          actor,
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/definitions/validate",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({ workspaceId: z.string(), sourceMd: z.string() })
          .parse(await readBody(request));
        const actor = browserActor(requireTeam(), request, body.workspaceId);
        if (!isManager(actor))
          throw new WorkflowError(
            "forbidden",
            "workspace owner or admin is required",
          );
        const result = service.validate(body.sourceMd, body.workspaceId);
        sendJson(response, 200, { ok: true, ...result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/definitions/import",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            workspaceId: z.string(),
            sourceMd: z.string(),
            activate: z.boolean().default(true),
          })
          .parse(await readBody(request));
        const actor = browserActor(requireTeam(), request, body.workspaceId);
        const definition = await service.importDefinition(actor, body);
        sendJson(response, 201, { ok: true, definition });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/instances",
      handler: (request, response) => {
        assertMethod(request, response, "GET");
        const workspaceId = requireWorkspace(request);
        const actor = browserActor(requireTeam(), request, workspaceId);
        const sessionId = queryParam(request, "sessionId");
        sendJson(response, 200, {
          ok: true,
          instances: service.instances(
            workspaceId,
            sessionId === undefined ? {} : { sessionId },
          ),
          actor,
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/instances/detail",
      handler: (request, response) => {
        assertMethod(request, response, "GET");
        const workspaceId = requireWorkspace(request);
        const actor = browserActor(requireTeam(), request, workspaceId);
        const instanceId = queryParam(request, "instanceId");
        if (instanceId === undefined)
          throw new WorkflowError("invalid_input", "instanceId is required");
        const instance = service.instanceView(instanceId);
        if (instance === undefined || instance.workspaceId !== workspaceId) {
          throw new WorkflowError("not_found", "workflow instance not found");
        }
        sendJson(response, 200, {
          ok: true,
          instance,
          submissions: service.submissions(instanceId),
          events: service.events(instanceId),
          actor,
        });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/deliverables/text",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            instanceId: z.string().min(1),
            nodeId: z.string().min(1),
            requirementKey: z.string().min(1),
            value: z.string().max(100_000),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const submission = await service.submitDeliverable(actor, {
          instanceId: body.instanceId,
          nodeId: body.nodeId,
          requirementKey: body.requirementKey,
          type: "text",
          value: body.value,
          note: body.note,
        });
        sendJson(response, 201, { ok: true, submission });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/deliverables/link",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            instanceId: z.string().min(1),
            nodeId: z.string().min(1),
            requirementKey: z.string().min(1),
            value: z.string().min(1).max(2_048),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const submission = await service.submitDeliverable(actor, {
          instanceId: body.instanceId,
          nodeId: body.nodeId,
          requirementKey: body.requirementKey,
          type: "link",
          value: body.value,
          note: body.note,
        });
        sendJson(response, 201, { ok: true, submission });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/deliverables/file",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const multipart = await readMultipart(request);
        const instanceId = multipart.fields.get("instanceId") ?? "";
        const nodeId = multipart.fields.get("nodeId") ?? "";
        const requirementKey = multipart.fields.get("requirementKey") ?? "";
        const note = multipart.fields.get("note") || undefined;
        if (instanceId === "" || nodeId === "" || requirementKey === "")
          throw new WorkflowError("invalid_input", "missing upload fields");
        const instance = service.instance(instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const submission = await service.submitDeliverableFiles(actor, {
          instanceId,
          nodeId,
          requirementKey,
          note,
          files: multipart.files.map((file) => ({
            fileName: file.fileName,
            mimeType: file.mimeType,
            data: file.data,
          })),
        });
        sendJson(response, 201, { ok: true, submission });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/deliverables/download",
      handler: async (request, response) => {
        assertMethod(request, response, "GET");
        const submissionId = queryParam(request, "submissionId");
        const artifactId = queryParam(request, "artifactId");
        if (submissionId === undefined)
          throw new WorkflowError("invalid_input", "submissionId is required");
        const record = service.submission(submissionId);
        if (record === undefined)
          throw new WorkflowError("not_found", "submission not found");
        browserActor(requireTeam(), request, record.workspaceId);
        const artifact =
          record.artifacts.find((item) => item.id === artifactId) ??
          record.artifacts[0];
        if (artifact === undefined)
          throw new WorkflowError("not_found", "artifact not found");
        const root = resolve(service.artifactRoot());
        const target = resolve(root, artifact.storagePath);
        const realRoot = await realpath(root);
        const realFile = await realpath(target);
        if (!realFile.startsWith(realRoot))
          throw new WorkflowError(
            "forbidden",
            "artifact path escapes storage root",
          );
        const data = await readFile(realFile);
        const asciiName = artifact.fileName
          .replace(/[^\x20-\x7e]/g, "_")
          .replace(/"/g, "_");
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": String(data.byteLength),
          "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`,
          "x-content-type-options": "nosniff",
          "cache-control": "no-store",
        });
        response.end(data);
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/deliverables/reject",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            submissionId: z.string().min(1),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const record = service.submission(body.submissionId);
        if (record === undefined)
          throw new WorkflowError("not_found", "submission not found");
        const actor = browserActor(requireTeam(), request, record.workspaceId);
        const submission = await service.rejectSubmission(actor, body);
        sendJson(response, 200, { ok: true, submission });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/instances/start",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            workspaceId: z.string(),
            definitionId: z.string().optional(),
            title: z.string().min(1).max(160),
            sessionId: z.string().optional(),
            relatedSessionIds: z.array(z.string()).default([]),
            context: z
              .record(
                z.string(),
                z.union([z.string(), z.number(), z.boolean()]),
              )
              .default({}),
          })
          .parse(await readBody(request));
        const actor = browserActor(requireTeam(), request, body.workspaceId);
        const instance = await service.startInstance(actor, body);
        sendJson(response, 201, { ok: true, instance });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/nodes/complete",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = actionBodySchema.parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.completeNode(actor, {
          instanceId: body.instanceId,
          nodeId: body.nodeId,
          note: typeof body.note === "string" ? body.note : undefined,
        });
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/approvals/decide",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = actionBodySchema
          .extend({
            decision: z.enum(["approved", "rejected"]),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.decideApproval(actor, body);
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/approvals/delegate",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = actionBodySchema
          .extend({
            toId: z.string().min(1),
            toName: z.string().min(1),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.delegateApproval(actor, body);
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/approvals/countersign",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = actionBodySchema
          .extend({
            toId: z.string().min(1),
            toName: z.string().min(1),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.countersignApproval(actor, body);
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/decisions/resolve",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = actionBodySchema
          .extend({
            values: z.record(
              z.string(),
              z.union([z.string(), z.number(), z.boolean()]),
            ),
            note: z.string().max(500).optional(),
          })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.resolveDecision(actor, {
          instanceId: body.instanceId,
          nodeId: body.nodeId,
          values: body.values,
          note: body.note,
        });
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/instances/cancel",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({ instanceId: z.string() })
          .parse(await readBody(request));
        const instance = service.instance(body.instanceId);
        if (instance === undefined)
          throw new WorkflowError("not_found", "workflow instance not found");
        const actor = browserActor(
          requireTeam(),
          request,
          instance.workspaceId,
        );
        const result = await service.cancel(actor, body.instanceId);
        sendJson(response, 200, { ok: true, instance: result });
      },
    },
    {
      kind: "exact",
      path: "/api/collab/workflow/definitions/status",
      handler: async (request, response) => {
        assertMethod(request, response, "POST");
        const body = z
          .object({
            workspaceId: z.string(),
            definitionId: z.string(),
            status: z.enum(["active", "archived"]),
          })
          .parse(await readBody(request));
        const actor = browserActor(requireTeam(), request, body.workspaceId);
        const definition = await service.setDefinitionStatus(actor, body);
        sendJson(response, 200, { ok: true, definition });
      },
    },
  ];

  return routes.map((route) => ({
    ...route,
    handler: (request: IncomingMessage, response: ServerResponse) =>
      runHandler(async () => route.handler(request, response), response),
  }));
}

function assertMethod(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
): void {
  if (request.method !== method) {
    throw new WorkflowError("method_not_allowed", "method not allowed");
  }
}

function agentActor(exec: ToolExecLike): WorkflowActor {
  return {
    kind: "agent",
    id: exec.session?.id ?? "agent",
    name: "Agent",
    sessionId: exec.session?.id,
    workspaceRole: "member",
  };
}

async function agentWorkflowAction(
  service: WorkflowService,
  exec: ToolExecLike,
  input: string,
): Promise<string> {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const command = parts.shift();
  const actor = agentActor(exec);
  if (command === "list") {
    const workspaceId = parts.shift();
    if (workspaceId === undefined)
      throw new WorkflowError(
        "invalid_input",
        "usage: /workflow list <workspaceId>",
      );
    return (
      service
        .instances(workspaceId)
        .slice(0, 20)
        .map(
          (instance) => `${instance.title}\t${instance.status}\t${instance.id}`,
        )
        .join("\n") || "no workflow instances"
    );
  }
  if (command === undefined)
    throw new WorkflowError(
      "invalid_input",
      "usage: /workflow <list|complete|approve> ...",
    );
  if (command === "complete" || command === "approve") {
    const [instanceId, nodeId] = parts;
    if (instanceId === undefined || nodeId === undefined) {
      throw new WorkflowError(
        "invalid_input",
        `usage: /workflow ${command} <instanceId> <nodeId>`,
      );
    }
    const result =
      command === "complete"
        ? await service.completeNode(actor, { instanceId, nodeId })
        : await service.decideApproval(actor, {
            instanceId,
            nodeId,
            decision: "approved",
          });
    return `updated ${result.title}: ${nodeId} ${result.status}`;
  }
  throw new WorkflowError(
    "invalid_input",
    `unknown workflow action: ${command}`,
  );
}

export async function apply(
  ctx: WorkflowContext,
): Promise<void | (() => void)> {
  const domain = await ctx.storageDomain.open(workflowDomainSpec);
  let injectedTeam: TeamServiceLike | undefined;
  const service = new WorkflowService(
    {
      definitions: domain.table("definitions"),
      instances: domain.table("instances"),
      events: domain.table("events"),
      submissions: domain.table("submissions"),
    },
    { team: () => injectedTeam },
  );
  ctx.provide("collabWorkflow", service);
  ctx.effect(() => () => void domain.close());
  ctx.inject(["collabTeam"], (child) => {
    injectedTeam = child.collabTeam;
    const team = injectedTeam;
    for (const route of createWorkflowRoutes(service, () => team)) {
      ctx.webServer.register(route);
    }
  });
  ctx.commands.register({
    name: "workflow",
    description: "inspect and advance Pluginmax workflows",
    input: { hint: "[list|complete|approve] ...", attachments: false },
    handler: async (invocation: CommandInvocationLike) => {
      try {
        return {
          kind: "success",
          text: await agentWorkflowAction(
            service,
            { signal: { throwIfAborted: () => undefined } },
            invocation.rawInput,
          ),
        };
      } catch (error) {
        return {
          kind: "error",
          text:
            error instanceof Error ? error.message : "workflow command failed",
        };
      }
    },
  });
  ctx.tools.register({
    name: "collab_workflow",
    description:
      "List workspace workflow instances or complete/approve a node.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "complete", "approve"] },
        workspaceId: { type: "string" },
        instanceId: { type: "string" },
        nodeId: { type: "string" },
      },
      required: ["action"],
      additionalProperties: false,
    },
    output: stringToolOutput,
    execute: async (args: unknown, exec: ToolExecLike) => {
      exec.signal.throwIfAborted();
      const parsed = z
        .object({
          action: z.enum(["list", "complete", "approve"]),
          workspaceId: z.string().optional(),
          instanceId: z.string().optional(),
          nodeId: z.string().optional(),
        })
        .parse(args);
      if (parsed.action === "list") {
        if (parsed.workspaceId === undefined)
          throw new WorkflowError("invalid_input", "workspaceId is required");
        return agentWorkflowAction(service, exec, `list ${parsed.workspaceId}`);
      }
      if (parsed.instanceId === undefined || parsed.nodeId === undefined) {
        throw new WorkflowError(
          "invalid_input",
          "instanceId and nodeId are required",
        );
      }
      return agentWorkflowAction(
        service,
        exec,
        `${parsed.action} ${parsed.instanceId} ${parsed.nodeId}`,
      );
    },
  });
}
