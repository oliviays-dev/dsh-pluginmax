import { describe, expect, it } from "vitest";
import {
  PermissionScopeService,
  type PermissionAssignmentServiceLike,
  type PermissionEmployeeServiceLike,
  type PermissionGrantLike,
  type PermissionPrincipalRuntimeLike,
} from "./permission-scope.js";
import type { PrincipalRecord } from "./principal.js";

function principal(overrides: Partial<PrincipalRecord> = {}): PrincipalRecord {
  return {
    id: "principal-human-alice",
    kind: "human",
    displayName: "Alice",
    status: "active",
    statusAuthority: "system",
    source: "account",
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    ...overrides,
  };
}

function setup(input: {
  readonly principal?: PrincipalRecord;
  readonly grants?: readonly PermissionGrantLike[];
  readonly memberRole?: "owner" | "member" | "guest" | undefined;
  readonly assignments?: PermissionAssignmentServiceLike;
  readonly employee?: PermissionEmployeeServiceLike;
  readonly principalRuntime?: PermissionPrincipalRuntimeLike;
}) {
  const record = input.principal ?? principal();
  return new PermissionScopeService(
    {
      team: {
        members: () =>
          input.memberRole === undefined
            ? []
            : [{ userId: "alice", memberRole: input.memberRole }],
      },
      principals: {
        get: () => record,
        preferredSubjectId: (_principalId, types) =>
          types.includes("auth-user") ? "alice" : undefined,
        grants: () => input.grants ?? [],
      },
      assignments: () => input.assignments,
      employees: () => input.employee,
      principalRuntime: () => input.principalRuntime,
    },
    { now: () => new Date("2026-11-06T00:00:00.000Z") },
  );
}

describe("effective permission scope", () => {
  it("intersects project role and Principal grant actions", () => {
    const service = setup({
      memberRole: "member",
      grants: [
        {
          principalId: "principal-human-alice",
          scopeType: "project",
          scopeId: "workspace-1",
          permissions: ["read"],
          status: "active",
        },
      ],
      assignments: {
        seats: () => [
          {
            seatId: "analyst",
            assigneeKind: "user",
            assigneeId: "alice",
            principalId: "principal-human-alice",
            permissions: ["read", "write"],
            status: "assigned",
          },
        ],
      },
    });

    expect(
      service.resolve({
        workspaceId: "workspace-1",
        principalId: "principal-human-alice",
        requestedActions: ["read", "write"],
      }),
    ).toMatchObject({
      allowed: false,
      allowedActions: ["read"],
      deniedActions: ["write"],
    });
  });

  it("fails closed when a human assignee is outside the project", () => {
    const service = setup({ memberRole: undefined });
    expect(
      service.resolve({
        workspaceId: "workspace-1",
        principalId: "principal-human-alice",
        requestedActions: ["read"],
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["负责人不是当前项目成员"],
    });
  });

  it("intersects Digital Employee tools and resource scopes", () => {
    const ai = principal({
      id: "principal-ai-worker",
      kind: "ai",
      displayName: "Worker",
      source: "ai-companion",
    });
    const service = new PermissionScopeService(
      {
        team: { members: () => [] },
        principals: {
          get: () => ai,
          preferredSubjectId: (_principalId, types) =>
            types.includes("employee") ? "employee-1" : undefined,
          grants: () => [
            {
              principalId: ai.id,
              scopeType: "project",
              scopeId: "workspace-1",
              permissions: ["read", "write"],
              status: "active",
            },
          ],
        },
        assignments: () => ({
          seats: () => [
            {
              seatId: "analyst",
              assigneeKind: "agent",
              assigneeId: "employee-1",
              principalId: ai.id,
              permissions: ["read", "write"],
              status: "assigned",
            },
          ],
        }),
        employees: () => ({
          workflowTarget: () => ({
            assignment: { permissions: ["read", "write"] },
            profile: {
              allowedTools: ["tool:read"],
              deniedTools: ["tool:write"],
              resourceScopes: ["task/task-1"],
              budget: { maxTurns: 10, maxMinutes: 30 },
            },
          }),
        }),
      },
      { now: () => new Date("2026-11-06T00:00:00.000Z") },
    );

    expect(
      service.resolve({
        workspaceId: "workspace-1",
        principalId: ai.id,
        requestedActions: ["read", "write"],
        requestedTools: ["tool:read", "tool:write"],
        requestedResources: ["task/task-1", "task/task-2"],
      }),
    ).toMatchObject({
      allowed: false,
      allowedActions: ["read", "write"],
      allowedTools: ["tool:read"],
      deniedTools: ["tool:write"],
      allowedResources: ["task/task-1"],
      deniedResources: ["task/task-2"],
    });
  });

  it("uses both project and workspace grants for an AI Principal", () => {
    const ai = principal({
      id: "principal-ai-worker",
      kind: "ai",
      source: "ai-companion",
    });
    const service = new PermissionScopeService({
      team: { members: () => [] },
      principals: {
        get: () => ai,
        preferredSubjectId: () => undefined,
        grants: () => [
          {
            principalId: ai.id,
            scopeType: "workspace",
            scopeId: "workspace-1",
            permissions: ["read"],
            status: "active",
          },
          {
            principalId: ai.id,
            scopeType: "project",
            scopeId: "workspace-1",
            permissions: ["read", "write"],
            status: "active",
          },
        ],
      },
      principalRuntime: () => ({
        profile: () => ({ allowedTools: ["tool:read"], status: "active" }),
      }),
    });

    expect(
      service.resolve({
        workspaceId: "workspace-1",
        principalId: ai.id,
        requestedActions: ["read", "write"],
        requestedTools: ["tool:read"],
      }),
    ).toMatchObject({
      allowed: true,
      allowedActions: ["read", "write"],
      allowedTools: ["tool:read"],
    });
  });
});
