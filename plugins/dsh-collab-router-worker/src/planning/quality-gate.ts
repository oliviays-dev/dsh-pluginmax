import type { PlanCriticReport } from "./models.js";

export interface PlanningQualityGateInput {
  readonly rootAcceptance: readonly string[];
  readonly graph: {
    readonly nodes: readonly {
      readonly id: string;
      readonly title: string;
      readonly acceptance: readonly string[];
      readonly risk?: "low" | "medium" | "high" | "irreversible" | undefined;
      readonly humanGate?:
        "none" | "before_start" | "before_complete" | undefined;
      readonly evidenceRequirements?: readonly string[] | undefined;
    }[];
  };
  readonly validatorErrors: readonly string[];
  readonly critic: Pick<
    PlanCriticReport,
    "verdict" | "score" | "issues" | "acceptanceCoverage"
  >;
  readonly approval: "manual" | "risk-based" | "auto";
  readonly triggerKind:
    | "human-manual"
    | "agent-assigned"
    | "task-spec-changed"
    | "agent-requested"
    | "replan-requested";
}

export interface PlanningQualityGateResult {
  readonly decision: "auto-approve" | "review-required";
  readonly score: number;
  readonly risk: "low" | "medium" | "high" | "irreversible";
  readonly reasons: readonly string[];
  readonly coverage: number;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("zh-Hans-CN");
}

function riskRank(risk: PlanningQualityGateResult["risk"]): number {
  if (risk === "irreversible") return 3;
  if (risk === "high") return 2;
  if (risk === "medium") return 1;
  return 0;
}

export function evaluatePlanningQuality(
  input: PlanningQualityGateInput,
): PlanningQualityGateResult {
  const reasons: string[] = [];
  const maxRisk = input.graph.nodes.reduce<PlanningQualityGateResult["risk"]>(
    (current, node) => {
      const risk = node.risk ?? "low";
      return riskRank(risk) > riskRank(current) ? risk : current;
    },
    "low",
  );
  const coveredCriteria = input.rootAcceptance.filter((criterion) => {
    const expected = normalized(criterion);
    const criticCoverage = input.critic.acceptanceCoverage.some(
      (item) =>
        normalized(item.criterion) === expected &&
        item.coveredByNodeIds.length > 0,
    );
    const nodeCoverage = input.graph.nodes.some((node) =>
      node.acceptance.some((item) => normalized(item).includes(expected)),
    );
    return criticCoverage || nodeCoverage;
  }).length;
  const coverage =
    input.rootAcceptance.length === 0
      ? 0
      : coveredCriteria / input.rootAcceptance.length;
  const score = Math.round(
    Math.min(100, input.critic.score * 0.7 + coverage * 30),
  );
  if (input.validatorErrors.length > 0) {
    reasons.push(...input.validatorErrors);
  }
  if (coverage < 1) {
    reasons.push("Root acceptance 尚未被完整覆盖");
  }
  if (input.critic.verdict !== "pass") {
    reasons.push(`Plan Critic verdict=${input.critic.verdict}`);
  }
  if (score < 85) {
    reasons.push(`质量分 ${score} 低于自动批准阈值 85`);
  }
  if (maxRisk !== "low") {
    reasons.push(`计划包含 ${maxRisk} 风险节点`);
  }
  if (
    input.graph.nodes.some(
      (node) =>
        (node.humanGate ?? "none") !== "none" ||
        (node.evidenceRequirements?.length ?? 0) === 0,
    )
  ) {
    reasons.push("计划包含 Human Gate 或证据要求需要人工确认");
  }
  if (input.triggerKind === "human-manual") {
    reasons.push("人工发起计划默认必须人工审核");
  }
  if (input.approval === "manual") {
    reasons.push("当前审批策略为 manual");
  }
  const autoApproved =
    reasons.length === 0 &&
    input.triggerKind !== "human-manual" &&
    input.approval !== "manual" &&
    maxRisk === "low";
  return {
    decision: autoApproved ? "auto-approve" : "review-required",
    score,
    risk: maxRisk,
    reasons,
    coverage,
  };
}
