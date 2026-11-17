import { createHash } from "node:crypto";
import type {
  InstanceSkillExtension,
  Teammate,
  TeammateExtensionPolicy,
  TeammateTemplate,
  TemplateSkillBinding,
} from "./models.js";
import { TeammateError, TeammateService } from "./service.js";

export const TASK_PLANNING_SCENE = "task-planning";
export const TASK_PLANNING_CORE_SKILL_ID = "skill-task-planning-core";

export interface SkillCatalogItemLike {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly instructions?: string | undefined;
  readonly triggers?: readonly string[] | undefined;
  readonly source?: "seed" | "provider" | "user" | undefined;
  readonly status?: "enabled" | "available" | undefined;
}

export interface TeammateSkillCatalog {
  installedSkills(
    principal: string | { readonly userId: string },
  ): Promise<readonly SkillCatalogItemLike[]>;
  resolveSkills(
    principal: string | { readonly userId: string },
    skillIds: readonly string[],
    options?: { readonly requireInstallation?: boolean },
  ): Promise<readonly SkillCatalogItemLike[]>;
}

export interface EffectiveTeammateSkill {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly bindingSource: "platform" | "user";
  readonly mode: "required" | "default" | "additive" | "primary";
  readonly scenes: readonly string[];
  readonly instructions: string;
  readonly instructionsHash: string;
  readonly sourceRefs: readonly {
    readonly type: "text";
    readonly id: string;
    readonly version: string;
  }[];
}

export interface TeammateSkillResolution {
  readonly teammateId: string;
  readonly templateId?: string | undefined;
  readonly scene: string;
  readonly effective: readonly EffectiveTeammateSkill[];
  readonly installed: readonly {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly source?: "seed" | "provider" | "user" | undefined;
  }[];
  readonly excluded: readonly {
    readonly skillId: string;
    readonly reason: string;
  }[];
  readonly policyVersion: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sceneMatches(configured: string, requested: string): boolean {
  return configured === requested || requested.startsWith(`${configured}:`);
}

function scenesForBinding(
  binding: Pick<TemplateSkillBinding, "scenes">,
): readonly string[] {
  return binding.scenes.length === 0 ? ["general"] : binding.scenes;
}

function scenesForExtension(
  extension: Pick<InstanceSkillExtension, "scenes">,
  skill: SkillCatalogItemLike,
): readonly string[] {
  if (extension.scenes.length > 0) return extension.scenes;
  if (skill.triggers !== undefined && skill.triggers.length > 0) {
    return skill.triggers;
  }
  return ["general"];
}

function effectiveSkill(
  skill: SkillCatalogItemLike,
  bindingSource: EffectiveTeammateSkill["bindingSource"],
  mode: EffectiveTeammateSkill["mode"],
  scenes: readonly string[],
): EffectiveTeammateSkill {
  const instructions = skill.instructions?.trim() ?? "";
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    bindingSource,
    mode,
    scenes,
    instructions,
    instructionsHash: hash(instructions),
    sourceRefs: [{ type: "text", id: skill.id, version: skill.version }],
  };
}

export class TeammateSkillResolutionService {
  constructor(
    private readonly deps: {
      readonly teammates: Pick<TeammateService, "get" | "templateOf">;
      readonly skillCatalog: () => TeammateSkillCatalog | undefined;
    },
  ) {}

  private catalog(): TeammateSkillCatalog {
    const catalog = this.deps.skillCatalog();
    if (catalog === undefined) {
      throw new TeammateError(
        "skill_catalog_unavailable",
        "Skill 服务不可用，无法解析规划场景",
      );
    }
    return catalog;
  }

  async resolveForScene(input: {
    readonly teammateId: string;
    readonly scene: string;
    readonly principalId: string;
  }): Promise<TeammateSkillResolution> {
    const teammate = this.deps.teammates.get(input.teammateId);
    const template = this.deps.teammates.templateOf(teammate);
    return this.resolve(teammate, template, input.scene, input.principalId, {
      strictRequired: true,
    });
  }

  private async resolve(
    teammate: Teammate,
    template: TeammateTemplate | undefined,
    scene: string,
    principalId: string,
    options: { readonly strictRequired: boolean },
  ): Promise<TeammateSkillResolution> {
    const catalog = this.catalog();
    const baseline = template?.skillBindings ?? [];
    const policy =
      template?.extensionPolicy ??
      ({
        allowAdditionalSkills: true,
        allowDisableDefaultSkills: false,
        allowSceneOverrides: false,
        protectedScenes: [],
        protectedSkillIds: [],
      } satisfies TeammateExtensionPolicy);
    const extensions = (teammate.skillExtensions ?? []).filter(
      (extension) => extension.status === "active",
    );
    let installed: Awaited<ReturnType<TeammateSkillCatalog["installedSkills"]>>;
    let baseSkills: Awaited<ReturnType<TeammateSkillCatalog["resolveSkills"]>>;
    let extensionSkills: Awaited<
      ReturnType<TeammateSkillCatalog["resolveSkills"]>
    >;
    try {
      [installed, baseSkills, extensionSkills] = await Promise.all([
        catalog.installedSkills({ userId: principalId }),
        catalog.resolveSkills(
          {
            userId: template?.createdBy ?? teammate.ownerUserId,
          },
          [
            ...new Set([
              ...baseline.map((binding) => binding.skillId),
              ...(scene === TASK_PLANNING_SCENE ||
              scene.startsWith(`${TASK_PLANNING_SCENE}:`)
                ? [TASK_PLANNING_CORE_SKILL_ID]
                : []),
            ]),
          ],
          { requireInstallation: false },
        ),
        catalog.resolveSkills(
          { userId: principalId },
          extensions.map((extension) => extension.skillId),
          { requireInstallation: true },
        ),
      ]);
    } catch (cause) {
      throw new TeammateError(
        "skill_catalog_unavailable",
        cause instanceof Error ? cause.message : "Skill 目录解析失败",
      );
    }
    const baseById = new Map(baseSkills.map((skill) => [skill.id, skill]));
    const extensionById = new Map(
      extensionSkills.map((skill) => [skill.id, skill]),
    );
    const excluded: Array<{ skillId: string; reason: string }> = [];
    const required = baseline.filter(
      (binding) =>
        binding.enabled &&
        binding.mode === "required" &&
        scenesForBinding(binding).some((candidate) =>
          sceneMatches(candidate, scene),
        ),
    );
    const missingRequired = required.filter(
      (binding) => baseById.get(binding.skillId) === undefined,
    );
    if (options.strictRequired && missingRequired.length > 0) {
      throw new TeammateError(
        "required_skill_missing",
        `必需 Skill 未安装或不可用：${missingRequired
          .map((binding) => binding.skillId)
          .join("、")}`,
      );
    }
    const userPrimaries = extensions.filter((extension) => {
      const skill = extensionById.get(extension.skillId);
      return (
        extension.mode === "primary" &&
        skill !== undefined &&
        scenesForExtension(extension, skill).some((candidate) =>
          sceneMatches(candidate, scene),
        )
      );
    });
    const primaryScenes = new Set(
      userPrimaries.flatMap((extension) => {
        const skill = extensionById.get(extension.skillId)!;
        return scenesForExtension(extension, skill).filter((candidate) =>
          sceneMatches(candidate, scene),
        );
      }),
    );
    const platformDefaultScenes = new Set(
      baseline
        .filter(
          (binding) =>
            binding.enabled &&
            binding.mode === "default" &&
            scenesForBinding(binding).some((candidate) =>
              sceneMatches(candidate, scene),
            ),
        )
        .flatMap((binding) => scenesForBinding(binding)),
    );
    const effective: EffectiveTeammateSkill[] = [];
    const effectiveIds = new Set<string>();
    const add = (skill: EffectiveTeammateSkill) => {
      if (effectiveIds.has(skill.id)) return;
      effectiveIds.add(skill.id);
      effective.push(skill);
    };
    for (const binding of baseline) {
      if (
        !binding.enabled ||
        binding.mode === "optional" ||
        !scenesForBinding(binding).some((candidate) =>
          sceneMatches(candidate, scene),
        )
      ) {
        continue;
      }
      if (
        binding.mode === "default" &&
        scenesForBinding(binding).some((candidate) =>
          primaryScenes.has(candidate),
        )
      ) {
        continue;
      }
      const skill = baseById.get(binding.skillId);
      if (skill === undefined) {
        excluded.push({
          skillId: binding.skillId,
          reason: "platform skill unavailable",
        });
        continue;
      }
      add(
        effectiveSkill(
          skill,
          "platform",
          binding.mode,
          scenesForBinding(binding),
        ),
      );
    }
    for (const extension of extensions) {
      if (policy.protectedSkillIds.includes(extension.skillId)) {
        excluded.push({
          skillId: extension.skillId,
          reason: "protected platform skill cannot be user-overridden",
        });
        continue;
      }
      const skill = extensionById.get(extension.skillId);
      if (skill === undefined) {
        excluded.push({
          skillId: extension.skillId,
          reason: "skill not installed or unavailable",
        });
        continue;
      }
      const scenes = scenesForExtension(extension, skill);
      if (!scenes.some((candidate) => sceneMatches(candidate, scene))) {
        continue;
      }
      if (
        extension.mode === "primary" &&
        scenes.some((candidate) => policy.protectedScenes.includes(candidate))
      ) {
        excluded.push({
          skillId: extension.skillId,
          reason: "protected scene cannot be user-overridden",
        });
        continue;
      }
      const overridesDefault =
        extension.mode === "primary" &&
        scenes.some((candidate) => platformDefaultScenes.has(candidate));
      if (overridesDefault && !policy.allowSceneOverrides) {
        excluded.push({
          skillId: extension.skillId,
          reason: "template does not allow primary scene overrides",
        });
        continue;
      }
      const requiredOverride =
        extension.mode === "primary" &&
        baseline.some(
          (binding) =>
            binding.enabled &&
            binding.mode === "required" &&
            scenesForBinding(binding).some((candidate) =>
              scenes.includes(candidate),
            ),
        );
      if (requiredOverride) {
        excluded.push({
          skillId: extension.skillId,
          reason: "primary skill cannot replace a required skill",
        });
        continue;
      }
      add(effectiveSkill(skill, "user", extension.mode, scenes));
    }
    if (
      (scene === TASK_PLANNING_SCENE ||
        scene.startsWith(`${TASK_PLANNING_SCENE}:`)) &&
      !effectiveIds.has(TASK_PLANNING_CORE_SKILL_ID)
    ) {
      const core = baseById.get(TASK_PLANNING_CORE_SKILL_ID);
      if (core === undefined) {
        if (options.strictRequired) {
          throw new TeammateError(
            "required_skill_missing",
            `必需 Skill 未安装或不可用：${TASK_PLANNING_CORE_SKILL_ID}`,
          );
        }
      } else {
        add(
          effectiveSkill(core, "platform", "required", [TASK_PLANNING_SCENE]),
        );
      }
    }
    return {
      teammateId: teammate.id,
      ...(template === undefined ? {} : { templateId: template.id }),
      scene,
      effective,
      installed: installed.map((skill) => ({
        id: skill.id,
        name: skill.name,
        version: skill.version,
        ...(skill.source === undefined ? {} : { source: skill.source }),
      })),
      excluded,
      policyVersion: `teammate-skill-resolution-v1:${template?.version ?? "legacy"}`,
    };
  }
}
