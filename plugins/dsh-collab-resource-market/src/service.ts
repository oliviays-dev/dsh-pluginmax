import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  MCPS,
  PANEL_MANIFESTS,
  SKILLS,
  TEMPLATES,
  type McpAsset,
  type PanelManifest,
  type SkillAsset,
  type SkillMountTarget,
  type WorkbenchTemplateAsset,
} from "./catalog.js";
import type { McpProviderRegistry } from "./mcp-registry.js";

export const idSchema = z.string().trim().min(1).max(200);
export const isoTimeSchema = z.string().datetime({ precision: 3 });

export const skillBindingSchema = z.object({
  targetId: idSchema,
  active: z.boolean().default(false),
  boundAt: isoTimeSchema,
});

export type SkillBinding = z.infer<typeof skillBindingSchema>;

export const installRecordSchema = z.object({
  userId: idSchema,
  assetType: z.enum(["skill", "mcp"]),
  assetId: idSchema,
  status: z.enum(["enabled", "pending", "connected"]),
  /** Component-slot relations for component-scoped skills. */
  bindings: z.array(skillBindingSchema).optional(),
  updatedAt: isoTimeSchema,
});

export type InstallRecord = z.infer<typeof installRecordSchema>;

export const customResourceTypeSchema = z.enum([
  "skill",
  "mcp",
  "workbench-template",
  "panel-plugin",
]);

export const resourceOriginSchema = z.enum(["platform", "user"]);
export const sharingScopeSchema = z.enum(["private", "platform"]);
export const publicationStatusSchema = z.enum([
  "draft",
  "published",
  "delisted",
  "archived",
]);
export const availabilityStatusSchema = z.enum(["active", "suspended"]);

export const resourceLifecycleSchema = z.object({
  resourceType: customResourceTypeSchema,
  resourceId: idSchema,
  origin: resourceOriginSchema,
  ownerPrincipalId: idSchema,
  sharingScope: sharingScopeSchema,
  publicationStatus: publicationStatusSchema,
  availabilityStatus: availabilityStatusSchema,
  adminLocked: z.boolean().default(false),
  revision: z.number().int().positive().default(1),
  reasonCode: z.string().trim().max(80).optional(),
  note: z.string().trim().max(1000).optional(),
  updatedBy: idSchema,
  updatedAt: isoTimeSchema,
  createdAt: isoTimeSchema,
});

export const resourceLifecycleAuditSchema = z.object({
  id: idSchema,
  action: z.enum([
    "resource.delist",
    "resource.relist",
    "resource.suspend",
    "resource.resume",
  ]),
  actorPrincipalId: idSchema,
  actorRole: z.string().trim().min(1).max(40),
  resourceType: customResourceTypeSchema,
  resourceId: idSchema,
  resourceName: z.string().trim().min(1).max(120),
  resourceVersion: z.string().trim().min(1).max(80),
  origin: resourceOriginSchema,
  sharingScope: sharingScopeSchema,
  fromPublicationStatus: publicationStatusSchema,
  toPublicationStatus: publicationStatusSchema,
  fromAvailabilityStatus: availabilityStatusSchema,
  toAvailabilityStatus: availabilityStatusSchema,
  reasonCode: z.string().trim().max(80).optional(),
  note: z.string().trim().max(1000).optional(),
  occurredAt: isoTimeSchema,
});

export const customResourceSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  type: customResourceTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  category: z.string().trim().min(1).max(40).default("自定义"),
  version: z.string().trim().min(1).max(80),
  publisherName: z.string().trim().min(1).max(120),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20),
  sharingScope: sharingScopeSchema.default("private"),
  manifest: z.record(z.string(), z.unknown()).optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export type CustomResourceRecord = z.infer<typeof customResourceSchema>;
export type ResourceLifecycleRecord = z.infer<typeof resourceLifecycleSchema>;
export type ResourceLifecycleAudit = z.infer<
  typeof resourceLifecycleAuditSchema
>;
export type ResourceOrigin = z.infer<typeof resourceOriginSchema>;
export type SharingScope = z.infer<typeof sharingScopeSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;
export type CustomResourceInput = {
  type: CustomAssetType;
  name: string;
  description?: string | undefined;
  version?: string | undefined;
  publisherName?: string | undefined;
  permissions?: string[] | undefined;
  sharingScope?: SharingScope | undefined;
  manifest?: Record<string, unknown> | undefined;
};
export type CustomResourceUpdateInput = Omit<CustomResourceInput, "type">;

export interface ResourceActions {
  readonly canView: boolean;
  readonly canInstall: boolean;
  readonly canEdit: boolean;
  readonly canDelist: boolean;
  readonly canRelist: boolean;
  readonly canSuspend: boolean;
  readonly canDelete: boolean;
}

export interface ResourceLifecycleView {
  readonly origin: ResourceOrigin;
  readonly ownerPrincipalId: string;
  readonly sharingScope: SharingScope;
  readonly publicationStatus: PublicationStatus;
  readonly availabilityStatus: AvailabilityStatus;
  readonly adminLocked: boolean;
  readonly revision: number;
  readonly actions: ResourceActions;
}

export interface OfficialSkillInput {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category?: string | undefined;
  readonly version?: string | undefined;
  readonly permissions?: string[] | undefined;
  readonly instructions: string;
  readonly triggers?: string[] | undefined;
  readonly mountTargets?: readonly SkillMountTarget[] | undefined;
}

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface WorkbenchV2Port {
  entitlements(userId: string): string[];
  enablePlugin(
    principal: { userId: string },
    pluginId: string,
  ): Promise<unknown>;
}

export interface MarketPrincipal {
  userId: string;
  role?: "admin" | "owner" | "member" | "guest";
}

export type McpConnectionStatus = "connected" | "pending" | "off";
export type CustomAssetType = z.infer<typeof customResourceTypeSchema>;

export interface SkillCatalogProvider {
  readonly id: string;
  list(principal: MarketPrincipal): Promise<readonly SkillAsset[]>;
  install?(
    principal: MarketPrincipal,
    skillId: string,
  ): Promise<InstallRecord | void>;
}

export interface SkillInstallOptions {
  readonly targetIds?: readonly string[] | undefined;
  readonly activeTargetId?: string | undefined;
}

export interface McpProviderAsset extends McpAsset {
  status: McpConnectionStatus;
}

export interface McpCatalogProvider {
  readonly id: string;
  list(principal: MarketPrincipal): Promise<readonly McpProviderAsset[]>;
  connect?(
    principal: MarketPrincipal,
    mcpId: string,
  ): Promise<{ status: "pending" | "connected" }>;
  disconnect?(principal: MarketPrincipal, mcpId: string): Promise<void>;
}

export type PublisherFilter = "official" | "certified" | "community";
export type CompatibilityStatus = "compatible" | "incompatible";
export type CompatibilityFilter = CompatibilityStatus;
export type MarketSort = "recommended" | "updated" | "name";
export type MarketSource = "seed" | "provider" | "user";

export interface MarketListInput {
  query?: string;
  category?: string;
  publisher?: PublisherFilter;
  compatibility?: CompatibilityFilter;
  sort?: MarketSort;
  page?: number;
  pageSize?: number;
  includeDelisted?: boolean;
  publicationStatus?: "published" | "delisted";
}

export interface MarketPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type TemplateDependencyStatus =
  | "enabled"
  | "not_enabled"
  | "not_packaged"
  | "disabled"
  | "incompatible"
  | "missing";

export interface TemplatePanelView {
  pluginId: string;
  title: string;
  pluginVersion: string;
  span: number;
  order: number;
  runtimeStatus: PanelManifest["runtimeStatus"];
  compatibility: CompatibilityStatus;
  publisherName: string;
  dataScopes: string[];
}

export interface TemplateDependencyView {
  id: string;
  versionRange: string;
  status: TemplateDependencyStatus;
  compatibleHost?: string;
}

export interface WorkbenchTemplateView
  extends WorkbenchTemplateAsset, ResourceLifecycleView {
  source: "seed";
  compatibility: CompatibilityStatus;
  dependencies: TemplateDependencyView[];
  panels: TemplatePanelView[];
}

export type PanelPluginStatus =
  "enabled" | "not_enabled" | "not_packaged" | "disabled" | "incompatible";

export interface PanelPluginView extends PanelManifest, ResourceLifecycleView {
  source: "seed";
  compatibility: CompatibilityStatus;
  status: PanelPluginStatus;
}

export interface SkillView extends SkillAsset, ResourceLifecycleView {
  source: MarketSource;
  status: "enabled" | "available";
  bindings: SkillBinding[];
}

export interface McpView extends McpAsset, ResourceLifecycleView {
  source: MarketSource;
  status: McpConnectionStatus;
  connectionMode: "provider" | "request_only";
}

export interface CustomResourceView
  extends Omit<CustomResourceRecord, "sharingScope">, ResourceLifecycleView {
  source: "user";
  status?: "enabled" | "available";
}

export const resourceMarketDomainSpec = {
  name: "collab_resource_market",
  version: 1,
  tables: {
    installs: { valueSchema: installRecordSchema },
    custom_assets: { valueSchema: customResourceSchema },
    resource_lifecycle: { valueSchema: resourceLifecycleSchema },
    resource_lifecycle_audit: {
      valueSchema: resourceLifecycleAuditSchema,
    },
  },
} as const;

export class ResourceMarketError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "ResourceMarketError";
  }
}

const installKey = (
  userId: string,
  assetType: InstallRecord["assetType"],
  assetId: string,
): string => `${userId}\u0000${assetType}\u0000${assetId}`;

const lifecycleKey = (
  resourceType: CustomAssetType,
  resourceId: string,
): string => `${resourceType}\u0000${resourceId}`;

const normalizePrincipal = (
  principal: string | MarketPrincipal,
): MarketPrincipal =>
  typeof principal === "string" ? { userId: principal } : principal;

interface ResourceDescriptor {
  readonly resourceType: CustomAssetType;
  readonly resourceId: string;
  readonly name: string;
  readonly version: string;
  readonly origin: ResourceOrigin;
  readonly ownerPrincipalId: string;
  readonly sharingScope: SharingScope;
}

export interface LifecycleMutationInput {
  readonly resourceType: CustomAssetType;
  readonly resourceId: string;
  readonly reasonCode?: string | undefined;
  readonly note?: string | undefined;
  readonly expectedRevision: number;
}

export interface LifecycleMutationResult {
  readonly resource: {
    readonly resourceType: CustomAssetType;
    readonly resourceId: string;
    readonly name: string;
    readonly version: string;
    readonly origin: ResourceOrigin;
    readonly ownerPrincipalId: string;
    readonly sharingScope: SharingScope;
    readonly publicationStatus: PublicationStatus;
    readonly availabilityStatus: AvailabilityStatus;
    readonly adminLocked: boolean;
    readonly revision: number;
    readonly actions: ResourceActions;
  };
  readonly auditId: string;
}

const normalizedPageSize = (value: number | undefined): number =>
  Math.max(1, Math.min(50, Math.round(value ?? 24)));

const normalizedPageNumber = (value: number | undefined): number =>
  Math.max(1, Math.round(value ?? 1));

function manifestMountTargets(value: unknown): SkillMountTarget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item === null || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const targetId =
      typeof record.targetId === "string" ? record.targetId.trim() : "";
    const componentId =
      typeof record.componentId === "string" ? record.componentId.trim() : "";
    const componentLabel =
      typeof record.componentLabel === "string"
        ? record.componentLabel.trim()
        : "";
    const slotId =
      typeof record.slotId === "string" ? record.slotId.trim() : "";
    const slotLabel =
      typeof record.slotLabel === "string" ? record.slotLabel.trim() : "";
    if (
      record.type !== "component-slot" ||
      targetId === "" ||
      componentId === "" ||
      componentLabel === "" ||
      slotId === "" ||
      slotLabel === ""
    ) {
      return [];
    }
    return [
      {
        type: "component-slot" as const,
        targetId,
        componentId,
        componentLabel,
        slotId,
        slotLabel,
      },
    ];
  });
}

function pageOf<T>(items: readonly T[], input: MarketListInput): MarketPage<T> {
  const page = normalizedPageNumber(input.page);
  const pageSize = normalizedPageSize(input.pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  return {
    items: items.slice(
      (normalizedPage - 1) * pageSize,
      normalizedPage * pageSize,
    ),
    total,
    page: normalizedPage,
    pageSize,
    pageCount,
  };
}

export class ResourceMarketService {
  constructor(
    private readonly tables: {
      installs: KvTableLike<InstallRecord>;
      customAssets: KvTableLike<CustomResourceRecord>;
      lifecycle: KvTableLike<ResourceLifecycleRecord>;
      lifecycleAudit: KvTableLike<ResourceLifecycleAudit>;
    },
    private readonly options: {
      workbench: () => WorkbenchV2Port | undefined;
      skillProvider?: () => SkillCatalogProvider | undefined;
      mcpProvider?: () => McpCatalogProvider | undefined;
      mcpRegistry?: () => McpProviderRegistry | undefined;
      now?: () => Date;
    },
  ) {}

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private marketProviderError(cause: unknown): never {
    const code =
      cause !== null && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code ?? "")
        : "";
    if (code === "not_found") {
      throw new ResourceMarketError("not_found", "MCP 不存在");
    }
    throw new ResourceMarketError(
      "unavailable",
      cause instanceof Error ? cause.message : "MCP provider is unavailable",
    );
  }

  private requireWorkbench(): WorkbenchV2Port {
    const workbench = this.options.workbench();
    if (workbench === undefined) {
      throw new ResourceMarketError("unavailable", "工作台服务不可用");
    }
    return workbench;
  }

  private install(
    userId: string,
    assetType: InstallRecord["assetType"],
    assetId: string,
  ): InstallRecord | undefined {
    return this.tables.installs.get(installKey(userId, assetType, assetId));
  }

  private skillBindings(userId: string, skillId: string): SkillBinding[] {
    return [...(this.install(userId, "skill", skillId)?.bindings ?? [])];
  }

  private customDescriptor(record: CustomResourceRecord): ResourceDescriptor {
    const origin: ResourceOrigin =
      record.ownerId === "platform" ? "platform" : "user";
    return {
      resourceType: record.type,
      resourceId: record.id,
      name: record.name,
      version: record.version,
      origin,
      ownerPrincipalId: origin === "platform" ? "platform" : record.ownerId,
      sharingScope:
        origin === "platform" ? "platform" : (record.sharingScope ?? "private"),
    };
  }

  private platformDescriptor(
    resourceType: CustomAssetType,
    resourceId: string,
    name: string,
    version: string,
  ): ResourceDescriptor {
    return {
      resourceType,
      resourceId,
      name,
      version,
      origin: "platform",
      ownerPrincipalId: "platform",
      sharingScope: "platform",
    };
  }

  private descriptorFor(
    resourceType: CustomAssetType,
    resourceId: string,
    name: string,
    version: string,
  ): ResourceDescriptor {
    const custom =
      resourceType === "skill" || resourceType === "mcp"
        ? this.tables.customAssets.get(resourceId)
        : undefined;
    if (custom !== undefined && custom.type === resourceType) {
      return this.customDescriptor(custom);
    }
    return this.platformDescriptor(resourceType, resourceId, name, version);
  }

  private lifecycleRecordFor(
    descriptor: ResourceDescriptor,
  ): ResourceLifecycleRecord {
    const stored = this.tables.lifecycle.get(
      lifecycleKey(descriptor.resourceType, descriptor.resourceId),
    );
    if (stored !== undefined) return stored;
    const now = this.now();
    return {
      resourceType: descriptor.resourceType,
      resourceId: descriptor.resourceId,
      origin: descriptor.origin,
      ownerPrincipalId: descriptor.ownerPrincipalId,
      sharingScope: descriptor.sharingScope,
      publicationStatus: "published",
      availabilityStatus: "active",
      adminLocked: false,
      revision: 1,
      updatedBy: descriptor.ownerPrincipalId,
      updatedAt: now,
      createdAt: now,
    };
  }

  private actionsFor(
    principal: MarketPrincipal,
    descriptor: ResourceDescriptor,
    lifecycle: ResourceLifecycleRecord,
  ): ResourceActions {
    const admin = principal.role === "admin";
    const owner = descriptor.ownerPrincipalId === principal.userId;
    const shared = descriptor.sharingScope === "platform";
    const baseVisible = owner || descriptor.origin === "platform" || shared;
    const canView =
      baseVisible &&
      (lifecycle.publicationStatus === "published" || owner || admin);
    const published =
      lifecycle.publicationStatus === "published" &&
      lifecycle.availabilityStatus === "active";
    return {
      canView,
      canInstall: canView && published,
      canEdit:
        canView && descriptor.origin === "user" && (owner || (admin && shared)),
      canDelist:
        canView &&
        lifecycle.publicationStatus === "published" &&
        (admin || (descriptor.origin === "user" && shared && owner)),
      canRelist:
        canView &&
        lifecycle.publicationStatus === "delisted" &&
        (admin ||
          (descriptor.origin === "user" &&
            shared &&
            owner &&
            !lifecycle.adminLocked)),
      canSuspend: false,
      canDelete:
        canView &&
        owner &&
        descriptor.origin === "user" &&
        descriptor.sharingScope === "private",
    };
  }

  private lifecycleView(
    principal: MarketPrincipal,
    descriptor: ResourceDescriptor,
  ): ResourceLifecycleView {
    const lifecycle = this.lifecycleRecordFor(descriptor);
    return {
      origin: descriptor.origin,
      ownerPrincipalId: descriptor.ownerPrincipalId,
      sharingScope: descriptor.sharingScope,
      publicationStatus: lifecycle.publicationStatus,
      availabilityStatus: lifecycle.availabilityStatus,
      adminLocked: lifecycle.adminLocked,
      revision: lifecycle.revision,
      actions: this.actionsFor(principal, descriptor, lifecycle),
    };
  }

  private matchesPublication(
    principal: MarketPrincipal,
    descriptor: ResourceDescriptor,
    input: Pick<MarketListInput, "includeDelisted" | "publicationStatus">,
  ): boolean {
    const lifecycle = this.lifecycleRecordFor(descriptor);
    const actions = this.actionsFor(principal, descriptor, lifecycle);
    if (!actions.canView) return false;
    if (input.publicationStatus !== undefined) {
      return lifecycle.publicationStatus === input.publicationStatus;
    }
    if (input.includeDelisted === true) {
      return lifecycle.publicationStatus !== "archived";
    }
    return lifecycle.publicationStatus === "published";
  }

  private ensureMutableLifecycle(
    principal: MarketPrincipal,
    descriptor: ResourceDescriptor,
    action: "delist" | "relist",
  ): ResourceLifecycleRecord {
    const lifecycle = this.lifecycleRecordFor(descriptor);
    const actions = this.actionsFor(principal, descriptor, lifecycle);
    if (!actions.canView) {
      throw new ResourceMarketError("not_found", "资源不存在");
    }
    if (descriptor.sharingScope === "private") {
      throw new ResourceMarketError(
        "conflict",
        "私有资源不支持下架，请直接删除私有资源",
      );
    }
    const allowed = action === "delist" ? actions.canDelist : actions.canRelist;
    if (!allowed) {
      throw new ResourceMarketError(
        "forbidden",
        action === "delist" ? "无权下架该资源" : "无权重新上架该资源",
      );
    }
    return lifecycle;
  }

  private async resolveResourceDescriptor(
    principal: MarketPrincipal,
    resourceType: CustomAssetType,
    resourceId: string,
  ): Promise<ResourceDescriptor | undefined> {
    const custom = this.tables.customAssets.get(resourceId);
    if (custom !== undefined && custom.type === resourceType) {
      return this.customDescriptor(custom);
    }
    if (resourceType === "skill") {
      const provider = this.options.skillProvider?.();
      const catalog =
        provider === undefined ? SKILLS : await provider.list(principal);
      const skill = catalog.find((item) => item.id === resourceId);
      return skill === undefined
        ? undefined
        : this.platformDescriptor("skill", skill.id, skill.name, skill.version);
    }
    if (resourceType === "mcp") {
      const registry = this.options.mcpRegistry?.();
      const provider =
        registry === undefined || registry.size === 0
          ? this.options.mcpProvider?.()
          : undefined;
      let catalog: readonly McpAsset[];
      try {
        catalog =
          registry !== undefined && registry.size > 0
            ? await registry.list(principal)
            : provider === undefined
              ? MCPS
              : await provider.list(principal);
      } catch (cause) {
        this.marketProviderError(cause);
      }
      const mcp = catalog.find((item) => item.id === resourceId);
      return mcp === undefined
        ? undefined
        : this.platformDescriptor("mcp", mcp.id, mcp.name, mcp.version);
    }
    if (resourceType === "workbench-template") {
      const template = this.template(resourceId);
      return template === undefined
        ? undefined
        : this.platformDescriptor(
            "workbench-template",
            template.id,
            template.name,
            template.version,
          );
    }
    const plugin = this.panelManifest(resourceId);
    return plugin === undefined
      ? undefined
      : this.platformDescriptor(
          "panel-plugin",
          plugin.id,
          plugin.name,
          plugin.version,
        );
  }

  private async mutateLifecycle(
    principalInput: string | MarketPrincipal,
    input: LifecycleMutationInput,
    action: "delist" | "relist",
  ): Promise<LifecycleMutationResult> {
    const principal = normalizePrincipal(principalInput);
    const descriptor = await this.resolveResourceDescriptor(
      principal,
      input.resourceType,
      input.resourceId,
    );
    if (descriptor === undefined) {
      throw new ResourceMarketError("not_found", "资源不存在");
    }
    const current = this.ensureMutableLifecycle(principal, descriptor, action);
    if (current.revision !== input.expectedRevision) {
      throw new ResourceMarketError("conflict", "资源状态已变化，请刷新后重试");
    }
    const now = this.now();
    const publicationStatus: PublicationStatus =
      action === "delist" ? "delisted" : "published";
    const adminForcedUserDelist =
      action === "delist" &&
      principal.role === "admin" &&
      descriptor.origin === "user" &&
      descriptor.ownerPrincipalId !== principal.userId;
    const next = resourceLifecycleSchema.parse({
      ...current,
      resourceType: descriptor.resourceType,
      resourceId: descriptor.resourceId,
      origin: descriptor.origin,
      ownerPrincipalId: descriptor.ownerPrincipalId,
      sharingScope: descriptor.sharingScope,
      publicationStatus,
      availabilityStatus: current.availabilityStatus,
      adminLocked: adminForcedUserDelist
        ? true
        : action === "relist" && principal.role === "admin"
          ? false
          : current.adminLocked,
      revision: current.revision + 1,
      ...(input.reasonCode === undefined
        ? { reasonCode: undefined }
        : { reasonCode: input.reasonCode }),
      ...(input.note === undefined
        ? { note: undefined }
        : { note: input.note }),
      updatedBy: principal.userId,
      updatedAt: now,
      createdAt: current.createdAt,
    });
    await this.tables.lifecycle.put(
      lifecycleKey(descriptor.resourceType, descriptor.resourceId),
      next,
    );
    const audit = resourceLifecycleAuditSchema.parse({
      id: `resource-audit-${randomUUID()}`,
      action: action === "delist" ? "resource.delist" : "resource.relist",
      actorPrincipalId: principal.userId,
      actorRole: principal.role ?? "member",
      resourceType: descriptor.resourceType,
      resourceId: descriptor.resourceId,
      resourceName: descriptor.name,
      resourceVersion: descriptor.version,
      origin: descriptor.origin,
      sharingScope: descriptor.sharingScope,
      fromPublicationStatus: current.publicationStatus,
      toPublicationStatus: next.publicationStatus,
      fromAvailabilityStatus: current.availabilityStatus,
      toAvailabilityStatus: next.availabilityStatus,
      ...(input.reasonCode === undefined
        ? {}
        : { reasonCode: input.reasonCode }),
      ...(input.note === undefined ? {} : { note: input.note }),
      occurredAt: now,
    });
    await this.tables.lifecycleAudit.put(audit.id, audit);
    return {
      resource: {
        resourceType: descriptor.resourceType,
        resourceId: descriptor.resourceId,
        name: descriptor.name,
        version: descriptor.version,
        origin: descriptor.origin,
        ownerPrincipalId: descriptor.ownerPrincipalId,
        sharingScope: descriptor.sharingScope,
        publicationStatus: next.publicationStatus,
        availabilityStatus: next.availabilityStatus,
        adminLocked: next.adminLocked,
        revision: next.revision,
        actions: this.actionsFor(principal, descriptor, next),
      },
      auditId: audit.id,
    };
  }

  async delistResource(
    principal: string | MarketPrincipal,
    input: LifecycleMutationInput,
  ): Promise<LifecycleMutationResult> {
    return this.mutateLifecycle(principal, input, "delist");
  }

  async relistResource(
    principal: string | MarketPrincipal,
    input: LifecycleMutationInput,
  ): Promise<LifecycleMutationResult> {
    return this.mutateLifecycle(principal, input, "relist");
  }

  private customResourcesFor(
    principal: MarketPrincipal,
    input: {
      type?: CustomAssetType;
      query?: string;
      category?: string;
      includeDelisted?: boolean;
      publicationStatus?: "published" | "delisted";
    },
  ): CustomResourceView[] {
    return Array.from(this.tables.customAssets.entries())
      .map(([, record]) => record)
      .filter((record) => record.ownerId !== "platform")
      .filter(
        (record) => input.type === undefined || record.type === input.type,
      )
      .filter((record) => {
        const descriptor = this.customDescriptor(record);
        return this.matchesPublication(principal, descriptor, input);
      })
      .filter(
        (record) =>
          input.category === undefined ||
          input.category === "" ||
          input.category === "全部" ||
          input.category === record.category,
      )
      .filter((record) =>
        this.matches(
          `${record.name} ${record.description} ${record.publisherName} ${record.permissions.join(" ")}`,
          input.query ?? "",
          "",
        ),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => {
        const descriptor = this.customDescriptor(record);
        return {
          ...record,
          source: "user" as const,
          ...this.lifecycleView(principal, descriptor),
          ...(record.type === "skill"
            ? {
                status:
                  this.install(principal.userId, "skill", record.id)?.status ===
                  "enabled"
                    ? ("enabled" as const)
                    : ("available" as const),
                bindings: this.skillBindings(principal.userId, record.id),
              }
            : {}),
        };
      });
  }

  private customRecordsForAssetCatalog(
    principal: MarketPrincipal,
    type: CustomAssetType,
  ): CustomResourceRecord[] {
    return Array.from(this.tables.customAssets.entries())
      .map(([, record]) => record)
      .filter((record) => record.ownerId !== "platform" && record.type === type)
      .filter(
        (record) =>
          record.ownerId === principal.userId ||
          (record.sharingScope ?? "private") === "platform",
      );
  }

  private customSkillAssets(principal: MarketPrincipal): readonly SkillAsset[] {
    return this.customRecordsForAssetCatalog(principal, "skill").map(
      (record) => {
        const manifest = record.manifest ?? {};
        const instructions =
          typeof manifest.instructions === "string"
            ? manifest.instructions.trim()
            : "";
        const triggers = Array.isArray(manifest.triggers)
          ? manifest.triggers.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
        const mountTargets = manifestMountTargets(manifest.mountTargets);
        return {
          id: record.id,
          name: record.name,
          category: "自定义",
          description: record.description,
          publisher: {
            id: record.ownerId,
            name: record.publisherName,
            verified: false,
            kind: "community" as const,
          },
          version: record.version,
          icon: "sparkles",
          permissions: [...record.permissions],
          usage: "自定义 Skill",
          ...(instructions === "" ? {} : { instructions }),
          ...(triggers.length === 0 ? {} : { triggers }),
          ...(mountTargets.length === 0 ? {} : { mountTargets }),
        };
      },
    );
  }

  private platformSkillAssets(): readonly SkillAsset[] {
    return Array.from(this.tables.customAssets.entries())
      .map(([, record]) => record)
      .filter(
        (record) => record.ownerId === "platform" && record.type === "skill",
      )
      .map((record) => {
        const manifest = record.manifest ?? {};
        const instructions =
          typeof manifest.instructions === "string"
            ? manifest.instructions.trim()
            : "";
        const triggers = Array.isArray(manifest.triggers)
          ? manifest.triggers.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
        const mountTargets = manifestMountTargets(manifest.mountTargets);
        return {
          id: record.id,
          name: record.name,
          category: record.category,
          description: record.description,
          publisher: {
            id: "pluginmax",
            name: record.publisherName,
            verified: true,
            kind: "official" as const,
          },
          version: record.version,
          icon: "sparkles",
          permissions: [...record.permissions],
          usage: "平台官方",
          ...(instructions === "" ? {} : { instructions }),
          ...(triggers.length === 0 ? {} : { triggers }),
          ...(mountTargets.length === 0 ? {} : { mountTargets }),
        };
      });
  }

  private availableSkills(
    principal: MarketPrincipal,
    provider: SkillCatalogProvider | undefined,
    providerCatalog: readonly SkillAsset[],
  ): readonly SkillAsset[] {
    const officialOverrides = this.platformSkillAssets();
    const overrideIds = new Set(officialOverrides.map((skill) => skill.id));
    return [
      ...providerCatalog.filter((skill) => !overrideIds.has(skill.id)),
      ...officialOverrides,
      ...this.customSkillAssets(principal),
    ];
  }

  private matches(haystack: string, query: string, category: string): boolean {
    const normalized = query.trim().toLowerCase();
    return (
      (category === "" ||
        category === "全部" ||
        haystack.toLowerCase().includes(category.toLowerCase())) &&
      (normalized === "" || haystack.toLowerCase().includes(normalized))
    );
  }

  private matchesPublisher(
    publisherKind: "official" | "certified" | "community",
    filter: PublisherFilter | undefined,
  ): boolean {
    return filter === undefined || publisherKind === filter;
  }

  private isCompatibleHost(compatibleHost: string): boolean {
    return compatibleHost === "DSH 0.1.x";
  }

  private templateView(
    principal: MarketPrincipal,
    template: WorkbenchTemplateAsset,
    enabled: ReadonlySet<string>,
  ): WorkbenchTemplateView {
    const dependencies = template.requiredPlugins.map((required) => {
      const manifest = this.panelManifest(required.id);
      if (manifest === undefined) {
        return {
          id: required.id,
          versionRange: required.versionRange,
          status: "missing" as const,
        };
      }
      if (!this.isCompatibleHost(manifest.compatibleHost)) {
        return {
          id: required.id,
          versionRange: required.versionRange,
          compatibleHost: manifest.compatibleHost,
          status: "incompatible" as const,
        };
      }
      const runtime = manifest.runtimeStatus ?? "not_packaged";
      if (runtime !== "packaged") {
        return {
          id: required.id,
          versionRange: required.versionRange,
          compatibleHost: manifest.compatibleHost,
          status: runtime,
        };
      }
      return {
        id: required.id,
        versionRange: required.versionRange,
        compatibleHost: manifest.compatibleHost,
        status: enabled.has(required.id)
          ? ("enabled" as const)
          : ("not_enabled" as const),
      };
    });
    const blocking = dependencies.some((dependency) =>
      ["missing", "not_packaged", "disabled", "incompatible"].includes(
        dependency.status,
      ),
    );
    return {
      ...template,
      source: "seed",
      ...this.lifecycleView(
        principal,
        this.platformDescriptor(
          "workbench-template",
          template.id,
          template.name,
          template.version,
        ),
      ),
      compatibility: blocking ? "incompatible" : "compatible",
      dependencies,
      panels: template.panelPlan.map((panel) => {
        const manifest = this.panelManifest(panel.pluginId);
        return {
          pluginId: panel.pluginId,
          title: panel.title ?? manifest?.name ?? panel.pluginId,
          pluginVersion: panel.pluginVersion,
          span: panel.span,
          order: panel.order,
          runtimeStatus: manifest?.runtimeStatus ?? "not_packaged",
          compatibility:
            manifest !== undefined &&
            this.isCompatibleHost(manifest.compatibleHost) &&
            manifest.runtimeStatus === "packaged"
              ? "compatible"
              : "incompatible",
          publisherName: manifest?.publisher.name ?? template.publisher.name,
          dataScopes: manifest?.dataScopes ?? [],
        };
      }),
    };
  }

  private pluginView(
    principal: MarketPrincipal,
    manifest: PanelManifest,
    enabled: ReadonlySet<string>,
  ): PanelPluginView {
    const runtime = manifest.runtimeStatus ?? "not_packaged";
    const compatible = this.isCompatibleHost(manifest.compatibleHost);
    const status: PanelPluginStatus = !compatible
      ? "incompatible"
      : runtime !== "packaged"
        ? runtime
        : enabled.has(manifest.id)
          ? "enabled"
          : "not_enabled";
    return {
      ...manifest,
      source: "seed",
      ...this.lifecycleView(
        principal,
        this.platformDescriptor(
          "panel-plugin",
          manifest.id,
          manifest.name,
          manifest.version,
        ),
      ),
      compatibility: compatible ? "compatible" : "incompatible",
      status,
    };
  }

  private filterTemplates(
    principal: MarketPrincipal,
    input: MarketListInput,
  ): WorkbenchTemplateView[] {
    const enabled = new Set(
      this.requireWorkbench().entitlements(principal.userId),
    );
    const items = TEMPLATES.filter((template) =>
      this.matches(
        `${template.name} ${template.description} ${template.category} ${template.tags.join(" ")} ${template.publisher.name} ${template.panelPlan.map((panel) => panel.pluginId).join(" ")}`,
        input.query ?? "",
        input.category ?? "",
      ),
    )
      .filter((template) =>
        this.matchesPublisher(template.publisher.kind, input.publisher),
      )
      .filter((template) =>
        this.matchesPublication(
          principal,
          this.platformDescriptor(
            "workbench-template",
            template.id,
            template.name,
            template.version,
          ),
          input,
        ),
      )
      .map((template) => this.templateView(principal, template, enabled))
      .filter(
        (template) =>
          input.compatibility === undefined ||
          template.compatibility === input.compatibility,
      );
    const sort = input.sort ?? "recommended";
    items.sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
      if (sort === "updated") {
        return right.updatedAt.localeCompare(left.updatedAt);
      }
      return right.installs - left.installs || right.rating - left.rating;
    });
    return items;
  }

  private filterPlugins(
    principal: MarketPrincipal,
    input: MarketListInput,
  ): PanelPluginView[] {
    const enabled = new Set(
      this.requireWorkbench().entitlements(principal.userId),
    );
    const items = PANEL_MANIFESTS.filter((manifest) =>
      this.matches(
        `${manifest.name} ${manifest.description} ${manifest.category} ${manifest.publisher.name} ${manifest.dataScopes.join(" ")}`,
        input.query ?? "",
        input.category ?? "",
      ),
    )
      .filter((manifest) =>
        this.matchesPublisher(manifest.publisher.kind, input.publisher),
      )
      .filter((manifest) =>
        this.matchesPublication(
          principal,
          this.platformDescriptor(
            "panel-plugin",
            manifest.id,
            manifest.name,
            manifest.version,
          ),
          input,
        ),
      )
      .map((manifest) => this.pluginView(principal, manifest, enabled))
      .filter(
        (manifest) =>
          input.compatibility === undefined ||
          manifest.compatibility === input.compatibility,
      );
    const sort = input.sort ?? "recommended";
    items.sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name, "zh-CN");
      return (
        left.category.localeCompare(right.category, "zh-CN") ||
        left.name.localeCompare(right.name, "zh-CN")
      );
    });
    return items;
  }

  templateList(
    principal: string | MarketPrincipal,
    input: MarketListInput = {},
  ): MarketPage<WorkbenchTemplateView> {
    return pageOf(
      this.filterTemplates(normalizePrincipal(principal), input),
      input,
    );
  }

  templateDetail(
    principal: string | MarketPrincipal,
    id: string,
    version?: string,
    options: { readonly includeDelisted?: boolean } = {},
  ): WorkbenchTemplateView | undefined {
    const template = this.template(id, version);
    if (template === undefined) return undefined;
    const user = normalizePrincipal(principal);
    const descriptor = this.platformDescriptor(
      "workbench-template",
      template.id,
      template.name,
      template.version,
    );
    const lifecycle = this.lifecycleRecordFor(descriptor);
    if (
      options.includeDelisted !== true &&
      lifecycle.publicationStatus !== "published"
    ) {
      return undefined;
    }
    const enabled = new Set(this.requireWorkbench().entitlements(user.userId));
    return this.templateView(user, template, enabled);
  }

  templates(input: {
    query?: string;
    category?: string;
  }): WorkbenchTemplateAsset[] {
    return TEMPLATES.filter((template) =>
      this.matches(
        `${template.name} ${template.description} ${template.category} ${template.publisher.name}`,
        input.query ?? "",
        input.category ?? "",
      ),
    );
  }

  template(id: string, version?: string): WorkbenchTemplateAsset | undefined {
    return TEMPLATES.find(
      (template) =>
        template.id === id &&
        (version === undefined || template.version === version),
    );
  }

  runtimeStatus(id: string): "packaged" | "not_packaged" | "disabled" {
    return (
      PANEL_MANIFESTS.find((item) => item.id === id)?.runtimeStatus ??
      "not_packaged"
    );
  }

  panelManifest(id: string): PanelManifest | undefined {
    return PANEL_MANIFESTS.find((item) => item.id === id);
  }

  plugin(id: string):
    | (PanelManifest & {
        compatibility: CompatibilityStatus;
        enabledFor(userId: string): boolean;
      })
    | undefined {
    const manifest = this.panelManifest(id);
    if (manifest === undefined) return undefined;
    return {
      ...manifest,
      compatibility: this.isCompatibleHost(manifest.compatibleHost)
        ? "compatible"
        : "incompatible",
      enabledFor: (userId) =>
        this.requireWorkbench().entitlements(userId).includes(id),
    };
  }

  plugins(input: {
    userId: string;
    query?: string;
    category?: string;
    publisher?: PublisherFilter;
    compatibility?: CompatibilityFilter;
    sort?: MarketSort;
    includeDelisted?: boolean;
    publicationStatus?: "published" | "delisted";
  }): PanelPluginView[] {
    return this.filterPlugins(normalizePrincipal(input.userId), input);
  }

  pluginList(
    principal: string | MarketPrincipal,
    input: MarketListInput = {},
  ): MarketPage<PanelPluginView> {
    return pageOf(
      this.filterPlugins(normalizePrincipal(principal), input),
      input,
    );
  }

  async enablePlugin(
    userId: string,
    pluginId: string,
  ): Promise<{
    ok: true;
    pluginId: string;
    status: "enabled" | "not_packaged" | "disabled";
    entitlement?: unknown;
  }> {
    const manifest = this.panelManifest(pluginId);
    if (manifest === undefined) {
      throw new ResourceMarketError("not_found", "面板插件不存在");
    }
    const descriptor = this.platformDescriptor(
      "panel-plugin",
      manifest.id,
      manifest.name,
      manifest.version,
    );
    const actions = this.lifecycleView({ userId }, descriptor).actions;
    if (!actions.canInstall) {
      return { ok: true, pluginId, status: "disabled" };
    }
    const runtime = this.runtimeStatus(pluginId);
    if (runtime === "not_packaged") {
      return { ok: true, pluginId, status: "not_packaged" };
    }
    if (runtime === "disabled") {
      return { ok: true, pluginId, status: "disabled" };
    }
    if (!this.isCompatibleHost(manifest.compatibleHost)) {
      throw new ResourceMarketError("unavailable", "面板插件与当前宿主不兼容");
    }
    const entitlement = await this.requireWorkbench().enablePlugin(
      { userId },
      pluginId,
    );
    return {
      ok: true,
      pluginId,
      status: "enabled",
      entitlement,
    };
  }

  async skills(
    principalInput: string | MarketPrincipal,
    input: {
      query?: string;
      category?: string;
      includeDelisted?: boolean;
      publicationStatus?: "published" | "delisted";
    } = {},
  ): Promise<SkillView[]> {
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const providerCatalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    const catalog = this.availableSkills(principal, provider, providerCatalog);
    return catalog
      .filter((skill) =>
        this.matches(
          `${skill.name} ${skill.description} ${skill.category} ${skill.publisher.name}`,
          input.query ?? "",
          input.category ?? "",
        ),
      )
      .filter((skill) => {
        const descriptor = this.descriptorFor(
          "skill",
          skill.id,
          skill.name,
          skill.version,
        );
        return this.matchesPublication(principal, descriptor, input);
      })
      .map((skill) => {
        const stored = this.tables.customAssets.get(skill.id);
        const descriptor = this.descriptorFor(
          "skill",
          skill.id,
          skill.name,
          skill.version,
        );
        return {
          ...skill,
          ...this.lifecycleView(principal, descriptor),
          source:
            stored === undefined
              ? provider === undefined
                ? ("seed" as const)
                : ("provider" as const)
              : stored.ownerId === "platform"
                ? ("provider" as const)
                : ("user" as const),
          status:
            this.install(principal.userId, "skill", skill.id)?.status ===
            "enabled"
              ? ("enabled" as const)
              : ("available" as const),
          bindings: this.skillBindings(principal.userId, skill.id),
        };
      });
  }

  customResources(
    principalInput: string | MarketPrincipal,
    input: {
      type?: CustomAssetType;
      query?: string;
      category?: string;
      includeDelisted?: boolean;
      publicationStatus?: "published" | "delisted";
    } = {},
  ): CustomResourceView[] {
    return this.customResourcesFor(normalizePrincipal(principalInput), input);
  }

  async registerCustomResource(
    principalInput: string | MarketPrincipal,
    input: CustomResourceInput,
  ): Promise<CustomResourceView> {
    const principal = normalizePrincipal(principalInput);
    if (principal.role === "guest") {
      throw new ResourceMarketError("forbidden", "访客不能注册资源");
    }
    if (input.type === "skill") {
      const instructions = input.manifest?.instructions;
      if (typeof instructions !== "string" || instructions.trim() === "") {
        throw new ResourceMarketError(
          "invalid_input",
          "Skill 清单必须包含非空的 instructions",
        );
      }
    }
    const now = this.now();
    const record: CustomResourceRecord = {
      id: `custom-${randomUUID()}`,
      ownerId: principal.userId,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: "自定义",
      version: input.version?.trim() || "1.0.0",
      publisherName: input.publisherName?.trim() || principal.userId,
      permissions: [...new Set(input.permissions ?? [])],
      sharingScope: input.sharingScope ?? "private",
      ...(input.manifest === undefined ? {} : { manifest: input.manifest }),
      createdAt: now,
      updatedAt: now,
    };
    await this.tables.customAssets.put(record.id, record);
    return {
      ...record,
      source: "user",
      ...this.lifecycleView(principal, this.customDescriptor(record)),
    };
  }

  async updateCustomResource(
    principalInput: string | MarketPrincipal,
    resourceId: string,
    input: CustomResourceUpdateInput,
  ): Promise<CustomResourceView> {
    const principal = normalizePrincipal(principalInput);
    const existing = this.tables.customAssets.get(resourceId);
    if (existing === undefined || existing.ownerId === "platform") {
      throw new ResourceMarketError("not_found", "自定义资源不存在");
    }
    const descriptor = this.customDescriptor(existing);
    if (
      !this.actionsFor(
        principal,
        descriptor,
        this.lifecycleRecordFor(descriptor),
      ).canEdit
    ) {
      throw new ResourceMarketError("forbidden", "无权编辑该资源");
    }
    if (
      existing.sharingScope === "platform" &&
      input.sharingScope === "private"
    ) {
      throw new ResourceMarketError(
        "conflict",
        "共享资源不能直接改为私有，请先下架",
      );
    }
    if (existing.type === "skill") {
      const instructions =
        input.manifest?.instructions ??
        (typeof existing.manifest?.instructions === "string"
          ? existing.manifest.instructions
          : "");
      if (typeof instructions !== "string" || instructions.trim() === "") {
        throw new ResourceMarketError(
          "invalid_input",
          "Skill 清单必须包含非空的 instructions",
        );
      }
    }
    const now = this.now();
    const record = customResourceSchema.parse({
      ...existing,
      name: input.name?.trim() ?? existing.name,
      description: input.description?.trim() ?? existing.description,
      version: input.version?.trim() || existing.version,
      publisherName: input.publisherName?.trim() || existing.publisherName,
      permissions: input.permissions ?? existing.permissions,
      sharingScope: input.sharingScope ?? existing.sharingScope,
      ...(input.manifest === undefined ? {} : { manifest: input.manifest }),
      updatedAt: now,
    });
    await this.tables.customAssets.put(resourceId, record);
    const lifecycle = this.lifecycleRecordFor(this.customDescriptor(record));
    await this.tables.lifecycle.put(lifecycleKey(record.type, record.id), {
      ...lifecycle,
      sharingScope: record.sharingScope,
      revision: lifecycle.revision + 1,
      updatedBy: principal.userId,
      updatedAt: now,
    });
    return {
      ...record,
      source: "user",
      ...this.lifecycleView(principal, this.customDescriptor(record)),
    };
  }

  async saveOfficialSkill(
    principalInput: string | MarketPrincipal,
    input: OfficialSkillInput,
  ): Promise<CustomResourceView> {
    const principal = normalizePrincipal(principalInput);
    if (principal.role !== "admin") {
      throw new ResourceMarketError(
        "forbidden",
        "只有平台管理员可以编辑官方 Skill",
      );
    }
    const instructions = input.instructions.trim();
    if (instructions === "") {
      throw new ResourceMarketError(
        "invalid_input",
        "官方 Skill 必须包含非空 instructions",
      );
    }
    const existing = this.tables.customAssets.get(input.id);
    if (existing !== undefined && existing.ownerId !== "platform") {
      throw new ResourceMarketError("conflict", "Skill ID 已被其他资源占用");
    }
    const timestamp = this.now();
    const record = customResourceSchema.parse({
      id: input.id,
      ownerId: "platform",
      type: "skill",
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category?.trim() || "AI办公",
      version: input.version?.trim() || "1.0.0",
      publisherName: "Pluginmax 官方",
      permissions: [...new Set(input.permissions ?? [])],
      sharingScope: "platform",
      manifest: {
        instructions,
        triggers: [...new Set(input.triggers ?? [])],
        mountTargets: [...(input.mountTargets ?? [])],
      },
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    await this.tables.customAssets.put(record.id, record);
    return {
      ...record,
      source: "user",
      ...this.lifecycleView(principal, this.customDescriptor(record)),
    };
  }

  async removeCustomResource(
    principalInput: string | MarketPrincipal,
    resourceId: string,
  ): Promise<void> {
    const principal = normalizePrincipal(principalInput);
    const record = this.tables.customAssets.get(resourceId);
    if (record === undefined || record.ownerId !== principal.userId) {
      throw new ResourceMarketError("not_found", "自定义资源不存在");
    }
    if (
      record.ownerId === "platform" ||
      (record.sharingScope ?? "private") !== "private"
    ) {
      throw new ResourceMarketError(
        "conflict",
        "共享资源不能直接删除，请先下架",
      );
    }
    await this.tables.customAssets.delete(resourceId);
    await this.tables.lifecycle.delete(lifecycleKey(record.type, resourceId));
    if (record.type === "skill") {
      await this.tables.installs.delete(
        installKey(record.ownerId, "skill", resourceId),
      );
    }
  }

  async installSkill(
    principalInput: string | MarketPrincipal,
    skillId: string,
    options: SkillInstallOptions = {},
  ): Promise<InstallRecord> {
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const providerCatalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    const catalog = this.availableSkills(principal, provider, providerCatalog);
    const skill = catalog.find((item) => item.id === skillId);
    if (skill === undefined) {
      throw new ResourceMarketError("not_found", "Skill 不存在");
    }
    const descriptor = this.descriptorFor(
      "skill",
      skill.id,
      skill.name,
      skill.version,
    );
    if (!this.lifecycleView(principal, descriptor).actions.canInstall) {
      throw new ResourceMarketError("conflict", "资源已下架或停用，无法安装");
    }
    const targets = skill.mountTargets ?? [];
    const targetIds = [...new Set(options.targetIds ?? [])];
    if (
      targetIds.some(
        (targetId) => !targets.some((target) => target.targetId === targetId),
      )
    ) {
      throw new ResourceMarketError(
        "invalid_input",
        "Skill 不支持所选组件挂载点",
      );
    }
    if (
      options.activeTargetId !== undefined &&
      !targetIds.includes(options.activeTargetId)
    ) {
      throw new ResourceMarketError(
        "invalid_input",
        "当前方案必须位于已选择的安装位置",
      );
    }
    const providerRecord = await provider?.install?.(principal, skillId);
    const now = this.now();
    const activeTargetId =
      options.activeTargetId ?? (targetIds.length === 1 ? targetIds[0] : "");
    if (activeTargetId !== "") {
      for (const [key, existing] of this.tables.installs.entries()) {
        if (
          existing.userId !== principal.userId ||
          existing.assetType !== "skill" ||
          existing.assetId === skillId ||
          !(existing.bindings ?? []).some(
            (binding) => binding.targetId === activeTargetId && binding.active,
          )
        ) {
          continue;
        }
        await this.tables.installs.put(key, {
          ...existing,
          bindings: (existing.bindings ?? []).map((binding) =>
            binding.targetId === activeTargetId
              ? { ...binding, active: false }
              : binding,
          ),
          updatedAt: now,
        });
      }
    }
    const record: InstallRecord = providerRecord ?? {
      userId: principal.userId,
      assetType: "skill",
      assetId: skillId,
      status: "enabled",
      updatedAt: now,
    };
    const nextRecord: InstallRecord = {
      ...record,
      bindings: targetIds.map((targetId) => ({
        targetId,
        active: targetId === activeTargetId,
        boundAt: now,
      })),
      updatedAt: now,
    };
    await this.tables.installs.put(
      installKey(principal.userId, "skill", skillId),
      nextRecord,
    );
    return nextRecord;
  }

  async setSkillTargetActive(
    principalInput: string | MarketPrincipal,
    skillId: string,
    targetId: string,
  ): Promise<InstallRecord> {
    const principal = normalizePrincipal(principalInput);
    const installed = this.install(principal.userId, "skill", skillId);
    if (installed === undefined || installed.status !== "enabled") {
      throw new ResourceMarketError("not_found", "Skill 尚未安装");
    }
    const provider = this.options.skillProvider?.();
    const providerCatalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    const skill = this.availableSkills(
      principal,
      provider,
      providerCatalog,
    ).find((item) => item.id === skillId);
    if (skill === undefined) {
      throw new ResourceMarketError("not_found", "Skill 不存在");
    }
    if (
      !(skill.mountTargets ?? []).some((target) => target.targetId === targetId)
    ) {
      throw new ResourceMarketError(
        "invalid_input",
        "Skill 不支持该组件挂载点",
      );
    }
    if (
      !(installed.bindings ?? []).some(
        (binding) => binding.targetId === targetId,
      )
    ) {
      throw new ResourceMarketError("conflict", "Skill 尚未绑定到该组件");
    }
    const now = this.now();
    const records = [...this.tables.installs.entries()].filter(
      ([, record]) =>
        record.userId === principal.userId && record.assetType === "skill",
    );
    let selected: InstallRecord = installed;
    for (const [key, record] of records) {
      if (
        !(record.bindings ?? []).some(
          (binding) => binding.targetId === targetId,
        )
      ) {
        continue;
      }
      const next: InstallRecord = {
        ...record,
        bindings: (record.bindings ?? []).map((binding) =>
          binding.targetId === targetId
            ? {
                ...binding,
                active: record.assetId === skillId,
              }
            : binding,
        ),
        updatedAt: now,
      };
      await this.tables.installs.put(key, next);
      if (record.assetId === skillId) selected = next;
    }
    return selected;
  }

  async skillsForTarget(
    principalInput: string | MarketPrincipal,
    targetId: string,
  ): Promise<{
    targetId: string;
    activeSkillId?: string;
    skills: SkillView[];
  }> {
    const installed = await this.installedSkills(principalInput);
    const compatible = installed.filter((skill) =>
      (skill.mountTargets ?? []).some((target) => target.targetId === targetId),
    );
    const active = compatible.find((skill) =>
      (skill.bindings ?? []).some(
        (binding) => binding.targetId === targetId && binding.active,
      ),
    );
    return {
      targetId,
      ...(active === undefined ? {} : { activeSkillId: active.id }),
      skills: compatible,
    };
  }

  async uninstallSkill(
    principalInput: string | MarketPrincipal,
    skillId: string,
  ): Promise<void> {
    const principal = normalizePrincipal(principalInput);
    const existing = this.install(principal.userId, "skill", skillId);
    if (existing === undefined) {
      throw new ResourceMarketError("not_found", "Skill 尚未安装");
    }
    await this.tables.installs.delete(
      installKey(principal.userId, "skill", skillId),
    );
  }

  async installedSkills(
    principalInput: string | MarketPrincipal,
  ): Promise<SkillView[]> {
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const providerCatalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    const catalog = this.availableSkills(principal, provider, providerCatalog);
    return catalog
      .filter(
        (skill) =>
          this.install(principal.userId, "skill", skill.id)?.status ===
          "enabled",
      )
      .map((skill) => ({
        ...skill,
        ...this.lifecycleView(
          principal,
          this.descriptorFor("skill", skill.id, skill.name, skill.version),
        ),
        source: (() => {
          const stored = this.tables.customAssets.get(skill.id);
          if (stored?.ownerId === "platform") return "provider" as const;
          if (stored !== undefined) return "user" as const;
          return provider === undefined
            ? ("seed" as const)
            : ("provider" as const);
        })(),
        status: "enabled" as const,
        bindings: this.skillBindings(principal.userId, skill.id),
      }));
  }

  async resolveSkills(
    principalInput: string | MarketPrincipal,
    skillIds: readonly string[],
    options: { readonly requireInstallation?: boolean } = {},
  ): Promise<SkillView[]> {
    if (skillIds.length === 0) return [];
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const providerCatalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    const available = this.availableSkills(
      principal,
      provider,
      providerCatalog,
    ).map((skill) => ({
      ...skill,
      ...this.lifecycleView(
        principal,
        this.descriptorFor("skill", skill.id, skill.name, skill.version),
      ),
      source: (() => {
        const stored = this.tables.customAssets.get(skill.id);
        if (stored?.ownerId === "platform") return "provider" as const;
        if (stored !== undefined) return "user" as const;
        return provider === undefined
          ? ("seed" as const)
          : ("provider" as const);
      })(),
      status:
        this.install(principal.userId, "skill", skill.id)?.status === "enabled"
          ? ("enabled" as const)
          : ("available" as const),
      bindings: this.skillBindings(principal.userId, skill.id),
    }));
    const byId = new Map(available.map((skill) => [skill.id, skill]));
    return [...new Set(skillIds)]
      .map((skillId) => byId.get(skillId))
      .filter(
        (skill): skill is SkillView =>
          skill !== undefined &&
          (options.requireInstallation === false || skill.status === "enabled"),
      );
  }

  async mcps(
    principalInput: string | MarketPrincipal,
    input: {
      query?: string;
      category?: string;
      includeDelisted?: boolean;
      publicationStatus?: "published" | "delisted";
    } = {},
  ): Promise<McpView[]> {
    const principal = normalizePrincipal(principalInput);
    const registry = this.options.mcpRegistry?.();
    const provider =
      registry === undefined || registry.size === 0
        ? this.options.mcpProvider?.()
        : undefined;
    let catalog: readonly (McpAsset & {
      status?: McpConnectionStatus;
    })[];
    try {
      catalog =
        registry !== undefined && registry.size > 0
          ? await registry.list(principal)
          : provider === undefined
            ? MCPS
            : await provider.list(principal);
    } catch (cause) {
      this.marketProviderError(cause);
    }
    return Promise.all(
      catalog
        .filter((mcp) =>
          this.matches(
            `${mcp.name} ${mcp.description} ${mcp.protocol} ${mcp.publisher.name} ${mcp.permissions.join(" ")}`,
            input.query ?? "",
            input.category ?? "",
          ),
        )
        .filter((mcp) =>
          this.matchesPublication(
            principal,
            this.platformDescriptor("mcp", mcp.id, mcp.name, mcp.version),
            input,
          ),
        )
        .map(async (mcp) => {
          const stored = this.install(principal.userId, "mcp", mcp.id);
          const providerStatus: McpConnectionStatus =
            provider === undefined
              ? stored?.status === "pending"
                ? "pending"
                : mcp.initialStatus
              : (mcp.status ??
                (stored?.status === "pending" ? "pending" : "off"));
          let status = providerStatus;
          if (stored?.status === "connected" && providerStatus === "off") {
            try {
              const restored =
                registry !== undefined && registry.size > 0
                  ? await registry.connect(principal, mcp.id)
                  : await provider?.connect?.(principal, mcp.id);
              if (restored !== undefined) status = restored.status;
            } catch {
              // Keep the provider-reported state when a runtime reconnect fails.
            }
          }
          return {
            ...mcp,
            ...this.lifecycleView(
              principal,
              this.platformDescriptor("mcp", mcp.id, mcp.name, mcp.version),
            ),
            source:
              (registry !== undefined && registry.size > 0) ||
              provider !== undefined
                ? "provider"
                : "seed",
            status,
            connectionMode:
              (registry !== undefined && registry.size > 0) ||
              provider?.connect !== undefined
                ? "provider"
                : "request_only",
          };
        }),
    );
  }

  async connectMcp(
    principalInput: string | MarketPrincipal,
    mcpId: string,
  ): Promise<InstallRecord> {
    const principal = normalizePrincipal(principalInput);
    const descriptor = await this.resolveResourceDescriptor(
      principal,
      "mcp",
      mcpId,
    );
    if (descriptor === undefined) {
      throw new ResourceMarketError("not_found", "MCP 不存在");
    }
    if (!this.lifecycleView(principal, descriptor).actions.canInstall) {
      throw new ResourceMarketError("conflict", "资源已下架或停用，无法连接");
    }
    const registry = this.options.mcpRegistry?.();
    const provider =
      registry === undefined || registry.size === 0
        ? this.options.mcpProvider?.()
        : undefined;
    let connected: { status: "pending" | "connected" } | undefined;
    if (registry !== undefined && registry.size > 0) {
      try {
        connected = await registry.connect(principal, mcpId);
      } catch (cause) {
        this.marketProviderError(cause);
      }
    } else {
      const catalog: readonly (McpAsset & {
        status?: McpConnectionStatus;
      })[] = provider === undefined ? MCPS : await provider.list(principal);
      const manifest = catalog.find((mcp) => mcp.id === mcpId);
      if (manifest === undefined) {
        throw new ResourceMarketError("not_found", "MCP 不存在");
      }
      connected = await provider?.connect?.(principal, mcpId);
    }
    const record: InstallRecord = {
      userId: principal.userId,
      assetType: "mcp",
      assetId: mcpId,
      status: connected?.status ?? "pending",
      updatedAt: this.now(),
    };
    await this.tables.installs.put(
      installKey(principal.userId, "mcp", mcpId),
      record,
    );
    return record;
  }

  async disconnectMcp(
    principalInput: string | MarketPrincipal,
    mcpId: string,
  ): Promise<void> {
    const principal = normalizePrincipal(principalInput);
    const registry = this.options.mcpRegistry?.();
    const provider =
      registry === undefined || registry.size === 0
        ? this.options.mcpProvider?.()
        : undefined;
    if (registry !== undefined && registry.size > 0) {
      try {
        await registry.disconnect(principal, mcpId);
      } catch (cause) {
        this.marketProviderError(cause);
      }
    } else if (provider !== undefined) {
      const catalog = await provider.list(principal);
      if (!catalog.some((mcp) => mcp.id === mcpId)) {
        throw new ResourceMarketError("not_found", "MCP 不存在");
      }
      await provider.disconnect?.(principal, mcpId);
    }
    await this.tables.installs.delete(
      installKey(principal.userId, "mcp", mcpId),
    );
  }
}
