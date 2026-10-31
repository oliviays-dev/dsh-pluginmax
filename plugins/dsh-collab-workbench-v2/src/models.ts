import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(200);
export const isoTimeSchema = z.string().datetime({ precision: 3 });
export const spanSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const panelInstanceSchema = z.object({
  id: idSchema,
  pluginId: idSchema,
  pluginVersion: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).optional(),
  span: spanSchema,
  order: z.number().int().min(0).max(200),
  height: z.number().int().min(120).max(1200).nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  visibilityCondition: z
    .object({
      workspaceIds: z.array(idSchema).max(100).optional(),
      projectIds: z.array(idSchema).max(100).optional(),
      roles: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    })
    .optional(),
});

export const workbenchRecordSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(400).default(""),
  icon: z.string().trim().min(1).max(80).default("layout"),
  color: z.string().trim().max(40).default("#3f6ef3"),
  visibility: z.enum(["private", "team"]),
  sharedWorkspaceIds: z.array(idSchema).max(20).default([]),
  layout: z.object({
    columns: z.literal(6),
    density: z.enum(["comfortable", "compact"]),
  }),
  panels: z.array(panelInstanceSchema).max(100),
  sourceTemplate: z
    .object({
      id: idSchema,
      version: z.string().trim().min(1).max(80),
    })
    .optional(),
  revision: z.number().int().min(1),
  publishedRevision: z.number().int().min(0),
  updatedBy: idSchema.optional(),
  updatedByName: z.string().trim().max(120).default(""),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const preferenceSchema = z.object({
  userId: idSchema,
  activeWorkbenchId: idSchema.optional(),
  defaultWorkbenchId: idSchema.optional(),
  favoriteIds: z.array(idSchema).max(5).default([]),
  order: z.array(idSchema).max(100).default([]),
  updatedAt: isoTimeSchema,
});

export const panelEntitlementSchema = z.object({
  userId: idSchema,
  pluginId: idSchema,
  enabled: z.boolean(),
  updatedAt: isoTimeSchema,
});

export const idempotencySchema = z.object({
  key: z.string().min(1).max(500),
  userId: idSchema,
  operation: z.string().trim().min(1).max(80),
  result: z.unknown(),
  createdAt: isoTimeSchema,
});

export const workbenchAuditSchema = z.object({
  id: idSchema,
  actorId: idSchema,
  action: z.string().trim().min(1).max(80),
  workbenchId: idSchema.optional(),
  result: z.enum(["ok", "failed"]),
  detail: z.record(z.string(), z.string()).default({}),
  createdAt: isoTimeSchema,
});

export const workbenchV2DomainSpec = {
  name: "collab_workbench_v2",
  version: 1,
  tables: {
    workbenches: { valueSchema: workbenchRecordSchema },
    preferences: { valueSchema: preferenceSchema },
    panel_entitlements: { valueSchema: panelEntitlementSchema },
    idempotency: { valueSchema: idempotencySchema },
    audit: { valueSchema: workbenchAuditSchema },
  },
} as const;

export type PanelInstance = z.infer<typeof panelInstanceSchema>;
export type WorkbenchRecord = z.infer<typeof workbenchRecordSchema>;
export type WorkbenchPreference = z.infer<typeof preferenceSchema>;
export type PanelEntitlement = z.infer<typeof panelEntitlementSchema>;
export type WorkbenchAudit = z.infer<typeof workbenchAuditSchema>;

export const entitlementKey = (userId: string, pluginId: string): string =>
  `${userId}\u0000${pluginId}`;
