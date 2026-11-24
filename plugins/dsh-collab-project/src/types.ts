import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(160);
export const isoTimeSchema = z.string().datetime({ precision: 3 });

/** 项目运行状态：与 demo 保持一致，使用中文枚举直接落库。 */
export const projectStatusSchema = z.enum([
  "进行中",
  "规划中",
  "已完成",
  "已暂停",
  "风险",
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectHealthSchema = z.enum(["健康", "关注", "风险"]);
export type ProjectHealth = z.infer<typeof projectHealthSchema>;

export const roleCategorySchema = z.enum([
  "管理",
  "执行",
  "评审",
  "审批",
  "计划",
  "采购",
  "支持",
]);
export type RoleCategory = z.infer<typeof roleCategorySchema>;

/**
 * 角色权限：与 dsh-collab-roles 的席位权限共用同一词表，
 * 供「授权范围」只读展示与席位物化时使用。
 */
export const rolePermissionSchema = z.enum([
  "read",
  "write",
  "approve",
  "manage_members",
  "manage_roles",
]);
export type RolePermission = z.infer<typeof rolePermissionSchema>;

/**
 * 项目内角色定义（项目自己的副本）。
 *
 * 项目模版里的角色只是初始化素材；应用到项目时复制成本结构，
 * 之后每个项目独立增删改，不会影响模版、角色库或其他项目。
 */
export const projectRoleDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  category: roleCategorySchema,
  description: z.string().trim().max(500).default(""),
  permissions: z.array(rolePermissionSchema).min(1).max(5),
});
export type ProjectRoleDefinition = z.infer<typeof projectRoleDefinitionSchema>;

export const roleMappingAssigneeSchema = z.object({
  kind: z.enum(["user", "agent"]),
  id: idSchema,
  name: z.string().trim().max(120).optional(),
});
export type RoleMappingAssignee = z.infer<typeof roleMappingAssigneeSchema>;

export const roleMappingPresetSchema = z.object({
  roleId: idSchema,
  assignees: z.array(roleMappingAssigneeSchema).min(1).max(100),
  updatedBy: idSchema,
  updatedAt: isoTimeSchema,
});
export type RoleMappingPreset = z.infer<typeof roleMappingPresetSchema>;

export const businessChainModeSchema = z.enum([
  "required",
  "optional",
  "none",
]);
export type BusinessChainMode = z.infer<typeof businessChainModeSchema>;

export const businessChainVersionPolicySchema = z.enum([
  "pin-at-project-create",
  "latest-active",
]);
export type BusinessChainVersionPolicy = z.infer<
  typeof businessChainVersionPolicySchema
>;

/** 业务对象引用只使用稳定系统、类型和对象 ID，不保存展示名称。 */
export const businessChainExternalRefSchema = z.object({
  system: z.string().trim().min(1).max(80),
  objectType: z.string().trim().min(1).max(80),
  objectId: z.string().trim().min(1).max(200),
  required: z.boolean().default(true),
});
export type BusinessChainExternalRef = z.infer<
  typeof businessChainExternalRefSchema
>;

export const businessChainNodeBindingSchema = z.object({
  nodeId: idSchema,
  externalRefs: z.array(businessChainExternalRefSchema).max(50).default([]),
});
export type BusinessChainNodeBinding = z.infer<
  typeof businessChainNodeBindingSchema
>;

/**
 * 项目创建或显式应用时保存的业务链路快照。
 * 模版后续更新只影响下一次显式应用，不修改这里。
 */
export const projectBusinessChainBindingSchema = z.object({
  projectTemplateId: idSchema,
  businessChainTemplateId: idSchema,
  workflowDefinitionId: idSchema,
  workflowDefinitionVersion: z.number().int().positive(),
  workflowInstanceId: idSchema.optional(),
  chainKey: idSchema.optional(),
  bindingMode: z.enum([
    "template-default",
    "template-allowed",
    "project-custom",
    "legacy",
  ]),
  sourceTemplateRevision: z.number().int().positive(),
  nodeBindings: z.array(businessChainNodeBindingSchema).max(100).default([]),
  boundAt: isoTimeSchema,
  boundBy: idSchema,
});
export type ProjectBusinessChainBinding = z.infer<
  typeof projectBusinessChainBindingSchema
>;

export const projectReportScheduleFrequencySchema = z.enum([
  "daily",
  "weekdays",
  "weekly",
  "monthly",
]);
export type ProjectReportScheduleFrequency = z.infer<
  typeof projectReportScheduleFrequencySchema
>;

const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "无效的时区");

/**
 * 项目日报自动生成计划。
 *
 * 默认每天本地时间 08:00 生成一次；同一天已有日报时不会覆盖，
 * 因此手动更新或错过的调度恢复都不会制造重复快照。
 */
export const projectReportScheduleSchema = z.object({
  enabled: z.boolean().default(true),
  frequency: projectReportScheduleFrequencySchema.default("daily"),
  time: z
    .string()
    .trim()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("08:00"),
  timezone: timeZoneSchema.default("Asia/Shanghai"),
  /** 0 = 周日，1 = 周一；仅 weekly 使用。 */
  weekday: z.number().int().min(0).max(6).default(1),
  /** 仅 monthly 使用；限制到 28，避免短月跳过。 */
  dayOfMonth: z.number().int().min(1).max(28).default(1),
});
export type ProjectReportSchedule = z.infer<typeof projectReportScheduleSchema>;

export const projectDemoDataNodeSchema = z.object({
  status: z
    .enum(["waiting", "ready", "running", "blocked", "completed", "failed"])
    .optional(),
  owner: z.string().trim().max(120).optional(),
  exception: z.string().trim().max(1_000).optional(),
  fields: z
    .record(
      z.string().trim().min(1).max(120),
      z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
});
export type ProjectDemoDataNode = z.infer<typeof projectDemoDataNodeSchema>;

export const projectDemoDataChangeEventSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(80).default("external"),
  categoryLabel: z.string().trim().min(1).max(80).optional(),
  at: z.string().datetime({ offset: true }),
  description: z.string().trim().min(1).max(1_000),
  source: z.string().trim().max(200).default("演示数据"),
  linkedNodeIds: z.array(idSchema).max(100).default([]),
});

export const projectDemoDataDocumentSchema = z.object({
  schemaVersion: z
    .literal("project-demo-data-v1")
    .default("project-demo-data-v1"),
  nodes: z.record(z.string(), projectDemoDataNodeSchema).default({}),
  changeEvents: z.array(projectDemoDataChangeEventSchema).max(200).default([]),
});
export type ProjectDemoDataDocument = z.infer<
  typeof projectDemoDataDocumentSchema
>;

export const projectDemoDataConfigSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  uploadedAt: isoTimeSchema,
  uploadedBy: idSchema,
  data: projectDemoDataDocumentSchema,
});
export type ProjectDemoDataConfig = z.infer<
  typeof projectDemoDataConfigSchema
>;

/**
 * 项目扩展信息。
 *
 * 项目本体是 DSH 工作区（标题、目录、会话归属由工作区注册表拥有），
 * 这里只保存项目管理域补充的字段，主键即 workspaceId。
 */
export const projectRecordSchema = z.object({
  workspaceId: idSchema,
  code: z.string().trim().max(60).default(""),
  ownerId: idSchema.optional(),
  ownerName: z.string().trim().max(80).default(""),
  status: projectStatusSchema.default("进行中"),
  health: projectHealthSchema.default("健康"),
  progress: z.number().int().min(0).max(100).default(0),
  /** ISO 日期（YYYY-MM-DD）；空串表示未设置。 */
  startDate: z.string().trim().max(20).default(""),
  targetDate: z.string().trim().max(20).default(""),
  description: z.string().trim().max(2000).default(""),
  /** 已应用的项目模版；仅作初始化来源，项目角色清单以 projectRoles 为准。 */
  templateId: idSchema.optional(),
  /** 项目自己的角色定义副本；由模版初始化，之后可独立增删改。 */
  projectRoles: z.array(projectRoleDefinitionSchema).max(50).default([]),
  /** 创建默认工作流实例时预填的角色映射；仍由创建者最终确认。 */
  roleMappingPresets: z.record(z.string(), roleMappingPresetSchema).default({}),
  /** 是否已完成角色初始化（区分「还没初始化」与「用户主动清空」）。 */
  rolesInitialized: z.boolean().default(false),
  /** 角色集版本：每次「确认生效」+1，用于并发编辑保护。 */
  rolesRevision: z.number().int().positive().default(1),
  rolesUpdatedAt: isoTimeSchema.optional(),
  rolesUpdatedBy: idSchema.optional(),
  /** 项目级业务链路快照；缺省表示兼容旧项目，不自动绑定任何工作流。 */
  businessChainBinding: projectBusinessChainBindingSchema.optional(),
  /** 项目业务链路配置 revision，用于应用绑定时防止并发覆盖。 */
  businessChainRevision: z.number().int().positive().default(1),
  businessChainValidatedAt: isoTimeSchema.optional(),
  /** 项目概览演示数据；上传后优先覆盖节点字段，便于现场调演示。 */
  demoDataConfig: projectDemoDataConfigSchema.optional(),
  reportSchedule: projectReportScheduleSchema.default({
    enabled: true,
    frequency: "daily",
    time: "08:00",
    timezone: "Asia/Shanghai",
    weekday: 1,
    dayOfMonth: 1,
  }),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type ProjectRecord = z.infer<typeof projectRecordSchema>;

/** 项目角色库（模版素材）：新建项目模版时可引用的角色目录。 */
export const projectRoleRecordSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  category: roleCategorySchema,
  description: z.string().trim().max(500).default(""),
  permissions: z.array(rolePermissionSchema).min(1).max(5),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type ProjectRoleRecord = z.infer<typeof projectRoleRecordSchema>;

/**
 * 项目模版：按项目类型预置「项目角色清单」与「工作流模版清单」。
 * 工作流模版本体由 dsh-collab-workflow 维护，这里只保存引用 id。
 */
export const projectTemplateRecordSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40),
  status: z.enum(["启用", "停用"]),
  description: z.string().trim().max(500).default(""),
  roleIds: z.array(idSchema).max(50).default([]),
  workflowTemplateIds: z.array(idSchema).max(50).default([]),
  businessChainMode: businessChainModeSchema.default("none"),
  allowedBusinessChainTemplateIds: z.array(idSchema).max(50).default([]),
  defaultBusinessChainTemplateId: idSchema.optional(),
  versionPolicy: businessChainVersionPolicySchema.default(
    "pin-at-project-create",
  ),
  revision: z.number().int().positive().default(1),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});
export type ProjectTemplateRecord = z.infer<typeof projectTemplateRecordSchema>;

export const projectAlertLifecycleSchema = z.enum([
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "suppressed",
  "stale",
]);
export type ProjectAlertLifecycle = z.infer<
  typeof projectAlertLifecycleSchema
>;

/**
 * 项目域 Alert 投影。conditionKey 是跨来源修订稳定的业务身份，
 * alertId 在同一个项目内保持稳定，不随标题或事件 ID 变化。
 */
export const projectAlertRecordSchema = z.object({
  alertId: idSchema,
  workspaceId: idSchema,
  conditionKey: z.string().trim().min(1).max(500),
  sourceSystem: z.string().trim().min(1).max(80),
  sourceObjectId: z.string().trim().max(200).default(""),
  sourceRevision: z.string().trim().max(120).default(""),
  nodeId: idSchema.optional(),
  alertType: z.string().trim().min(1).max(80),
  severity: z.enum(["P0", "P1", "P2"]),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1_000).default(""),
  lifecycle: projectAlertLifecycleSchema,
  assigneePrincipalId: idSchema.optional(),
  linkedTaskIds: z.array(idSchema).max(200).default([]),
  firstSeenAt: isoTimeSchema,
  lastSeenAt: isoTimeSchema,
  resolvedAt: isoTimeSchema.optional(),
  suppressedUntil: isoTimeSchema.optional(),
  followTargetId: z.string().trim().min(1).max(300),
});
export type ProjectAlertRecord = z.infer<typeof projectAlertRecordSchema>;

/** 项目日报：按日期保留快照，同一天重复生成即覆盖。 */
export const projectReportTypeSchema = z.enum(["daily", "weekly", "progress"]);
export type ProjectReportType = z.infer<typeof projectReportTypeSchema>;

export const projectReportRecordSchema = z.object({
  workspaceId: idSchema,
  reportType: projectReportTypeSchema.default("daily"),
  date: z.string().trim().min(8).max(20),
  periodStart: z.string().trim().max(20).optional(),
  periodEnd: z.string().trim().max(20).optional(),
  generatedAt: z.string().trim().min(1).max(40),
  generatedBy: z.string().trim().min(1).max(80),
  generatedByTeammateId: idSchema.optional(),
  runId: z.string().trim().max(180).optional(),
  skillId: z.string().trim().max(160).optional(),
  skillVersion: z.string().trim().max(80).optional(),
  triggerSource: z
    .enum(["button", "chat", "task", "schedule", "system", "api"])
    .default("api"),
  generationMode: z
    .enum(["agent", "deterministic_fallback"])
    .default("deterministic_fallback"),
  generationError: z.string().trim().max(500).optional(),
  sourceRefs: z.array(z.string().trim().min(1).max(300)).max(500).default([]),
  content: z.string().max(20_000),
  createdAt: isoTimeSchema,
});
export type ProjectReportRecord = z.infer<typeof projectReportRecordSchema>;

export const projectAuditCategorySchema = z.enum([
  "project",
  "member",
  "role",
  "template",
  "report",
  "identity",
]);
export type ProjectAuditCategory = z.infer<typeof projectAuditCategorySchema>;

/**
 * 项目审计事件：只追加、不覆盖。
 *
 * summary 供时间线直接展示；detail 保留审计需要的结构化上下文，
 * 值统一为字符串，避免把密码、token 等敏感对象写入日志。
 */
export const projectAuditRecordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  at: isoTimeSchema,
  actorId: idSchema,
  actorPrincipalId: z.string().trim().min(1).max(180).optional(),
  actorName: z.string().trim().max(80).default(""),
  actorRole: z.string().trim().max(40).default(""),
  source: z.enum(["project", "identity"]).default("project"),
  category: projectAuditCategorySchema,
  action: z.string().trim().min(1).max(80),
  targetId: z.string().trim().max(160).optional(),
  targetName: z.string().trim().max(160).optional(),
  summary: z.string().trim().min(1).max(500),
  detail: z.record(z.string(), z.string().max(2000)).default({}),
  createdAt: isoTimeSchema,
});
export type ProjectAuditRecord = z.infer<typeof projectAuditRecordSchema>;

export const projectMemberKindSchema = z.enum(["human", "agent"]);
export type ProjectMemberKind = z.infer<typeof projectMemberKindSchema>;
