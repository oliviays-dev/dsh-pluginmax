import type { RootTaskLike } from "../service.js";
import type { PlanningSettings } from "./models.js";
import type { PlanningService } from "./service.js";

export type TaskDispatchReadinessVerdict =
  | { readonly ready: true }
  | {
      readonly ready: false;
      readonly code:
        | "planning-required"
        | "planning-running"
        | "planning-review-required"
        | "planning-blocked";
      readonly message: string;
      readonly retryToken?: string | undefined;
    };

export interface TaskDispatchReadiness {
  inspect(input: {
    readonly task: RootTaskLike;
    readonly workspaceId: string;
    readonly requestedBy: "assignment" | "manual" | "queue" | "dependency";
  }): TaskDispatchReadinessVerdict | Promise<TaskDispatchReadinessVerdict>;
}

export class PlanningDispatchReadinessGate implements TaskDispatchReadiness {
  constructor(
    private readonly deps: {
      readonly settings: (workspaceId: string) => PlanningSettings;
      readonly planning: PlanningService;
      readonly plans: {
        findByRoot(
          workspaceId: string,
          rootTaskId: string,
        ):
          | {
              readonly status:
                | "draft"
                | "proposed"
                | "approved"
                | "active"
                | "finalizing"
                | "paused"
                | "resume_required"
                | "completed"
                | "cancelled"
                | "failed";
            }
          | undefined;
      };
    },
  ) {}

  inspect(input: {
    readonly task: RootTaskLike;
    readonly workspaceId: string;
    readonly requestedBy: "assignment" | "manual" | "queue" | "dependency";
  }): TaskDispatchReadinessVerdict {
    const settings = this.deps.settings(input.workspaceId);
    if (!settings.enabled) return { ready: true };
    if (input.task.receiverType !== "agent") return { ready: true };
    if (input.task.creationKey?.startsWith("router-worker:") === true) {
      return { ready: true };
    }
    const run = this.deps.planning.activeRun(input.workspaceId, input.task.id);
    if (run !== undefined) {
      return run.status === "review_required"
        ? {
            ready: false,
            code: "planning-review-required",
            message: "任务规划等待人工审核",
            retryToken: run.id,
          }
        : {
            ready: false,
            code:
              run.status === "clarifying"
                ? "planning-blocked"
                : "planning-running",
            message:
              run.status === "clarifying"
                ? "任务规划等待补充信息"
                : "任务正在生成执行计划",
            retryToken: run.id,
          };
    }
    const plan = this.deps.plans.findByRoot(input.workspaceId, input.task.id);
    if (
      plan !== undefined &&
      ["approved", "active", "finalizing", "completed"].includes(plan.status)
    ) {
      return { ready: true };
    }
    if (
      plan !== undefined &&
      ["draft", "proposed", "paused", "resume_required"].includes(plan.status)
    ) {
      return {
        ready: false,
        code: "planning-review-required",
        message: "任务计划等待人工编辑与确认",
      };
    }
    if (plan?.status === "failed" || plan?.status === "cancelled") {
      return {
        ready: false,
        code: "planning-blocked",
        message: "任务计划已失败或取消，需要重新规划",
      };
    }
    if (!settings.agentOwnerPolicy.requirePlanBeforeExecution) {
      return { ready: true };
    }
    return {
      ready: false,
      code: "planning-required",
      message: "Agent 负责人任务需要先生成并确认执行计划",
    };
  }
}
