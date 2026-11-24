import { describe, expect, it } from "vitest";
import { planGraphSchema, planSettingsSchema } from "./models.js";
import { validatePlanGraph } from "./validator.js";

const settings = planSettingsSchema.parse({});

function node(id: string, dependencies: readonly string[] = []) {
  return {
    id,
    title: id,
    description: `${id} description`,
    type: "task" as const,
    receiverType: "human" as const,
    receiverId: "zhouning",
    receiverName: "周宁",
    priority: "P2" as const,
    acceptance: [`${id} accepted`],
    dependencies: [...dependencies],
    reviewMode: "human" as const,
    maxAttempts: 1,
    timeoutSeconds: 3_600,
  };
}

describe("Router plan graph connectivity", () => {
  it("rejects multiple disconnected components", () => {
    const graph = planGraphSchema.parse({
      nodes: [
        node("capability-gate"),
        node("collect"),
        node("research", ["collect"]),
        node("final", ["research"]),
      ],
      startNodeIds: ["capability-gate", "collect"],
      warnings: [],
    });

    expect(validatePlanGraph(graph, settings)).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "disconnected-graph",
      }),
    );
  });

  it("allows parallel roots that later merge into one DAG", () => {
    const graph = planGraphSchema.parse({
      nodes: [
        node("market"),
        node("ip-analysis"),
        node("design", ["market", "ip-analysis"]),
        node("final", ["design"]),
      ],
      startNodeIds: ["market", "ip-analysis"],
      warnings: [],
    });

    expect(
      validatePlanGraph(graph, settings).filter(
        (issue) => issue.code === "disconnected-graph",
      ),
    ).toEqual([]);
  });
});
