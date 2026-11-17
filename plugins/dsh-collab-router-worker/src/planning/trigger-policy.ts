import { createHash } from "node:crypto";
import type {
  PlanningRun,
  PlanningSettings,
  PlanningTrigger,
} from "./models.js";

export interface PlanningTaskTriggerLike {
  readonly id: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly acceptance?: readonly string[] | undefined;
  readonly priority: string;
  readonly due?: string | undefined;
  readonly receiverType?: "unassigned" | "human" | "agent" | "role" | undefined;
  readonly receiverId?: string | undefined;
  readonly creationKey?: string | undefined;
  readonly updatedAt?: string | undefined;
  readonly events?: readonly {
    readonly kind: string;
    readonly actorPrincipalId?: string | undefined;
  }[];
}

export type PlanningTriggerDecision =
  | {
      readonly action: "request";
      readonly reason:
        | "human-manual"
        | "agent-assigned"
        | "task-spec-changed"
        | "agent-requested"
        | "replan-requested";
    }
  | {
      readonly action: "merge";
      readonly reason: "active-run";
      readonly runId: string;
    }
  | {
      readonly action: "skip";
      readonly reason:
        | "planning-disabled"
        | "not-agent-owner"
        | "not-root-task"
        | "approved-plan-exists"
        | "assignment-auto-plan-disabled"
        | "spec-change-auto-plan-disabled"
        | "same-task-revision"
        | "self-trigger"
        | "human-manual-disabled";
    };

export interface PlanningTriggerPolicyInput {
  readonly trigger: PlanningTrigger;
  readonly settings: PlanningSettings;
  readonly receiverType: "unassigned" | "human" | "agent" | "role";
  readonly isRootTask: boolean;
  readonly hasApprovedPlan: boolean;
  readonly taskRevision: string;
  readonly lastProcessedRevision?: string | undefined;
  readonly actorPrincipalId?: string | undefined;
  readonly plannerPrincipalId?: string | undefined;
  readonly activeRun?: Pick<PlanningRun, "id"> | undefined;
}

export function decidePlanningTrigger(
  input: PlanningTriggerPolicyInput,
): PlanningTriggerDecision {
  if (!input.settings.enabled) {
    return { action: "skip", reason: "planning-disabled" };
  }
  if (
    input.actorPrincipalId !== undefined &&
    input.plannerPrincipalId !== undefined &&
    input.actorPrincipalId === input.plannerPrincipalId
  ) {
    return { action: "skip", reason: "self-trigger" };
  }
  if (input.activeRun !== undefined) {
    return {
      action: "merge",
      reason: "active-run",
      runId: input.activeRun.id,
    };
  }
  if (input.trigger.kind === "human-manual") {
    return input.settings.humanOwner.allowManualPlanning
      ? { action: "request", reason: "human-manual" }
      : { action: "skip", reason: "human-manual-disabled" };
  }
  if (
    input.lastProcessedRevision !== undefined &&
    input.lastProcessedRevision === input.taskRevision
  ) {
    return { action: "skip", reason: "same-task-revision" };
  }
  if (input.receiverType !== "agent") {
    return { action: "skip", reason: "not-agent-owner" };
  }
  if (!input.isRootTask) {
    return { action: "skip", reason: "not-root-task" };
  }
  if (input.trigger.kind === "agent-assigned") {
    if (!input.settings.agentOwnerPolicy.autoPlanOnAssignment) {
      return { action: "skip", reason: "assignment-auto-plan-disabled" };
    }
    if (input.hasApprovedPlan) {
      return { action: "skip", reason: "approved-plan-exists" };
    }
    return { action: "request", reason: "agent-assigned" };
  }
  if (input.trigger.kind === "task-spec-changed") {
    if (!input.settings.agentOwnerPolicy.autoPlanOnSpecChange) {
      return { action: "skip", reason: "spec-change-auto-plan-disabled" };
    }
    if (input.hasApprovedPlan) {
      return { action: "skip", reason: "approved-plan-exists" };
    }
    return { action: "request", reason: "task-spec-changed" };
  }
  if (input.trigger.kind === "agent-requested") {
    return { action: "request", reason: "agent-requested" };
  }
  return { action: "request", reason: "replan-requested" };
}

export function triggerIdentity(trigger: PlanningTrigger): string {
  switch (trigger.kind) {
    case "human-manual":
      return `${trigger.kind}:${trigger.userId}`;
    case "agent-assigned":
    case "agent-requested":
      return `${trigger.kind}:${trigger.agentId}`;
    case "task-spec-changed":
      return `${trigger.kind}:${trigger.field}`;
    case "replan-requested":
      return `${trigger.kind}:${trigger.userId ?? ""}:${trigger.agentId ?? ""}`;
  }
}

export function triggerEventKey(input: {
  readonly trigger: PlanningTrigger;
  readonly taskRevision: string;
  readonly eventKey?: string | undefined;
  readonly taskDefinitionDigest?: string | undefined;
}): string {
  return [
    triggerIdentity(input.trigger),
    input.taskRevision,
    input.eventKey ?? input.taskDefinitionDigest ?? "",
  ].join(":");
}

export function planningTaskDigest(task: PlanningTaskTriggerLike): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: task.title,
        description: task.description ?? "",
        acceptance: task.acceptance ?? [],
        priority: task.priority,
        due: task.due ?? "",
        receiverType: task.receiverType,
        receiverId: task.receiverId ?? "",
      }),
    )
    .digest("hex");
}

export function automaticPlanningTrigger(task: PlanningTaskTriggerLike):
  | {
      readonly trigger: PlanningTrigger;
      readonly taskDefinitionDigest: string;
      readonly eventKey: string;
    }
  | undefined {
  if (task.receiverType !== "agent" || task.receiverId === undefined) {
    return undefined;
  }
  if (task.creationKey?.startsWith("router-worker:") === true) {
    return undefined;
  }
  const latest = task.events?.at(-1);
  if (
    latest === undefined ||
    !["created", "assigned", "updated"].includes(latest.kind)
  ) {
    return undefined;
  }
  const trigger: PlanningTrigger =
    latest.kind === "updated"
      ? { kind: "task-spec-changed", field: "description" }
      : { kind: "agent-assigned", agentId: task.receiverId };
  const taskDefinitionDigest = planningTaskDigest(task);
  return {
    trigger,
    taskDefinitionDigest,
    eventKey: [
      task.updatedAt ?? "unknown",
      latest.kind,
      taskDefinitionDigest,
    ].join(":"),
  };
}
