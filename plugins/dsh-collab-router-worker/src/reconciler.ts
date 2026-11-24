import type { RouterWorkerPlanService } from "./service.js";

export class PlanReconciler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly plans: RouterWorkerPlanService,
    private readonly intervalMs = 15_000,
    private readonly onFinalizing?: (
      plan: Awaited<ReturnType<RouterWorkerPlanService["reconcile"]>>,
    ) => Promise<void> | void,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  get active(): boolean {
    return this.timer !== undefined;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const plan of this.plans.activePlans()) {
        try {
          const reconciled = await this.plans.reconcile(plan.id);
          if (reconciled.status === "finalizing") {
            await this.onFinalizing?.(reconciled);
          }
        } catch {
          // Keep the plan active so the next reconciliation tick can retry.
        }
      }
      if (this.plans.activePlans().length === 0) this.stop();
    } finally {
      this.running = false;
    }
  }
}
