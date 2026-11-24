import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  bearerToken,
  readJsonBody,
  sameOrigin,
  sendJson,
} from "@pluginmax/shared";
import { z } from "zod";
import {
  allowedBusinessChainDefinitions,
  businessChainTemplateId,
  defaultBusinessChainDefinition,
  validateBusinessChainSelection,
  type BusinessChainDefinitionLike,
} from "./business-chain.js";
import {
  hydrateOverviewAlerts,
  ProjectProgressOverviewService,
} from "./progress-overview.js";
import {
  MockScenarioSourceRegistry,
  type ProgressSourceRegistryLike,
} from "./progress-sources.js";
import {
  ProjectError,
  ProjectService,
  projectDomainSpec,
  type KvTableLike,
} from "./service.js";
import {
  projectHealthSchema,
  projectDemoDataDocumentSchema,
  projectMemberKindSchema,
  projectReportScheduleSchema,
  projectReportTypeSchema,
  projectRoleDefinitionSchema,
  projectStatusSchema,
  roleCategorySchema,
  roleMappingAssigneeSchema,
  rolePermissionSchema,
  type ProjectAuditRecord,
  type BusinessChainExternalRef,
  type BusinessChainNodeBinding,
  type ProjectDemoDataConfig,
  type ProjectAlertRecord,
  type ProjectRecord,
  type ProjectRoleDefinition,
  type ProjectReportRecord,
  type ProjectReportSchedule,
  type ProjectReportType,
  type ProjectRoleRecord,
  type ProjectTemplateRecord,
  type RolePermission,
  type RoleMappingAssignee,
} from "./types.js";

export const name = "dsh-collab-project";
export const inject = ["storageDomain", "webServer"];

export { ProjectError, ProjectService, projectDomainSpec };
export {
  allowedBusinessChainDefinitions,
  businessChainTemplateId,
  defaultBusinessChainDefinition,
  validateBusinessChainSelection,
} from "./business-chain.js";
export type {
  BusinessChainDefinitionLike,
  BusinessChainValidationIssue,
  BusinessChainValidationResult,
} from "./business-chain.js";
export {
  hydrateOverviewAlerts,
  ProjectProgressOverviewService,
} from "./progress-overview.js";
export type {
  ProjectAlertCandidate,
  ProjectAlertView,
  ProjectProgressOverview,
  ProgressOverviewBuildResult,
  ProgressOverviewInput,
} from "./progress-overview.js";
export {
  extractMockSnapshot,
  MockScenarioSourceRegistry,
  mockSourceHealthLabel,
} from "./progress-sources.js";
export type {
  ProgressSourceRegistryLike,
  ProgressSourceResult,
  ProgressSourceStatus,
} from "./progress-sources.js";
export type {
  BusinessChainExternalRef,
  BusinessChainMode,
  BusinessChainNodeBinding,
  BusinessChainVersionPolicy,
  ProjectAlertLifecycle,
  ProjectAlertRecord,
  ProjectAuditRecord,
  ProjectBusinessChainBinding,
  ProjectDemoDataConfig,
  ProjectDemoDataDocument,
  ProjectRecord,
  ProjectRoleDefinition,
  ProjectReportRecord,
  ProjectReportSchedule,
  ProjectRoleRecord,
  ProjectTemplateRecord,
  RoleMappingAssignee,
  RoleMappingPreset,
} from "./types.js";

interface WebRouteLike {
  readonly kind: "exact";
  readonly path: string;
  handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> | void;
}

type GlobalRole = "admin" | "owner" | "member" | "guest";
type MemberRole = "owner" | "member" | "guest";

interface TeamPrincipalLike {
  readonly userId: string;
  readonly role: GlobalRole;
}

interface WorkspaceUserLike {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

interface WorkspaceMemberLike {
  readonly userId: string;
  readonly name?: string;
  readonly memberRole: MemberRole;
  readonly addedAt?: string;
  readonly addedBy?: string;
}

interface TeamServiceLike {
  resolveToken(token: string): TeamPrincipalLike | undefined;
  users(): readonly WorkspaceUserLike[];
  members(workspaceId: string): readonly WorkspaceMemberLike[];
  addMember(
    actorId: string,
    input: {
      readonly workspaceId: string;
      readonly userId: string;
      readonly role: MemberRole;
    },
    options?: {
      readonly allowWorkspaceOwner?: boolean;
      readonly allowSelfOwnerBootstrap?: boolean;
    },
  ): Promise<unknown>;
  removeMember(
    actorId: string,
    input: { readonly workspaceId: string; readonly userId: string },
    options?: { readonly allowWorkspaceOwner?: boolean },
  ): Promise<unknown>;
  leaveWorkspace?(actorId: string, workspaceId: string): Promise<unknown>;
  audit?(filter: {
    readonly action?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): readonly TeamAuditRecordLike[];
}

interface TeamAuditRecordLike {
  readonly id: string;
  readonly at: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly targetId?: string;
  readonly workspaceId?: string;
  readonly detail: Readonly<Record<string, string>>;
}

interface WorkspaceLike {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  setTitle?(title: string): Promise<void>;
}

interface WorkspaceRegistryLike {
  get(workspaceId: string): WorkspaceLike | undefined;
  list(): readonly WorkspaceLike[];
  create?(path: string, title?: string): Promise<WorkspaceLike>;
}

interface WorkspaceViewLike {
  readonly workspaceId?: string;
  readonly id?: string;
}

/**
 * 宿主工作区控制器的变更流：先给一份 baseline，之后逐条增量。
 * 项目管理用它把「项目编号」绑定到项目创建时刻，而不是等页面读取时才补。
 */
interface WorkspaceFollowFrameLike {
  readonly type: "baseline" | "upsert" | "remove" | "order" | "archived";
  readonly value?: { readonly items?: readonly WorkspaceViewLike[] };
  readonly workspace?: WorkspaceViewLike;
}

interface WorkspaceControllerLike {
  follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrameLike>;
}

interface SeatLike {
  readonly id: string;
  readonly label: string;
  readonly participantKind: string;
  readonly personaId?: string | undefined;
  readonly permissions: readonly string[];
}

interface WorkspaceRoleConfigLike {
  readonly workspaceId: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly seats: readonly SeatLike[];
}

interface AssignmentLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly seatId: string;
  readonly seatLabel: string;
  readonly assigneeKind: "user" | "agent";
  readonly assigneeId: string;
  readonly principalId?: string | undefined;
  readonly status: "claimed" | "assigned" | "released";
  readonly personaId?: string | undefined;
}

interface RoleActorLike {
  readonly kind: "user" | "agent";
  readonly id: string;
  readonly globalRole?: GlobalRole | undefined;
  readonly workspaceRole?: MemberRole | undefined;
}

interface WorkspaceTypeLike {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly seats: readonly SeatLike[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AssignmentServiceLike {
  config(workspaceId: string): WorkspaceRoleConfigLike;
  seats(workspaceId: string): readonly AssignmentLike[];
  materialize(
    actor: RoleActorLike,
    workspaceId: string,
    type: WorkspaceTypeLike,
  ): Promise<WorkspaceRoleConfigLike>;
  assign(
    actor: RoleActorLike,
    input: {
      readonly workspaceId: string;
      readonly seatId: string;
      readonly assigneeKind: "user" | "agent";
      readonly assigneeId: string;
      readonly personaId?: string;
    },
  ): Promise<AssignmentLike>;
  release(
    actor: RoleActorLike,
    workspaceId: string,
    seatId: string,
    target?: {
      readonly assigneeKind: "user" | "agent";
      readonly assigneeId: string;
    },
  ): Promise<unknown>;
}

interface EmployeeLike {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "human" | "digital";
  readonly status: string;
  readonly principalId?: string | undefined;
  readonly authUserId?: string | undefined;
  readonly managerEmployeeId?: string | undefined;
}

interface EmployeeServiceLike {
  list(): readonly EmployeeLike[];
  employeeWorkspaceTarget(
    employeeId: string,
    workspaceId: string,
  ): unknown | undefined;
}

interface TeammateLike {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly ownerName: string;
  readonly source: "platform" | "personal";
  readonly avatar: string;
  readonly employeeId?: string | undefined;
  readonly personaId?: string | undefined;
}

interface TeammateRuntimeLike {
  assignable(
    actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: GlobalRole;
    },
    workspaceId?: string,
  ): readonly TeammateLike[];
  isSystemAgent?(ref: string): boolean;
  isProjectManagedAgent?(ref: string): boolean;
  ensureProjectManagerAgent?(input: {
    readonly workspaceId: string;
    readonly projectName: string;
    readonly actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: GlobalRole;
    };
  }): Promise<TeammateLike>;
  projectManagerFor?(workspaceId: string): TeammateLike | undefined;
  renameProjectManager?(input: {
    readonly workspaceId: string;
    readonly projectName: string;
    readonly actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: GlobalRole;
    };
  }): Promise<TeammateLike | undefined>;
  ensureRuntime?(input: {
    readonly teammateId: string;
    readonly workspaceId: string;
    readonly actor: {
      readonly userId: string;
      readonly name: string;
      readonly role: GlobalRole;
    };
    readonly workspaceRole?: MemberRole | undefined;
  }): Promise<{
    readonly teammateId: string;
    readonly principalId?: string | undefined;
    readonly profileId: string;
    readonly personaId?: string | undefined;
    readonly execution?: "builtin" | "external" | undefined;
  }>;
}

interface TaskLike {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly receiverName?: string | undefined;
  readonly due?: string | undefined;
  readonly archivedAt?: string | undefined;
  readonly progress?: number | undefined;
  readonly receiverState?: "active" | "needs_reassignment" | undefined;
  readonly reassignmentReason?: string | undefined;
  readonly needsInput?: boolean | undefined;
  readonly queueState?: "idle" | "blocked" | "paused" | undefined;
  readonly executionAnomaly?:
    | {
        readonly code: string;
        readonly message: string;
        readonly at: string;
      }
    | undefined;
  readonly comments?:
    | readonly {
        readonly id: string;
        readonly at: string;
        readonly authorName: string;
        readonly content: string;
        readonly isKeyConsensus?: boolean | undefined;
      }[]
    | undefined;
  readonly workflow?:
    | {
        readonly instanceId?: string | undefined;
        readonly instanceTitle?: string | undefined;
        readonly nodeId?: string | undefined;
        readonly nodeName?: string | undefined;
      }
    | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface TaskServiceLike {
  list(workspaceId: string): readonly TaskLike[];
  markRoleUnavailable?(
    workspaceId: string,
    roles: ReadonlyMap<string, string>,
    skipTaskIds?: ReadonlySet<string>,
  ): Promise<number>;
}

interface TaskDocumentLike {
  readonly id: string;
  readonly kind: "produced" | "uploaded";
  readonly name: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mimeType: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly available: boolean;
}

interface TaskDocumentQueryServiceLike {
  list(
    taskId: string,
    options?: {
      readonly includeUploaded?: boolean;
      readonly maxFiles?: number;
    },
  ): Promise<{
    readonly workspaceReady: boolean;
    readonly documents: readonly TaskDocumentLike[];
  }>;
}

interface PrincipalRecordLike {
  readonly id: string;
  readonly kind: "human" | "ai";
  readonly displayName: string;
  readonly status: "active" | "suspended" | "archived";
}

interface PrincipalBindingLike {
  readonly subjectType: "auth-user" | "employee" | "teammate" | "hrm";
  readonly subjectId: string;
}

interface PrincipalServiceLike {
  resolveReference(reference: string): PrincipalRecordLike | undefined;
  resolveSubject(
    subjectType: "auth-user" | "employee" | "teammate",
    subjectId: string,
  ): PrincipalRecordLike | undefined;
  bindings(principalId: string): readonly PrincipalBindingLike[];
  preferredSubjectId(
    principalId: string,
    subjectTypes: readonly ("auth-user" | "employee" | "teammate" | "hrm")[],
  ): string | undefined;
  syncExclusiveGrant(input: {
    readonly principalId: string;
    readonly scopeType: "workspace";
    readonly scopeId: string;
    readonly role: string;
    readonly permissions: readonly string[];
    readonly grantedByPrincipalId?: string;
  }): Promise<unknown>;
  revokeMatchingGrants(input: {
    readonly principalId: string;
    readonly scopeType: "workspace";
    readonly scopeId: string;
    readonly role: string;
  }): Promise<unknown>;
}

interface WorkflowInstanceLike {
  readonly id: string;
  readonly definitionId?: string | undefined;
  readonly definitionKey: string;
  readonly definitionVersion: number;
  readonly title: string;
  readonly status: string;
  readonly createdAt?: string | undefined;
  readonly updatedAt: string;
  readonly assignmentBindings?: Readonly<
    Record<
      string,
      {
        readonly primaryAssignee?: {
          readonly name?: string | undefined;
          readonly id?: string | undefined;
        };
        readonly source?: {
          readonly label?: string | undefined;
        };
      }
    >
  >;
  readonly nodes?:
    | Readonly<
        Record<
          string,
          {
            readonly status: string;
            readonly attempts?: number | undefined;
            readonly assignedTo?: string | undefined;
            readonly enteredAt?: string | undefined;
            readonly completedAt?: string | undefined;
            readonly taskIds?: readonly string[] | undefined;
            readonly note?: string | undefined;
            readonly approvals?: Readonly<
              Record<
                string,
                {
                  readonly status: string;
                  readonly at?: string | undefined;
                }
              >
            >;
          }
        >
      >
    | undefined;
  readonly roleSnapshot?: Record<
    string,
    { readonly roleId?: string } | undefined
  >;
}

interface WorkflowArtifactLike {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

interface WorkflowSubmissionLike {
  readonly id: string;
  readonly instanceId: string;
  readonly nodeId: string;
  readonly requirementKey: string;
  readonly requirementTitle: string;
  readonly type: "file" | "text" | "link";
  readonly artifacts: readonly WorkflowArtifactLike[];
  readonly submittedByName: string;
  readonly submittedAt: string;
  readonly status: "submitted" | "rejected";
}

interface WorkflowNodeLike {
  readonly id: string;
  readonly name: string;
  readonly executor: {
    readonly kind: string;
    readonly id: string;
    readonly label?: string | undefined;
  };
  readonly approvers: readonly {
    readonly kind: string;
    readonly id: string;
    readonly name: string;
  }[];
  readonly businessChain?: {
    readonly sequence?: number | undefined;
    readonly stageCode?: string | undefined;
    readonly summaryMetric?: string | undefined;
    readonly externalRefs?: readonly BusinessChainExternalRef[] | undefined;
    readonly fields?:
      | readonly {
          readonly key: string;
          readonly label: string;
          readonly bindings: readonly {
            readonly system: string;
            readonly objectId: string;
            readonly path: string;
          }[];
        }[]
      | undefined;
  };
}

interface WorkflowDefinitionLike {
  readonly id: string;
  readonly key: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly workspaceId: string;
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
    readonly nodes: readonly WorkflowNodeLike[];
    readonly edges?: readonly {
      readonly from: string;
      readonly to: string;
    }[];
  };
}

interface WorkflowEventLike {
  readonly id: string;
  readonly nodeId?: string | undefined;
  readonly kind: string;
  readonly message: string;
  readonly at: string;
  readonly actorName?: string | undefined;
  readonly data?: Record<string, unknown>;
}

interface WorkflowServiceLike {
  instances(workspaceId: string): readonly WorkflowInstanceLike[];
  instance?(instanceId: string): WorkflowInstanceLike | undefined;
  discardInstance?(instanceId: string): Promise<boolean>;
  definition?(definitionId: string): WorkflowDefinitionLike | undefined;
  events?(instanceId: string): readonly WorkflowEventLike[];
  submissions?(instanceId: string): readonly WorkflowSubmissionLike[];
  sharedDefinitions?(): readonly WorkflowDefinitionLike[];
}

interface MeetingOutputLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: string;
  readonly createdBy: string;
  readonly updatedAt: string;
}

interface MeetingServiceLike {
  list(workspaceId: string): readonly MeetingOutputLike[];
  get(meetingId: string): MeetingOutputLike;
}

interface MeetingFileLike {
  readonly id: string;
  readonly meetingId: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly uploadedBy: string;
  readonly createdAt: string;
}

interface MeetingFileServiceLike {
  list(meetingId: string): readonly MeetingFileLike[];
}

interface MeetingMinuteVersionLike {
  readonly id: string;
  readonly meetingId: string;
  readonly version: number;
  readonly content: string;
  readonly status: string;
  readonly requestedBy: string;
  readonly confirmedBy?: string | undefined;
  readonly updatedAt: string;
}

interface MeetingMinutesServiceLike {
  activeVersion(meetingId: string): MeetingMinuteVersionLike | undefined;
}

interface DataAgentConversationOutputLike {
  readonly id: string;
  readonly title: string;
  readonly workspaceId: string;
  readonly ownerUserId: string;
}

interface DataAgentReportOutputLike {
  readonly id: string;
  readonly conversationId: string;
  readonly title: string;
  readonly markdown: string;
  readonly version: number;
  readonly createdAt: string;
}

interface DataAgentOutputServiceLike {
  projectReports(workspaceId: string): readonly {
    readonly conversation: DataAgentConversationOutputLike;
    readonly report: DataAgentReportOutputLike;
  }[];
  conversation(conversationId: string): DataAgentConversationOutputLike;
  report(reportId: string): DataAgentReportOutputLike;
}

export interface ProjectDependencies {
  readonly team: TeamServiceLike;
  readonly workspaces: WorkspaceRegistryLike;
  readonly assignments: () => AssignmentServiceLike | undefined;
  readonly employees: () => EmployeeServiceLike | undefined;
  readonly teammates: () => TeammateRuntimeLike | undefined;
  readonly tasks: () => TaskServiceLike | undefined;
  readonly taskDocuments?: () => TaskDocumentQueryServiceLike | undefined;
  readonly workflows: () => WorkflowServiceLike | undefined;
  readonly meetings?: () => MeetingServiceLike | undefined;
  readonly meetingFiles?: () => MeetingFileServiceLike | undefined;
  readonly meetingMinutes?: () => MeetingMinutesServiceLike | undefined;
  readonly dataAgent?: () => DataAgentOutputServiceLike | undefined;
  readonly principals?: () => PrincipalServiceLike | undefined;
  readonly skillCatalog?: () => ProjectSkillCatalogLike | undefined;
  readonly agent?: () => ProjectAgentServiceLike | undefined;
  readonly progressSources?: () => ProgressSourceRegistryLike | undefined;
  readonly now?: () => Date;
}

interface ProjectReportAgentRunLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly source: "workflow" | "task" | "meeting" | "chat";
  readonly instanceId: string;
  readonly createdBy: string;
  readonly sessionId?: string | undefined;
  readonly status: string;
  readonly output?: { readonly summary: string } | undefined;
  readonly error?: string | undefined;
}

interface ProjectReportAgentServiceLike {
  runs(filter?: {
    readonly workspaceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }): readonly ProjectReportAgentRunLike[];
}

interface ProjectAgentServiceLike {
  run?(runId: string): ProjectReportAgentRunLike | undefined;
  runs(filter?: {
    readonly workspaceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }): readonly ProjectReportAgentRunLike[];
  dispatch(input: {
    readonly workspaceId: string;
    readonly workspacePath?: string | undefined;
    readonly profileId: string;
    readonly source: "chat";
    readonly instanceId: string;
    readonly nodeId: string;
    readonly dispatchKey: string;
    readonly trigger: "manual-dispatch";
    readonly attempt: number;
    readonly runSeq: number;
    readonly maxAttempts: number;
    readonly timeoutMs: number;
    readonly personaId?: string | undefined;
    readonly principalId?: string | undefined;
    readonly principalType?: "principal-runtime" | undefined;
    readonly payload: {
      readonly instanceTitle: string;
      readonly nodeName: string;
      readonly nodeDescription: string;
      readonly profileName: string;
      readonly deliverables: readonly [];
      readonly context: Readonly<Record<string, string | number | boolean>>;
    };
    readonly createdBy: string;
  }): Promise<ProjectReportAgentRunLike>;
}

interface ProjectSkillCatalogLike {
  resolveSkills(
    principal: { readonly userId: string },
    skillIds: readonly string[],
    options?: { readonly requireInstallation?: boolean },
  ): Promise<
    readonly {
      readonly id: string;
      readonly name?: string | undefined;
      readonly version: string;
      readonly instructions?: string | undefined;
    }[]
  >;
}

const PROJECT_REPORTING_SKILL_ID = "skill-project-reporting";
const DEFAULT_PROJECT_REPORTING_SKILL_VERSION = "1.0.0";

interface ProjectToolExecLike {
  readonly signal?: AbortSignal | undefined;
  readonly agent?: {
    readonly session?: { readonly id?: string };
  };
}

interface ProjectToolDefinitionLike {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly output: {
    readonly schema: { readonly type: "string" };
    render(
      args: unknown,
      value: string,
    ): Array<{ readonly type: "text"; readonly text: string }>;
  };
  execute(args: unknown, exec: ProjectToolExecLike): Promise<string>;
}

interface ProjectContext {
  storageDomain: {
    open(spec: typeof projectDomainSpec): Promise<ProjectDomainLike>;
  };
  effect(register: () => () => void): void;
  provide(key: "collabProjects", value: ProjectService): unknown;
  webServer: { register(route: WebRouteLike): unknown };
  tools?: {
    get?(name: string): unknown;
    register(definition: ProjectToolDefinitionLike): () => void;
  };
  get(key: string): unknown;
  inject(
    keys: readonly ["collabTeam"],
    callback: (
      child: ProjectContext & { readonly collabTeam: TeamServiceLike },
    ) => void,
  ): { dispose(): void };
  inject(
    keys: readonly ["collabTeam", "workspaceController"],
    callback: (
      child: ProjectContext & {
        readonly collabTeam: TeamServiceLike;
        readonly workspaceController: WorkspaceControllerLike;
      },
    ) => void,
  ): { dispose(): void };
}

interface ProjectDomainLike {
  table(name: "projects"): KvTableLike<ProjectRecord>;
  table(name: "templates"): KvTableLike<ProjectTemplateRecord>;
  table(name: "roles"): KvTableLike<ProjectRoleRecord>;
  table(name: "reports"): KvTableLike<ProjectReportRecord>;
  table(name: "audit"): KvTableLike<ProjectAuditRecord>;
  table(name: "alerts"): KvTableLike<ProjectAlertRecord>;
  close(): Promise<void>;
}

const PERMISSION_LABEL: Record<string, string> = {
  read: "查看",
  write: "编辑",
  approve: "审批",
  manage_members: "成员管理",
  manage_roles: "角色管理",
};

const USER_ROLE_LABEL: Record<string, string> = {
  admin: "平台管理员",
  owner: "平台负责人",
  member: "平台成员",
  guest: "平台访客",
};

/** 平台角色只读展示：只取账号的全局角色，不与工作区成员角色混用。 */
function platformRoleLabel(userRole: string | undefined): string {
  return USER_ROLE_LABEL[userRole ?? ""] ?? "平台成员";
}

function globalRoleOf(userRole: string): GlobalRole {
  if (
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "member" ||
    userRole === "guest"
  ) {
    return userRole;
  }
  return "member";
}

function projectTeammateActors(team: TeamServiceLike): readonly {
  userId: string;
  name: string;
  role: GlobalRole;
}[] {
  return [
    ...team.users().map((user) => ({
      userId: user.id,
      name: user.name,
      role: globalRoleOf(user.role),
    })),
    {
      userId: "platform",
      name: "平台",
      role: "admin",
    },
  ];
}

function scopeLabel(permissions: readonly string[]): string {
  const labels = [...new Set(permissions)]
    .map((permission) => PERMISSION_LABEL[permission] ?? permission)
    .filter((label) => label !== "");
  return labels.length === 0 ? "未分配" : labels.join("、");
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

export interface ProjectReportScheduleClock {
  readonly date: string;
  readonly time: string;
  readonly weekday: number;
  readonly dayOfMonth: number;
}

/** 按计划时区计算日期、时间与周几，避免依赖服务端进程本地时区。 */
export function projectReportScheduleClock(
  value: Date,
  timezone = "Asia/Shanghai",
): ProjectReportScheduleClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const date = `${year}-${month}-${day}`;
  return {
    date,
    time: `${part("hour").padStart(2, "0")}:${part("minute").padStart(2, "0")}`,
    weekday: new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    ).getUTCDay(),
    dayOfMonth: Number(day),
  };
}

/** 判断计划在本次调度检查时是否到期；到达时间后当天仍会补跑。 */
export function isProjectReportScheduleDue(
  schedule: ProjectReportSchedule,
  clock: ProjectReportScheduleClock,
): boolean {
  if (!schedule.enabled || clock.time < schedule.time) return false;
  if (schedule.frequency === "weekdays") {
    return clock.weekday >= 1 && clock.weekday <= 5;
  }
  if (schedule.frequency === "weekly") {
    return clock.weekday === schedule.weekday;
  }
  if (schedule.frequency === "monthly") {
    return clock.dayOfMonth === schedule.dayOfMonth;
  }
  return true;
}

function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

function principal(
  request: IncomingMessage,
  team: TeamServiceLike,
): TeamPrincipalLike {
  const token = bearerToken({
    get(name) {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  if (token === undefined) {
    throw new ProjectError("unauthorized", "bearer token is required");
  }
  const resolved = team.resolveToken(token);
  if (resolved === undefined) {
    throw new ProjectError("unauthorized", "invalid or expired token");
  }
  return resolved;
}

function memberRoleOf(
  team: TeamServiceLike,
  workspaceId: string,
  userId: string,
): MemberRole | undefined {
  return team.members(workspaceId).find((member) => member.userId === userId)
    ?.memberRole;
}

function resolveMemberIdentity(
  principals: PrincipalServiceLike | undefined,
  memberKind: "human" | "agent",
  memberId: string,
): {
  readonly memberKind: "human" | "agent";
  readonly memberId: string;
  readonly principalId?: string;
} {
  if (principals === undefined) return { memberKind, memberId };
  const principal = principals.resolveReference(memberId);
  if (principal === undefined) return { memberKind, memberId };
  if (principal.status === "archived") {
    throw new ProjectError("conflict", "已归档主体不能加入项目");
  }
  if (principal.kind === "human") {
    const authUserId = principals.preferredSubjectId(principal.id, [
      "auth-user",
    ]);
    if (authUserId === undefined) {
      throw new ProjectError("invalid_input", "该人类主体没有可用的登录账号");
    }
    return {
      memberKind: "human",
      memberId: authUserId,
      principalId: principal.id,
    };
  }
  const agentId = principals.preferredSubjectId(principal.id, [
    "teammate",
    "employee",
  ]);
  if (agentId === undefined) {
    throw new ProjectError("invalid_input", "该 AI 主体没有可用的伙伴实例");
  }
  return {
    memberKind: "agent",
    memberId: agentId,
    principalId: principal.id,
  };
}

function requireWorkspaceAccess(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
): TeamPrincipalLike {
  const current = principal(request, team);
  if (
    current.role !== "admin" &&
    memberRoleOf(team, workspaceId, current.userId) === undefined
  ) {
    throw new ProjectError("forbidden", "workspace membership is required");
  }
  return current;
}

/**
 * 项目级管理权限：平台管理员或项目（工作区）负责人。
 * 平台级账号与平台角色不在这里维护，因此非管理员只能管理自己负责的项目。
 */
function requireProjectManager(
  request: IncomingMessage,
  team: TeamServiceLike,
  workspaceId: string,
): TeamPrincipalLike {
  const current = requireWorkspaceAccess(request, team, workspaceId);
  if (
    current.role !== "admin" &&
    memberRoleOf(team, workspaceId, current.userId) !== "owner"
  ) {
    throw new ProjectError(
      "forbidden",
      "workspace owner or platform admin is required",
    );
  }
  return current;
}

function requirePlatformAdmin(
  request: IncomingMessage,
  team: TeamServiceLike,
): TeamPrincipalLike {
  const current = principal(request, team);
  if (current.role !== "admin") {
    throw new ProjectError("forbidden", "platform admin is required");
  }
  return current;
}

function actorOf(
  current: TeamPrincipalLike,
  team: TeamServiceLike,
  workspaceId: string,
): RoleActorLike {
  const workspaceRole = memberRoleOf(team, workspaceId, current.userId);
  return {
    kind: "user",
    id: current.userId,
    globalRole: current.role,
    ...(workspaceRole === undefined ? {} : { workspaceRole }),
  };
}

function assertSameOrigin(request: IncomingMessage): void {
  if (
    request.headers.origin !== undefined &&
    !sameOrigin(request.headers.origin, request.headers.host)
  ) {
    throw new ProjectError("forbidden", "same-origin request is required");
  }
}

function query(request: IncomingMessage): URLSearchParams {
  return new URL(request.url ?? "/", "http://dsh.invalid").searchParams;
}

function routeError(response: ServerResponse, cause: unknown): void {
  if (cause instanceof ProjectError) {
    const status =
      cause.code === "unauthorized"
        ? 401
        : cause.code === "forbidden"
          ? 403
          : cause.code === "not_found"
            ? 404
            : cause.code === "conflict" ||
                cause.code === "member_impact" ||
                cause.code === "workflow_template_blocked" ||
                cause.code === "revision_conflict"
              ? 409
              : 400;
    sendJson(response, status, {
      ok: false,
      error: {
        code: cause.code,
        message: cause.message,
        ...cause.details,
      },
    });
    return;
  }
  sendJson(response, 500, {
    ok: false,
    error: { code: "internal_error", message: "project request failed" },
  });
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  try {
    return await readJsonBody(request);
  } catch {
    throw new ProjectError("invalid_input", "请求内容不合法");
  }
}

/** zod 校验失败统一转成 400，而不是落到 500。 */
async function readBodyAs<T>(
  request: IncomingMessage,
  schema: z.ZodType<T>,
): Promise<T> {
  const result = schema.safeParse(await readBody(request));
  if (!result.success) {
    throw new ProjectError("invalid_input", "请求内容不合法");
  }
  return result.data;
}

function activeTasks(tasks: readonly TaskLike[]): TaskLike[] {
  return tasks
    .filter((task) => task.archivedAt === undefined)
    .sort((left, right) => {
      const rank: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
      const gap = (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9);
      if (gap !== 0) return gap;
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
}

type ProjectOutputType =
  | "pdf"
  | "word"
  | "spreadsheet"
  | "presentation"
  | "markdown"
  | "text"
  | "image"
  | "archive"
  | "other";

interface ProjectOutputItem {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly updatedAt: string;
  readonly documentType: ProjectOutputType;
  readonly extension: string;
  readonly contentRole: "input" | "output";
  readonly authorName: string;
  readonly sourceKind: "task" | "workflow" | "meeting" | "data-agent";
  readonly sourceId: string;
  readonly sourceName: string;
  readonly taskId?: string;
  readonly workflowInstanceId?: string;
  readonly workflowInstanceTitle?: string;
  readonly workflowNodeId?: string;
  readonly workflowNodeName?: string;
  readonly submissionId?: string;
  readonly artifactId?: string;
  readonly meetingId?: string;
  readonly minuteVersionId?: string;
  readonly dataAgentConversationId?: string;
  readonly dataAgentReportId?: string;
  readonly downloadUrl: string;
}

function outputExtension(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,16})$/.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function outputType(name: string, mimeType: string): ProjectOutputType {
  const extension = outputExtension(name);
  if (extension === "pdf" || mimeType === "application/pdf") return "pdf";
  if (["doc", "docx", "rtf", "odt"].includes(extension)) return "word";
  if (["csv", "xls", "xlsx", "ods"].includes(extension)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (["md", "markdown"].includes(extension)) return "markdown";
  if (["txt", "log", "json", "yml", "yaml"].includes(extension)) return "text";
  if (
    mimeType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)
  ) {
    return "image";
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) return "archive";
  return "other";
}

function outputDateKey(value: string): string {
  return dateOf(value) || value.slice(0, 10);
}

function outputDedupeKey(
  workflowInstanceId: string,
  workflowNodeId: string,
  name: string,
  size: number,
  date: string,
): string {
  return JSON.stringify([workflowInstanceId, workflowNodeId, name, size, date]);
}

async function projectOutputs(
  workspaceId: string,
  tasks: readonly TaskLike[],
  taskDocuments: TaskDocumentQueryServiceLike | undefined,
  workflows: WorkflowServiceLike | undefined,
  meetings: MeetingServiceLike | undefined,
  meetingFiles: MeetingFileServiceLike | undefined,
  meetingMinutes: MeetingMinutesServiceLike | undefined,
  dataAgent: DataAgentOutputServiceLike | undefined,
  authorNameByUserId: ReadonlyMap<string, string>,
): Promise<ProjectOutputItem[]> {
  const items: ProjectOutputItem[] = [];
  const definitions = workflows?.sharedDefinitions?.() ?? [];
  const instances = workflows?.instances(workspaceId) ?? [];
  const instanceById = new Map(
    instances.map((instance) => [instance.id, instance]),
  );
  const nodeNameFor = (
    instance: WorkflowInstanceLike,
    nodeId: string,
  ): string | undefined => {
    const definition =
      definitions.find((item) => item.id === instance.definitionId) ??
      definitions.find(
        (item) =>
          item.key === instance.definitionKey &&
          item.version === instance.definitionVersion,
      );
    return definition?.graph?.nodes.find((node) => node.id === nodeId)?.name;
  };

  // 工作流提交是交付物的权威来源；同名同日期的任务扫描结果只保留一份。
  const dedupe = new Set<string>();
  for (const instance of instances) {
    const submissions = [...(workflows?.submissions?.(instance.id) ?? [])]
      .filter(
        (submission) =>
          submission.status === "submitted" &&
          submission.type === "file" &&
          submission.artifacts.length > 0,
      )
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    const seenRequirements = new Set<string>();
    for (const submission of submissions) {
      const requirementId = `${submission.nodeId}:${submission.requirementKey}`;
      if (seenRequirements.has(requirementId)) continue;
      seenRequirements.add(requirementId);
      const nodeName =
        nodeNameFor(instance, submission.nodeId) ?? submission.nodeId;
      for (const artifact of submission.artifacts) {
        const key = outputDedupeKey(
          instance.id,
          submission.nodeId,
          artifact.fileName,
          artifact.size,
          outputDateKey(submission.submittedAt),
        );
        dedupe.add(key);
        items.push({
          id: `workflow:${submission.id}:${artifact.id}`,
          name: artifact.fileName,
          mimeType: artifact.mimeType,
          size: artifact.size,
          updatedAt: submission.submittedAt,
          documentType: outputType(artifact.fileName, artifact.mimeType),
          extension: outputExtension(artifact.fileName),
          contentRole: "output",
          authorName: submission.submittedByName,
          sourceKind: "workflow",
          sourceId: instance.id,
          sourceName: instance.title,
          workflowInstanceId: instance.id,
          workflowInstanceTitle: instance.title,
          workflowNodeId: submission.nodeId,
          workflowNodeName: nodeName,
          submissionId: submission.id,
          artifactId: artifact.id,
          downloadUrl: `/api/collab/workflow/deliverables/download?submissionId=${encodeURIComponent(submission.id)}&artifactId=${encodeURIComponent(artifact.id)}`,
        });
      }
    }
  }

  for (const task of tasks) {
    if (taskDocuments === undefined) break;
    let result: Awaited<ReturnType<TaskDocumentQueryServiceLike["list"]>>;
    try {
      result = await taskDocuments.list(task.id, {
        includeUploaded: true,
        maxFiles: 100,
      });
    } catch {
      continue;
    }
    const workflow = task.workflow;
    const workflowInstance =
      workflow?.instanceId === undefined
        ? undefined
        : instanceById.get(workflow.instanceId);
    const workflowNodeName =
      workflow?.nodeName ??
      (workflowInstance === undefined || workflow?.nodeId === undefined
        ? undefined
        : nodeNameFor(workflowInstance, workflow.nodeId));
    for (const document of result.documents) {
      if (!document.available) continue;
      if (
        workflow?.instanceId !== undefined &&
        workflow.nodeId !== undefined &&
        dedupe.has(
          outputDedupeKey(
            workflow.instanceId,
            workflow.nodeId,
            document.name,
            document.size,
            outputDateKey(document.updatedAt),
          ),
        )
      ) {
        continue;
      }
      const workflowInstanceTitle =
        workflow?.instanceTitle ?? workflowInstance?.title;
      const taskWorkflowLink: Pick<
        ProjectOutputItem,
        "workflowInstanceId" | "workflowInstanceTitle"
      > =
        workflow?.instanceId === undefined
          ? {}
          : workflowInstanceTitle === undefined
            ? { workflowInstanceId: workflow.instanceId }
            : {
                workflowInstanceId: workflow.instanceId,
                workflowInstanceTitle,
              };
      items.push({
        id: `task:${task.id}:${document.id}`,
        name: document.name,
        mimeType: document.mimeType,
        size: document.size,
        updatedAt: document.updatedAt,
        documentType: outputType(document.name, document.mimeType),
        extension: outputExtension(document.name),
        contentRole: document.kind === "uploaded" ? "input" : "output",
        authorName: document.updatedBy,
        sourceKind: "task",
        sourceId: task.id,
        sourceName: task.title,
        taskId: task.id,
        ...taskWorkflowLink,
        ...(workflow?.nodeId === undefined
          ? {}
          : {
              workflowNodeId: workflow.nodeId,
              ...(workflowNodeName === undefined ? {} : { workflowNodeName }),
            }),
        downloadUrl: `/api/collab/tasks/document/content?taskId=${encodeURIComponent(task.id)}&path=${encodeURIComponent(document.relativePath)}`,
      });
    }
  }

  let meetingRecords: readonly MeetingOutputLike[] = [];
  try {
    meetingRecords = meetings?.list(workspaceId) ?? [];
  } catch {
    meetingRecords = [];
  }
  for (const meeting of meetingRecords) {
    if (meetingFiles !== undefined) {
      let files: readonly MeetingFileLike[] = [];
      try {
        files = meetingFiles.list(meeting.id);
      } catch {
        files = [];
      }
      for (const file of files) {
        items.push({
          id: `meeting:file:${file.id}`,
          name: file.name,
          mimeType: file.mime,
          size: file.size,
          updatedAt: file.createdAt,
          documentType: outputType(file.name, file.mime),
          extension: outputExtension(file.name),
          contentRole: "input",
          authorName:
            authorNameByUserId.get(file.uploadedBy) ?? file.uploadedBy,
          sourceKind: "meeting",
          sourceId: meeting.id,
          sourceName: meeting.title,
          meetingId: meeting.id,
          downloadUrl: `/api/collab/meeting/file?fileId=${encodeURIComponent(file.id)}`,
        });
      }
    }
    if (meetingMinutes === undefined) continue;
    let minute: MeetingMinuteVersionLike | undefined;
    try {
      minute = meetingMinutes.activeVersion(meeting.id);
    } catch {
      minute = undefined;
    }
    if (
      minute === undefined ||
      minute.content.trim() === "" ||
      (minute.status !== "confirmed" && minute.status !== "pending_confirm")
    ) {
      continue;
    }
    const authorId = minute.confirmedBy ?? minute.requestedBy;
    items.push({
      id: `meeting:minute:${minute.id}`,
      name: `${meeting.title} · 会议纪要.md`,
      mimeType: "text/markdown",
      size: Buffer.byteLength(minute.content),
      updatedAt: minute.updatedAt,
      documentType: "markdown",
      extension: "md",
      contentRole: "output",
      authorName: authorNameByUserId.get(authorId) ?? authorId,
      sourceKind: "meeting",
      sourceId: meeting.id,
      sourceName: meeting.title,
      meetingId: meeting.id,
      minuteVersionId: minute.id,
      downloadUrl: `/api/collab/projects/outputs/download?workspaceId=${encodeURIComponent(workspaceId)}&sourceKind=meeting-minutes&meetingId=${encodeURIComponent(meeting.id)}&versionId=${encodeURIComponent(minute.id)}`,
    });
  }

  let dataAgentReports: ReturnType<
    DataAgentOutputServiceLike["projectReports"]
  > = [];
  try {
    dataAgentReports = dataAgent?.projectReports(workspaceId) ?? [];
  } catch {
    dataAgentReports = [];
  }
  for (const { conversation, report } of dataAgentReports) {
    items.push({
      id: `data-agent:report:${report.id}`,
      name: `${report.title}.md`,
      mimeType: "text/markdown",
      size: Buffer.byteLength(report.markdown),
      updatedAt: report.createdAt,
      documentType: "markdown",
      extension: "md",
      contentRole: "output",
      authorName:
        authorNameByUserId.get(conversation.ownerUserId) ??
        conversation.ownerUserId,
      sourceKind: "data-agent",
      sourceId: conversation.id,
      sourceName: conversation.title,
      dataAgentConversationId: conversation.id,
      dataAgentReportId: report.id,
      downloadUrl: `/api/collab/projects/outputs/download?workspaceId=${encodeURIComponent(workspaceId)}&sourceKind=data-agent-report&reportId=${encodeURIComponent(report.id)}`,
    });
  }

  return items
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 2_000);
}

function sendOutputDownload(
  response: ServerResponse,
  input: {
    readonly fileName: string;
    readonly contentType: string;
    readonly content: string;
  },
): void {
  const body = Buffer.from(input.content, "utf8");
  response.writeHead(200, {
    "content-type": input.contentType,
    "content-length": String(body.byteLength),
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
    "cache-control": "no-store",
  });
  response.end(body);
}

interface ProjectNoteSet {
  readonly members: string;
  readonly tasks: string;
  readonly workflows: string;
}

function notesOf(
  tasks: readonly TaskLike[],
  workflows: readonly WorkflowInstanceLike[],
  today: string,
): ProjectNoteSet {
  const createdToday = tasks.filter(
    (task) => dateOf(task.createdAt) === today,
  ).length;
  const recentWorkflows = workflows.filter((workflow) => {
    const updated = dateOf(workflow.updatedAt);
    return updated >= shiftDate(today, -7);
  }).length;
  const blocked = workflows.filter(
    (workflow) => workflow.status === "blocked",
  ).length;
  return {
    members: "",
    tasks: createdToday === 0 ? "今日无新增" : `今日新增 ${createdToday} 项`,
    workflows:
      blocked > 0
        ? `${blocked} 个阻塞`
        : recentWorkflows === 0
          ? "近 7 天无新增"
          : `近 7 天新增 ${recentWorkflows} 个`,
  };
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

interface MemberView {
  readonly id: string;
  readonly principalId?: string;
  readonly name: string;
  readonly kind: "human" | "agent";
  readonly kindLabel: string;
  readonly roleIds: readonly string[];
  readonly roleNames: readonly string[];
  readonly platformRole: string;
  readonly workspaceRole?: MemberRole | undefined;
  readonly joinedAt?: string | undefined;
  readonly avatar?: string | undefined;
  readonly source?: "platform" | "personal" | undefined;
  readonly scope: string;
  readonly ownerName?: string;
}

interface MemberDirectory {
  readonly humans: readonly {
    readonly id: string;
    readonly principalId?: string;
    readonly name: string;
    readonly platformRole: string;
  }[];
  readonly agents: readonly {
    readonly id: string;
    readonly principalId?: string;
    readonly name: string;
    readonly kindLabel: string;
    readonly platformRole: string;
    readonly ownerUserId?: string;
    readonly ownerName?: string;
  }[];
}

function teammateDirectory(
  teammates: TeammateRuntimeLike | undefined,
  employees: EmployeeServiceLike | undefined,
  workspaceId: string,
  actor: { userId: string; name: string; role: GlobalRole },
  actors: readonly {
    userId: string;
    name: string;
    role: GlobalRole;
  }[] = [actor],
): TeammateLike[] {
  const list: TeammateLike[] = [];
  const seenTeammates = new Set<string>();
  for (const teammateActor of actors) {
    for (const teammate of teammates?.assignable(teammateActor, workspaceId) ??
      []) {
      if (seenTeammates.has(teammate.id)) continue;
      seenTeammates.add(teammate.id);
      list.push(teammate);
    }
  }
  const seenEmployees = new Set(
    list
      .map((teammate) => teammate.employeeId)
      .filter((value): value is string => value !== undefined),
  );
  const employeeList = employees?.list() ?? [];
  const employeeById = new Map(
    employeeList.map((employee) => [employee.id, employee]),
  );
  for (const employee of employeeList) {
    if (employee.kind !== "digital") continue;
    if (seenEmployees.has(employee.id)) continue;
    if (
      employees?.employeeWorkspaceTarget(employee.id, workspaceId) === undefined
    ) {
      continue;
    }
    const manager =
      employee.managerEmployeeId === undefined
        ? undefined
        : employeeById.get(employee.managerEmployeeId);
    list.push({
      id: employee.id,
      name: employee.displayName,
      ownerUserId: employee.authUserId ?? "",
      ownerName: manager?.displayName ?? "",
      source: "platform",
      avatar: "",
      employeeId: employee.id,
    });
  }
  return list;
}

/**
 * 项目角色的席位是按需物化的：工作区还没物化过角色时，dsh-collab-roles 的
 * `seats()` 会抛 not_found。列表、详情与成员移除这类读路径要把它降级成
 * 「没有项目角色」，而不是让整个项目页 500。
 */
function activeSeats(
  assignments: AssignmentServiceLike | undefined,
  workspaceId: string,
): readonly AssignmentLike[] {
  if (assignments === undefined) return [];
  try {
    return assignments
      .seats(workspaceId)
      .filter((assignment) => assignment.status !== "released");
  } catch {
    return [];
  }
}

/** 工作区的项目负责人：取工作区成员里的 owner（没有就留空）。 */
function ownerOfWorkspace(
  team: TeamServiceLike,
  workspaceId: string,
): { ownerId?: string; ownerName: string } {
  const owner = team
    .members(workspaceId)
    .find((member) => member.memberRole === "owner");
  const ownerName =
    owner === undefined
      ? ""
      : (team.users().find((user) => user.id === owner.userId)?.name ??
        owner.name ??
        "");
  return {
    ...(owner === undefined ? {} : { ownerId: owner.userId }),
    ownerName,
  };
}

function buildMembers(
  team: TeamServiceLike,
  assignments: AssignmentServiceLike | undefined,
  teammates: TeammateRuntimeLike | undefined,
  employees: EmployeeServiceLike | undefined,
  principals: PrincipalServiceLike | undefined,
  workspaceId: string,
  actor: { userId: string; name: string; role: GlobalRole },
  roleById: Map<string, { name: string; permissions: readonly string[] }>,
  teammateActors?: readonly {
    userId: string;
    name: string;
    role: GlobalRole;
  }[],
): {
  readonly members: readonly MemberView[];
  readonly directory: MemberDirectory;
} {
  const seats = activeSeats(assignments, workspaceId);
  const userById = new Map(team.users().map((user) => [user.id, user]));
  const humans: MemberView[] = team.members(workspaceId).map((member) => {
    const user = userById.get(member.userId);
    const held = seats.filter(
      (assignment) =>
        assignment.assigneeKind === "user" &&
        assignment.assigneeId === member.userId,
    );
    const permissions = held.flatMap((assignment) => {
      const role = roleById.get(assignment.seatId);
      return role?.permissions ?? [];
    });
    const principalId =
      held.find((assignment) => assignment.principalId !== undefined)
        ?.principalId ??
      principals?.resolveSubject("auth-user", member.userId)?.id;
    return {
      id: member.userId,
      ...(principalId === undefined ? {} : { principalId }),
      name: user?.name ?? member.userId,
      kind: "human",
      kindLabel: "Human Principal",
      roleIds: held.map((assignment) => assignment.seatId),
      roleNames: held.map(
        (assignment) =>
          roleById.get(assignment.seatId)?.name ?? assignment.seatLabel,
      ),
      platformRole: platformRoleLabel(user?.role),
      workspaceRole: member.memberRole,
      ...(member.addedAt === undefined ? {} : { joinedAt: member.addedAt }),
      scope: scopeLabel(permissions),
    };
  });
  const agentDirectory = teammateDirectory(
    teammates,
    employees,
    workspaceId,
    actor,
    teammateActors,
  );
  const agentById = new Map(
    agentDirectory.map((teammate) => [teammate.id, teammate]),
  );
  /**
   * AI 员工暂未接入独立的平台角色授权，因此不再从实例 Owner 隐式继承。
   * Owner 只表示业务负责人，不构成平台管理员或平台成员的授权来源。
   */
  const teammatePlatformRole = (teammate: TeammateLike | undefined) => {
    void teammate;
    return "未分配";
  };
  const agentIds = [
    ...new Set(
      seats
        .filter((assignment) => assignment.assigneeKind === "agent")
        .map((assignment) => assignment.assigneeId),
    ),
  ];
  const agents: MemberView[] = agentIds.map((agentId) => {
    const teammate = agentById.get(agentId);
    const held = seats.filter(
      (assignment) =>
        assignment.assigneeKind === "agent" &&
        assignment.assigneeId === agentId,
    );
    const permissions = held.flatMap((assignment) => {
      const role = roleById.get(assignment.seatId);
      return role?.permissions ?? [];
    });
    const principalId =
      held.find((assignment) => assignment.principalId !== undefined)
        ?.principalId ??
      principals?.resolveSubject("teammate", agentId)?.id ??
      employees?.list().find((employee) => employee.id === agentId)
        ?.principalId;
    return {
      id: agentId,
      ...(principalId === undefined ? {} : { principalId }),
      name: teammate?.name ?? agentId,
      kind: "agent",
      kindLabel: "AI Principal",
      roleIds: held.map((assignment) => assignment.seatId),
      roleNames: held.map(
        (assignment) =>
          roleById.get(assignment.seatId)?.name ?? assignment.seatLabel,
      ),
      platformRole: teammatePlatformRole(teammate),
      ...(teammate === undefined
        ? {}
        : { avatar: teammate.avatar, source: teammate.source }),
      scope: scopeLabel(permissions),
      ...(teammate?.ownerName === undefined || teammate.ownerName === ""
        ? {}
        : { ownerName: teammate.ownerName }),
    };
  });
  const humanMemberIds = new Set(humans.map((member) => member.id));
  const agentMemberIds = new Set(agents.map((member) => member.id));
  const directory: MemberDirectory = {
    humans: team
      .users()
      .filter((user) => !humanMemberIds.has(user.id))
      .map((user) => {
        const principalId = principals?.resolveSubject(
          "auth-user",
          user.id,
        )?.id;
        return {
          id: user.id,
          ...(principalId === undefined ? {} : { principalId }),
          name: user.name,
          platformRole: platformRoleLabel(user.role),
        };
      }),
    agents: agentDirectory
      .filter(
        (teammate) =>
          teammates?.isSystemAgent?.(teammate.id) !== true ||
          teammates?.isProjectManagedAgent?.(teammate.id) === true,
      )
      .filter((teammate) => !agentMemberIds.has(teammate.id))
      .map((teammate) => {
        const principalId =
          principals?.resolveSubject("teammate", teammate.id)?.id ??
          (teammate.employeeId === undefined
            ? undefined
            : employees
                ?.list()
                .find((employee) => employee.id === teammate.employeeId)
                ?.principalId);
        return {
          id: teammate.id,
          ...(principalId === undefined ? {} : { principalId }),
          name: teammate.name,
          kindLabel:
            teammate.source === "personal"
              ? `个人分身 · ${teammate.ownerName}`
              : "平台 AI伙伴",
          platformRole: teammatePlatformRole(teammate),
          ownerUserId: teammate.ownerUserId,
          ...(teammate.ownerName === ""
            ? {}
            : { ownerName: teammate.ownerName }),
        };
      }),
  };
  return { members: [...humans, ...agents], directory };
}

function memberDirectorySearch(
  directory: MemberDirectory,
  matchingOwnerIds: ReadonlySet<string>,
  keyword: string,
  limit: number,
): MemberDirectory {
  const value = keyword.trim().toLowerCase();
  if (value === "") return { humans: [], agents: [] };
  const matches = (name: string, id?: string) =>
    `${name} ${id ?? ""}`.toLowerCase().includes(value);
  const humans = directory.humans
    .filter((candidate) => matches(candidate.name, candidate.id))
    .slice(0, limit);
  const agents = directory.agents
    .filter(
      (candidate) =>
        matches(candidate.name, candidate.id) ||
        (candidate.ownerUserId !== undefined &&
          matchingOwnerIds.has(candidate.ownerUserId)),
    )
    .slice(0, limit);
  return { humans, agents };
}

/** roles 插件自动补齐的系统席位，不属于项目自定义角色。 */
const FACILITATOR_SEAT_ID = "facilitator";
const SYSTEM_SEAT_IDS = new Set([FACILITATOR_SEAT_ID]);
const ROLE_PERMISSION_VALUES: readonly RolePermission[] = [
  "read",
  "write",
  "approve",
  "manage_members",
  "manage_roles",
];

/** 项目角色定义 → 席位定义。 */
function seatOfProjectRole(role: ProjectRoleDefinition): SeatLike {
  return {
    id: role.id,
    label: role.name,
    participantKind: "any",
    permissions: [...role.permissions],
  };
}

/** 把模版角色复制成项目自己的角色副本。 */
function templateProjectRoles(
  service: ProjectService,
  template: ProjectTemplateRecord,
): ProjectRoleDefinition[] {
  return template.roleIds
    .map((roleId) => service.role(roleId))
    .filter((role): role is ProjectRoleRecord => role !== undefined)
    .map((role) => ({
      id: role.id,
      name: role.name,
      code: role.code,
      category: role.category,
      description: role.description,
      permissions: [...role.permissions],
    }));
}

/** 项目角色快照进入角色库时使用独立编码，避免覆盖或串联已有素材。 */
function nextCopiedRoleCode(base: string, used: Set<string>): string {
  const normalized = (base.trim().toUpperCase() || "ROLE").slice(0, 80);
  for (let index = 1; index < 1_000; index += 1) {
    const suffix = index === 1 ? "_COPY" : `_COPY_${index}`;
    const candidate = `${normalized.slice(0, 80 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new ProjectError("conflict", "无法为项目角色生成唯一模版编码");
}

/**
 * 把项目自己的角色定义同步成 roles 插件的席位。
 * 项目清空角色时只保留系统 Facilitator 席位（roles 插件本身也会补齐它），
 * 这样已删除角色的指派会被 materialize 自动清理。
 */
async function syncProjectSeats(
  service: ProjectService,
  assignments: AssignmentServiceLike,
  actor: RoleActorLike,
  project: ProjectRecord,
  now: () => Date,
): Promise<WorkspaceRoleConfigLike> {
  return materializeProjectSeats(
    service,
    assignments,
    actor,
    project,
    project.projectRoles.map(seatOfProjectRole),
    now,
  );
}

/** 将一组席位物化到项目；空集合只保留系统 Facilitator 席位。 */
async function materializeProjectSeats(
  service: ProjectService,
  assignments: AssignmentServiceLike,
  actor: RoleActorLike,
  project: ProjectRecord,
  inputSeats: readonly SeatLike[],
  now: () => Date,
): Promise<WorkspaceRoleConfigLike> {
  const seats: SeatLike[] =
    inputSeats.length === 0
      ? [
          {
            id: FACILITATOR_SEAT_ID,
            label: "会议 Facilitator",
            participantKind: "agent",
            permissions: ["read", "write"],
          },
        ]
      : [...inputSeats];
  const template =
    project.templateId === undefined
      ? undefined
      : service.template(project.templateId);
  const timestamp = nowIso(now);
  return assignments.materialize(actor, project.workspaceId, {
    id: template?.id ?? "project-roles",
    name: template?.name ?? "项目角色",
    description: "项目自定义角色清单",
    seats,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * 确保项目角色已初始化：
 * - 已初始化：原样返回（用户主动清空后不会复活）；
 * - 未初始化但已应用模版：复制模版角色；
 * - 未初始化但已有物化席位：从席位迁移（跳过系统 Facilitator）；
 * - 都没有：保持空清单，由用户添加角色或应用模版。
 */
async function ensureProjectRoleCopy(
  service: ProjectService,
  assignments: AssignmentServiceLike | undefined,
  project: ProjectRecord,
): Promise<ProjectRecord> {
  if (project.rolesInitialized) return project;
  if (project.templateId !== undefined) {
    const template = service.template(project.templateId);
    if (template !== undefined) {
      const roles = templateProjectRoles(service, template);
      if (roles.length > 0) {
        return service.replaceProjectRoles({
          workspaceId: project.workspaceId,
          roles,
          templateId: template.id,
        });
      }
    }
  }
  if (assignments !== undefined) {
    let seats: readonly SeatLike[] = [];
    try {
      seats = assignments.config(project.workspaceId).seats;
    } catch {
      seats = [];
    }
    const roles = seats
      .filter((seat) => !SYSTEM_SEAT_IDS.has(seat.id))
      .map((seat) => {
        const valid = seat.permissions.filter(
          (permission): permission is RolePermission =>
            (ROLE_PERMISSION_VALUES as readonly string[]).includes(permission),
        );
        const permissions: RolePermission[] =
          valid.length === 0 ? ["read", "write"] : valid;
        return {
          id: seat.id,
          name: seat.label,
          code: seat.id.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase(),
          category: "执行" as const,
          description: "从既有项目席位迁移",
          permissions,
        };
      });
    if (roles.length > 0) {
      return service.replaceProjectRoles({
        workspaceId: project.workspaceId,
        roles,
      });
    }
  }
  return project;
}

interface ProjectViewInput {
  readonly project: ProjectRecord;
  readonly workspace: WorkspaceLike;
  readonly isMember: boolean;
  readonly memberRole: MemberRole | undefined;
  readonly humanMemberCount: number;
  readonly aiPartnerCount: number;
  readonly tasks: readonly TaskLike[];
  readonly workflows: readonly WorkflowInstanceLike[];
  readonly today: string;
}

function projectView(input: ProjectViewInput): Record<string, unknown> {
  const tasks = activeTasks(input.tasks);
  return {
    ...input.project,
    name: input.workspace.title,
    path: input.workspace.path,
    isMember: input.isMember,
    ...(input.memberRole === undefined ? {} : { memberRole: input.memberRole }),
    counts: {
      members: input.humanMemberCount + input.aiPartnerCount,
      humans: input.humanMemberCount,
      aiPartners: input.aiPartnerCount,
      tasks: tasks.length,
      workflows: input.workflows.length,
    },
    notes: notesOf(tasks, input.workflows, input.today),
  };
}

interface ReportInput {
  readonly project: ProjectRecord;
  readonly workspace: WorkspaceLike;
  readonly tasks: readonly TaskLike[];
  readonly workflows: readonly WorkflowInstanceLike[];
  readonly today: string;
  readonly reportType?: ProjectReportType | undefined;
}

type ProjectRagStatus = "健康" | "关注" | "风险";

interface ProjectReportFinding {
  readonly score: number;
  readonly text: string;
}

interface ProjectReportAssessment {
  readonly tasks: readonly TaskLike[];
  readonly openTasks: readonly TaskLike[];
  readonly completedTasks: readonly TaskLike[];
  readonly inProgressTasks: readonly TaskLike[];
  readonly reviewTasks: readonly TaskLike[];
  readonly overdueTasks: readonly TaskLike[];
  readonly abnormalTasks: readonly TaskLike[];
  readonly unassignedTasks: readonly TaskLike[];
  readonly needsInputTasks: readonly TaskLike[];
  readonly blockedWorkflows: readonly WorkflowInstanceLike[];
  readonly failedWorkflows: readonly WorkflowInstanceLike[];
  readonly waitingWorkflows: readonly WorkflowInstanceLike[];
  readonly completedWorkflows: readonly WorkflowInstanceLike[];
  readonly expectedProgress: number | undefined;
  readonly progressVariance: number | undefined;
  readonly riskFindings: readonly ProjectReportFinding[];
  readonly attentionFindings: readonly ProjectReportFinding[];
  readonly keyResults: readonly string[];
  readonly nextActions: readonly string[];
  readonly rag: ProjectRagStatus;
  readonly ragBasis: readonly string[];
  readonly coverageNotes: readonly string[];
}

const TASK_PRIORITY_RANK: Record<string, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
};

const DAY_MS = 24 * 60 * 60 * 1_000;

function reportDateDay(date: string): number | undefined {
  const value = Date.parse(`${dateOf(date)}T00:00:00.000Z`);
  return Number.isFinite(value) ? Math.floor(value / DAY_MS) : undefined;
}

function reportDaysBetween(from: string, to: string): number | undefined {
  const start = reportDateDay(from);
  const end = reportDateDay(to);
  return start === undefined || end === undefined ? undefined : end - start;
}

function reportPriorityRank(task: TaskLike): number {
  return TASK_PRIORITY_RANK[task.priority] ?? 9;
}

function reportTaskSort(left: TaskLike, right: TaskLike): number {
  return (
    reportPriorityRank(left) - reportPriorityRank(right) ||
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function reportWorkflowSort(
  left: WorkflowInstanceLike,
  right: WorkflowInstanceLike,
): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function reportDatePresent(date: string | undefined): date is string {
  return (
    date !== undefined &&
    /^\d{4}-\d{2}-\d{2}/.test(date) &&
    Number.isFinite(Date.parse(`${dateOf(date)}T00:00:00.000Z`))
  );
}

function reportPlannedProgress(
  project: ProjectRecord,
  today: string,
): number | undefined {
  if (
    !reportDatePresent(project.startDate) ||
    !reportDatePresent(project.targetDate)
  ) {
    return undefined;
  }
  const totalDays = reportDaysBetween(project.startDate, project.targetDate);
  if (totalDays === undefined || totalDays <= 0) return undefined;
  const elapsedDays = reportDaysBetween(project.startDate, today);
  if (elapsedDays === undefined) return undefined;
  return Math.max(
    0,
    Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  );
}

function reportSignedPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${value} 个百分点`;
}

function reportTrim(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

function reportTaskResult(task: TaskLike): string {
  const consensus = [...(task.comments ?? [])]
    .filter(
      (comment) =>
        comment.isKeyConsensus === true && comment.content.trim() !== "",
    )
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  const detail =
    consensus === undefined ? "" : `：${reportTrim(consensus.content, 140)}`;
  return `- \`${task.id}\` ${reportTrim(task.title, 120)}${detail}`;
}

function addReportFinding(
  findings: ProjectReportFinding[],
  score: number,
  text: string,
): void {
  if (!findings.some((finding) => finding.text === text)) {
    findings.push({ score, text });
  }
}

function assessProjectReport(input: ReportInput): ProjectReportAssessment {
  const today = dateOf(input.today);
  const tasks = activeTasks(input.tasks).filter(
    (task) => task.status !== "cancelled",
  );
  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks
    .filter(
      (task) => task.status === "done" && dateOf(task.updatedAt) === today,
    )
    .sort(reportTaskSort);
  const inProgressTasks = openTasks.filter(
    (task) => task.status === "progress",
  );
  const reviewTasks = openTasks.filter((task) => task.status === "review");
  const overdueTasks = openTasks.filter(
    (task) => reportDatePresent(task.due) && dateOf(task.due) < today,
  );
  const abnormalTasks = openTasks.filter(
    (task) =>
      task.status === "abnormal" ||
      task.executionAnomaly !== undefined ||
      task.receiverState === "needs_reassignment" ||
      task.queueState === "blocked",
  );
  const unassignedTasks = openTasks.filter(
    (task) => task.receiverType === "unassigned",
  );
  const needsInputTasks = openTasks.filter((task) => task.needsInput === true);
  const blockedWorkflows = input.workflows
    .filter((workflow) => workflow.status === "blocked")
    .sort(reportWorkflowSort);
  const failedWorkflows = input.workflows
    .filter((workflow) => workflow.status === "failed")
    .sort(reportWorkflowSort);
  const waitingWorkflows = input.workflows
    .filter((workflow) => workflow.status === "waiting")
    .sort(reportWorkflowSort);
  const completedWorkflows = input.workflows
    .filter(
      (workflow) =>
        workflow.status === "completed" && dateOf(workflow.updatedAt) === today,
    )
    .sort(reportWorkflowSort);

  const riskFindings: ProjectReportFinding[] = [];
  const attentionFindings: ProjectReportFinding[] = [];
  const riskTaskIds = new Set<string>();
  const attentionTaskIds = new Set<string>();
  const riskWorkflowIds = new Set<string>();
  const hasExecutionRisk = (task: TaskLike): boolean =>
    task.status === "abnormal" ||
    task.executionAnomaly !== undefined ||
    task.receiverState === "needs_reassignment" ||
    task.queueState === "blocked";
  const p1Overdue = overdueTasks.filter((task) => task.priority === "P1");
  const nonP1Overdue = overdueTasks.filter((task) => task.priority !== "P1");
  for (const task of p1Overdue) {
    if (hasExecutionRisk(task)) continue;
    addReportFinding(
      riskFindings,
      100,
      `- P1 任务 \`${task.id}\`「${task.title}」已超过截止日期 ${dateOf(task.due ?? "")}。`,
    );
    riskTaskIds.add(task.id);
  }
  for (const task of nonP1Overdue) {
    if (hasExecutionRisk(task)) continue;
    addReportFinding(
      attentionFindings,
      65,
      `- 任务 \`${task.id}\`「${task.title}」已超过截止日期 ${dateOf(task.due ?? "")}。`,
    );
    attentionTaskIds.add(task.id);
  }
  for (const task of abnormalTasks) {
    const reason =
      task.executionAnomaly?.message ??
      task.reassignmentReason ??
      (task.queueState === "blocked" ? "依赖未满足" : "任务状态异常");
    addReportFinding(
      riskFindings,
      task.priority === "P1" ? 98 : 85,
      `- 任务 \`${task.id}\`「${task.title}」需要处理：${reportTrim(reason, 160)}。`,
    );
    (task.priority === "P1" ? riskTaskIds : attentionTaskIds).add(task.id);
  }
  for (const workflow of blockedWorkflows) {
    addReportFinding(
      riskFindings,
      92,
      `- 工作流「${workflow.title}」当前阻塞，需确认责任人与解除条件。`,
    );
    riskWorkflowIds.add(workflow.id);
  }
  for (const workflow of failedWorkflows) {
    addReportFinding(
      riskFindings,
      96,
      `- 工作流「${workflow.title}」执行失败，需决定重试或人工接管。`,
    );
    riskWorkflowIds.add(workflow.id);
  }
  for (const workflow of waitingWorkflows) {
    addReportFinding(
      attentionFindings,
      60,
      `- 工作流「${workflow.title}」处于等待状态。`,
    );
  }
  for (const workflow of input.workflows) {
    for (const [nodeId, node] of Object.entries(workflow.nodes ?? {})) {
      if (
        !riskWorkflowIds.has(workflow.id) &&
        (node.status === "blocked" || node.status === "failed")
      ) {
        addReportFinding(
          riskFindings,
          node.status === "failed" ? 94 : 88,
          `- 工作流「${workflow.title}」节点“${nodeId}”${node.status === "failed" ? "执行失败" : "阻塞"}。`,
        );
      }
      const idleDays =
        node.enteredAt === undefined
          ? undefined
          : reportDaysBetween(node.enteredAt, today);
      if (
        !riskWorkflowIds.has(workflow.id) &&
        idleDays !== undefined &&
        idleDays >= 3 &&
        ["running", "waiting", "blocked", "failed"].includes(node.status)
      ) {
        addReportFinding(
          riskFindings,
          82,
          `- 工作流「${workflow.title}」节点“${nodeId}”已停留 ${idleDays} 天。`,
        );
      }
      const pendingApprovalCount = Object.values(node.approvals ?? {}).filter(
        (approval) => approval.status === "pending",
      ).length;
      if (pendingApprovalCount > 0) {
        addReportFinding(
          attentionFindings,
          pendingApprovalCount > 1 ? 72 : 58,
          `- 工作流「${workflow.title}」节点“${nodeId}”有 ${pendingApprovalCount} 个待审批项。`,
        );
      }
    }
  }
  for (const task of unassignedTasks) {
    if (riskTaskIds.has(task.id) || attentionTaskIds.has(task.id)) continue;
    addReportFinding(
      task.priority === "P1" ? riskFindings : attentionFindings,
      task.priority === "P1" ? 86 : 55,
      `- ${task.priority} 任务 \`${task.id}\`「${task.title}」尚未分配负责人。`,
    );
    (task.priority === "P1" ? riskTaskIds : attentionTaskIds).add(task.id);
  }
  for (const task of needsInputTasks) {
    if (riskTaskIds.has(task.id) || attentionTaskIds.has(task.id)) continue;
    addReportFinding(
      attentionFindings,
      62,
      `- 任务 \`${task.id}\`「${task.title}」等待补充信息。`,
    );
    attentionTaskIds.add(task.id);
  }
  if (reviewTasks.length > 0) {
    addReportFinding(
      attentionFindings,
      52,
      `- ${reviewTasks.length} 项任务处于待验收状态，尚未形成最终结果。`,
    );
  }

  const expectedProgress = reportPlannedProgress(input.project, today);
  const progressVariance =
    expectedProgress === undefined
      ? undefined
      : input.project.progress - expectedProgress;
  if (progressVariance !== undefined) {
    if (progressVariance <= -15) {
      addReportFinding(
        riskFindings,
        90,
        `- 实际进度 ${input.project.progress}% 落后计划 ${Math.abs(progressVariance)} 个百分点。`,
      );
    } else if (progressVariance <= -5) {
      addReportFinding(
        attentionFindings,
        57,
        `- 实际进度 ${input.project.progress}% 落后计划 ${Math.abs(progressVariance)} 个百分点。`,
      );
    }
  }
  const targetOverdueDays =
    reportDatePresent(input.project.targetDate) &&
    input.project.status !== "已完成"
      ? reportDaysBetween(input.project.targetDate, today)
      : undefined;
  if (targetOverdueDays !== undefined && targetOverdueDays > 0) {
    addReportFinding(
      riskFindings,
      89,
      `- 项目已超过目标日期 ${input.project.targetDate} 共 ${targetOverdueDays} 天。`,
    );
  }
  if (input.project.health !== "健康") {
    addReportFinding(
      input.project.health === "风险" ? riskFindings : attentionFindings,
      input.project.health === "风险" ? 84 : 54,
      `- 人工健康度标记为「${input.project.health}」。`,
    );
  }

  riskFindings.sort((left, right) => right.score - left.score);
  attentionFindings.sort((left, right) => right.score - left.score);
  const rag: ProjectRagStatus =
    riskFindings.length > 0
      ? "风险"
      : attentionFindings.length > 0
        ? "关注"
        : "健康";
  const ragBasis = [...riskFindings, ...attentionFindings]
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((finding) => finding.text.replace(/^-\s*/, ""));
  const coverageNotes: string[] = [];
  if (expectedProgress === undefined) {
    coverageNotes.push("未设置完整起止日期，无法计算计划进度与偏差。");
  }
  if (input.project.targetDate === "") {
    coverageNotes.push("未设置目标日期，无法判断交付窗口。");
  }

  const keyResults = [
    ...completedTasks.slice(0, 4).map(reportTaskResult),
    ...completedWorkflows
      .slice(0, 2)
      .map((workflow) => `- 工作流「${workflow.title}」已完成。`),
  ];
  if (keyResults.length === 0) {
    keyResults.push("- 报告日未捕获到已确认的任务或工作流结果。");
  }

  const nextActions: string[] = [];
  const addAction = (text: string): void => {
    if (
      nextActions.length < 5 &&
      !nextActions.some((action) => action === text)
    ) {
      nextActions.push(text);
    }
  };
  for (const task of p1Overdue.slice(0, 2)) {
    addAction(`- 处理 P1 逾期任务 \`${task.id}\`，明确改期或当日解除阻塞。`);
  }
  for (const task of abnormalTasks.slice(0, 2)) {
    addAction(
      `- 复核异常任务 \`${task.id}\` 的最近一次执行记录并决定重试或改派。`,
    );
  }
  for (const workflow of [...blockedWorkflows, ...failedWorkflows].slice(
    0,
    2,
  )) {
    addAction(`- 处理工作流「${workflow.title}」的阻塞或失败节点。`);
  }
  if (reviewTasks.length > 0) {
    addAction(`- 完成 ${reviewTasks.length} 项待验收任务的验收或退回。`);
  }
  if (needsInputTasks.length > 0) {
    addAction(
      `- 为 ${needsInputTasks.length} 项等待信息的任务补充必要上下文。`,
    );
  }
  if (unassignedTasks.length > 0) {
    addAction(`- 为 ${unassignedTasks.length} 项未分配任务指定负责人。`);
  }
  if (coverageNotes.length > 0) {
    addAction("- 补充项目起止日期，恢复计划进度与偏差评估。");
  }
  if (nextActions.length === 0) {
    addAction("- 保持当前节奏，在下一检查点复核关键交付结果。");
  }

  return {
    tasks,
    openTasks,
    completedTasks,
    inProgressTasks,
    reviewTasks,
    overdueTasks,
    abnormalTasks,
    unassignedTasks,
    needsInputTasks,
    blockedWorkflows,
    failedWorkflows,
    waitingWorkflows,
    completedWorkflows,
    expectedProgress,
    progressVariance,
    riskFindings,
    attentionFindings,
    keyResults,
    nextActions,
    rag,
    ragBasis,
    coverageNotes,
  };
}

/**
 * 项目日报正文：按 senior-pm 的健康度、计划偏差和风险登记册思路生成。
 * 只汇总已确认结果与需要关注的异常，不把“最近更新的任务”当作进展。
 */
export function buildProjectReportContent(input: ReportInput): string {
  const assessment = assessProjectReport(input);
  const reportType = input.reportType ?? "daily";
  const scheduleLine =
    assessment.expectedProgress === undefined ||
    assessment.progressVariance === undefined
      ? `- 进度：实际 ${input.project.progress}%；未设置完整起止日期，计划偏差不可用。`
      : `- 进度：实际 ${input.project.progress}%，计划 ${assessment.expectedProgress}%，偏差 ${reportSignedPoints(assessment.progressVariance)}。`;
  const taskLine =
    `- 任务：报告日确认完成 ${assessment.completedTasks.length} 项，` +
    `当前未完成 ${assessment.openTasks.length} 项，逾期 ${assessment.overdueTasks.length} 项。`;
  const workflowLine =
    `- 工作流：报告日确认完成 ${assessment.completedWorkflows.length} 个，` +
    `阻塞 ${assessment.blockedWorkflows.length} 个、失败 ${assessment.failedWorkflows.length} 个、等待 ${assessment.waitingWorkflows.length} 个。`;
  const riskLines =
    assessment.riskFindings.length === 0
      ? assessment.attentionFindings.length === 0
        ? []
        : ["- 未命中高风险规则。"]
      : assessment.riskFindings.slice(0, 8).map((finding) => finding.text);
  const attentionLines =
    assessment.attentionFindings.length === 0
      ? []
      : assessment.attentionFindings.slice(0, 5).map((finding) => finding.text);
  const coverageLines = assessment.coverageNotes.map(
    (note) => `- 数据缺口：${note}`,
  );
  const exceptionLines = [
    ...riskLines,
    ...attentionLines,
    ...(assessment.riskFindings.length === 0 &&
    assessment.attentionFindings.length === 0
      ? ["- 当前未命中风险、异常、逾期或等待规则。"]
      : []),
  ];
  const section = (heading: string, lines: readonly string[]): string[] => [
    `## ${heading}`,
    "",
    ...lines,
    "",
  ];
  const conclusion = [
    `${input.workspace.title} 截至 ${dateOf(input.today)} 处于「${input.project.status}」状态，综合健康度判定为「${assessment.rag}」。`,
    "",
    ...assessment.ragBasis.map((reason) => `- 判定依据：${reason}`),
    ...(assessment.ragBasis.length === 0
      ? ["- 判定依据：未命中进度、任务或工作流风险规则。"]
      : []),
  ];
  const sections =
    reportType === "weekly"
      ? [
          section("本周结论", conclusion),
          section("目标与里程碑进展", [
            scheduleLine,
            taskLine,
            workflowLine,
            ...coverageLines,
          ]),
          section("关键结果", assessment.keyResults),
          section("指标与风险趋势", [
            scheduleLine,
            taskLine,
            workflowLine,
            ...riskLines,
          ]),
          section("阻塞、依赖与需决策事项", exceptionLines),
          section("下周计划", assessment.nextActions),
        ]
      : reportType === "progress"
        ? [
            section("当前状态", conclusion),
            section("与计划的差异", [scheduleLine, ...coverageLines]),
            section("已完成", assessment.keyResults),
            section("风险与依赖", exceptionLines),
            section("需要支持或决策", assessment.nextActions),
          ]
        : [
            section("一句话结论", conclusion),
            section("项目健康度与计划偏差", [
              scheduleLine,
              taskLine,
              workflowLine,
              ...coverageLines,
            ]),
            section("关键结果", assessment.keyResults),
            section("业务数据异常", [
              "- 本报告日未接入订单、时效、支付等业务运营数据，业务数据异常未覆盖。",
            ]),
            section("推进异常", exceptionLines),
            section("待确认与下一步", assessment.nextActions),
          ];
  return sections.flat().join("\n").trim();
}

const memberSaveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  memberKind: projectMemberKindSchema,
  memberId: z.string().trim().min(1).max(240),
  roleIds: z.array(z.string().trim().min(1).max(160)).max(50),
  workspaceRole: z.enum(["owner", "member", "guest"]).optional(),
});

const memberRemoveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  memberKind: projectMemberKindSchema,
  memberId: z.string().trim().min(1).max(240),
});

const templateSaveSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40),
  status: z.enum(["启用", "停用"]),
  description: z.string().trim().max(500).default(""),
  roleIds: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  workflowTemplateIds: z
    .array(z.string().trim().min(1).max(160))
    .max(50)
    .optional(),
  businessChainMode: z.enum(["required", "optional", "none"]).optional(),
  allowedBusinessChainTemplateIds: z
    .array(z.string().trim().min(1).max(160))
    .max(50)
    .optional(),
  defaultBusinessChainTemplateId: z.string().trim().max(160).optional(),
  versionPolicy: z.enum(["pin-at-project-create", "latest-active"]).optional(),
});

const templateFromProjectSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).optional(),
});

const businessChainRefInputSchema = z.object({
  system: z.string().trim().min(1).max(80),
  objectType: z.string().trim().min(1).max(80),
  objectId: z.string().trim().min(1).max(200),
  required: z.boolean().default(true),
});

const businessChainNodeBindingInputSchema = z.object({
  nodeId: z.string().trim().min(1).max(160),
  externalRefs: z.array(businessChainRefInputSchema).max(50),
});

const businessChainValidateSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  definitionId: z.string().trim().min(1).max(160),
  nodeBindings: z
    .array(businessChainNodeBindingInputSchema)
    .max(100)
    .default([]),
});

const businessChainBindSchema = businessChainValidateSchema.extend({
  revision: z.number().int().positive(),
  validationDigest: z.string().trim().min(1).max(120),
});

const businessChainCustomBindSchema = businessChainValidateSchema.extend({
  revision: z.number().int().positive(),
});

const demoDataUploadSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(240),
  data: projectDemoDataDocumentSchema,
});

const roleSaveSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  category: roleCategorySchema,
  description: z.string().trim().max(500).default(""),
  permissions: z.array(rolePermissionSchema).max(5).default([]),
});

/** 项目自己的角色定义（模版/角色库只做预填，不被引用修改）。 */
const projectRoleSaveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  role: z.object({
    id: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(80),
    code: z.string().trim().min(1).max(80),
    category: roleCategorySchema,
    description: z.string().trim().max(500).default(""),
    permissions: z.array(rolePermissionSchema).min(1).max(5),
  }),
});

const projectRoleRemoveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  roleId: z.string().trim().min(1).max(160),
});

const roleMappingSaveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  roleId: z.string().trim().min(1).max(160),
  assignees: z.array(roleMappingAssigneeSchema).min(1).max(100),
});

const roleMappingRemoveSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  roleId: z.string().trim().min(1).max(160),
});

/** 从其他项目复用角色定义：默认复制所选角色，按 id / code 去重。 */
const projectRoleImportSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  sourceWorkspaceId: z.string().trim().min(1).max(160),
  roleIds: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
});

/** 草稿确认：整组覆盖生效，不再有单条增删接口的语义。 */
const rolesConfirmSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160),
  expectedRevision: z.number().int().positive(),
  roles: z.array(projectRoleDefinitionSchema).max(50),
  ackMemberLoss: z.boolean().default(false),
});

export function createProjectRoutes(
  service: ProjectService,
  dependencies: ProjectDependencies,
): WebRouteLike[] {
  const now = dependencies.now ?? (() => new Date());
  const { team, workspaces } = dependencies;

  function today(): string {
    return projectReportScheduleClock(now(), "Asia/Shanghai").date;
  }

  function tasksOf(workspaceId: string): TaskLike[] {
    const visibleWorkflowIds = new Set(
      workflowsOf(workspaceId).map((instance) => instance.id),
    );
    return [...(dependencies.tasks()?.list(workspaceId) ?? [])].filter(
      (task) =>
        task.workflow?.instanceId === undefined ||
        visibleWorkflowIds.has(task.workflow.instanceId),
    );
  }

  function workflowsOf(workspaceId: string): WorkflowInstanceLike[] {
    const workflowService = dependencies.workflows();
    return [...(workflowService?.instances(workspaceId) ?? [])].filter(
      (instance) =>
        workflowService?.definition?.(instance.definitionId ?? "")?.kind !==
        "business-chain",
    );
  }

  function workflowDefinitions(): BusinessChainDefinitionLike[] {
    return [
      ...(dependencies.workflows()?.sharedDefinitions?.() ?? []),
    ] as BusinessChainDefinitionLike[];
  }

  function businessChainSourceStatuses(
    definition: BusinessChainDefinitionLike | undefined,
    projectCode: string,
    workspaceId: string,
  ): Promise<Record<string, "fresh" | "stale" | "error" | "missing">> {
    const registry = dependencies.progressSources?.();
    const refs = (definition?.graph?.nodes ?? []).flatMap(
      (node) => node.businessChain?.externalRefs ?? [],
    );
    if (registry === undefined) return Promise.resolve({});
    return registry
      .read({
        workspaceId,
        projectCode,
        refs,
        timeoutMs: 1_500,
      })
      .then((results) =>
        Object.fromEntries(
          results.map((result) => [result.system, result.status]),
        ),
      )
      .catch(() =>
        Object.fromEntries(
          [...new Set(refs.map((ref) => ref.system))].map((system) => [
            system,
            "error" as const,
          ]),
        ),
      );
  }

  function nodeBindingsOfDefinition(
    definition: BusinessChainDefinitionLike,
  ): BusinessChainNodeBinding[] {
    return (definition.graph?.nodes ?? []).map((node) => ({
      nodeId: node.id,
      externalRefs: [...(node.businessChain?.externalRefs ?? [])],
    }));
  }

  function bindingForDefinition(input: {
    readonly project: ProjectRecord;
    readonly template?: ProjectTemplateRecord | undefined;
    readonly definition: BusinessChainDefinitionLike;
    readonly actorId: string;
    readonly bindingMode:
      "template-default" | "template-allowed" | "project-custom";
    readonly nodeBindings?: readonly BusinessChainNodeBinding[] | undefined;
  }): Omit<NonNullable<ProjectRecord["businessChainBinding"]>, "boundAt"> {
    return {
      projectTemplateId:
        input.bindingMode === "project-custom"
          ? "project-custom"
          : (input.template?.id ??
            input.project.templateId ??
            "project-custom"),
      businessChainTemplateId: businessChainTemplateId(input.definition),
      workflowDefinitionId: input.definition.id,
      workflowDefinitionVersion: input.definition.version,
      ...(input.project.businessChainBinding?.workflowDefinitionId !==
        input.definition.id ||
      input.project.businessChainBinding?.workflowInstanceId === undefined
        ? {}
        : {
            workflowInstanceId:
              input.project.businessChainBinding.workflowInstanceId,
          }),
      chainKey:
        input.definition.businessChain?.chainKey ?? input.definition.key,
      bindingMode: input.bindingMode,
      sourceTemplateRevision: input.template?.revision ?? 1,
      nodeBindings: [
        ...(input.nodeBindings ?? nodeBindingsOfDefinition(input.definition)),
      ],
      boundBy: input.actorId,
    };
  }

  function actorName(userId: string): string {
    return team.users().find((user) => user.id === userId)?.name ?? userId;
  }

  const WORKSPACE_ROLE_PERMISSIONS: Record<MemberRole, readonly string[]> = {
    owner: ["read", "write", "approve", "manage_members"],
    member: ["read", "write"],
    guest: ["read"],
  };

  async function syncWorkspaceMembershipGrant(input: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly role: MemberRole;
    readonly actorId: string;
  }): Promise<void> {
    const principals = dependencies.principals?.();
    if (principals === undefined) return;
    const principal = principals.resolveSubject("auth-user", input.userId);
    if (principal === undefined) return;
    const actor = principals.resolveSubject("auth-user", input.actorId);
    await principals.syncExclusiveGrant({
      principalId: principal.id,
      scopeType: "workspace",
      scopeId: input.workspaceId,
      role: `workspace-${input.role}`,
      permissions: WORKSPACE_ROLE_PERMISSIONS[input.role],
      ...(actor === undefined ? {} : { grantedByPrincipalId: actor.id }),
    });
  }

  async function revokeWorkspaceMembershipGrant(input: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly role: MemberRole;
  }): Promise<void> {
    const principals = dependencies.principals?.();
    if (principals === undefined) return;
    const principal = principals.resolveSubject("auth-user", input.userId);
    if (principal === undefined) return;
    await principals.revokeMatchingGrants({
      principalId: principal.id,
      scopeType: "workspace",
      scopeId: input.workspaceId,
      role: `workspace-${input.role}`,
    });
  }

  const hydratedWorkspaceGrants = new Set<string>();
  async function hydrateWorkspaceMembershipGrants(
    workspaceId: string,
    actorId: string,
  ): Promise<void> {
    if (hydratedWorkspaceGrants.has(workspaceId)) return;
    hydratedWorkspaceGrants.add(workspaceId);
    for (const member of team.members(workspaceId)) {
      await syncWorkspaceMembershipGrant({
        workspaceId,
        userId: member.userId,
        role: member.memberRole,
        actorId,
      });
    }
  }

  async function appendProjectAudit(
    current: TeamPrincipalLike,
    workspaceId: string,
    input: {
      readonly category: ProjectAuditRecord["category"];
      readonly action: string;
      readonly targetId?: string | undefined;
      readonly targetName?: string | undefined;
      readonly summary: string;
      readonly detail?: Readonly<Record<string, string>> | undefined;
    },
  ): Promise<void> {
    const actorPrincipalId = dependencies
      .principals?.()
      ?.resolveSubject("auth-user", current.userId)?.id;
    await service.appendAudit({
      workspaceId,
      actorId: current.userId,
      ...(actorPrincipalId === undefined ? {} : { actorPrincipalId }),
      actorName: actorName(current.userId),
      actorRole: current.role,
      category: input.category,
      action: input.action,
      ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      ...(input.targetName === undefined
        ? {}
        : { targetName: input.targetName }),
      summary: input.summary,
      detail: input.detail ?? {},
    });
  }

  function changedProjectSettings(
    before: ProjectRecord,
    after: ProjectRecord,
  ): Record<string, string> {
    const fields: Array<{
      key: keyof ProjectRecord;
      label: string;
      format?: (value: unknown) => string;
    }> = [
      { key: "ownerName", label: "负责人" },
      { key: "status", label: "运行状态" },
      { key: "health", label: "健康度" },
      { key: "progress", label: "进度", format: (value) => `${value}%` },
      { key: "startDate", label: "开始日期" },
      { key: "targetDate", label: "目标日期" },
      { key: "description", label: "项目说明" },
    ];
    const detail: Record<string, string> = {};
    for (const field of fields) {
      const beforeValue = before[field.key] ?? "";
      const afterValue = after[field.key] ?? "";
      if (beforeValue === afterValue) continue;
      const format =
        field.format ?? ((value: unknown) => String(value || "未设置"));
      detail[field.label] = `${format(beforeValue)} → ${format(afterValue)}`;
    }
    return detail;
  }

  function auditSemantic(action: string): string {
    if (action.endsWith("member.add")) return "member.add";
    if (action.endsWith("member.update")) return "member.add";
    if (action.endsWith("member.remove") || action.endsWith("member.leave")) {
      return "member.remove";
    }
    if (action.endsWith("member.roles.update")) return "member.roles.update";
    return action;
  }

  function identityAuditDetail(
    detail: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const labels: Record<string, string> = {
      memberRole: "工作区角色",
      name: "账号名称",
      role: "平台角色",
      status: "账号状态",
    };
    const workspaceRoleValues: Record<string, string> = {
      owner: "项目负责人",
      member: "项目成员",
      guest: "项目访客",
    };
    const platformRoleValues: Record<string, string> = {
      admin: "平台管理员",
      owner: "平台负责人",
      member: "平台成员",
      guest: "平台访客",
    };
    const statusValues: Record<string, string> = {
      active: "启用",
      disabled: "停用",
    };
    return Object.fromEntries(
      Object.entries(detail).map(([key, value]) => {
        const translated =
          key === "memberRole"
            ? (workspaceRoleValues[value] ?? value)
            : key === "role"
              ? (platformRoleValues[value] ?? value)
              : key === "status"
                ? (statusValues[value] ?? value)
                : value;
        return [labels[key] ?? key, translated];
      }),
    );
  }

  function mergeProjectAudit(
    workspaceId: string,
    limit: number,
  ): ProjectAuditRecord[] {
    const userById = new Map(team.users().map((user) => [user.id, user]));
    const humanMemberIds = new Set(
      team.members(workspaceId).map((member) => member.userId),
    );
    const projectEvents = service.audits(workspaceId, 500);
    const rawIdentityEvents = team.audit?.({ limit: 500 }) ?? [];
    for (const event of projectEvents) {
      if (event.category === "member" && event.targetId !== undefined) {
        humanMemberIds.add(event.targetId);
      }
    }
    for (const event of rawIdentityEvents) {
      if (
        event.workspaceId === workspaceId &&
        ["member_add", "member_remove", "member_leave"].includes(
          event.action,
        ) &&
        event.targetId !== undefined
      ) {
        humanMemberIds.add(event.targetId);
      }
    }
    const identityEvents: ProjectAuditRecord[] = [];
    for (const event of rawIdentityEvents) {
      const action = event.action;
      const projectScoped = event.workspaceId === workspaceId;
      const accountScoped =
        event.workspaceId === undefined &&
        (action === "register_user" || action === "update_user") &&
        event.targetId !== undefined &&
        humanMemberIds.has(event.targetId);
      if (!projectScoped && !accountScoped) continue;
      let category: ProjectAuditRecord["category"] = "identity";
      let mappedAction = `identity.${action.replaceAll("_", ".")}`;
      let summary = "";
      if (action === "member_add") {
        category = "member";
        summary = `协作身份添加成员「${
          userById.get(event.targetId ?? "")?.name ?? event.targetId ?? ""
        }」`;
      } else if (action === "member_remove") {
        category = "member";
        summary = `协作身份移除成员「${
          userById.get(event.targetId ?? "")?.name ?? event.targetId ?? ""
        }」`;
      } else if (action === "member_leave") {
        category = "member";
        mappedAction = "identity.member.leave";
        summary = `成员「${
          userById.get(event.targetId ?? "")?.name ?? event.targetId ?? ""
        }」离开项目`;
      } else if (action === "register_user") {
        summary = `创建平台账号「${
          userById.get(event.targetId ?? "")?.name ?? event.targetId ?? ""
        }」`;
      } else if (action === "update_user") {
        summary = `更新平台账号「${
          userById.get(event.targetId ?? "")?.name ?? event.targetId ?? ""
        }」`;
      } else {
        continue;
      }
      const actorPrincipalId = dependencies
        .principals?.()
        ?.resolveSubject("auth-user", event.actorId)?.id;
      identityEvents.push({
        id: `identity:${event.id}`,
        workspaceId,
        at: event.at,
        actorId: event.actorId,
        ...(actorPrincipalId === undefined ? {} : { actorPrincipalId }),
        actorName: userById.get(event.actorId)?.name ?? event.actorId,
        actorRole: event.actorRole,
        source: "identity",
        category,
        action: mappedAction,
        ...(event.targetId === undefined
          ? {}
          : {
              targetId: event.targetId,
              targetName: userById.get(event.targetId)?.name ?? event.targetId,
            }),
        summary,
        detail: identityAuditDetail(event.detail),
        createdAt: event.at,
      });
    }

    const usedProjectEvents = new Set<string>();
    const uniqueIdentityEvents = identityEvents.filter((identity) => {
      const at = Date.parse(identity.at);
      const duplicate = projectEvents.find((project) => {
        if (usedProjectEvents.has(project.id)) return false;
        if (auditSemantic(project.action) !== auditSemantic(identity.action)) {
          return false;
        }
        if ((project.targetId ?? "") !== (identity.targetId ?? "")) {
          return false;
        }
        const projectAt = Date.parse(project.at);
        return (
          Number.isFinite(at) &&
          Number.isFinite(projectAt) &&
          Math.abs(projectAt - at) <= 5_000
        );
      });
      if (duplicate === undefined) return true;
      usedProjectEvents.add(duplicate.id);
      return false;
    });
    return [...projectEvents, ...uniqueIdentityEvents]
      .sort((left, right) => {
        const byTime = right.at.localeCompare(left.at);
        return byTime === 0 ? right.id.localeCompare(left.id) : byTime;
      })
      .slice(0, limit);
  }

  /**
   * 读取项目记录，缺失时自动建档并分配 `PRJ` + 6 位数字编号，
   * 保证项目清单里不再出现「未编号」。
   */
  async function ensureProjectRecord(
    workspace: WorkspaceLike,
  ): Promise<ProjectRecord> {
    const owner = ownerOfWorkspace(team, workspace.id);
    const project = await service.ensureProject({
      workspaceId: workspace.id,
      ...owner,
    });
    if (
      project.ownerId === undefined &&
      project.ownerName.trim() === "" &&
      owner.ownerId !== undefined &&
      owner.ownerName !== ""
    ) {
      return service.upsertProject({
        workspaceId: workspace.id,
        ...owner,
      });
    }
    return project;
  }

  function activeAgentIds(workspaceId: string): string[] {
    const assignments = dependencies.assignments();
    return [
      ...new Set(
        activeSeats(assignments, workspaceId)
          .filter((assignment) => assignment.assigneeKind === "agent")
          .map((assignment) => assignment.assigneeId),
      ),
    ];
  }

  /**
   * 应用项目模版：把模版角色复制成项目自己的角色副本，
   * 再同步成 roles 插件的席位，并记录已应用的模版。
   */
  async function applyTemplateToProject(
    current: TeamPrincipalLike,
    workspaceId: string,
    templateId: string,
  ): Promise<ProjectRecord> {
    const template = service.template(templateId);
    if (template === undefined) {
      throw new ProjectError("not_found", "项目模版不存在");
    }
    const templateRoles = templateProjectRoles(service, template);
    const systemProjectManager = service.role("role-pm");
    const roles =
      systemProjectManager === undefined ||
      templateRoles.some((role) => role.id === systemProjectManager.id)
        ? templateRoles
        : [
            {
              id: systemProjectManager.id,
              name: systemProjectManager.name,
              code: systemProjectManager.code,
              category: systemProjectManager.category,
              description: systemProjectManager.description,
              permissions: [...systemProjectManager.permissions],
            },
            ...templateRoles,
          ];
    if (roles.length === 0) {
      throw new ProjectError("invalid_input", "项目模版没有可用的项目角色");
    }
    let project = await service.replaceProjectRoles({
      workspaceId,
      roles,
      templateId: template.id,
    });
    const assignments = dependencies.assignments();
    if (assignments === undefined) {
      throw new ProjectError("invalid_input", "项目角色服务不可用");
    }
    await syncProjectSeats(
      service,
      assignments,
      actorOf(current, team, workspaceId),
      project,
      now,
    );
    const definitions = workflowDefinitions();
    let businessChainDetail: Record<string, string> | undefined;
    if (template.businessChainMode !== "none") {
      const definition = defaultBusinessChainDefinition(
        definitions,
        template,
        workspaceId,
      );
      if (
        template.businessChainMode === "required" &&
        definition === undefined
      ) {
        throw new ProjectError(
          "invalid_input",
          "项目模版要求绑定业务链路，但默认业务链路不存在或未启用",
        );
      }
      if (definition !== undefined) {
        project = await service.saveBusinessChainBinding({
          workspaceId,
          expectedRevision: project.businessChainRevision,
          binding: bindingForDefinition({
            project,
            template,
            definition,
            actorId: current.userId,
            bindingMode: "template-default",
          }),
        });
        businessChainDetail = {
          业务链路: definition.name,
          定义版本: `v${definition.version}`,
          绑定方式: "由项目模版提供",
        };
      }
    }
    await appendProjectAudit(current, workspaceId, {
      category: "template",
      action: "template.apply",
      targetId: template.id,
      targetName: template.name,
      summary: `应用项目模版「${template.name}」`,
      detail: {
        模版编码: template.code,
        生效角色数: String(roles.length),
        角色清单: roles.map((role) => role.name).join("、"),
        ...businessChainDetail,
      },
    });
    return project;
  }

  async function projectViews(current: TeamPrincipalLike): Promise<unknown[]> {
    const date = today();
    return Promise.all(
      workspaces.list().map(async (workspace) => {
        const memberRole = memberRoleOf(team, workspace.id, current.userId);
        const humanMembers = team.members(workspace.id).length;
        const aiPartners = activeAgentIds(workspace.id).length;
        return projectView({
          project: await ensureProjectRecord(workspace),
          workspace,
          isMember: memberRole !== undefined,
          memberRole,
          humanMemberCount: humanMembers,
          aiPartnerCount: aiPartners,
          tasks: tasksOf(workspace.id),
          workflows: workflowsOf(workspace.id),
          today: date,
        });
      }),
    );
  }

  const list = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const current = principal(request, team);
      const views = await projectViews(current);
      sendJson(response, 200, {
        ok: true,
        projects:
          current.role === "admin"
            ? views
            : views.filter(
                (project) =>
                  (project as { readonly isMember?: boolean }).isMember ===
                  true,
              ),
        viewer: {
          id: current.userId,
          role: current.role,
          name:
            team.users().find((user) => user.id === current.userId)?.name ??
            current.userId,
        },
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const detail = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      const current = requireWorkspaceAccess(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      await hydrateWorkspaceMembershipGrants(workspaceId, current.userId);
      const assignments = dependencies.assignments();
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      const memberRole = memberRoleOf(team, workspaceId, current.userId);
      let projectManager = dependencies
        .teammates()
        ?.projectManagerFor?.(workspaceId);
      let managerWarning: string | undefined;
      if (
        projectManager === undefined &&
        (current.role === "admin" || memberRole === "owner")
      ) {
        const manager = await provisionProjectManager(
          current,
          workspace,
          project,
        );
        project = manager.project;
        projectManager = manager.teammate;
        managerWarning = manager.warning;
      }
      let config: WorkspaceRoleConfigLike | undefined;
      try {
        config = assignments?.config(workspaceId);
      } catch {
        config = undefined;
      }
      const seats = config?.seats ?? [];
      const catalog = new Map(service.roles().map((role) => [role.id, role]));
      const roleMap = new Map<
        string,
        { name: string; permissions: readonly string[] }
      >();
      for (const role of project.projectRoles) roleMap.set(role.id, role);
      for (const seat of seats) {
        if (roleMap.has(seat.id)) continue;
        const catalogRole = catalog.get(seat.id);
        roleMap.set(seat.id, {
          name: catalogRole?.name ?? seat.label,
          permissions: catalogRole?.permissions ?? seat.permissions,
        });
      }
      const memberCountBySeat = new Map<string, number>();
      for (const assignment of activeSeats(assignments, workspaceId)) {
        memberCountBySeat.set(
          assignment.seatId,
          (memberCountBySeat.get(assignment.seatId) ?? 0) + 1,
        );
      }
      const roleList = [
        ...project.projectRoles.map((role) => ({
          ...role,
          memberCount: memberCountBySeat.get(role.id) ?? 0,
          system: role.id === "role-pm",
        })),
        ...seats
          .filter((seat) => SYSTEM_SEAT_IDS.has(seat.id))
          .map((seat) => ({
            id: seat.id,
            name: roleMap.get(seat.id)?.name ?? seat.label,
            code: seat.id.toUpperCase(),
            category: "支持",
            description:
              "平台系统席位（会议 Facilitator），不属于项目自定义角色。",
            permissions: roleMap.get(seat.id)?.permissions ?? seat.permissions,
            memberCount: memberCountBySeat.get(seat.id) ?? 0,
            system: true,
          })),
      ];
      const memberDirectory = buildMembers(
        team,
        assignments,
        dependencies.teammates(),
        dependencies.employees(),
        dependencies.principals?.(),
        workspaceId,
        {
          userId: current.userId,
          name:
            team.users().find((user) => user.id === current.userId)?.name ??
            current.userId,
          role: current.role,
        },
        roleMap,
        projectTeammateActors(team),
      );
      const tasks = tasksOf(workspaceId);
      const workflows = workflowsOf(workspaceId);
      sendJson(response, 200, {
        ok: true,
        project: projectView({
          project,
          workspace,
          isMember: memberRole !== undefined,
          memberRole,
          humanMemberCount: memberDirectory.members.filter(
            (member) => member.kind === "human",
          ).length,
          aiPartnerCount: memberDirectory.members.filter(
            (member) => member.kind === "agent",
          ).length,
          tasks,
          workflows,
          today: today(),
        }),
        members: memberDirectory.members,
        directory: memberDirectory.directory,
        roles: roleList,
        roleMappingPresets: project.roleMappingPresets,
        roleLibrary: service.roles(),
        templates: service.templates(),
        tasks: activeTasks(tasks),
        workflows,
        projectManager: projectManager ?? null,
        ...(managerWarning === undefined ? {} : { managerWarning }),
        viewer: {
          id: current.userId,
          role: current.role,
          workspaceRole: memberRole ?? null,
          canManage: current.role === "admin" || memberRole === "owner",
        },
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const update = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          ownerId: z.string().trim().min(1).max(160).optional(),
          status: projectStatusSchema.optional(),
          health: projectHealthSchema.optional(),
          progress: z.number().int().min(0).max(100).optional(),
          startDate: z.string().trim().max(20).optional(),
          targetDate: z.string().trim().max(20).optional(),
          description: z.string().trim().max(2000).optional(),
        }),
      );
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const ownerUser =
        body.ownerId === undefined
          ? undefined
          : team.users().find((user) => user.id === body.ownerId);
      if (body.ownerId !== undefined && ownerUser === undefined) {
        throw new ProjectError("invalid_input", "项目负责人不是有效用户");
      }
      if (
        body.ownerId !== undefined &&
        memberRoleOf(team, body.workspaceId, body.ownerId) === undefined
      ) {
        throw new ProjectError("invalid_input", "项目负责人必须是该项目成员");
      }
      const before = await ensureProjectRecord(workspace);
      const project = await service.upsertProject({
        workspaceId: body.workspaceId,
        ...(body.ownerId === undefined
          ? {}
          : { ownerId: body.ownerId, ownerName: ownerUser?.name ?? "" }),
        ...(body.status === undefined ? {} : { status: body.status }),
        ...(body.health === undefined ? {} : { health: body.health }),
        ...(body.progress === undefined ? {} : { progress: body.progress }),
        ...(body.startDate === undefined ? {} : { startDate: body.startDate }),
        ...(body.targetDate === undefined
          ? {}
          : { targetDate: body.targetDate }),
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
      });
      const changes = changedProjectSettings(before, project);
      if (Object.keys(changes).length > 0) {
        await appendProjectAudit(current, body.workspaceId, {
          category: "project",
          action: "project.settings.update",
          targetId: body.workspaceId,
          targetName: workspace.title,
          summary: `更新项目设置（${Object.keys(changes).length} 项）`,
          detail: changes,
        });
      }
      sendJson(response, 200, { ok: true, project });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const provisionProjectManager = async (
    current: TeamPrincipalLike,
    workspace: WorkspaceLike,
    initialProject: ProjectRecord,
  ): Promise<{
    project: ProjectRecord;
    teammate: TeammateLike | undefined;
    warning?: string;
  }> =>
    ensureProjectManagerInstance({
      service,
      dependencies,
      current,
      workspace,
      project: initialProject,
    });

  /**
   * 新建项目：把一个已存在的本地目录注册为 DSH 工作区（项目），
   * 创建者成为项目成员与项目负责人；可选同时应用项目模版。
   * 不自动创建磁盘目录，也不会改动任何平台级账号或平台角色。
   */
  const create = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          path: z.string().trim().min(1).max(1024),
          name: z.string().trim().min(1).max(80),
          templateId: z.string().trim().min(1).max(160).optional(),
        }),
      );
      const current = principal(request, team);
      if (workspaces.create === undefined) {
        throw new ProjectError("invalid_input", "工作区服务不可用");
      }
      if (body.templateId !== undefined) {
        const template = service.template(body.templateId);
        if (template === undefined) {
          throw new ProjectError("not_found", "项目模版不存在");
        }
        if (template.businessChainMode === "required") {
          const definition = workflowDefinitions().find(
            (candidate) =>
              candidate.kind === "business-chain" &&
              candidate.status === "active" &&
              candidate.scope === "platform" &&
              businessChainTemplateId(candidate) ===
                template.defaultBusinessChainTemplateId,
          );
          if (definition === undefined) {
            throw new ProjectError(
              "invalid_input",
              "项目模版要求绑定业务链路，但默认业务链路不存在或未启用",
            );
          }
        }
      }
      let created: WorkspaceLike;
      try {
        created = await workspaces.create(body.path, body.name);
      } catch {
        throw new ProjectError(
          "invalid_input",
          "无法把该目录注册为项目：目录不存在或已被占用",
        );
      }
      if (created.setTitle !== undefined && created.title !== body.name) {
        await created.setTitle(body.name);
      }
      const members = team.members(created.id);
      if (
        members.length > 0 &&
        memberRoleOf(team, created.id, current.userId) === undefined
      ) {
        throw new ProjectError("forbidden", "该项目已存在成员，无法认领");
      }
      if (members.length === 0) {
        await team.addMember(
          current.userId,
          {
            workspaceId: created.id,
            userId: current.userId,
            role: "owner",
          },
          {
            allowWorkspaceOwner: true,
            allowSelfOwnerBootstrap: members.length === 0,
          },
        );
      }
      const userName =
        team.users().find((user) => user.id === current.userId)?.name ??
        current.userId;
      let project = await service.upsertProject({
        workspaceId: created.id,
        ownerId: current.userId,
        ownerName: userName,
      });
      await appendProjectAudit(current, created.id, {
        category: "project",
        action: "project.create",
        targetId: created.id,
        targetName: created.title,
        summary: `创建项目「${created.title}」`,
        detail: {
          项目编号: project.code,
          项目目录: created.path,
          项目负责人: userName,
        },
      });
      if (body.templateId !== undefined) {
        project = await applyTemplateToProject(
          current,
          created.id,
          body.templateId,
        );
      }
      const manager = await provisionProjectManager(current, created, project);
      project = manager.project;
      await appendProjectAudit(current, created.id, {
        category: manager.teammate === undefined ? "project" : "member",
        action:
          manager.teammate === undefined
            ? "project.manager.provision_failed"
            : "project.manager.provision",
        targetId: manager.teammate?.id ?? "role-pm",
        targetName: manager.teammate?.name ?? "项目经理",
        summary:
          manager.teammate === undefined
            ? "初始化平台预置项目经理失败"
            : `已初始化平台预置项目经理「${manager.teammate.name}」`,
        detail: {
          项目角色: "role-pm",
          状态: manager.teammate === undefined ? "failed" : "ready",
          ...(manager.warning === undefined ? {} : { 警告: manager.warning }),
        },
      });
      sendJson(response, 201, {
        ok: true,
        workspaceId: created.id,
        project,
        projectManager: manager.teammate,
        ...(manager.warning === undefined ? {} : { warning: manager.warning }),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const templateList = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    try {
      assertSameOrigin(request);
      principal(request, team);
      const definitions = dependencies.workflows()?.sharedDefinitions?.() ?? [];
      const businessChainDefinitions = workflowDefinitions();
      sendJson(response, 200, {
        ok: true,
        templates: service.templates(),
        roles: service.roles(),
        workflowTemplates: definitions.map((definition) => ({
          id: definition.id,
          key: definition.key,
          version: definition.version,
          name: definition.name,
          description: definition.description,
          status: definition.status,
          kind: definition.kind ?? "workflow",
          businessChain: definition.businessChain,
        })),
        businessChainTemplates: businessChainDefinitions
          .filter((definition) => definition.kind === "business-chain")
          .map((definition) => ({
            id: businessChainTemplateId(definition),
            definitionId: definition.id,
            key: definition.key,
            name: definition.businessChain?.displayName ?? definition.name,
            version: definition.version,
            status: definition.status,
            workspaceId: definition.workspaceId,
            chainKey: definition.businessChain?.chainKey,
            projectTypeCodes: definition.businessChain?.projectTypeCodes ?? [],
            stageCount: definition.graph?.nodes.length ?? 0,
            nodes: (definition.graph?.nodes ?? [])
              .map((node) => ({
                nodeId: node.id,
                name: node.name,
                sequence: node.businessChain?.sequence ?? 0,
                stageCode: node.businessChain?.stageCode ?? "",
                executor: node.executor,
                externalRefs: [...(node.businessChain?.externalRefs ?? [])],
                fields: [...(node.businessChain?.fields ?? [])],
              }))
              .sort((left, right) => left.sequence - right.sequence),
          })),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const templateSave = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      requirePlatformAdmin(request, team);
      const body = await readBodyAs(request, templateSaveSchema);
      const existing = service.template(body.id);
      const mode =
        body.businessChainMode ?? existing?.businessChainMode ?? "none";
      const allowedIds =
        body.allowedBusinessChainTemplateIds ??
        existing?.allowedBusinessChainTemplateIds ??
        [];
      if (mode !== "none" && allowedIds.length > 0) {
        const available = new Map(
          workflowDefinitions()
            .filter(
              (definition) =>
                definition.kind === "business-chain" &&
                definition.status === "active",
            )
            .map((definition) => [
              businessChainTemplateId(definition),
              definition,
            ]),
        );
        const unknown = allowedIds.filter((id) => !available.has(id));
        if (unknown.length > 0) {
          throw new ProjectError(
            "invalid_input",
            `业务链路模板不存在或未启用：${unknown.join("、")}`,
          );
        }
      }
      const template = await service.saveTemplate({
        ...body,
        ...(body.roleIds === undefined ? {} : { roleIds: body.roleIds }),
        ...(body.workflowTemplateIds === undefined
          ? {}
          : { workflowTemplateIds: body.workflowTemplateIds }),
        ...(body.businessChainMode === undefined
          ? {}
          : { businessChainMode: body.businessChainMode }),
        ...(body.allowedBusinessChainTemplateIds === undefined
          ? {}
          : {
              allowedBusinessChainTemplateIds:
                body.allowedBusinessChainTemplateIds,
            }),
        ...(body.defaultBusinessChainTemplateId === undefined
          ? {}
          : {
              defaultBusinessChainTemplateId:
                body.defaultBusinessChainTemplateId,
            }),
        ...(body.versionPolicy === undefined
          ? {}
          : { versionPolicy: body.versionPolicy }),
      });
      sendJson(response, 200, { ok: true, template });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /**
   * 把当前项目已生效的角色定义和业务链路另存为项目模版。
   * 角色先复制到角色库，模版只引用新的副本，因此后续项目调整不会影响快照。
   */
  const templateFromProject = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, templateFromProjectSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      if (current.role !== "admin") {
        throw new ProjectError("forbidden", "platform admin is required");
      }
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      const roles = project.projectRoles.filter(
        (role) =>
          role.id !== "role-pm" &&
          role.code.trim().toUpperCase() !== "PROJECT_MANAGER",
      );
      if (roles.length === 0) {
        throw new ProjectError(
          "invalid_input",
          "当前项目没有可保存的自定义项目角色",
        );
      }

      const binding = project.businessChainBinding;
      const businessChain =
        binding === undefined
          ? undefined
          : workflowDefinitions().find(
              (definition) =>
                definition.id === binding.workflowDefinitionId &&
                definition.status === "active" &&
                businessChainTemplateId(definition) ===
                  binding.businessChainTemplateId,
            );
      if (binding !== undefined && businessChain === undefined) {
        throw new ProjectError(
          "invalid_input",
          "当前项目绑定的业务链路已停用或不存在，无法保存为项目模版",
        );
      }

      const usedRoleCodes = new Set(
        service.roles().map((role) => role.code.trim().toUpperCase()),
      );
      const createdRoles: ProjectRoleRecord[] = [];
      let savedTemplate: ProjectTemplateRecord | undefined;
      try {
        for (const role of roles) {
          const code = nextCopiedRoleCode(role.code, usedRoleCodes);
          usedRoleCodes.add(code);
          createdRoles.push(
            await service.saveRole({
              id: `role-snapshot-${randomUUID()}`,
              name: role.name,
              code,
              category: role.category,
              description: role.description,
              permissions: role.permissions,
            }),
          );
        }

        const usedTemplateCodes = new Set(
          service
            .templates()
            .map((template) => template.code.trim().toUpperCase()),
        );
        let templateCode = "";
        do {
          templateCode = `TPL-${nowIso(now)
            .slice(0, 10)
            .replaceAll("-", "")}-${randomUUID()
            .replaceAll("-", "")
            .slice(0, 8)
            .toUpperCase()}`;
        } while (usedTemplateCodes.has(templateCode));
        const sourceTemplate =
          project.templateId === undefined
            ? undefined
            : service.template(project.templateId);
        savedTemplate = await service.saveTemplate({
          id: `tpl-from-project-${randomUUID()}`,
          name: body.name,
          code: templateCode,
          type: body.type,
          status: "启用",
          description:
            body.description === undefined || body.description === ""
              ? `从项目「${workspace.title}」保存`
              : body.description,
          roleIds: createdRoles.map((role) => role.id),
          workflowTemplateIds: [],
          businessChainMode: businessChain === undefined ? "none" : "required",
          allowedBusinessChainTemplateIds:
            businessChain === undefined
              ? []
              : [businessChainTemplateId(businessChain)],
          defaultBusinessChainTemplateId:
            businessChain === undefined
              ? undefined
              : businessChainTemplateId(businessChain),
          versionPolicy:
            sourceTemplate?.versionPolicy ?? "pin-at-project-create",
        });
      } catch (cause) {
        if (savedTemplate === undefined) {
          for (const role of createdRoles) {
            await service.removeRole(role.id).catch(() => undefined);
          }
        }
        throw cause;
      }

      await appendProjectAudit(current, body.workspaceId, {
        category: "template",
        action: "template.create_from_project",
        targetId: savedTemplate.id,
        targetName: savedTemplate.name,
        summary: `从项目「${workspace.title}」保存项目模版「${savedTemplate.name}」`,
        detail: {
          模版编码: savedTemplate.code,
          项目类型: savedTemplate.type,
          角色数: String(createdRoles.length),
          角色清单: createdRoles.map((role) => role.name).join("、"),
          业务链路:
            businessChain?.businessChain?.displayName ??
            businessChain?.name ??
            "不包含",
        },
      });
      sendJson(response, 201, {
        ok: true,
        template: savedTemplate,
        roles: createdRoles,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const templateRemove = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      requirePlatformAdmin(request, team);
      const body = await readBodyAs(
        request,
        z.object({ id: z.string().trim().min(1).max(160) }),
      );
      await service.removeTemplate(body.id);
      sendJson(response, 200, { ok: true });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const templateApply = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          templateId: z.string().trim().min(1).max(160),
        }),
      );
      const current = requireProjectManager(request, team, body.workspaceId);
      const project = await applyTemplateToProject(
        current,
        body.workspaceId,
        body.templateId,
      );
      sendJson(response, 200, {
        ok: true,
        project,
        template: service.template(body.templateId),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const roleSave = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      requirePlatformAdmin(request, team);
      const body = await readBodyAs(request, roleSaveSchema);
      const role = await service.saveRole({
        ...body,
        permissions:
          body.permissions.length === 0 ? undefined : body.permissions,
      });
      sendJson(response, 200, { ok: true, role });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const roleRemove = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      requirePlatformAdmin(request, team);
      const body = await readBodyAs(
        request,
        z.object({ id: z.string().trim().min(1).max(160) }),
      );
      await service.removeRole(body.id);
      sendJson(response, 200, { ok: true });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 保存项目自己的角色定义（新增/编辑），并同步项目席位。 */
  const projectRoleSave = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      principal(request, team);
      const body = await readBodyAs(request, projectRoleSaveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      if (body.role.id === "role-pm") {
        throw new ProjectError(
          "invalid_input",
          "平台预置项目经理角色不能通过此入口编辑",
        );
      }
      const assignments = dependencies.assignments();
      await ensureProjectRoleCopy(
        service,
        assignments,
        await ensureProjectRecord(workspace),
      );
      const project = await service.saveProjectRole({
        workspaceId: body.workspaceId,
        role: body.role,
      });
      if (assignments !== undefined) {
        await syncProjectSeats(
          service,
          assignments,
          actorOf(current, team, body.workspaceId),
          project,
          now,
        );
      }
      await appendProjectAudit(current, body.workspaceId, {
        category: "role",
        action: "role.save",
        targetId: body.role.id,
        targetName: body.role.name,
        summary: `保存项目角色「${body.role.name}」`,
        detail: {
          角色标识: body.role.code,
          角色分类: body.role.category,
          授权范围: body.role.permissions
            .map((permission) => PERMISSION_LABEL[permission] ?? permission)
            .join("、"),
        },
      });
      sendJson(response, 200, { ok: true, project });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 添加成员时的动态搜索：人类命中时一并返回其名下尚未加入项目的 AI 伙伴。 */
  const memberSearch = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const workspaceId = query(request).get("workspaceId") ?? "";
      const current = requireProjectManager(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      await hydrateWorkspaceMembershipGrants(workspaceId, current.userId);
      const assignments = dependencies.assignments();
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      const keyword = query(request).get("q") ?? "";
      const rawLimit = Number(query(request).get("limit") ?? "30");
      const limit = Math.min(
        50,
        Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 30),
      );
      const roleById = new Map(
        project.projectRoles.map((role) => [
          role.id,
          { name: role.name, permissions: role.permissions },
        ]),
      );
      const memberDirectory = buildMembers(
        team,
        assignments,
        dependencies.teammates(),
        dependencies.employees(),
        dependencies.principals?.(),
        workspaceId,
        {
          userId: current.userId,
          name:
            team.users().find((user) => user.id === current.userId)?.name ??
            current.userId,
          role: current.role,
        },
        roleById,
        projectTeammateActors(team),
      );
      const normalized = keyword.trim().toLowerCase();
      const matchingOwnerIds = new Set(
        team
          .users()
          .filter(
            (user) =>
              normalized !== "" &&
              `${user.name} ${user.id}`.toLowerCase().includes(normalized),
          )
          .map((user) => user.id),
      );
      const directory = memberDirectorySearch(
        memberDirectory.directory,
        matchingOwnerIds,
        keyword,
        limit,
      );
      sendJson(response, 200, {
        ok: true,
        query: keyword.trim(),
        humans: directory.humans,
        agents: directory.agents,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 删除项目自己的角色定义；席位与指派同步清理。 */
  const projectRoleRemove = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      principal(request, team);
      const body = await readBodyAs(request, projectRoleRemoveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      if (body.roleId === "role-pm") {
        throw new ProjectError("invalid_input", "平台预置项目经理角色不能删除");
      }
      const before = await ensureProjectRecord(workspace);
      const removedRole = before.projectRoles.find(
        (role) => role.id === body.roleId,
      );
      const project = await service.removeProjectRole({
        workspaceId: body.workspaceId,
        roleId: body.roleId,
      });
      if (assignments !== undefined) {
        await syncProjectSeats(
          service,
          assignments,
          actorOf(current, team, body.workspaceId),
          project,
          now,
        );
      }
      await appendProjectAudit(current, body.workspaceId, {
        category: "role",
        action: "role.remove",
        targetId: body.roleId,
        targetName: removedRole?.name ?? body.roleId,
        summary: `移除项目角色「${removedRole?.name ?? body.roleId}」`,
        detail: {
          角色标识: removedRole?.code ?? "",
        },
      });
      sendJson(response, 200, { ok: true, project });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const roleMappingSave = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, roleMappingSaveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      if (assignments === undefined) {
        throw new ProjectError("invalid_input", "项目角色服务不可用");
      }
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      const role = project.projectRoles.find(
        (candidate) => candidate.id === body.roleId,
      );
      if (role === undefined) {
        throw new ProjectError("not_found", "项目角色不存在");
      }
      const projectAgents = new Set(
        activeSeats(assignments, body.workspaceId)
          .filter((assignment) => assignment.assigneeKind === "agent")
          .map((assignment) => assignment.assigneeId),
      );
      const seen = new Set<string>();
      const assignees: RoleMappingAssignee[] = [];
      for (const assignee of body.assignees) {
        const key = `${assignee.kind}:${assignee.id}`;
        if (seen.has(key)) continue;
        if (assignee.kind === "user") {
          const member = team
            .members(body.workspaceId)
            .find((candidate) => candidate.userId === assignee.id);
          if (member === undefined) {
            throw new ProjectError(
              "invalid_input",
              `用户 ${assignee.name ?? assignee.id} 不是当前项目成员`,
            );
          }
        } else if (!projectAgents.has(assignee.id)) {
          throw new ProjectError(
            "invalid_input",
            `AI伙伴 ${assignee.name ?? assignee.id} 不是当前项目成员`,
          );
        }
        seen.add(key);
        assignees.push(assignee);
      }
      const saved = await service.saveRoleMappingPreset({
        workspaceId: body.workspaceId,
        roleId: role.id,
        assignees,
        updatedBy: current.userId,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "role",
        action: "role.mapping.save",
        targetId: role.id,
        targetName: role.name,
        summary: `保存角色「${role.name}」的实例映射预设`,
        detail: {
          映射成员: assignees.map((item) => item.name ?? item.id).join("、"),
        },
      });
      sendJson(response, 200, { ok: true, project: saved });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const roleMappingRemove = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, roleMappingRemoveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      await ensureProjectRecord(workspace);
      const saved = await service.removeRoleMappingPreset({
        workspaceId: body.workspaceId,
        roleId: body.roleId,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "role",
        action: "role.mapping.remove",
        targetId: body.roleId,
        summary: "移除角色实例映射预设",
      });
      sendJson(response, 200, { ok: true, project: saved });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 可作为角色复用来源的项目：当前用户可访问、且已有项目角色。 */
  const roleSources = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const current = principal(request, team);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireWorkspaceAccess(request, team, workspaceId);
      const assignments = dependencies.assignments();
      const sources: Array<{
        workspaceId: string;
        name: string;
        code: string;
        roles: readonly ProjectRoleDefinition[];
      }> = [];
      for (const workspace of workspaces.list()) {
        if (workspace.id === workspaceId) continue;
        if (
          current.role !== "admin" &&
          memberRoleOf(team, workspace.id, current.userId) === undefined
        ) {
          continue;
        }
        let project = await ensureProjectRecord(workspace);
        project = await ensureProjectRoleCopy(service, assignments, project);
        if (project.projectRoles.length === 0) continue;
        sources.push({
          workspaceId: workspace.id,
          name: workspace.title,
          code: project.code,
          roles: project.projectRoles,
        });
      }
      sendJson(response, 200, { ok: true, sources });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 从另一个项目复用角色定义：合并进当前项目，按 id / code 去重。 */
  const roleImport = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      principal(request, team);
      const body = await readBodyAs(request, projectRoleImportSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      if (body.sourceWorkspaceId === body.workspaceId) {
        throw new ProjectError("invalid_input", "不能从当前项目自身复用角色");
      }
      requireWorkspaceAccess(request, team, body.sourceWorkspaceId);
      const sourceWorkspace = workspaces.get(body.sourceWorkspaceId);
      const targetWorkspace = workspaces.get(body.workspaceId);
      if (sourceWorkspace === undefined || targetWorkspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      let source = await ensureProjectRecord(sourceWorkspace);
      source = await ensureProjectRoleCopy(service, assignments, source);
      let target = await ensureProjectRecord(targetWorkspace);
      target = await ensureProjectRoleCopy(service, assignments, target);
      const selected = new Set(body.roleIds);
      const existingIds = new Set(target.projectRoles.map((role) => role.id));
      const existingCodes = new Set(
        target.projectRoles.map((role) => role.code),
      );
      const next = [...target.projectRoles];
      let imported = 0;
      let skipped = 0;
      for (const role of source.projectRoles) {
        if (!selected.has(role.id)) continue;
        if (existingIds.has(role.id) || existingCodes.has(role.code)) {
          skipped += 1;
          continue;
        }
        next.push({ ...role, permissions: [...role.permissions] });
        existingIds.add(role.id);
        existingCodes.add(role.code);
        imported += 1;
      }
      const project = await service.upsertProject({
        workspaceId: body.workspaceId,
        projectRoles: next,
        rolesInitialized: true,
      });
      if (
        assignments !== undefined &&
        (project.projectRoles.length > 0 || target.projectRoles.length > 0)
      ) {
        await syncProjectSeats(
          service,
          assignments,
          actorOf(current, team, body.workspaceId),
          project,
          now,
        );
      }
      if (imported > 0) {
        const importedNames = next
          .slice(target.projectRoles.length)
          .map((role) => role.name)
          .join("、");
        await appendProjectAudit(current, body.workspaceId, {
          category: "role",
          action: "role.import",
          targetId: body.sourceWorkspaceId,
          targetName: sourceWorkspace.title,
          summary: `从项目「${sourceWorkspace.title}」复用 ${imported} 个项目角色`,
          detail: {
            来源项目: `${sourceWorkspace.title}（${source.code}）`,
            导入角色: importedNames,
            跳过重复角色: String(skipped),
          },
        });
      }
      sendJson(response, 200, { ok: true, project, imported, skipped });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /**
   * 草稿确认：整组覆盖项目角色。
   * 校验 revision → 差异（按 code）→ 工作流模版阻塞 → 成员影响确认 → 原子生效。
   */
  const rolesConfirm = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      principal(request, team);
      const body = await readBodyAs(request, rolesConfirmSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      if (body.expectedRevision !== project.rolesRevision) {
        throw new ProjectError(
          "revision_conflict",
          "项目角色已被其他人更新，请刷新后重新编辑",
          { currentRevision: project.rolesRevision },
        );
      }

      // 1) 规范化并校验 code / name 唯一。
      const seenCodes = new Set<string>();
      const seenNames = new Set<string>();
      const effectiveByCode = new Map(
        project.projectRoles.map((role) => [
          role.code.trim().toUpperCase(),
          role,
        ]),
      );
      const usedIds = new Set(project.projectRoles.map((role) => role.id));
      let generated = 0;
      const systemProjectManager = service.role("role-pm");
      const submittedRoles = [...body.roles];
      if (
        systemProjectManager !== undefined &&
        !submittedRoles.some(
          (role) =>
            role.id === "role-pm" ||
            role.code.trim().toUpperCase() === "PROJECT_MANAGER",
        )
      ) {
        submittedRoles.push({
          id: systemProjectManager.id,
          name: systemProjectManager.name,
          code: systemProjectManager.code,
          category: systemProjectManager.category,
          description: systemProjectManager.description,
          permissions: [...systemProjectManager.permissions],
        });
      }
      const normalized: ProjectRoleDefinition[] = submittedRoles.map((role) => {
        const code = role.code.trim().toUpperCase();
        const name = role.name.trim();
        const nameKey = name.toLowerCase();
        if (seenCodes.has(code)) {
          throw new ProjectError("invalid_input", `角色标识重复：${code}`);
        }
        if (seenNames.has(nameKey)) {
          throw new ProjectError("invalid_input", `角色名称重复：${name}`);
        }
        seenCodes.add(code);
        seenNames.add(nameKey);
        const existing = effectiveByCode.get(code);
        if (
          systemProjectManager !== undefined &&
          (role.id === "role-pm" || existing?.id === "role-pm")
        ) {
          usedIds.add("role-pm");
          return {
            id: "role-pm",
            name: systemProjectManager.name,
            code: systemProjectManager.code,
            category: systemProjectManager.category,
            description: systemProjectManager.description,
            permissions: [...systemProjectManager.permissions],
          };
        }
        let id = existing?.id ?? role.id;
        if (existing === undefined && usedIds.has(id)) {
          generated += 1;
          id = `role-${Date.now().toString(36)}-${generated}`;
        }
        usedIds.add(id);
        return {
          id,
          name,
          code,
          category: role.category,
          description: role.description,
          permissions: [...role.permissions],
        };
      });

      // 2) 差异（按 code 匹配，matched 角色保留原 id 与席位）。
      const nextCodes = new Set(normalized.map((role) => role.code));
      const fieldKey = (role: ProjectRoleDefinition) =>
        [
          role.name,
          role.category,
          role.description,
          [...role.permissions].sort().join(","),
        ].join("\u0000");
      const added = normalized.filter(
        (role) => !effectiveByCode.has(role.code),
      );
      const updated = normalized.filter((role) => {
        const existing = effectiveByCode.get(role.code);
        return existing !== undefined && fieldKey(existing) !== fieldKey(role);
      });
      const removed = project.projectRoles.filter(
        (role) => !nextCodes.has(role.code.trim().toUpperCase()),
      );
      const removedIds = new Set(removed.map((role) => role.id));
      const removedById = new Map(removed.map((role) => [role.id, role]));

      // 3) 已加载工作流模版：被引用角色不能下线。
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const loadedDefinitionIds = template?.workflowTemplateIds ?? [];
      const definitions = dependencies.workflows()?.sharedDefinitions?.() ?? [];
      const blockedTemplates: Array<Record<string, string>> = [];
      for (const definitionId of loadedDefinitionIds) {
        const definition = definitions.find(
          (candidate) => candidate.id === definitionId,
        );
        if (
          definition === undefined ||
          definition.status !== "active" ||
          definition.graph === undefined
        ) {
          continue;
        }
        for (const node of definition.graph.nodes) {
          const refs = [
            ...(node.executor.kind === "role"
              ? [
                  {
                    id: node.executor.id,
                    name: node.executor.label ?? node.executor.id,
                  },
                ]
              : []),
            ...node.approvers
              .filter((approver) => approver.kind === "role")
              .map((approver) => ({ id: approver.id, name: approver.name })),
          ];
          for (const ref of refs) {
            if (!removedIds.has(ref.id)) continue;
            const role = removedById.get(ref.id);
            blockedTemplates.push({
              templateId: definition.id,
              templateName: definition.name,
              nodeId: node.id,
              nodeName: node.name,
              roleId: ref.id,
              roleCode: role?.code ?? "",
              roleName: role?.name ?? ref.name,
            });
          }
        }
      }
      if (blockedTemplates.length > 0) {
        throw new ProjectError(
          "workflow_template_blocked",
          "有角色仍被项目已加载的工作流模版引用，不能下线；请先失效或编辑对应工作流模版",
          { templates: blockedTemplates },
        );
      }

      // 4) 成员影响：移除角色上的 active 指派。
      const agentDirectory = new Map(
        teammateDirectory(
          dependencies.teammates(),
          dependencies.employees(),
          body.workspaceId,
          {
            userId: current.userId,
            name:
              team.users().find((user) => user.id === current.userId)?.name ??
              current.userId,
            role: current.role,
          },
          projectTeammateActors(team),
        ).map((teammate) => [teammate.id, teammate]),
      );
      const userById = new Map(team.users().map((user) => [user.id, user]));
      const impactsByMember = new Map<
        string,
        {
          memberKind: "human" | "agent";
          memberId: string;
          memberName: string;
          roles: Array<{ roleId: string; roleCode: string; roleName: string }>;
        }
      >();
      for (const assignment of activeSeats(assignments, body.workspaceId)) {
        const role = removedById.get(assignment.seatId);
        if (role === undefined) continue;
        const memberKind =
          assignment.assigneeKind === "user" ? "human" : "agent";
        const memberKey = `${memberKind}:${assignment.assigneeId}`;
        const memberName =
          memberKind === "human"
            ? (userById.get(assignment.assigneeId)?.name ??
              assignment.assigneeId)
            : (agentDirectory.get(assignment.assigneeId)?.name ??
              assignment.assigneeId);
        const impact = impactsByMember.get(memberKey) ?? {
          memberKind,
          memberId: assignment.assigneeId,
          memberName,
          roles: [],
        };
        impact.roles.push({
          roleId: role.id,
          roleCode: role.code,
          roleName: role.name,
        });
        impactsByMember.set(memberKey, impact);
      }
      const memberImpacts = [...impactsByMember.values()];
      if (memberImpacts.length > 0 && !body.ackMemberLoss) {
        throw new ProjectError(
          "member_impact",
          `确认删除后，${memberImpacts.length} 位成员在 ${removed.length} 个角色上的项目角色会被清空`,
          {
            impacts: memberImpacts,
            removedRoles: removed.map((role) => ({
              roleId: role.id,
              roleCode: role.code,
              roleName: role.name,
            })),
          },
        );
      }

      // 5) 席位同步 + 项目记录写入（失败回滚席位）。
      const actor = actorOf(current, team, body.workspaceId);
      let oldSeats: readonly SeatLike[] = [];
      if (assignments !== undefined) {
        try {
          oldSeats = assignments.config(body.workspaceId).seats;
        } catch {
          oldSeats = [];
        }
      }
      if (assignments !== undefined) {
        await materializeProjectSeats(
          service,
          assignments,
          actor,
          project,
          normalized.map(seatOfProjectRole),
          now,
        );
      }
      const timestamp = nowIso(now);
      const nextRoleIds = new Set(normalized.map((role) => role.id));
      const roleMappingPresets = Object.fromEntries(
        Object.entries(project.roleMappingPresets).filter(([roleId]) =>
          nextRoleIds.has(roleId),
        ),
      );
      let saved: ProjectRecord;
      try {
        saved = await service.upsertProject({
          workspaceId: body.workspaceId,
          projectRoles: normalized,
          roleMappingPresets,
          rolesInitialized: true,
          rolesRevision: project.rolesRevision + 1,
          rolesUpdatedAt: timestamp,
          rolesUpdatedBy: current.userId,
        });
      } catch (cause) {
        if (assignments !== undefined) {
          try {
            await materializeProjectSeats(
              service,
              assignments,
              actor,
              project,
              oldSeats,
              now,
            );
          } catch {
            // rollback is best-effort; surface the original failure.
          }
        }
        throw cause;
      }

      // 6) 进行中任务标记需改派。受实例角色快照保护的工作流任务跳过。
      const removedRoleNames = new Map(
        removed.map((role) => [role.id, role.name]),
      );
      let tasksNeedingReassignment = 0;
      let warning: string | undefined;
      const taskService = dependencies.tasks();
      if (taskService?.markRoleUnavailable !== undefined) {
        const workflowService = dependencies.workflows();
        const skipTaskIds = new Set<string>();
        if (workflowService?.instance !== undefined) {
          for (const task of taskService.list(body.workspaceId)) {
            if (
              task.receiverType !== "role" ||
              task.receiverId === undefined ||
              !removedIds.has(task.receiverId)
            ) {
              continue;
            }
            const instanceId = task.workflow?.instanceId;
            if (instanceId === undefined) continue;
            const instance = workflowService.instance(instanceId);
            if (instance?.roleSnapshot?.[task.receiverId] !== undefined) {
              skipTaskIds.add(task.id);
            }
          }
        }
        try {
          tasksNeedingReassignment = await taskService.markRoleUnavailable(
            body.workspaceId,
            removedRoleNames,
            skipTaskIds,
          );
        } catch {
          warning = "角色已生效，但部分任务未能标记为需改派";
        }
      }
      await appendProjectAudit(current, body.workspaceId, {
        category: "role",
        action: "roles.confirm",
        targetId: body.workspaceId,
        targetName: workspace.title,
        summary: `确认项目角色清单 v${saved.rolesRevision}`,
        detail: {
          新增角色: added.map((role) => role.name).join("、") || "无",
          修改角色: updated.map((role) => role.name).join("、") || "无",
          移除角色: removed.map((role) => role.name).join("、") || "无",
          影响成员: String(memberImpacts.length),
          需改派任务: String(tasksNeedingReassignment),
          ...(warning === undefined ? {} : { 警告: warning }),
        },
      });

      sendJson(response, 200, {
        ok: true,
        project: saved,
        revision: saved.rolesRevision,
        diff: {
          added: added.map((role) => role.code),
          updated: updated.map((role) => role.code),
          removed: removed.map((role) => role.code),
        },
        memberImpacts,
        tasksNeedingReassignment,
        ...(warning === undefined ? {} : { warning }),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const outputs = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      if (workspaceId === "") {
        throw new ProjectError("invalid_input", "workspaceId is required");
      }
      requireWorkspaceAccess(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const items = await projectOutputs(
        workspaceId,
        dependencies.tasks()?.list(workspaceId) ?? [],
        dependencies.taskDocuments?.(),
        dependencies.workflows(),
        dependencies.meetings?.(),
        dependencies.meetingFiles?.(),
        dependencies.meetingMinutes?.(),
        dependencies.dataAgent?.(),
        new Map(team.users().map((user) => [user.id, user.name])),
      );
      sendJson(response, 200, {
        ok: true,
        workspaceId,
        generatedAt: nowIso(now),
        outputs: items,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 项目产出物中由会议纪要 / Data Agent 报告生成的虚拟文档。 */
  const outputsDownload = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const params = query(request);
      const workspaceId = params.get("workspaceId") ?? "";
      requireWorkspaceAccess(request, team, workspaceId);
      const sourceKind = params.get("sourceKind");
      if (sourceKind === "meeting-minutes") {
        const meetings = dependencies.meetings?.();
        const minutes = dependencies.meetingMinutes?.();
        if (meetings === undefined || minutes === undefined) {
          throw new ProjectError("not_found", "会议纪要服务不可用");
        }
        const meetingId = params.get("meetingId") ?? "";
        const versionId = params.get("versionId") ?? "";
        const meeting = meetings.get(meetingId);
        if (meeting.workspaceId !== workspaceId) {
          throw new ProjectError("forbidden", "会议不属于当前项目");
        }
        const minute = minutes.activeVersion(meetingId);
        if (
          minute === undefined ||
          minute.id !== versionId ||
          minute.content.trim() === ""
        ) {
          throw new ProjectError("not_found", "会议纪要不存在");
        }
        sendOutputDownload(response, {
          fileName: `${meeting.title} · 会议纪要.md`,
          contentType: "text/markdown; charset=utf-8",
          content: minute.content,
        });
        return;
      }
      if (sourceKind === "data-agent-report") {
        const dataAgent = dependencies.dataAgent?.();
        if (dataAgent === undefined) {
          throw new ProjectError("not_found", "Data Agent 服务不可用");
        }
        const report = dataAgent.report(params.get("reportId") ?? "");
        const conversation = dataAgent.conversation(report.conversationId);
        if (conversation.workspaceId !== workspaceId) {
          throw new ProjectError("forbidden", "报告不属于当前项目");
        }
        sendOutputDownload(response, {
          fileName: `${report.title}.md`,
          contentType: "text/markdown; charset=utf-8",
          content: report.markdown,
        });
        return;
      }
      throw new ProjectError("invalid_input", "不支持的产出物下载类型");
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const membersSave = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, memberSaveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const resolved = resolveMemberIdentity(
        dependencies.principals?.(),
        body.memberKind,
        body.memberId,
      );
      const memberKind = resolved.memberKind;
      const memberId = resolved.memberId;
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const assignments = dependencies.assignments();
      if (assignments === undefined) {
        throw new ProjectError("invalid_input", "项目角色服务不可用");
      }
      const actor = actorOf(current, team, body.workspaceId);
      let project = await ensureProjectRecord(workspace);
      project = await ensureProjectRoleCopy(service, assignments, project);
      const seatIds = new Set(project.projectRoles.map((role) => role.id));
      for (const roleId of body.roleIds) {
        if (!seatIds.has(roleId)) {
          throw new ProjectError(
            "invalid_input",
            `项目角色不在该项目角色清单内：${roleId}`,
          );
        }
      }
      // 把项目自己的角色定义同步成席位；用户清空角色时也要同步一次以清理指派。
      let hasConfig = true;
      try {
        assignments.config(body.workspaceId);
      } catch {
        hasConfig = false;
      }
      if (project.projectRoles.length > 0 || hasConfig) {
        await syncProjectSeats(service, assignments, actor, project, now);
      }
      const roleNameById = new Map(
        project.projectRoles.map((role) => [role.id, role.name]),
      );
      const assigneeKind = memberKind === "human" ? "user" : "agent";
      const activeBefore = activeSeats(assignments, body.workspaceId).filter(
        (assignment) =>
          assignment.assigneeKind === assigneeKind &&
          assignment.assigneeId === memberId,
      );
      const beforeRoleIds = new Set(
        activeBefore.map((assignment) => assignment.seatId),
      );
      const wasMember =
        memberKind === "human"
          ? memberRoleOf(team, body.workspaceId, memberId) !== undefined
          : activeBefore.length > 0;
      const previousWorkspaceRole =
        memberKind === "human"
          ? memberRoleOf(team, body.workspaceId, memberId)
          : undefined;
      const requestedWorkspaceRole =
        memberKind === "human"
          ? (body.workspaceRole ?? previousWorkspaceRole ?? "member")
          : undefined;
      let targetName = memberId;
      if (memberKind === "human") {
        const user = team
          .users()
          .find((candidate) => candidate.id === memberId);
        if (user === undefined) {
          throw new ProjectError("not_found", "用户不存在");
        }
        targetName = user.name;
        if (
          previousWorkspaceRole === undefined ||
          previousWorkspaceRole !== requestedWorkspaceRole
        ) {
          // 只加入项目（工作区）成员资格，平台角色与账号状态不在这里改动。
          await team.addMember(
            current.userId,
            {
              workspaceId: body.workspaceId,
              userId: memberId,
              role: requestedWorkspaceRole ?? "member",
            },
            { allowWorkspaceOwner: true },
          );
        }
        await syncWorkspaceMembershipGrant({
          workspaceId: body.workspaceId,
          userId: memberId,
          role: requestedWorkspaceRole ?? "member",
          actorId: current.userId,
        });
      } else {
        const teammateRuntime = dependencies.teammates();
        if (
          teammateRuntime?.isSystemAgent?.(body.memberId) === true ||
          teammateRuntime?.isSystemAgent?.(memberId) === true
        ) {
          throw new ProjectError(
            "invalid_input",
            "平台内置 AI 伙伴不能作为项目成员",
          );
        }
        if (!wasMember && body.roleIds.length === 0) {
          throw new ProjectError(
            "invalid_input",
            "请为该 AI伙伴选择一个项目角色",
          );
        }
        const teammate = teammateDirectory(
          teammateRuntime,
          dependencies.employees(),
          body.workspaceId,
          {
            userId: current.userId,
            name:
              team.users().find((user) => user.id === current.userId)?.name ??
              current.userId,
            role: current.role,
          },
          projectTeammateActors(team),
        ).find((candidate) => candidate.id === memberId);
        if (teammate !== undefined) targetName = teammate.name;
        const alreadyAssigned = activeSeats(assignments, body.workspaceId).some(
          (assignment) =>
            assignment.assigneeKind === "agent" &&
            assignment.assigneeId === memberId,
        );
        if (teammate === undefined && !alreadyAssigned) {
          throw new ProjectError(
            "invalid_input",
            "该 AI伙伴当前不可指派到本项目",
          );
        }
      }
      const desired = new Set(body.roleIds);
      for (const roleId of desired) {
        await assignments.assign(actor, {
          workspaceId: body.workspaceId,
          seatId: roleId,
          assigneeKind,
          assigneeId: memberId,
        });
      }
      for (const assignment of activeBefore) {
        if (desired.has(assignment.seatId)) continue;
        await assignments.release(actor, body.workspaceId, assignment.seatId, {
          assigneeKind,
          assigneeId: memberId,
        });
      }
      const afterRoleNames = body.roleIds
        .map((roleId) => roleNameById.get(roleId) ?? roleId)
        .join("、");
      const beforeRoleNames = [...beforeRoleIds]
        .map((roleId) => roleNameById.get(roleId) ?? roleId)
        .join("、");
      const rolesChanged = beforeRoleNames !== afterRoleNames;
      const workspaceRoleChanged =
        requestedWorkspaceRole !== undefined &&
        previousWorkspaceRole !== requestedWorkspaceRole;
      if (!wasMember || rolesChanged || workspaceRoleChanged) {
        await appendProjectAudit(current, body.workspaceId, {
          category: "member",
          action: wasMember ? "member.update" : "member.add",
          targetId: memberId,
          targetName,
          summary: wasMember
            ? `更新成员「${targetName}」的工作区角色或项目角色`
            : `添加项目成员「${targetName}」`,
          detail: {
            成员类型: memberKind === "human" ? "人类成员" : "AI伙伴",
            ...(resolved.principalId === undefined
              ? {}
              : { Principal: resolved.principalId }),
            ...(workspaceRoleChanged
              ? {
                  工作区角色: `${previousWorkspaceRole ?? "未加入"} → ${
                    requestedWorkspaceRole ?? "未加入"
                  }`,
                }
              : {}),
            项目角色:
              wasMember && beforeRoleNames !== ""
                ? `${beforeRoleNames || "未分配"} → ${afterRoleNames || "未分配"}`
                : afterRoleNames || "未分配",
          },
        });
      }
      sendJson(response, 200, { ok: true });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const membersRemove = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, memberRemoveSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const resolved = resolveMemberIdentity(
        dependencies.principals?.(),
        body.memberKind,
        body.memberId,
      );
      const memberKind = resolved.memberKind;
      const memberId = resolved.memberId;
      const assignments = dependencies.assignments();
      const actor = actorOf(current, team, body.workspaceId);
      const assigneeKind = memberKind === "human" ? "user" : "agent";
      const project = service.project(body.workspaceId);
      const roleNameById = new Map(
        (project?.projectRoles ?? []).map((role) => [role.id, role.name]),
      );
      const active = activeSeats(assignments, body.workspaceId).filter(
        (assignment) =>
          assignment.assigneeKind === assigneeKind &&
          assignment.assigneeId === memberId,
      );
      for (const assignment of active) {
        await assignments?.release(actor, body.workspaceId, assignment.seatId, {
          assigneeKind,
          assigneeId: memberId,
        });
      }
      const targetName =
        memberKind === "human"
          ? (team.users().find((user) => user.id === memberId)?.name ??
            memberId)
          : (teammateDirectory(
              dependencies.teammates(),
              dependencies.employees(),
              body.workspaceId,
              {
                userId: current.userId,
                name: actorName(current.userId),
                role: current.role,
              },
              projectTeammateActors(team),
            ).find((candidate) => candidate.id === memberId)?.name ?? memberId);
      if (memberKind === "human") {
        const previousWorkspaceRole = memberRoleOf(
          team,
          body.workspaceId,
          memberId,
        );
        await team.removeMember(
          current.userId,
          {
            workspaceId: body.workspaceId,
            userId: memberId,
          },
          { allowWorkspaceOwner: true },
        );
        if (previousWorkspaceRole !== undefined) {
          await revokeWorkspaceMembershipGrant({
            workspaceId: body.workspaceId,
            userId: memberId,
            role: previousWorkspaceRole,
          });
        }
      }
      await appendProjectAudit(current, body.workspaceId, {
        category: "member",
        action: "member.remove",
        targetId: memberId,
        targetName,
        summary: `移除项目成员「${targetName}」`,
        detail: {
          成员类型: memberKind === "human" ? "人类成员" : "AI伙伴",
          ...(resolved.principalId === undefined
            ? {}
            : { Principal: resolved.principalId }),
          原项目角色:
            active
              .map(
                (assignment) =>
                  roleNameById.get(assignment.seatId) ?? assignment.seatLabel,
              )
              .filter(Boolean)
              .join("、") || "未分配",
        },
      });
      sendJson(response, 200, { ok: true });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /** 当前用户主动退出项目（工作区）成员关系；不涉及平台账号。 */
  const leaveProject = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({ workspaceId: z.string().trim().min(1).max(160) }),
      );
      const current = principal(request, team);
      const leavingRole = memberRoleOf(team, body.workspaceId, current.userId);
      if (leavingRole === undefined) {
        throw new ProjectError("forbidden", "当前用户不是该项目成员");
      }
      if (team.leaveWorkspace === undefined) {
        throw new ProjectError("invalid_input", "协作身份服务不可用");
      }
      const project = service.project(body.workspaceId);
      const roleNameById = new Map(
        (project?.projectRoles ?? []).map((role) => [role.id, role.name]),
      );
      const assignments = dependencies.assignments();
      const held = activeSeats(assignments, body.workspaceId).filter(
        (assignment) =>
          assignment.assigneeKind === "user" &&
          assignment.assigneeId === current.userId,
      );
      for (const assignment of held) {
        await assignments?.release(
          actorOf(current, team, body.workspaceId),
          body.workspaceId,
          assignment.seatId,
          { assigneeKind: "user", assigneeId: current.userId },
        );
      }
      await team.leaveWorkspace(current.userId, body.workspaceId);
      await revokeWorkspaceMembershipGrant({
        workspaceId: body.workspaceId,
        userId: current.userId,
        role: leavingRole,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "member",
        action: "member.leave",
        targetId: current.userId,
        targetName: actorName(current.userId),
        summary: `成员「${actorName(current.userId)}」退出项目`,
        detail: {
          工作区角色: leavingRole,
          原项目角色:
            held
              .map(
                (assignment) =>
                  roleNameById.get(assignment.seatId) ?? assignment.seatLabel,
              )
              .filter(Boolean)
              .join("、") || "未分配",
        },
      });
      sendJson(response, 200, { ok: true });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const reports = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireWorkspaceAccess(request, team, workspaceId);
      sendJson(response, 200, {
        ok: true,
        reports: service.reports(workspaceId),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const reportScheduleUpdate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          schedule: projectReportScheduleSchema,
        }),
      );
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const updated = await service.upsertProject({
        workspaceId: body.workspaceId,
        reportSchedule: body.schedule,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "report",
        action: "report.schedule.update",
        targetId: body.workspaceId,
        targetName: workspace.title,
        summary: `更新项目日报生成设置`,
        detail: {
          自动生成: body.schedule.enabled ? "启用" : "停用",
          频次: body.schedule.frequency,
          时间: body.schedule.time,
          时区: body.schedule.timezone,
          ...(body.schedule.frequency === "weekly"
            ? { 星期: String(body.schedule.weekday) }
            : {}),
          ...(body.schedule.frequency === "monthly"
            ? { 日期: String(body.schedule.dayOfMonth) }
            : {}),
          原时间: project.reportSchedule.time,
        },
      });
      sendJson(response, 200, {
        ok: true,
        reportSchedule: updated.reportSchedule,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const reportsGenerate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          date: z.string().trim().min(8).max(20).optional(),
          reportType: projectReportTypeSchema.default("daily"),
          periodStart: z.string().trim().max(20).optional(),
          periodEnd: z.string().trim().max(20).optional(),
          triggerSource: z
            .enum(["button", "chat", "task", "schedule", "system", "api"])
            .default("button"),
          triggerRef: z.string().trim().max(180).optional(),
        }),
      );
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const date = body.date ?? today();
      const timestamp = nowIso(now);
      const initialProject = await ensureProjectRecord(workspace);
      const manager = await provisionProjectManager(
        current,
        workspace,
        initialProject,
      );
      const project = manager.project;
      const projectManager = manager.teammate;
      const tasks = tasksOf(body.workspaceId);
      const workflows = workflowsOf(body.workspaceId);
      const reportTypeLabel =
        body.reportType === "weekly"
          ? "项目周报"
          : body.reportType === "progress"
            ? "进度汇报"
            : "项目日报";
      const generatedReport = await generateProjectReportContent({
        dependencies,
        workspace,
        project,
        projectManager,
        current,
        tasks,
        workflows,
        date,
        reportType: body.reportType,
      });
      const runId = generatedReport.agentRunId ?? `report-run-${randomUUID()}`;
      const report = await service.saveReport({
        workspaceId: body.workspaceId,
        date,
        reportType: body.reportType,
        ...(body.periodStart === undefined
          ? {}
          : { periodStart: body.periodStart }),
        ...(body.periodEnd === undefined ? {} : { periodEnd: body.periodEnd }),
        generatedAt: timestamp,
        generatedBy: projectManager?.name ?? "项目 AI",
        ...(projectManager === undefined
          ? {}
          : { generatedByTeammateId: projectManager.id }),
        runId,
        skillId: generatedReport.skillId,
        skillVersion: generatedReport.skillVersion,
        triggerSource: body.triggerSource,
        generationMode: generatedReport.generationMode,
        ...(generatedReport.generationError === undefined
          ? {}
          : { generationError: generatedReport.generationError }),
        sourceRefs: [
          ...tasks.map((task) => `task:${task.id}`),
          ...workflows.map((workflow) => `workflow:${workflow.id}`),
        ],
        content: generatedReport.content,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "report",
        action: "report.generate",
        targetId: date,
        targetName: `${date} ${reportTypeLabel}`,
        summary: `生成 ${date} ${reportTypeLabel}`,
        detail: {
          日期: date,
          报告类型: body.reportType,
          触发来源: body.triggerSource,
          运行ID: runId,
          撰写人: report.generatedBy,
          生成方式: generatedReport.generationMode,
          ...(generatedReport.generationError === undefined
            ? {}
            : { 回退原因: generatedReport.generationError }),
          ...(projectManager === undefined
            ? {}
            : { 项目经理: projectManager.name }),
        },
      });
      sendJson(response, 200, {
        ok: true,
        report,
        runId,
        projectManager: projectManager ?? null,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  /**
   * 审计访问暂不接项目自定义角色权限，沿用平台管理员 / 工作区负责人口径；
   * 后续由平台统一权限体系接管。
   */
  const history = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireProjectManager(request, team, workspaceId);
      const rawLimit = Number(query(request).get("limit") ?? "200");
      const limit = Math.min(
        500,
        Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 200),
      );
      sendJson(response, 200, {
        ok: true,
        events: mergeProjectAudit(workspaceId, limit),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainConfig = async (
    workspaceId: string,
    project: ProjectRecord,
    template: ProjectTemplateRecord | undefined,
    options: { readonly includeSourceHealth: boolean },
  ): Promise<Record<string, unknown>> => {
    const definitions = workflowDefinitions();
    const allowed = allowedBusinessChainDefinitions(
      definitions,
      template,
      workspaceId,
    );
    const binding = project.businessChainBinding;
    const definition =
      (binding === undefined
        ? undefined
        : definitions.find(
            (item) => item.id === binding.workflowDefinitionId,
          )) ??
      (binding === undefined
        ? undefined
        : (dependencies
            .workflows()
            ?.definition?.(binding.workflowDefinitionId) as
            BusinessChainDefinitionLike | undefined));
    const instance =
      binding?.workflowInstanceId === undefined
        ? undefined
        : (dependencies
            .workflows()
            ?.instances(workspaceId)
            .find((item) => item.id === binding.workflowInstanceId) ??
          dependencies.workflows()?.instance?.(binding.workflowInstanceId));
    const sourceStatuses =
      options.includeSourceHealth && definition !== undefined
        ? await businessChainSourceStatuses(
            definition,
            project.code,
            workspaceId,
          )
        : {};
    const sourceState =
      binding === undefined
        ? "unbound"
        : definition === undefined
          ? "missing"
          : definition.status !== "active"
            ? "disabled"
            : binding.bindingMode === "project-custom"
              ? "fresh"
              : template !== undefined &&
                  template.revision > binding.sourceTemplateRevision
                ? "stale"
                : "fresh";
    const nodes =
      definition?.graph?.nodes
        .map((node) => {
          const current = instance?.nodes?.[node.id];
          const refs =
            binding?.nodeBindings.find((item) => item.nodeId === node.id)
              ?.externalRefs ??
            node.businessChain?.externalRefs ??
            [];
          return {
            nodeId: node.id,
            name: node.name,
            sequence: node.businessChain?.sequence ?? 0,
            stageCode: node.businessChain?.stageCode ?? "",
            fields: node.businessChain?.fields ?? [],
            executor: node.executor,
            workflowStatus: current?.status ?? "waiting",
            externalRefs: refs,
            bindingStatus:
              refs.length === 0
                ? "unbound"
                : refs.some(
                      (ref) =>
                        sourceStatuses[ref.system] === "error" ||
                        sourceStatuses[ref.system] === "missing",
                    )
                  ? "error"
                  : refs.some((ref) => sourceStatuses[ref.system] === "stale")
                    ? "stale"
                    : "bound",
          };
        })
        .sort((left, right) => left.sequence - right.sequence) ?? [];
    return {
      configured: binding !== undefined,
      mode: template?.businessChainMode ?? "none",
      versionPolicy: template?.versionPolicy ?? "pin-at-project-create",
      revision: project.businessChainRevision,
      ...(project.businessChainValidatedAt === undefined
        ? {}
        : { lastValidatedAt: project.businessChainValidatedAt }),
      sourceState,
      template:
        template === undefined
          ? null
          : {
              id: template.id,
              name: template.name,
              type: template.type,
              revision: template.revision,
              allowedBusinessChainTemplateIds:
                template.allowedBusinessChainTemplateIds,
              defaultBusinessChainTemplateId:
                template.defaultBusinessChainTemplateId,
            },
      current:
        binding === undefined
          ? null
          : {
              ...binding,
              name:
                definition?.businessChain?.displayName ??
                definition?.name ??
                binding.workflowDefinitionId,
              definitionStatus: definition?.status ?? "missing",
              instanceStatus: instance?.status,
              instanceTitle: instance?.title,
            },
      candidates: allowed.map((candidate) => ({
        id: businessChainTemplateId(candidate),
        definitionId: candidate.id,
        name: candidate.businessChain?.displayName ?? candidate.name,
        version: candidate.version,
        status: candidate.status,
        chainKey: candidate.businessChain?.chainKey,
        stageCount: candidate.graph?.nodes.length ?? 0,
        sourceSystems: [
          ...new Set(
            (candidate.graph?.nodes ?? []).flatMap((node) =>
              (node.businessChain?.externalRefs ?? []).map((ref) => ref.system),
            ),
          ),
        ],
        nodes: (candidate.graph?.nodes ?? [])
          .map((node) => ({
            nodeId: node.id,
            name: node.name,
            sequence: node.businessChain?.sequence ?? 0,
            stageCode: node.businessChain?.stageCode ?? "",
            externalRefs: [...(node.businessChain?.externalRefs ?? [])],
            fields: [...(node.businessChain?.fields ?? [])],
            executor: node.executor,
          }))
          .sort((left, right) => left.sequence - right.sequence),
        updatedAt: candidate.updatedAt,
      })),
      nodes,
      sources: Object.entries(sourceStatuses).map(([system, status]) => ({
        system,
        status,
      })),
    };
  };

  const businessChainRead = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireProjectManager(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      sendJson(response, 200, {
        ok: true,
        businessChain: await businessChainConfig(
          workspaceId,
          project,
          template,
          { includeSourceHealth: true },
        ),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainCandidates = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireProjectManager(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const allowed = allowedBusinessChainDefinitions(
        workflowDefinitions(),
        template,
        workspaceId,
      );
      sendJson(response, 200, {
        ok: true,
        candidates: allowed.map((definition) => ({
          id: businessChainTemplateId(definition),
          definitionId: definition.id,
          name: definition.businessChain?.displayName ?? definition.name,
          version: definition.version,
          status: definition.status,
          stageCount: definition.graph?.nodes.length ?? 0,
        })),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainValidate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, businessChainValidateSchema);
      requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const definitions = workflowDefinitions();
      const definition = definitions.find(
        (candidate) => candidate.id === body.definitionId,
      );
      const sourceStatuses = await businessChainSourceStatuses(
        definition,
        project.code,
        body.workspaceId,
      );
      const validation = validateBusinessChainSelection({
        workspaceId: body.workspaceId,
        template,
        definitions,
        definitionId: body.definitionId,
        projectCustom:
          project.businessChainBinding?.bindingMode === "project-custom",
        nodeBindings: body.nodeBindings,
        sourceStatuses,
      });
      sendJson(response, 200, {
        ok: true,
        ...validation,
        revision: project.businessChainRevision,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainBind = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, businessChainBindSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const projectCustom =
        project.businessChainBinding?.bindingMode === "project-custom";
      const definitions = workflowDefinitions();
      const definition = definitions.find(
        (candidate) => candidate.id === body.definitionId,
      );
      if (definition === undefined) {
        throw new ProjectError("not_found", "业务链路定义不存在");
      }
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const nowText = nowIso(now);
      const effectiveTemplate = projectCustom
        ? ({
            id: project.templateId ?? "project-custom",
            name: "项目自定义业务链路",
            code: "PROJECT-CUSTOM",
            type: "项目自定义",
            status: "启用",
            description: "",
            roleIds: [],
            workflowTemplateIds: [],
            businessChainMode: "optional",
            allowedBusinessChainTemplateIds: [
              businessChainTemplateId(definition),
            ],
            defaultBusinessChainTemplateId: businessChainTemplateId(definition),
            versionPolicy: "pin-at-project-create",
            revision: 1,
            createdAt: nowText,
            updatedAt: nowText,
          } satisfies ProjectTemplateRecord)
        : template;
      if (effectiveTemplate === undefined) {
        throw new ProjectError("invalid_input", "项目还没有来源模版");
      }
      const sourceStatuses = await businessChainSourceStatuses(
        definition,
        project.code,
        body.workspaceId,
      );
      const validation = validateBusinessChainSelection({
        workspaceId: body.workspaceId,
        template: effectiveTemplate,
        definitions,
        definitionId: body.definitionId,
        projectCustom,
        nodeBindings: body.nodeBindings,
        sourceStatuses,
      });
      if (validation.blocking.length > 0) {
        throw new ProjectError(
          "invalid_input",
          validation.blocking.map((issue) => issue.message).join("；"),
          { blocking: validation.blocking },
        );
      }
      if (validation.digest !== body.validationDigest) {
        throw new ProjectError(
          "revision_conflict",
          "绑定校验结果已变化，请重新校验后再应用",
        );
      }
      const updated = await service.saveBusinessChainBinding({
        workspaceId: body.workspaceId,
        expectedRevision: body.revision,
        binding: bindingForDefinition({
          project,
          template: effectiveTemplate,
          definition,
          actorId: current.userId,
          bindingMode: projectCustom
            ? "project-custom"
            : effectiveTemplate.defaultBusinessChainTemplateId ===
                businessChainTemplateId(definition)
              ? "template-default"
              : "template-allowed",
          nodeBindings: body.nodeBindings,
        }),
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "template",
        action: "business-chain.bind",
        targetId: definition.id,
        targetName: definition.businessChain?.displayName ?? definition.name,
        summary: `应用业务链路「${definition.businessChain?.displayName ?? definition.name}」`,
        detail: {
          定义版本: `v${definition.version}`,
          来源模版: projectCustom ? "项目自定义" : effectiveTemplate.name,
          模版版本: projectCustom
            ? "项目级"
            : String(effectiveTemplate.revision),
          运行实例:
            updated.businessChainBinding?.workflowInstanceId ?? "尚未启动",
        },
      });
      sendJson(response, 200, {
        ok: true,
        project: updated,
        businessChain: await businessChainConfig(
          body.workspaceId,
          updated,
          effectiveTemplate,
          { includeSourceHealth: true },
        ),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainInstanceAttach = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          instanceId: z.string().trim().min(1).max(160),
          revision: z.number().int().positive(),
        }),
      );
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const binding = project.businessChainBinding;
      if (binding === undefined) {
        throw new ProjectError("invalid_input", "请先应用业务链路");
      }
      const instance =
        dependencies.workflows()?.instance?.(body.instanceId) ??
        dependencies
          .workflows()
          ?.instances(body.workspaceId)
          .find((candidate) => candidate.id === body.instanceId);
      if (
        instance === undefined ||
        instance.definitionId !== binding.workflowDefinitionId ||
        instance.definitionVersion !== binding.workflowDefinitionVersion
      ) {
        throw new ProjectError(
          "invalid_input",
          "工作流实例不存在或与当前业务链路快照不匹配",
        );
      }
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const nowText = nowIso(now);
      const effectiveTemplate =
        binding.bindingMode === "project-custom"
          ? ({
              id: project.templateId ?? "project-custom",
              name: "项目自定义业务链路",
              code: "PROJECT-CUSTOM",
              type: "项目自定义",
              status: "启用",
              description: "",
              roleIds: [],
              workflowTemplateIds: [],
              businessChainMode: "optional",
              allowedBusinessChainTemplateIds: [
                binding.businessChainTemplateId,
              ],
              defaultBusinessChainTemplateId: binding.businessChainTemplateId,
              versionPolicy: "pin-at-project-create",
              revision: 1,
              createdAt: nowText,
              updatedAt: nowText,
            } satisfies ProjectTemplateRecord)
          : template;
      if (effectiveTemplate === undefined) {
        throw new ProjectError("invalid_input", "项目来源模版不存在");
      }
      const updated = await service.saveBusinessChainBinding({
        workspaceId: body.workspaceId,
        expectedRevision: body.revision,
        binding: {
          ...binding,
          workflowInstanceId: instance.id,
          boundBy: current.userId,
        },
      });
      const workflows = dependencies.workflows();
      for (const candidate of workflows?.instances(body.workspaceId) ?? []) {
        if (
          candidate.id !== instance.id &&
          candidate.definitionKey === instance.definitionKey
        ) {
          await workflows?.discardInstance?.(candidate.id);
        }
      }
      sendJson(response, 200, {
        ok: true,
        project: updated,
        businessChain: await businessChainConfig(
          body.workspaceId,
          updated,
          effectiveTemplate,
          { includeSourceHealth: true },
        ),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const businessChainCustomBind = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, businessChainCustomBindSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const definition = workflowDefinitions().find(
        (candidate) => candidate.id === body.definitionId,
      );
      if (definition === undefined) {
        throw new ProjectError("not_found", "业务链路定义不存在");
      }
      const nowText = nowIso(now);
      const syntheticTemplate: ProjectTemplateRecord = {
        id: project.templateId ?? "project-custom",
        name: "项目自定义业务链路",
        code: "PROJECT-CUSTOM",
        type: "项目自定义",
        status: "启用",
        description: "",
        roleIds: [],
        workflowTemplateIds: [],
        businessChainMode: "optional",
        allowedBusinessChainTemplateIds: [businessChainTemplateId(definition)],
        defaultBusinessChainTemplateId: businessChainTemplateId(definition),
        versionPolicy: "pin-at-project-create",
        revision: 1,
        createdAt: nowText,
        updatedAt: nowText,
      };
      const sourceStatuses = await businessChainSourceStatuses(
        definition,
        project.code,
        body.workspaceId,
      );
      const validation = validateBusinessChainSelection({
        workspaceId: body.workspaceId,
        template: syntheticTemplate,
        definitions: workflowDefinitions(),
        definitionId: body.definitionId,
        nodeBindings: body.nodeBindings,
        sourceStatuses,
      });
      if (validation.blocking.length > 0) {
        throw new ProjectError(
          "invalid_input",
          validation.blocking.map((issue) => issue.message).join("；"),
          { blocking: validation.blocking },
        );
      }
      const updated = await service.saveBusinessChainBinding({
        workspaceId: body.workspaceId,
        expectedRevision: body.revision,
        binding: bindingForDefinition({
          project,
          definition,
          actorId: current.userId,
          bindingMode: "project-custom",
          nodeBindings: body.nodeBindings,
        }),
      });
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      await appendProjectAudit(current, body.workspaceId, {
        category: "template",
        action: "business-chain.custom.bind",
        targetId: definition.id,
        targetName: definition.businessChain?.displayName ?? definition.name,
        summary: `应用项目自定义业务链路「${
          definition.businessChain?.displayName ?? definition.name
        }」`,
        detail: {
          定义版本: `v${definition.version}`,
          来源: "项目级配置文件",
        },
      });
      sendJson(response, 200, {
        ok: true,
        project: updated,
        businessChain: await businessChainConfig(
          body.workspaceId,
          updated,
          template,
          { includeSourceHealth: true },
        ),
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const uploadProjectDemoData = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(request, demoDataUploadSchema);
      const current = requireProjectManager(request, team, body.workspaceId);
      const workspace = workspaces.get(body.workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const binding = project.businessChainBinding;
      if (binding === undefined) {
        throw new ProjectError(
          "invalid_input",
          "请先绑定业务链路，再上传演示数据配置",
        );
      }
      const definition = dependencies
        .workflows()
        ?.definition?.(binding.workflowDefinitionId) as
        BusinessChainDefinitionLike | undefined;
      const nodes = new Map(
        (definition?.graph?.nodes ?? []).map((node) => [node.id, node]),
      );
      if (nodes.size === 0) {
        throw new ProjectError("invalid_input", "当前业务链路定义不可用");
      }
      for (const [nodeId, demoNode] of Object.entries(body.data.nodes)) {
        const node = nodes.get(nodeId);
        if (node === undefined) {
          throw new ProjectError(
            "invalid_input",
            `演示数据包含未知节点：${nodeId}`,
          );
        }
        const fieldKeys = new Set(
          (node.businessChain?.fields ?? []).map((field) => field.key),
        );
        for (const fieldKey of Object.keys(demoNode.fields)) {
          if (!fieldKeys.has(fieldKey)) {
            throw new ProjectError(
              "invalid_input",
              `节点「${node.name}」没有字段：${fieldKey}`,
            );
          }
        }
      }
      for (const event of body.data.changeEvents) {
        for (const nodeId of event.linkedNodeIds) {
          if (!nodes.has(nodeId)) {
            throw new ProjectError(
              "invalid_input",
              `变更记录引用未知节点：${nodeId}`,
            );
          }
        }
      }
      const uploadedAt = nowIso(now);
      const demoDataConfig: ProjectDemoDataConfig = {
        fileName: body.fileName,
        uploadedAt,
        uploadedBy: current.userId,
        data: body.data,
      };
      const saved = await service.upsertProject({
        workspaceId: body.workspaceId,
        demoDataConfig,
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "project",
        action: "project.demo-data.upload",
        targetId: body.fileName,
        targetName: body.fileName,
        summary: `上传项目概览演示数据「${body.fileName}」`,
      });
      sendJson(response, 200, {
        ok: true,
        demoData: {
          fileName: demoDataConfig.fileName,
          uploadedAt: demoDataConfig.uploadedAt,
          uploadedBy: demoDataConfig.uploadedBy,
        },
        project: saved,
      });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const progressOverview = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const workspaceId = query(request).get("workspaceId") ?? "";
      requireWorkspaceAccess(request, team, workspaceId);
      const workspace = workspaces.get(workspaceId);
      if (workspace === undefined) {
        throw new ProjectError("not_found", "项目不存在");
      }
      const project = await ensureProjectRecord(workspace);
      const template =
        project.templateId === undefined
          ? undefined
          : service.template(project.templateId);
      const workflows = dependencies.workflows();
      const binding = project.businessChainBinding;
      const definition =
        binding === undefined
          ? undefined
          : (workflows?.definition?.(binding.workflowDefinitionId) as
              | {
                  id: string;
                  key: string;
                  version: number;
                  name: string;
                  status: string;
                  workspaceId: string;
                  kind?: string;
                  businessChain?: Record<string, unknown>;
                  graph?: {
                    nodes: readonly {
                      id: string;
                      name: string;
                      type?: string;
                      executor?: Record<string, unknown>;
                      responsible?: Record<string, unknown>;
                      businessChain?: Record<string, unknown>;
                    }[];
                    edges?: readonly { from: string; to: string }[];
                  };
                }
              | undefined);
      const instance =
        binding?.workflowInstanceId === undefined
          ? undefined
          : (workflows?.instance?.(binding.workflowInstanceId) ??
            workflows
              ?.instances(workspaceId)
              .find((item) => item.id === binding.workflowInstanceId));
      const registry = dependencies.progressSources?.();
      if (registry === undefined) {
        throw new ProjectError("invalid_input", "项目概览数据源服务未配置");
      }
      const memberNames = Object.fromEntries(
        team.users().map((user) => [user.id, user.name] as const),
      );
      const builder = new ProjectProgressOverviewService({
        sources: registry,
        ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
      });
      const detailed = await builder.buildDetailed({
        project,
        template,
        definition: definition as never,
        instance: instance as never,
        tasks: tasksOf(workspaceId),
        reports: service.reports(workspaceId),
        events:
          binding?.workflowInstanceId === undefined
            ? []
            : (workflows?.events?.(binding.workflowInstanceId) ?? []),
        memberNames,
      });
      const alerts =
        binding === undefined
          ? []
          : await service.upsertProjectAlerts(
              workspaceId,
              detailed.alertCandidates,
              {
                observedAt: detailed.overview.generatedAt,
                staleConditionKeys: detailed.staleConditionKeys,
                sourceStatuses: detailed.sourceStatuses,
              },
            );
      const overview = hydrateOverviewAlerts(detailed.overview, alerts);
      sendJson(response, 200, { ok: true, overview });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  const alertTransition = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      assertSameOrigin(request);
      const body = await readBodyAs(
        request,
        z.object({
          workspaceId: z.string().trim().min(1).max(160),
          alertId: z.string().trim().min(1).max(300),
          action: z.enum([
            "acknowledge",
            "start",
            "resolve",
            "suppress",
            "reopen",
          ]),
          suppressedUntil: z.string().datetime({ precision: 3 }).optional(),
        }),
      );
      const current = requireWorkspaceAccess(request, team, body.workspaceId);
      const actorPrincipalId = dependencies
        .principals?.()
        ?.resolveSubject("auth-user", current.userId)?.id;
      const alert = await service.transitionProjectAlert({
        workspaceId: body.workspaceId,
        alertId: body.alertId,
        action: body.action,
        ...(actorPrincipalId === undefined ? {} : { actorPrincipalId }),
        ...(body.suppressedUntil === undefined
          ? {}
          : { suppressedUntil: body.suppressedUntil }),
      });
      await appendProjectAudit(current, body.workspaceId, {
        category: "project",
        action: `alert.${body.action}`,
        targetId: alert.alertId,
        targetName: alert.title,
        summary: `更新 Alert「${alert.title}」`,
        detail: { 生命周期: alert.lifecycle },
      });
      sendJson(response, 200, { ok: true, alert });
    } catch (cause) {
      routeError(response, cause);
    }
  };

  return [
    { kind: "exact", path: "/api/collab/projects", handler: list },
    { kind: "exact", path: "/api/collab/projects/detail", handler: detail },
    {
      kind: "exact",
      path: "/api/collab/projects/members/search",
      handler: memberSearch,
    },
    { kind: "exact", path: "/api/collab/projects/outputs", handler: outputs },
    {
      kind: "exact",
      path: "/api/collab/projects/outputs/download",
      handler: outputsDownload,
    },
    { kind: "exact", path: "/api/collab/projects/create", handler: create },
    { kind: "exact", path: "/api/collab/projects/update", handler: update },
    {
      kind: "exact",
      path: "/api/collab/projects/templates",
      handler: templateList,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/templates/save",
      handler: templateSave,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/templates/from-project",
      handler: templateFromProject,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/templates/remove",
      handler: templateRemove,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/templates/apply",
      handler: templateApply,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/roles/save",
      handler: roleSave,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/roles/remove",
      handler: roleRemove,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role/save",
      handler: projectRoleSave,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role/remove",
      handler: projectRoleRemove,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role-sources",
      handler: roleSources,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role/import",
      handler: roleImport,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/roles/confirm",
      handler: rolesConfirm,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role-mappings/save",
      handler: roleMappingSave,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/role-mappings/remove",
      handler: roleMappingRemove,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/members/save",
      handler: membersSave,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/members/remove",
      handler: membersRemove,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/leave",
      handler: leaveProject,
    },
    { kind: "exact", path: "/api/collab/projects/reports", handler: reports },
    {
      kind: "exact",
      path: "/api/collab/projects/reports/schedule",
      handler: reportScheduleUpdate,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/reports/generate",
      handler: reportsGenerate,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/history",
      handler: history,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain",
      handler: businessChainRead,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain/candidates",
      handler: businessChainCandidates,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain/validate",
      handler: businessChainValidate,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain/bind",
      handler: businessChainBind,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain/custom",
      handler: businessChainCustomBind,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/business-chain/instance",
      handler: businessChainInstanceAttach,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/demo-data/upload",
      handler: uploadProjectDemoData,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/progress-overview",
      handler: progressOverview,
    },
    {
      kind: "exact",
      path: "/api/collab/projects/alerts/transition",
      handler: alertTransition,
    },
  ];
}

/**
 * 为一个工作区补齐项目记录与编号（`PRJ` + 6 位数字）。
 * 已建档的工作区保持原编号不变。
 */
export async function provisionProject(
  service: ProjectService,
  team: TeamServiceLike,
  workspaces: WorkspaceRegistryLike,
  workspaceId: string,
): Promise<ProjectRecord | undefined> {
  const workspace = workspaces.get(workspaceId);
  if (workspace === undefined) return undefined;
  return service.ensureProject({
    workspaceId: workspace.id,
    ...ownerOfWorkspace(team, workspace.id),
  });
}

/**
 * 订阅宿主工作区变更流：baseline 补齐既有项目编号，upsert 时给新建项目立即分配
 * 编号。这样从左侧栏新建的项目在创建那一刻就有编号，不用等页面读取。
 */
export function followWorkspaceProjects(
  service: ProjectService,
  team: TeamServiceLike,
  workspaces: WorkspaceRegistryLike,
  controller: WorkspaceControllerLike,
  onProvisioned?: (
    workspace: WorkspaceLike,
    project: ProjectRecord,
  ) => Promise<void> | void,
): () => void {
  const abort = new AbortController();
  void (async () => {
    try {
      for await (const frame of controller.follow(abort.signal)) {
        if (frame.type === "baseline") {
          for (const item of frame.value?.items ?? []) {
            const id = item.workspaceId ?? item.id;
            if (id !== undefined) {
              const project = await provisionProject(
                service,
                team,
                workspaces,
                id,
              );
              const workspace = workspaces.get(id);
              if (project !== undefined && workspace !== undefined) {
                await onProvisioned?.(workspace, project);
              }
            }
          }
          continue;
        }
        if (frame.type === "upsert") {
          const id = frame.workspace?.workspaceId ?? frame.workspace?.id;
          if (id !== undefined) {
            const project = await provisionProject(
              service,
              team,
              workspaces,
              id,
            );
            const workspace = workspaces.get(id);
            if (project !== undefined && workspace !== undefined) {
              await onProvisioned?.(workspace, project);
            }
          }
        }
      }
    } catch {
      // 变更流中断不影响读路径的兜底建档。
    }
  })();
  return () => abort.abort();
}

function scheduledReportActor(
  project: ProjectRecord,
  team: TeamServiceLike,
): TeamPrincipalLike {
  const ownerId =
    project.ownerId ??
    team
      .members(project.workspaceId)
      .find((member) => member.memberRole === "owner")?.userId;
  const user = team.users().find((candidate) => candidate.id === ownerId);
  if (user !== undefined) {
    return { userId: user.id, role: globalRoleOf(user.role) };
  }
  const admin = team.users().find((candidate) => candidate.role === "admin");
  return admin === undefined
    ? { userId: "system", role: "admin" }
    : { userId: admin.id, role: "admin" };
}

export async function ensureProjectManagerInstance(input: {
  readonly service: ProjectService;
  readonly dependencies: ProjectDependencies;
  readonly current: TeamPrincipalLike;
  readonly workspace: WorkspaceLike;
  readonly project: ProjectRecord;
}): Promise<{
  readonly project: ProjectRecord;
  readonly teammate: TeammateLike | undefined;
  readonly warning?: string;
}> {
  const { service, dependencies, current, workspace } = input;
  const teammates = dependencies.teammates();
  if (teammates?.ensureProjectManagerAgent === undefined) {
    return {
      project: input.project,
      teammate: undefined,
      warning: "AI伙伴服务不可用，项目经理未初始化",
    };
  }
  const userName =
    dependencies.team.users().find((user) => user.id === current.userId)
      ?.name ?? current.userId;
  const teammateActor = {
    userId: current.userId,
    name: userName,
    role: globalRoleOf(current.role),
  };
  let project = input.project;
  let teammate: TeammateLike | undefined;
  try {
    teammate = await teammates.ensureProjectManagerAgent({
      workspaceId: workspace.id,
      projectName: workspace.title,
      actor: teammateActor,
    });
    const systemRole = service.role("role-pm");
    if (
      systemRole !== undefined &&
      !project.projectRoles.some((role) => role.id === "role-pm")
    ) {
      const timestamp = nowIso(dependencies.now ?? (() => new Date()));
      project = await service.upsertProject({
        workspaceId: workspace.id,
        projectRoles: [
          {
            id: systemRole.id,
            name: systemRole.name,
            code: systemRole.code,
            category: systemRole.category,
            description: systemRole.description,
            permissions: [...systemRole.permissions],
          },
          ...project.projectRoles,
        ],
        rolesInitialized: true,
        rolesRevision: project.rolesRevision + 1,
        rolesUpdatedAt: timestamp,
        rolesUpdatedBy: current.userId,
      });
    }
    const assignments = dependencies.assignments();
    if (assignments !== undefined && systemRole !== undefined) {
      const roleActor = actorOf(current, dependencies.team, workspace.id);
      await syncProjectSeats(
        service,
        assignments,
        roleActor,
        project,
        dependencies.now ?? (() => new Date()),
      );
      await assignments.assign(roleActor, {
        workspaceId: workspace.id,
        seatId: "role-pm",
        assigneeKind: "agent",
        assigneeId: teammate.id,
      });
    }
    return { project, teammate };
  } catch (cause) {
    return {
      project,
      teammate,
      warning:
        cause instanceof Error
          ? `项目经理初始化失败：${cause.message}`
          : "项目经理初始化失败",
    };
  }
}

interface ProjectReportGenerationResult {
  readonly content: string;
  readonly generationMode: "agent" | "deterministic_fallback";
  readonly skillId: string;
  readonly skillVersion: string;
  readonly agentRunId?: string;
  readonly generationError?: string;
}

interface ProjectReportSkillSnapshot {
  readonly id: string;
  readonly name?: string | undefined;
  readonly version: string;
  readonly instructions?: string | undefined;
  readonly resolved: boolean;
}

async function resolveProjectReportSkill(
  dependencies: ProjectDependencies,
  userId: string,
): Promise<ProjectReportSkillSnapshot> {
  const fallback = {
    id: PROJECT_REPORTING_SKILL_ID,
    version: DEFAULT_PROJECT_REPORTING_SKILL_VERSION,
    resolved: false,
  } as const;
  try {
    const skill = (
      await dependencies
        .skillCatalog?.()
        ?.resolveSkills({ userId }, [PROJECT_REPORTING_SKILL_ID], {
          requireInstallation: false,
        })
    )?.[0];
    if (skill === undefined) return fallback;
    const instructions = skill.instructions?.trim();
    return {
      id: skill.id,
      version: skill.version,
      resolved: true,
      ...(skill.name === undefined ? {} : { name: skill.name }),
      ...(instructions === undefined || instructions === ""
        ? {}
        : { instructions }),
    };
  } catch {
    // Reporting remains available if the resource market is temporarily unavailable.
    return fallback;
  }
}

function reportHeadingsFor(reportType: ProjectReportType): readonly string[] {
  return reportType === "weekly"
    ? [
        "本周结论",
        "目标与里程碑进展",
        "关键结果",
        "指标与风险趋势",
        "阻塞、依赖与需决策事项",
        "下周计划",
      ]
    : reportType === "progress"
      ? ["当前状态", "与计划的差异", "已完成", "风险与依赖", "需要支持或决策"]
      : [
          "一句话结论",
          "项目健康度与计划偏差",
          "关键结果",
          "业务数据异常",
          "推进异常",
          "待确认与下一步",
        ];
}

function normalizeProjectAgentReport(content: string): string {
  const fenced = content
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const headingIndex = fenced.search(/^##\s+/m);
  return headingIndex < 0 ? fenced : fenced.slice(headingIndex).trim();
}

function validateProjectAgentReport(
  content: string,
  allowedSource: string,
  reportType: ProjectReportType,
):
  | { readonly valid: true; readonly content: string }
  | {
      readonly valid: false;
      readonly error: string;
    } {
  const normalized = normalizeProjectAgentReport(content);
  if (normalized === "") {
    return { valid: false, error: "Agent 返回内容为空" };
  }
  const missing = reportHeadingsFor(reportType).filter(
    (heading) => !new RegExp(`^##\\s+${heading}\\s*$`, "m").test(normalized),
  );
  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必需小节：${missing.join("、")}`,
    };
  }
  if (/^#\s+/m.test(normalized)) {
    return { valid: false, error: "报告不应包含一级标题" };
  }
  const allowedNumbers = new Set(allowedSource.match(/\d+(?:\.\d+)?/g) ?? []);
  const contentWithoutListNumbers = normalized.replace(/^\s*\d+[.)]\s+/gm, "");
  const unsupportedNumbers = [
    ...new Set(contentWithoutListNumbers.match(/\d+(?:\.\d+)?/g) ?? []),
  ].filter((value) => !allowedNumbers.has(value));
  if (unsupportedNumbers.length > 0) {
    return {
      valid: false,
      error: `包含事实包之外的数字：${unsupportedNumbers.slice(0, 6).join("、")}`,
    };
  }
  return { valid: true, content: normalized };
}

async function waitForProjectAgentRun(
  agent: ProjectAgentServiceLike,
  runId: string,
  timeoutMs: number,
): Promise<ProjectReportAgentRunLike | undefined> {
  const terminal = new Set([
    "succeeded",
    "failed",
    "timeout",
    "cancelled",
    "interrupted",
  ]);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const run =
      agent.run?.(runId) ??
      agent.runs().find((candidate) => candidate.id === runId);
    if (run !== undefined && terminal.has(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return agent.run?.(runId);
}

async function withProjectReportTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * 确定性事实包约束的 PM Agent 生成。数字必须来自事实包，标题必须满足
 * 汇报结构；任一校验失败均回退到确定性模板并记录原因。
 */
export async function generateProjectReportContent(input: {
  readonly dependencies: ProjectDependencies;
  readonly workspace: WorkspaceLike;
  readonly project: ProjectRecord;
  readonly projectManager: TeammateLike | undefined;
  readonly current: TeamPrincipalLike;
  readonly tasks: readonly TaskLike[];
  readonly workflows: readonly WorkflowInstanceLike[];
  readonly date: string;
  readonly reportType: ProjectReportType;
}): Promise<ProjectReportGenerationResult> {
  const reportSkill = await resolveProjectReportSkill(
    input.dependencies,
    input.current.userId,
  );
  const baseline = buildProjectReportContent({
    project: input.project,
    workspace: input.workspace,
    tasks: input.tasks,
    workflows: input.workflows,
    today: input.date,
    reportType: input.reportType,
  });
  if (!reportSkill.resolved) {
    return {
      content: baseline,
      generationMode: "deterministic_fallback",
      skillId: reportSkill.id,
      skillVersion: reportSkill.version,
      generationError: "资源市场项目汇报 Skill 未加载，已使用内置结构生成",
    };
  }
  const assessment = assessProjectReport({
    project: input.project,
    workspace: input.workspace,
    tasks: input.tasks,
    workflows: input.workflows,
    today: input.date,
    reportType: input.reportType,
  });
  const projectManager = input.projectManager;
  const runtime = input.dependencies.teammates();
  const agent = input.dependencies.agent?.();
  if (
    projectManager === undefined ||
    runtime?.ensureRuntime === undefined ||
    agent === undefined
  ) {
    return {
      content: baseline,
      generationMode: "deterministic_fallback",
      skillId: reportSkill.id,
      skillVersion: reportSkill.version,
      generationError: "项目经理 Agent 运行服务不可用",
    };
  }
  try {
    const memberRole = memberRoleOf(
      input.dependencies.team,
      input.workspace.id,
      input.current.userId,
    );
    const ensured = await runtime.ensureRuntime({
      teammateId: projectManager.id,
      workspaceId: input.workspace.id,
      actor: {
        userId: input.current.userId,
        name:
          input.dependencies.team
            .users()
            .find((user) => user.id === input.current.userId)?.name ??
          input.current.userId,
        role: globalRoleOf(input.current.role),
      },
      ...(memberRole === undefined ? {} : { workspaceRole: memberRole }),
    });
    const reportLabel =
      input.reportType === "weekly"
        ? "项目周报"
        : input.reportType === "progress"
          ? "进度汇报"
          : "项目日报";
    const factPack = {
      workspaceId: input.workspace.id,
      projectName: input.workspace.title,
      date: input.date,
      reportType: input.reportType,
      project: {
        status: input.project.status,
        health: input.project.health,
        progress: input.project.progress,
        startDate: input.project.startDate,
        targetDate: input.project.targetDate,
        description: input.project.description,
      },
      metrics: {
        totalTasks: input.tasks.length,
        openTasks: assessment.openTasks.length,
        completedTasks: assessment.completedTasks.length,
        inProgressTasks: assessment.inProgressTasks.length,
        reviewTasks: assessment.reviewTasks.length,
        overdueTasks: assessment.overdueTasks.length,
        abnormalTasks: assessment.abnormalTasks.length,
        unassignedTasks: assessment.unassignedTasks.length,
        needsInputTasks: assessment.needsInputTasks.length,
        totalWorkflows: input.workflows.length,
        completedWorkflows: assessment.completedWorkflows.length,
        blockedWorkflows: assessment.blockedWorkflows.length,
        failedWorkflows: assessment.failedWorkflows.length,
        waitingWorkflows: assessment.waitingWorkflows.length,
        taskStatusCounts: input.tasks.reduce<Record<string, number>>(
          (counts, task) => ({
            ...counts,
            [task.status]: (counts[task.status] ?? 0) + 1,
          }),
          {},
        ),
        openPriorityCounts: assessment.openTasks.reduce<Record<string, number>>(
          (counts, task) => ({
            ...counts,
            [task.priority]: (counts[task.priority] ?? 0) + 1,
          }),
          {},
        ),
        dueDateCounts: input.tasks.reduce<Record<string, number>>(
          (counts, task) =>
            task.due === undefined || task.due === ""
              ? counts
              : {
                  ...counts,
                  [task.due]: (counts[task.due] ?? 0) + 1,
                },
          {},
        ),
        abnormalDueDateCounts: input.tasks.reduce<Record<string, number>>(
          (counts, task) =>
            task.status !== "abnormal" ||
            task.due === undefined ||
            task.due === ""
              ? counts
              : {
                  ...counts,
                  [task.due]: (counts[task.due] ?? 0) + 1,
                },
          {},
        ),
      },
      tasks: input.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        receiverName: task.receiverName ?? "",
        due: task.due ?? "",
        progress: task.progress ?? 0,
        receiverState: task.receiverState ?? "",
        needsInput: task.needsInput === true,
        queueState: task.queueState ?? "",
        anomaly: task.executionAnomaly?.message ?? "",
        acceptance:
          task.comments
            ?.filter((comment) => comment.isKeyConsensus === true)
            .map((comment) => comment.content) ?? [],
      })),
      workflows: input.workflows.map((workflow) => ({
        id: workflow.id,
        title: workflow.title,
        status: workflow.status,
        updatedAt: workflow.updatedAt,
      })),
      deterministicBaseline: baseline,
    };
    const serializedFactPack = JSON.stringify(factPack);
    const skillSection =
      reportSkill.instructions === undefined
        ? []
        : [
            "",
            "## 场景 Skill 指令",
            reportSkill.instructions,
            "",
            "Skill 指令与平台契约冲突时，以平台契约、事实包和校验规则为准。",
          ];
    const instruction = [
      `请为项目「${input.workspace.title}」生成 ${input.date} ${reportLabel}。`,
      "",
      "必须遵守：",
      "- 只依据下方事实包，不新增事实包之外的数字、日期、负责人或结论。",
      "- 直接输出完整 Markdown 报告，不要输出思考过程、解释、代码块或一级标题。",
      `- 必须依次包含以下二级标题：${reportHeadingsFor(input.reportType)
        .map((heading) => `## ${heading}`)
        .join("、")}。`,
      "- 先给结论，再给证据；结果优先于动作；风险和下一步必须具体。",
      "- 不得调用 project_report_generate，也不能自行写入文件。",
      ...skillSection,
      "",
      "## 项目事实包",
      serializedFactPack,
    ].join("\n");
    const dispatched = await withProjectReportTimeout(
      agent.dispatch({
        workspaceId: input.workspace.id,
        workspacePath: input.workspace.path,
        profileId: ensured.profileId,
        source: "chat",
        instanceId: `project-report-${input.workspace.id}`,
        nodeId: "project-report",
        dispatchKey: `project-report:${input.workspace.id}:${input.date}:${input.reportType}`,
        trigger: "manual-dispatch",
        attempt: 1,
        runSeq: 1,
        maxAttempts: 1,
        timeoutMs: 90_000,
        ...(ensured.personaId === undefined
          ? {}
          : { personaId: ensured.personaId }),
        ...(ensured.principalId === undefined
          ? {}
          : {
              principalId: ensured.principalId,
              principalType: "principal-runtime" as const,
            }),
        payload: {
          instanceTitle: `${input.date} ${reportLabel}`,
          nodeName: "项目汇报生成",
          nodeDescription: instruction.slice(0, 2_000),
          profileName: projectManager.name,
          deliverables: [],
          context: {
            instruction,
            reportType: input.reportType,
            reportDate: input.date,
            projectId: input.workspace.id,
            transcript: "",
          },
        },
        createdBy: input.current.userId,
      }),
      20_000,
      "项目经理 Agent 派发超时",
    );
    const completed = await waitForProjectAgentRun(
      agent,
      dispatched.id,
      95_000,
    );
    if (completed?.status !== "succeeded") {
      return {
        content: baseline,
        generationMode: "deterministic_fallback",
        skillId: reportSkill.id,
        skillVersion: reportSkill.version,
        ...(dispatched.id === "" ? {} : { agentRunId: dispatched.id }),
        generationError:
          completed?.error ??
          `项目经理 Agent 运行状态为 ${completed?.status ?? "unknown"}`,
      };
    }
    const validation = validateProjectAgentReport(
      completed.output?.summary ?? "",
      serializedFactPack,
      input.reportType,
    );
    if (!validation.valid) {
      return {
        content: baseline,
        generationMode: "deterministic_fallback",
        skillId: reportSkill.id,
        skillVersion: reportSkill.version,
        agentRunId: dispatched.id,
        generationError: validation.error,
      };
    }
    return {
      content: validation.content,
      generationMode: "agent",
      skillId: reportSkill.id,
      skillVersion: reportSkill.version,
      agentRunId: dispatched.id,
    };
  } catch (cause) {
    return {
      content: baseline,
      generationMode: "deterministic_fallback",
      skillId: reportSkill.id,
      skillVersion: reportSkill.version,
      generationError: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/**
 * 检查一次到期项目并生成日报。调度器与手动更新共用同一份项目事实、
 * 项目经理 Agent 和日报快照存储；当天已有日报时直接跳过，避免重复覆盖。
 */
export async function runScheduledProjectReports(
  service: ProjectService,
  dependencies: ProjectDependencies,
): Promise<{ generated: number; skipped: number }> {
  const now = dependencies.now ?? (() => new Date());
  let generated = 0;
  let skipped = 0;
  for (const project of service.projects()) {
    const schedule = project.reportSchedule;
    if (!schedule.enabled) continue;
    const clock = projectReportScheduleClock(now(), schedule.timezone);
    if (!isProjectReportScheduleDue(schedule, clock)) continue;
    if (
      service.report(project.workspaceId, clock.date, "daily") !== undefined
    ) {
      skipped += 1;
      continue;
    }
    const workspace = dependencies.workspaces.get(project.workspaceId);
    if (workspace === undefined) continue;
    try {
      const current = scheduledReportActor(project, dependencies.team);
      const manager = await ensureProjectManagerInstance({
        service,
        dependencies,
        current,
        workspace,
        project,
      });
      const scheduledProject = manager.project;
      const projectManager = manager.teammate;
      const tasks = [
        ...(dependencies.tasks()?.list(project.workspaceId) ?? []),
      ];
      const workflows = [
        ...(dependencies.workflows()?.instances(project.workspaceId) ?? []),
      ];
      const generatedAt = nowIso(now);
      const generatedReport = await generateProjectReportContent({
        dependencies,
        workspace,
        project: scheduledProject,
        projectManager,
        current,
        tasks,
        workflows,
        date: clock.date,
        reportType: "daily",
      });
      const runId = generatedReport.agentRunId ?? `report-run-${randomUUID()}`;
      const report = await service.saveReport({
        workspaceId: project.workspaceId,
        date: clock.date,
        reportType: "daily",
        generatedAt,
        generatedBy: projectManager?.name ?? "项目 AI",
        ...(projectManager === undefined
          ? {}
          : { generatedByTeammateId: projectManager.id }),
        runId,
        skillId: generatedReport.skillId,
        skillVersion: generatedReport.skillVersion,
        triggerSource: "schedule",
        generationMode: generatedReport.generationMode,
        ...(generatedReport.generationError === undefined
          ? {}
          : { generationError: generatedReport.generationError }),
        sourceRefs: [
          ...tasks.map((task) => `task:${task.id}`),
          ...workflows.map((workflow) => `workflow:${workflow.id}`),
        ],
        content: generatedReport.content,
      });
      await service.appendAudit({
        workspaceId: project.workspaceId,
        actorId: current.userId,
        actorName: "定时任务",
        actorRole: "system",
        category: "report",
        action: "report.generate",
        targetId: clock.date,
        targetName: `${clock.date} 项目日报`,
        summary: `定时生成 ${clock.date} 项目日报`,
        detail: {
          日期: clock.date,
          报告类型: "daily",
          触发来源: "schedule",
          运行ID: runId,
          撰写人: report.generatedBy,
          生成方式: generatedReport.generationMode,
          ...(generatedReport.generationError === undefined
            ? {}
            : { 回退原因: generatedReport.generationError }),
          计划时间: schedule.time,
          时区: schedule.timezone,
        },
      });
      generated += 1;
    } catch {
      skipped += 1;
    }
  }
  return { generated, skipped };
}

export interface ProjectReportSchedulerOptions {
  readonly intervalMs?: number;
  readonly initialDelayMs?: number;
}

/** 启动分钟级检查；timer.unref 让插件测试和短生命周期进程可以正常退出。 */
export function startProjectReportScheduler(
  service: ProjectService,
  dependencies: ProjectDependencies,
  options: ProjectReportSchedulerOptions = {},
): () => void {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await runScheduledProjectReports(service, dependencies);
    } catch {
      // 单个调度轮次失败不终止后续检查。
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), options.intervalMs ?? 60_000);
  timer.unref?.();
  const initialTimer = setTimeout(
    () => void tick(),
    options.initialDelayMs ?? 5_000,
  );
  initialTimer.unref?.();
  return () => {
    clearInterval(timer);
    clearTimeout(initialTimer);
  };
}

function projectDependenciesFor(
  ctx: ProjectContext,
  team: TeamServiceLike,
  workspaces: WorkspaceRegistryLike,
): ProjectDependencies {
  return {
    team,
    workspaces,
    assignments: () =>
      ctx.get("collabAssignment") as AssignmentServiceLike | undefined,
    employees: () =>
      ctx.get("collabEmployee") as EmployeeServiceLike | undefined,
    teammates: () =>
      ctx.get("collabTeammateRuntime") as TeammateRuntimeLike | undefined,
    tasks: () => ctx.get("collabTasks") as TaskServiceLike | undefined,
    taskDocuments: () =>
      ctx.get("collabTaskDocuments") as
        TaskDocumentQueryServiceLike | undefined,
    workflows: () =>
      ctx.get("collabWorkflow") as WorkflowServiceLike | undefined,
    meetings: () => ctx.get("collabMeeting") as MeetingServiceLike | undefined,
    meetingFiles: () =>
      ctx.get("collabMeetingFiles") as MeetingFileServiceLike | undefined,
    meetingMinutes: () =>
      ctx.get("collabMeetingMinutes") as MeetingMinutesServiceLike | undefined,
    dataAgent: () =>
      ctx.get("collabDataAgent") as DataAgentOutputServiceLike | undefined,
    principals: () =>
      ctx.get("collabPrincipal") as PrincipalServiceLike | undefined,
    skillCatalog: () =>
      ctx.get("collabResourceMarket") as ProjectSkillCatalogLike | undefined,
    agent: () => ctx.get("collabAgent") as ProjectAgentServiceLike | undefined,
    progressSources: () =>
      new MockScenarioSourceRegistry({
        docsRoot:
          process.env.DSH_PROJECT_PROGRESS_DOCS ??
          resolve(process.cwd(), "docs/project-progress-overview"),
      }),
  };
}

export async function apply(ctx: ProjectContext): Promise<void> {
  const domain = await ctx.storageDomain.open(projectDomainSpec);
  const service = new ProjectService({
    projects: domain.table("projects"),
    templates: domain.table("templates"),
    roles: domain.table("roles"),
    reports: domain.table("reports"),
    audit: domain.table("audit"),
    alerts: domain.table("alerts"),
  });
  await service.seedDefaults();
  ctx.provide("collabProjects", service);
  ctx.effect(() => () => void domain.close());
  ctx.inject(["collabTeam"], (child) => {
    const workspaces = child.get("workspaceRegistry") as
      WorkspaceRegistryLike | undefined;
    if (workspaces === undefined) return;
    const reportDependencies = projectDependenciesFor(
      child,
      child.collabTeam,
      workspaces,
    );
    /** 启动时补齐项目记录、编号与项目托管 PM 实例，所有操作均幂等。 */
    void (async () => {
      for (const workspace of workspaces.list()) {
        const project = await provisionProject(
          service,
          child.collabTeam,
          workspaces,
          workspace.id,
        );
        if (project === undefined) continue;
        const current = scheduledReportActor(project, child.collabTeam);
        await ensureProjectManagerInstance({
          service,
          dependencies: reportDependencies,
          current,
          workspace,
          project,
        });
      }
    })().catch(() => undefined);
    const disposers = createProjectRoutes(service, reportDependencies).map(
      (route) => child.webServer.register(route) as () => void,
    );
    const stopReportScheduler = startProjectReportScheduler(
      service,
      reportDependencies,
    );
    ctx.effect(() => stopReportScheduler);
    const toolDisposer =
      child.tools?.get?.("project_report_generate") === undefined
        ? child.tools?.register({
            name: "project_report_generate",
            description:
              "Generate the current project manager agent's daily, weekly, or progress report from authorized project facts.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                reportType: {
                  type: "string",
                  enum: ["daily", "weekly", "progress"],
                },
                date: { type: "string" },
                periodStart: { type: "string" },
                periodEnd: { type: "string" },
                focus: { type: "string" },
              },
              required: ["reportType"],
            },
            output: {
              schema: { type: "string" },
              render: (_args, value) => [
                { type: "text" as const, text: String(value) },
              ],
            },
            execute: async (rawArgs, exec) => {
              exec.signal?.throwIfAborted();
              const args = z
                .object({
                  reportType: projectReportTypeSchema,
                  date: z.string().trim().min(8).max(20).optional(),
                  periodStart: z.string().trim().max(20).optional(),
                  periodEnd: z.string().trim().max(20).optional(),
                  focus: z.string().trim().max(500).optional(),
                })
                .parse(rawArgs);
              const sessionId = exec.agent?.session?.id;
              if (sessionId === undefined) {
                throw new Error("当前工具调用没有可用的会话上下文");
              }
              const agent = child.get("collabAgent") as
                ProjectReportAgentServiceLike | undefined;
              const run = agent
                ?.runs()
                .find(
                  (candidate) =>
                    candidate.sessionId === sessionId &&
                    !["succeeded", "failed", "cancelled"].includes(
                      candidate.status,
                    ),
                );
              if (run === undefined) {
                throw new Error("当前工具调用没有可用的 Agent Run");
              }
              const workspace = workspaces.get(run.workspaceId);
              if (workspace === undefined) {
                throw new Error("当前运行不属于有效项目");
              }
              const runtime = child.get("collabTeammateRuntime") as
                TeammateRuntimeLike | undefined;
              const projectManager = runtime?.projectManagerFor?.(workspace.id);
              if (
                projectManager === undefined ||
                run.instanceId !== projectManager.id
              ) {
                throw new Error(
                  "只有当前项目的项目经理 Agent 可以生成项目汇报",
                );
              }
              const timestamp = new Date().toISOString();
              const date =
                args.date ??
                projectReportScheduleClock(new Date(), "Asia/Shanghai").date;
              const project = await service.ensureProject({
                workspaceId: workspace.id,
                ...ownerOfWorkspace(child.collabTeam, workspace.id),
              });
              const tasks =
                (child.get("collabTasks") as TaskServiceLike | undefined)?.list(
                  workspace.id,
                ) ?? [];
              const workflows =
                (
                  child.get("collabWorkflow") as WorkflowServiceLike | undefined
                )?.instances(workspace.id) ?? [];
              const runId = `report-run-${randomUUID()}`;
              const reportSkill = await resolveProjectReportSkill(
                reportDependencies,
                run.createdBy,
              );
              const report = await service.saveReport({
                workspaceId: workspace.id,
                date,
                reportType: args.reportType,
                ...(args.periodStart === undefined
                  ? {}
                  : { periodStart: args.periodStart }),
                ...(args.periodEnd === undefined
                  ? {}
                  : { periodEnd: args.periodEnd }),
                generatedAt: timestamp,
                generatedBy: projectManager.name,
                generatedByTeammateId: projectManager.id,
                runId,
                skillId: reportSkill.id,
                skillVersion: reportSkill.version,
                triggerSource: run.source === "task" ? "task" : "chat",
                generationMode: "deterministic_fallback",
                generationError: "项目经理工具调用路径当前使用确定性模板生成",
                sourceRefs: [
                  ...tasks.map((task) => `task:${task.id}`),
                  ...workflows.map((workflow) => `workflow:${workflow.id}`),
                ],
                content: buildProjectReportContent({
                  project,
                  workspace,
                  tasks,
                  workflows,
                  today: date,
                  reportType: args.reportType,
                }),
              });
              const actorUser = child.collabTeam
                .users()
                .find((user) => user.id === run.createdBy);
              await service.appendAudit({
                workspaceId: workspace.id,
                actorId: run.createdBy,
                actorName: actorUser?.name ?? run.createdBy,
                actorRole: actorUser?.role ?? "member",
                category: "report",
                action: "report.generate",
                targetId: date,
                targetName: `${date} 项目汇报`,
                summary: `项目经理 Agent 生成 ${date} ${args.reportType} 汇报`,
                detail: {
                  报告类型: args.reportType,
                  触发来源: run.source === "task" ? "task" : "chat",
                  运行ID: runId,
                  项目经理: projectManager.name,
                  生成方式: "deterministic_fallback",
                  ...(args.focus === undefined ? {} : { 关注点: args.focus }),
                },
              });
              return JSON.stringify({
                ok: true,
                runId,
                report,
                projectManager: {
                  id: projectManager.id,
                  name: projectManager.name,
                },
              });
            },
          })
        : undefined;
    child.effect(() => () => {
      for (const dispose of disposers) dispose();
      toolDisposer?.();
    });
  });
  /*
   * 项目编号在「项目创建」时生效：等 workspaceController 就绪后订阅工作区变更流，
   * 新建 / 注册的项目在 upsert 的那一刻拿到编号，不用等页面读取。
   */
  ctx.inject(["collabTeam", "workspaceController"], (child) => {
    const workspaces = child.get("workspaceRegistry") as
      WorkspaceRegistryLike | undefined;
    const controller =
      child.workspaceController ??
      (child.get("workspaceController") as WorkspaceControllerLike | undefined);
    if (workspaces === undefined || controller?.follow === undefined) return;
    const dependencies = projectDependenciesFor(
      child,
      child.collabTeam,
      workspaces,
    );
    const stop = followWorkspaceProjects(
      service,
      child.collabTeam,
      workspaces,
      controller,
      async (workspace, project) => {
        const current = scheduledReportActor(project, child.collabTeam);
        await ensureProjectManagerInstance({
          service,
          dependencies,
          current,
          workspace,
          project,
        });
      },
    );
    child.effect(() => stop);
  });
}
