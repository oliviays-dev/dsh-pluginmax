import type {
  BusinessChainExternalRef,
  BusinessChainNodeBinding,
  ProjectTemplateRecord,
} from "./types.js";

export interface BusinessChainDefinitionLike {
  readonly id: string;
  readonly description?: string | undefined;
  readonly scope?: "project" | "platform" | undefined;
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly status: string;
  readonly workspaceId: string;
  readonly updatedAt?: string | undefined;
  readonly kind?: string | undefined;
  readonly businessChain?: {
    readonly enabled?: boolean | undefined;
    readonly templateId?: string | undefined;
    readonly chainKey?: string | undefined;
    readonly displayName?: string | undefined;
    readonly projectTypeCodes?: readonly string[] | undefined;
    readonly allowUnboundExternalNodes?: boolean | undefined;
  };
  readonly graph?: {
    readonly nodes: readonly {
      readonly id: string;
      readonly name: string;
      readonly executor?: {
        readonly kind: string;
        readonly id: string;
        readonly label?: string | undefined;
      } | undefined;
      readonly businessChain?: {
        readonly sequence?: number | undefined;
        readonly stageCode?: string | undefined;
        readonly summaryMetric?: string | undefined;
        readonly externalRefs?: readonly BusinessChainExternalRef[] | undefined;
        readonly fields?: readonly {
          readonly key: string;
          readonly label: string;
          readonly bindings: readonly {
            readonly system: string;
            readonly objectId: string;
            readonly path: string;
          }[];
        }[] | undefined;
      };
    }[];
  };
}

export interface BusinessChainValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string | undefined;
}

export interface BusinessChainValidationResult {
  readonly blocking: readonly BusinessChainValidationIssue[];
  readonly warnings: readonly BusinessChainValidationIssue[];
  readonly passed: readonly string[];
  readonly digest: string;
}

export function businessChainTemplateId(
  definition: BusinessChainDefinitionLike,
): string {
  return definition.businessChain?.templateId ?? definition.id;
}

export function isBusinessChainDefinition(
  definition: BusinessChainDefinitionLike,
): boolean {
  return (
    definition.kind === "business-chain" &&
    definition.businessChain?.enabled !== false
  );
}

/** 模版候选只包含允许、启用且明确标记为 business-chain 的定义。 */
export function allowedBusinessChainDefinitions(
  definitions: readonly BusinessChainDefinitionLike[],
  template: ProjectTemplateRecord | undefined,
  workspaceId: string,
): BusinessChainDefinitionLike[] {
  if (
    template === undefined ||
    template.businessChainMode === "none" ||
    template.allowedBusinessChainTemplateIds.length === 0
  ) {
    return [];
  }
  const allowed = new Set(template.allowedBusinessChainTemplateIds);
  return definitions
    .filter((definition) => isBusinessChainDefinition(definition))
    .filter(
      (definition) =>
        definition.status === "active" &&
        (definition.scope === "platform" ||
          definition.workspaceId === workspaceId),
    )
    .filter((definition) => allowed.has(businessChainTemplateId(definition)))
    .sort(
      (left, right) =>
        right.version - left.version ||
        left.name.localeCompare(right.name),
    );
}

export function defaultBusinessChainDefinition(
  definitions: readonly BusinessChainDefinitionLike[],
  template: ProjectTemplateRecord | undefined,
  workspaceId: string,
): BusinessChainDefinitionLike | undefined {
  if (
    template === undefined ||
    template.defaultBusinessChainTemplateId === undefined
  ) {
    return undefined;
  }
  return allowedBusinessChainDefinitions(
    definitions,
    template,
    workspaceId,
  ).find(
    (definition) =>
      businessChainTemplateId(definition) ===
      template.defaultBusinessChainTemplateId,
  );
}

function stableDigest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * 只做项目域可判断的静态校验。来源对象是否属于项目、MCP 新鲜度和 schema
 * 由 ProgressOverview 读取阶段继续校验；这里不猜测未声明的事实。
 */
export function validateBusinessChainSelection(input: {
  readonly workspaceId: string;
  readonly template: ProjectTemplateRecord | undefined;
  readonly definitions: readonly BusinessChainDefinitionLike[];
  readonly definitionId: string;
  readonly projectCustom?: boolean | undefined;
  readonly nodeBindings?: readonly BusinessChainNodeBinding[] | undefined;
  readonly sourceStatuses?: Readonly<
    Record<string, "fresh" | "stale" | "error" | "missing">
  >;
}): BusinessChainValidationResult {
  const blocking: BusinessChainValidationIssue[] = [];
  const warnings: BusinessChainValidationIssue[] = [];
  const passed: string[] = [];
  const definition = input.definitions.find(
    (candidate) => candidate.id === input.definitionId,
  );
  if (input.projectCustom === true) {
    passed.push("项目级业务链路配置合法");
  } else if (input.template === undefined) {
    blocking.push({
      code: "template_missing",
      message: "项目来源模版不存在",
    });
  } else if (input.template.businessChainMode === "none") {
    blocking.push({
      code: "template_none",
      message: "当前项目模版不使用业务链路",
    });
  } else if (
    definition !== undefined &&
    !input.template.allowedBusinessChainTemplateIds.includes(
      businessChainTemplateId(definition),
    )
  ) {
    blocking.push({
      code: "not_allowed",
      message: "业务链路不在项目模版允许范围内",
    });
  } else {
    passed.push("业务链路属于项目模版允许范围");
  }
  if (definition === undefined) {
    blocking.push({
      code: "definition_missing",
      message: "业务链路定义不存在",
    });
  } else if (!isBusinessChainDefinition(definition)) {
    blocking.push({
      code: "not_business_chain",
      message: "所选定义不是启用的 business-chain",
    });
  } else if (definition.status !== "active") {
    blocking.push({
      code: "definition_inactive",
      message: "业务链路定义未启用",
    });
  } else if (
    definition.scope !== "platform" &&
    definition.workspaceId !== input.workspaceId
  ) {
    blocking.push({
      code: "definition_scope",
      message: "业务链路定义不属于当前项目",
    });
  } else {
    passed.push("业务链路定义已启用");
  }
  const seenStageCodes = new Set<string>();
  const bindingByNode = new Map(
    (input.nodeBindings ?? []).map((binding) => [binding.nodeId, binding]),
  );
  for (const node of definition?.graph?.nodes ?? []) {
    const stageCode = node.businessChain?.stageCode;
    if (stageCode === undefined) {
      blocking.push({
        code: "stage_code_missing",
        nodeId: node.id,
        message: `节点「${node.name}」缺少 stageCode`,
      });
      continue;
    }
    if (seenStageCodes.has(stageCode)) {
      blocking.push({
        code: "stage_code_duplicate",
        nodeId: node.id,
        message: `节点「${node.name}」的 stageCode 重复：${stageCode}`,
      });
    }
    seenStageCodes.add(stageCode);
    const refs =
      bindingByNode.get(node.id)?.externalRefs ??
      node.businessChain?.externalRefs ??
      [];
    for (const ref of refs.filter((item) => item.required)) {
      const status = input.sourceStatuses?.[ref.system];
      if (status === "error" || status === "missing") {
        warnings.push({
          code: "source_unavailable",
          nodeId: node.id,
          message: `节点「${node.name}」的 ${ref.system} 来源暂不可用，配置可先应用`,
        });
      } else if (status === "stale") {
        warnings.push({
          code: "source_stale",
          nodeId: node.id,
          message: `节点「${node.name}」的 ${ref.system} 来源已超过 SLA`,
        });
      }
    }
  }
  if (blocking.length === 0) passed.push("节点 stageCode 与来源绑定有效");
  return {
    blocking,
    warnings,
    passed,
    digest: stableDigest({
      definitionId: input.definitionId,
      nodeBindings: input.nodeBindings ?? [],
    }),
  };
}

