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
  type WorkbenchTemplateAsset,
} from "./catalog.js";
import type { McpProviderRegistry } from "./mcp-registry.js";

export const idSchema = z.string().trim().min(1).max(200);
export const isoTimeSchema = z.string().datetime({ precision: 3 });

export const installRecordSchema = z.object({
  userId: idSchema,
  assetType: z.enum(["skill", "mcp"]),
  assetId: idSchema,
  status: z.enum(["enabled", "pending", "connected"]),
  updatedAt: isoTimeSchema,
});

export type InstallRecord = z.infer<typeof installRecordSchema>;

export const customResourceTypeSchema = z.enum([
  "skill",
  "mcp",
  "workbench-template",
  "panel-plugin",
]);

export const customResourceSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  type: customResourceTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  category: z.literal("自定义"),
  version: z.string().trim().min(1).max(80),
  publisherName: z.string().trim().min(1).max(120),
  permissions: z.array(z.string().trim().min(1).max(300)).max(20),
  manifest: z.record(z.string(), z.unknown()).optional(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export type CustomResourceRecord = z.infer<typeof customResourceSchema>;
export type CustomResourceInput = {
  type: CustomAssetType;
  name: string;
  description?: string | undefined;
  version?: string | undefined;
  publisherName?: string | undefined;
  permissions?: string[] | undefined;
  manifest?: Record<string, unknown> | undefined;
};

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
}

export type PublisherFilter = "official" | "certified" | "community";
export type CompatibilityStatus = "compatible" | "incompatible";
export type CompatibilityFilter = CompatibilityStatus;
export type MarketSort = "recommended" | "updated" | "name";
export type MarketSource = "seed" | "provider";

export interface MarketListInput {
  query?: string;
  category?: string;
  publisher?: PublisherFilter;
  compatibility?: CompatibilityFilter;
  sort?: MarketSort;
  page?: number;
  pageSize?: number;
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

export interface WorkbenchTemplateView extends WorkbenchTemplateAsset {
  source: "seed";
  compatibility: CompatibilityStatus;
  dependencies: TemplateDependencyView[];
  panels: TemplatePanelView[];
}

export type PanelPluginStatus =
  | "enabled"
  | "not_enabled"
  | "not_packaged"
  | "disabled"
  | "incompatible";

export interface PanelPluginView extends PanelManifest {
  source: "seed";
  compatibility: CompatibilityStatus;
  status: PanelPluginStatus;
}

export interface SkillView extends SkillAsset {
  source: MarketSource;
  status: "enabled" | "available";
}

export interface McpView extends McpAsset {
  source: MarketSource;
  status: McpConnectionStatus;
  connectionMode: "provider" | "request_only";
}

export interface CustomResourceView extends CustomResourceRecord {
  source: "user";
}

export const resourceMarketDomainSpec = {
  name: "collab_resource_market",
  version: 1,
  tables: {
    installs: { valueSchema: installRecordSchema },
    custom_assets: { valueSchema: customResourceSchema },
  },
} as const;

export class ResourceMarketError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "unauthorized"
      | "forbidden"
      | "not_found"
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

const normalizePrincipal = (
  principal: string | MarketPrincipal,
): MarketPrincipal =>
  typeof principal === "string" ? { userId: principal } : principal;

const normalizedPageSize = (value: number | undefined): number =>
  Math.max(1, Math.min(50, Math.round(value ?? 24)));

const normalizedPageNumber = (value: number | undefined): number =>
  Math.max(1, Math.round(value ?? 1));

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

  private customResourcesFor(
    principal: MarketPrincipal,
    input: {
      type?: CustomAssetType;
      query?: string;
      category?: string;
    },
  ): CustomResourceView[] {
    return Array.from(this.tables.customAssets.entries())
      .map(([, record]) => record)
      .filter((record) => record.ownerId === principal.userId)
      .filter((record) => input.type === undefined || record.type === input.type)
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
      .map((record) => ({ ...record, source: "user" as const }));
  }

  private matches(
    haystack: string,
    query: string,
    category: string,
  ): boolean {
    const normalized = query.trim().toLowerCase();
    return (
      (category === "" ||
        category === "全部" ||
        haystack.toLowerCase().includes(category.toLowerCase())) &&
      (normalized === "" ||
        haystack.toLowerCase().includes(normalized))
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
      .map((template) => this.templateView(template, enabled))
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
      .map((manifest) => this.pluginView(manifest, enabled))
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
  ): WorkbenchTemplateView | undefined {
    const template = this.template(id, version);
    if (template === undefined) return undefined;
    const user = normalizePrincipal(principal);
    const enabled = new Set(this.requireWorkbench().entitlements(user.userId));
    return this.templateView(template, enabled);
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
    return PANEL_MANIFESTS.find((item) => item.id === id)?.runtimeStatus ??
      "not_packaged";
  }

  panelManifest(id: string): PanelManifest | undefined {
    return PANEL_MANIFESTS.find((item) => item.id === id);
  }

  plugin(
    id: string,
  ):
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
    input: { query?: string; category?: string } = {},
  ): Promise<SkillView[]> {
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const catalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    return catalog
      .filter((skill) =>
        this.matches(
          `${skill.name} ${skill.description} ${skill.category} ${skill.publisher.name}`,
          input.query ?? "",
          input.category ?? "",
        ),
      )
      .map((skill) => ({
        ...skill,
        source: provider === undefined ? "seed" : "provider",
        status:
          this.install(principal.userId, "skill", skill.id)?.status ===
          "enabled"
            ? "enabled"
            : "available",
      }));
  }

  customResources(
    principalInput: string | MarketPrincipal,
    input: {
      type?: CustomAssetType;
      query?: string;
      category?: string;
    } = {},
  ): CustomResourceView[] {
    return this.customResourcesFor(normalizePrincipal(principalInput), input);
  }

  async registerCustomResource(
    principalInput: string | MarketPrincipal,
    input: CustomResourceInput,
  ): Promise<CustomResourceView> {
    const principal = normalizePrincipal(principalInput);
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
      ...(input.manifest === undefined ? {} : { manifest: input.manifest }),
      createdAt: now,
      updatedAt: now,
    };
    await this.tables.customAssets.put(record.id, record);
    return { ...record, source: "user" };
  }

  async removeCustomResource(
    principalInput: string | MarketPrincipal,
    resourceId: string,
  ): Promise<void> {
    const principal = normalizePrincipal(principalInput);
    const record = this.tables.customAssets.get(resourceId);
    if (
      record === undefined ||
      (record.ownerId !== principal.userId && principal.role !== "admin")
    ) {
      throw new ResourceMarketError("not_found", "自定义资源不存在");
    }
    await this.tables.customAssets.delete(resourceId);
  }

  async installSkill(
    principalInput: string | MarketPrincipal,
    skillId: string,
  ): Promise<InstallRecord> {
    const principal = normalizePrincipal(principalInput);
    const provider = this.options.skillProvider?.();
    const catalog =
      provider === undefined ? SKILLS : await provider.list(principal);
    if (!catalog.some((skill) => skill.id === skillId)) {
      throw new ResourceMarketError("not_found", "Skill 不存在");
    }
    const providerRecord = await provider?.install?.(principal, skillId);
    const record: InstallRecord = providerRecord ?? {
      userId: principal.userId,
      assetType: "skill",
      assetId: skillId,
      status: "enabled",
      updatedAt: this.now(),
    };
    await this.tables.installs.put(
      installKey(principal.userId, "skill", skillId),
      record,
    );
    return record;
  }

  async mcps(
    principalInput: string | MarketPrincipal,
    input: { query?: string; category?: string } = {},
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
    return catalog
      .filter((mcp) =>
        this.matches(
          `${mcp.name} ${mcp.description} ${mcp.protocol} ${mcp.publisher.name} ${mcp.permissions.join(" ")}`,
          input.query ?? "",
        input.category ?? "",
        ),
      )
      .map((mcp) => {
        const stored = this.install(principal.userId, "mcp", mcp.id);
        const status: McpConnectionStatus =
          provider === undefined
            ? stored?.status === "pending"
              ? "pending"
              : mcp.initialStatus
            : mcp.status ??
              (stored?.status === "pending" ? "pending" : "off");
        return {
          ...mcp,
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
      });
  }

  async connectMcp(
    principalInput: string | MarketPrincipal,
    mcpId: string,
  ): Promise<InstallRecord> {
    const principal = normalizePrincipal(principalInput);
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
}
