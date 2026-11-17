import type {
  PlanningKnowledgeReceipt,
  PlanningSourceRef,
  RequirementBrief,
} from "./models.js";

export interface PlanningKnowledgeContribution {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly authority: "policy" | "reference";
  readonly version: string;
  readonly sourceRefs: readonly PlanningSourceRef[];
  readonly processId?: string | undefined;
  readonly confidence: "high" | "medium" | "low";
}

export interface PlanningKnowledgeProvider {
  retrieve(input: {
    readonly workspaceId: string;
    readonly taskId: string;
    readonly taskRevision: string;
    readonly requirementBrief?: RequirementBrief | undefined;
    readonly scene: "task-planning";
    readonly query: string;
    readonly domainTags: readonly string[];
    readonly limit: number;
  }): Promise<{
    readonly contributions: readonly PlanningKnowledgeContribution[];
    readonly excluded: readonly {
      readonly id: string;
      readonly reason: string;
    }[];
  }>;
}

export function planningKnowledgeSections(
  contributions: readonly PlanningKnowledgeContribution[],
): readonly {
  readonly id: string;
  readonly type: "mode-policy" | "shared-object-context";
  readonly authority: "instruction" | "evidence";
  readonly text: string;
  readonly sourceRefs: readonly PlanningSourceRef[];
  readonly compression: "extracted";
}[] {
  return contributions.map((contribution) => ({
    id: `planning-knowledge:${contribution.id}@${contribution.version}`,
    type:
      contribution.authority === "policy"
        ? ("mode-policy" as const)
        : ("shared-object-context" as const),
    authority:
      contribution.authority === "policy"
        ? ("instruction" as const)
        : ("evidence" as const),
    text: [contribution.title, contribution.text].filter(Boolean).join("\n\n"),
    sourceRefs: contribution.sourceRefs,
    compression: "extracted" as const,
  }));
}

export function planningKnowledgeReceiptInput(input: {
  readonly providerId: string;
  readonly contextPackId: string;
  readonly contributions: readonly PlanningKnowledgeContribution[];
  readonly excluded: readonly {
    readonly id: string;
    readonly reason: string;
  }[];
}): Omit<
  PlanningKnowledgeReceipt,
  "id" | "workspaceId" | "planningRunId" | "createdAt"
> {
  return {
    providerId: input.providerId,
    contextPackId: input.contextPackId,
    contributions: input.contributions.map((contribution) => ({
      ...contribution,
      sourceRefs: [...contribution.sourceRefs],
    })),
    excluded: input.excluded.map((item) => ({ ...item })),
  };
}
