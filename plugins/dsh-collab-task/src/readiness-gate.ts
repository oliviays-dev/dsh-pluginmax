import type { TaskRecord } from "./types.js";

export type TaskDispatchRequestedBy =
  "assignment" | "manual" | "queue" | "dependency";

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
    readonly task: TaskRecord;
    readonly workspaceId: string;
    readonly requestedBy: TaskDispatchRequestedBy;
  }): TaskDispatchReadinessVerdict | Promise<TaskDispatchReadinessVerdict>;
}
