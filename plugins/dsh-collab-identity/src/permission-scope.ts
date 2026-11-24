import type { PrincipalGrant, PrincipalRecord } from "./principal.js";

const PROJECT_ACTIONS = [
  "read",
  "write",
  "approve",
  "manage_members",
  "manage_roles",
] as const;

export interface PermissionGrantLike {
  readonly principalId: string;
  readonly scopeType: "platform" | "workspace" | "project";
  readonly scopeId: string;
  readonly permissions: readonly string[];
  readonly status: "active" | "revoked" | "expired";
  readonly expiresAt?: string | undefined;
}

export interface PermissionPrincipalServiceLike {
  get(principalId: string): PrincipalRecord;
  preferredSubjectId(
    principalId: string,
    subjectTypes: readonly ("auth-user" | "employee" | "teammate" | "hrm")[],
  ): string | undefined;
  grants(principalId?: string): readonly PermissionGrantLike[];
}

export interface PermissionTeamServiceLike {
  members(workspaceId: string): readonly {
    readonly userId: string;
    readonly memberRole: "owner" | "member" | "guest";
  }[];
}

export interface PermissionAssignmentServiceLike {
  seats(workspaceId: string): readonly {
    readonly seatId: string;
    readonly assigneeKind: "user" | "agent";
    readonly assigneeId: string;
    readonly principalId?: string | undefined;
    readonly permissions: readonly string[];
    readonly status: "claimed" | "assigned" | "released";
  }[];
}

export interface PermissionEmployeeServiceLike {
  workflowTarget(
    employeeId: string,
    workspaceId: string,
  ):
    | {
        readonly assignment: {
          readonly permissions: readonly string[];
        };
        readonly profile: {
          readonly allowedTools: readonly string[];
          readonly deniedTools: readonly string[];
          readonly resourceScopes: readonly string[];
          readonly budget: {
            readonly maxTurns: number;
            readonly maxMinutes: number;
          };
        };
      }
    | undefined;
}

export interface PermissionPrincipalRuntimeLike {
  profile(
    principalId: string,
    workspaceId: string,
  ):
    | {
        readonly allowedTools: readonly string[];
        readonly status: "active" | "disabled";
      }
    | undefined;
}

export interface EffectivePermissionInput {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly requestedActions: readonly string[];
  readonly requestedTools?: readonly string[];
  readonly requestedResources?: readonly string[];
}

export interface EffectivePermission {
  readonly allowed: boolean;
  readonly allowedActions: readonly string[];
  readonly deniedActions: readonly string[];
  readonly allowedTools: readonly string[];
  readonly deniedTools: readonly string[];
  readonly allowedResources: readonly string[];
  readonly deniedResources: readonly string[];
  readonly reasons: readonly string[];
}

export interface PermissionScopeOptions {
  readonly now?: (() => Date) | undefined;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function intersect(
  requested: readonly string[],
  ...allowedSets: readonly (readonly string[])[]
): string[] {
  const requestedValues = unique(requested);
  return requestedValues.filter((value) =>
    allowedSets.every((allowed) => allowed.includes(value)),
  );
}

function defaultMemberActions(role: "owner" | "member" | "guest"): string[] {
  if (role === "guest") return ["read"];
  if (role === "member") return ["read", "write"];
  return [...PROJECT_ACTIONS];
}

function resourceAllowed(
  requested: string,
  scopes: readonly string[],
): boolean {
  return scopes.some(
    (scope) => requested === scope || requested.startsWith(`${scope}/`),
  );
}

/**
 * Read-only effective task scope resolver. It never persists permission data
 * and always resolves from the owning public services at call time.
 */
export class PermissionScopeService {
  private readonly now: () => Date;

  constructor(
    private readonly deps: {
      readonly team: PermissionTeamServiceLike;
      readonly principals: PermissionPrincipalServiceLike;
      readonly assignments?:
        (() => PermissionAssignmentServiceLike | undefined) | undefined;
      readonly employees?:
        (() => PermissionEmployeeServiceLike | undefined) | undefined;
      readonly principalRuntime?:
        (() => PermissionPrincipalRuntimeLike | undefined) | undefined;
    },
    options: PermissionScopeOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  resolve(input: EffectivePermissionInput): EffectivePermission {
    const requestedActions = unique(input.requestedActions);
    const requestedTools = unique(input.requestedTools ?? []);
    const requestedResources = unique(input.requestedResources ?? []);
    const reasons: string[] = [];
    let principal: PrincipalRecord;
    try {
      principal = this.deps.principals.get(input.principalId);
    } catch {
      return this.deny(requestedActions, requestedTools, requestedResources, [
        "Principal 不存在",
      ]);
    }
    if (principal.status !== "active") {
      return this.deny(requestedActions, requestedTools, requestedResources, [
        "Principal 非 active 状态",
      ]);
    }

    const now = this.now().getTime();
    const grants = this.deps.principals
      .grants(principal.id)
      .filter(
        (
          grant,
        ): grant is PermissionGrantLike & { readonly expiresAt?: string } =>
          grant.status === "active" &&
          (grant.scopeType === "workspace" || grant.scopeType === "project") &&
          grant.scopeId === input.workspaceId &&
          (grant.expiresAt === undefined ||
            (Number.isFinite(Date.parse(grant.expiresAt)) &&
              Date.parse(grant.expiresAt) > now)),
      );
    const grantActions = unique(grants.flatMap((grant) => grant.permissions));

    const authUserId =
      principal.kind === "human"
        ? this.deps.principals.preferredSubjectId(principal.id, ["auth-user"])
        : undefined;
    const member =
      authUserId === undefined
        ? undefined
        : this.deps.team
            .members(input.workspaceId)
            .find((candidate) => candidate.userId === authUserId);
    if (principal.kind === "human" && member === undefined) {
      return this.deny(requestedActions, requestedTools, requestedResources, [
        "负责人不是当前项目成员",
      ]);
    }

    const assignmentService = this.deps.assignments?.();
    const employeeId = this.deps.principals.preferredSubjectId(principal.id, [
      "employee",
    ]);
    const teammateId = this.deps.principals.preferredSubjectId(principal.id, [
      "teammate",
    ]);
    const assignments =
      assignmentService?.seats(input.workspaceId).filter((assignment) => {
        if (assignment.status === "released") return false;
        if (assignment.principalId === principal.id) return true;
        const assigneeId =
          assignment.assigneeKind === "user"
            ? authUserId
            : (teammateId ?? employeeId);
        return assigneeId !== undefined && assignment.assigneeId === assigneeId;
      }) ?? [];
    const seatActions = unique(
      assignments.flatMap((assignment) => assignment.permissions),
    );
    const projectActions =
      member === undefined
        ? grantActions
        : seatActions.length > 0
          ? seatActions
          : defaultMemberActions(member.memberRole);

    let allowedActions =
      grantActions.length === 0 && principal.kind === "human"
        ? intersect(requestedActions, projectActions)
        : intersect(requestedActions, projectActions, grantActions);

    let allowedTools = requestedTools;
    let deniedTools: string[] = [];
    let allowedResources = requestedResources;
    let deniedResources: string[] = [];
    const employee =
      employeeId === undefined
        ? undefined
        : this.deps
            .employees?.()
            ?.workflowTarget(employeeId, input.workspaceId);
    if (employee !== undefined) {
      allowedActions = intersect(
        allowedActions,
        employee.assignment.permissions,
      );
      const profileTools = unique(employee.profile.allowedTools);
      allowedTools =
        profileTools.length === 0
          ? requestedTools
          : intersect(requestedTools, profileTools);
      deniedTools = intersect(requestedTools, employee.profile.deniedTools);
      allowedTools = allowedTools.filter((tool) => !deniedTools.includes(tool));
      const profileResources = unique(employee.profile.resourceScopes);
      if (profileResources.length > 0) {
        const permit = requestedResources.filter((resource) =>
          resourceAllowed(resource, profileResources),
        );
        deniedResources = requestedResources.filter(
          (resource) => !permit.includes(resource),
        );
        allowedResources = permit;
      }
    } else if (principal.kind === "ai") {
      const profile = this.deps
        .principalRuntime?.()
        ?.profile(principal.id, input.workspaceId);
      if (profile === undefined || profile.status !== "active") {
        reasons.push("AI Principal 缺少启用的 Runtime Profile");
        allowedActions = [];
        allowedTools = [];
      } else {
        const profileTools = unique(profile.allowedTools);
        allowedTools =
          profileTools.length === 0
            ? requestedTools
            : intersect(requestedTools, profileTools);
      }
    }

    const deniedActions = requestedActions.filter(
      (action) => !allowedActions.includes(action),
    );
    if (deniedActions.length > 0) {
      reasons.push(`缺少动作权限：${deniedActions.join(", ")}`);
    }
    if (deniedTools.length > 0) {
      reasons.push(`工具被负责人配置拒绝：${deniedTools.join(", ")}`);
    }
    if (deniedResources.length > 0) {
      reasons.push(`资源超出负责人范围：${deniedResources.join(", ")}`);
    }
    return {
      allowed:
        deniedActions.length === 0 &&
        deniedTools.length === 0 &&
        deniedResources.length === 0 &&
        reasons.length === 0,
      allowedActions,
      deniedActions,
      allowedTools,
      deniedTools,
      allowedResources,
      deniedResources,
      reasons,
    };
  }

  private deny(
    actions: readonly string[],
    tools: readonly string[],
    resources: readonly string[],
    reasons: readonly string[],
  ): EffectivePermission {
    return {
      allowed: false,
      allowedActions: [],
      deniedActions: [...actions],
      allowedTools: [],
      deniedTools: [...tools],
      allowedResources: [],
      deniedResources: [...resources],
      reasons: [...reasons],
    };
  }
}

export type { PrincipalGrant };
