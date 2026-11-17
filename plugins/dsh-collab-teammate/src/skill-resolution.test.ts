import { describe, expect, it } from "vitest";
import type {
  InstanceSkillExtension,
  Teammate,
  TeammateEvent,
  TeammateExtensionPolicy,
  TeammateTemplate,
  TemplateSkillBinding,
} from "./models.js";
import {
  TeammateSkillResolutionService,
  type SkillCatalogItemLike,
} from "./skill-resolution.js";
import {
  TeammateService,
  TeammateTemplateService,
  type KvTableLike,
} from "./service.js";

function memoryTable<V>(): KvTableLike<V> {
  const values = new Map<string, V>();
  return {
    get: (key) => values.get(key),
    entries: () => values.entries(),
    get size() {
      return values.size;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      return values.delete(key);
    },
  };
}

const admin = {
  userId: "admin",
  name: "Admin",
  role: "admin" as const,
};

const coreSkill: SkillCatalogItemLike = {
  id: "skill-task-planning-core",
  name: "任务规划核心方法",
  version: "1.0.0",
  instructions: "# 任务规划核心方法",
  triggers: ["task-planning"],
  source: "seed",
  status: "available",
};

const domainSkill: SkillCatalogItemLike = {
  id: "skill-supply-chain-planning",
  name: "供应链任务拆解",
  version: "1.0.0",
  instructions: "# 供应链任务拆解",
  triggers: ["task-planning:supply-chain"],
  source: "user",
  status: "enabled",
};

let templateSequence = 0;

async function setup(input: {
  readonly available: readonly SkillCatalogItemLike[];
  readonly bindings: readonly TemplateSkillBinding[];
  readonly extensionPolicy?: Partial<TeammateExtensionPolicy> | undefined;
}) {
  const templates = new TeammateTemplateService({
    tables: { templates: memoryTable<TeammateTemplate>() },
  });
  const teammates = new TeammateService({
    tables: {
      teammates: memoryTable<Teammate>(),
      events: memoryTable<TeammateEvent>(),
    },
    templates,
  });
  const template = await templates.create(admin, {
    source: "platform",
    name: `规划模板-${(templateSequence += 1)}`,
    skillBindings: input.bindings,
    extensionPolicy: {
      allowAdditionalSkills: true,
      allowDisableDefaultSkills: false,
      allowSceneOverrides: false,
      protectedScenes: [],
      protectedSkillIds: [],
      ...input.extensionPolicy,
    },
  });
  const teammate = await teammates.create(admin, { templateId: template.id });
  const available = new Map(input.available.map((skill) => [skill.id, skill]));
  const catalog = {
    installedSkills: async () =>
      input.available.filter((skill) => skill.status === "enabled"),
    resolveSkills: async (
      _principal: string | { readonly userId: string },
      skillIds: readonly string[],
      options?: { readonly requireInstallation?: boolean },
    ) =>
      skillIds.flatMap((skillId) => {
        const skill = available.get(skillId);
        if (
          skill === undefined ||
          (options?.requireInstallation !== false && skill.status !== "enabled")
        ) {
          return [];
        }
        return [skill];
      }),
  };
  const resolver = new TeammateSkillResolutionService({
    teammates,
    skillCatalog: () => catalog,
  });
  return { resolver, teammate, teammates, templates };
}

const requiredCore: TemplateSkillBinding = {
  skillId: "skill-task-planning-core",
  versionConstraint: "^1",
  mode: "required",
  scenes: ["task-planning"],
  enabled: true,
};

function extension(input: {
  readonly skillId: string;
  readonly scene: string;
  readonly mode: "additive" | "primary";
}): InstanceSkillExtension {
  return {
    skillId: input.skillId,
    versionConstraint: "*",
    scenes: [input.scene],
    mode: input.mode,
    status: "active",
    addedBy: "admin",
    addedAt: "2026-11-16T00:00:00.000Z",
  };
}

describe("teammate planning skill resolution", () => {
  it("resolves required core skills and fails closed when they are missing", async () => {
    const { resolver, teammate } = await setup({
      available: [coreSkill],
      bindings: [requiredCore],
    });
    await expect(
      resolver.resolveForScene({
        teammateId: teammate.id,
        scene: "task-planning",
        principalId: "admin",
      }),
    ).resolves.toMatchObject({
      effective: [
        {
          id: "skill-task-planning-core",
          mode: "required",
          bindingSource: "platform",
        },
      ],
      policyVersion: expect.stringContaining("teammate-skill-resolution-v1"),
    });

    const missing = await setup({
      available: [],
      bindings: [requiredCore],
    });
    await expect(
      missing.resolver.resolveForScene({
        teammateId: missing.teammate.id,
        scene: "task-planning",
        principalId: "admin",
      }),
    ).rejects.toMatchObject({
      code: "required_skill_missing",
    });
  });

  it("allows additive domain skills but protects the core and primary scene overrides", async () => {
    const { resolver, teammate, teammates } = await setup({
      available: [coreSkill, domainSkill],
      bindings: [requiredCore],
      extensionPolicy: {
        protectedScenes: ["task-planning"],
        protectedSkillIds: ["skill-task-planning-core"],
      },
    });
    await teammates.updateSkillExtensions(admin, {
      teammateId: teammate.id,
      skillExtensions: [
        extension({
          skillId: "skill-supply-chain-planning",
          scene: "task-planning",
          mode: "additive",
        }),
        extension({
          skillId: "skill-task-planning-core",
          scene: "task-planning",
          mode: "primary",
        }),
      ],
    });
    const resolved = await resolver.resolveForScene({
      teammateId: teammate.id,
      scene: "task-planning",
      principalId: "admin",
    });
    expect(resolved.effective.map((skill) => skill.id)).toEqual([
      "skill-task-planning-core",
      "skill-supply-chain-planning",
    ]);
    expect(resolved.effective[0]).toMatchObject({
      mode: "required",
      bindingSource: "platform",
    });
    expect(resolved.effective[1]).toMatchObject({
      mode: "additive",
      bindingSource: "user",
    });
    expect(resolved.excluded).toContainEqual({
      skillId: "skill-task-planning-core",
      reason: "protected platform skill cannot be user-overridden",
    });
  });

  it("lets a permitted primary skill replace a platform default without replacing required core", async () => {
    const defaultDomain: TemplateSkillBinding = {
      skillId: "skill-supply-chain-planning",
      versionConstraint: "^1",
      mode: "default",
      scenes: ["task-planning:supply-chain"],
      enabled: true,
    };
    const { resolver, teammate, teammates } = await setup({
      available: [coreSkill, domainSkill],
      bindings: [requiredCore, defaultDomain],
      extensionPolicy: {
        allowSceneOverrides: true,
      },
    });
    await teammates.updateSkillExtensions(admin, {
      teammateId: teammate.id,
      skillExtensions: [
        extension({
          skillId: "skill-supply-chain-planning",
          scene: "task-planning:supply-chain",
          mode: "primary",
        }),
      ],
    });
    const resolved = await resolver.resolveForScene({
      teammateId: teammate.id,
      scene: "task-planning:supply-chain",
      principalId: "admin",
    });
    expect(resolved.effective.map((skill) => [skill.id, skill.mode])).toEqual([
      ["skill-task-planning-core", "required"],
      ["skill-supply-chain-planning", "primary"],
    ]);
  });
});
