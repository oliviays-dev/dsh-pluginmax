import type { PlanningSkillSnapshot, PlanningSourceRef } from "./models.js";

export interface ResolvedPlanningSkill {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly bindingSource: "platform" | "user";
  readonly mode: "required" | "default" | "additive" | "primary";
  readonly scenes: readonly string[];
  readonly instructions: string;
  readonly instructionsHash: string;
}

export interface PlanningSkillResolutionLike {
  readonly teammateId: string;
  readonly templateId?: string | undefined;
  readonly effective: readonly ResolvedPlanningSkill[];
  readonly excluded: readonly {
    readonly skillId: string;
    readonly reason: string;
  }[];
  readonly policyVersion: string;
}

export function planningSkillSections(
  resolution: PlanningSkillResolutionLike,
): readonly {
  readonly id: string;
  readonly type: "mode-policy";
  readonly authority: "instruction";
  readonly text: string;
  readonly sourceRefs: readonly PlanningSourceRef[];
  readonly compression: "full";
}[] {
  return resolution.effective
    .filter((skill) => skill.instructions.trim() !== "")
    .map((skill) => ({
      id: `planning-skill:${skill.id}@${skill.version}`,
      type: "mode-policy" as const,
      authority: "instruction" as const,
      text: skill.instructions,
      sourceRefs: [
        {
          type: "text" as const,
          id: skill.id,
          version: skill.version,
        },
      ],
      compression: "full" as const,
    }));
}

export function planningSkillSnapshotInput(
  resolution: PlanningSkillResolutionLike,
): Omit<
  PlanningSkillSnapshot,
  "id" | "workspaceId" | "planningRunId" | "createdAt"
> {
  return {
    ...(resolution.templateId === undefined
      ? {}
      : { templateId: resolution.templateId }),
    teammateId: resolution.teammateId,
    scene: "task-planning",
    policyVersion: resolution.policyVersion,
    skills: resolution.effective.map((skill) => ({
      id: skill.id,
      name: skill.name,
      version: skill.version,
      bindingSource: skill.bindingSource,
      mode: skill.mode,
      scenes: [...skill.scenes],
      instructions: skill.instructions,
      instructionsHash: skill.instructionsHash,
      sourceRefs: [
        {
          type: "text" as const,
          id: skill.id,
          version: skill.version,
        },
      ],
    })),
    excluded: resolution.excluded.map((item) => ({
      skillId: item.skillId,
      reason: item.reason,
    })),
  };
}

export function effectivePlanningSystemText(pack: {
  readonly rendered: { readonly systemText: string };
  readonly sections: readonly {
    readonly type: string;
    readonly text: string;
  }[];
}): string {
  return [
    pack.rendered.systemText,
    ...pack.sections
      .filter((section) => section.type === "mode-policy")
      .map((section) => `[mode-policy]\n${section.text}`),
  ]
    .filter((part) => part.trim() !== "")
    .join("\n\n");
}

export function effectivePlanningInstruction(pack: {
  readonly sections: readonly {
    readonly type: string;
    readonly text: string;
  }[];
}): string {
  const excludedTypes = new Set([
    "platform-policy",
    "agent-identity",
    "scene-policy",
    "execution-policy",
    "source-policy",
    "mode-policy",
  ]);
  return pack.sections
    .filter((section) => !excludedTypes.has(section.type))
    .map((section) => `[${section.type}]\n${section.text}`)
    .join("\n\n");
}
