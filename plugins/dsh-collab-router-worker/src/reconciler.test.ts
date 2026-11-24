import { describe, expect, it, vi } from "vitest";
import { PlanReconciler } from "./reconciler.js";
import type { RouterWorkerPlanService } from "./service.js";

describe("Plan reconciler", () => {
  it("does not create a timer until an active plan starts reconciliation", () => {
    vi.useFakeTimers();
    try {
      const plans = {
        activePlans: () => [],
        reconcile: async () => undefined,
      } as unknown as RouterWorkerPlanService;
      const reconciler = new PlanReconciler(plans, 1_000);
      expect(reconciler.active).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      reconciler.start();
      expect(vi.getTimerCount()).toBe(1);
      reconciler.stop();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
