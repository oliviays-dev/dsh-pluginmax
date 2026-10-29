import { randomUUID } from "node:crypto";
import {
  entitlementKey,
  type PanelEntitlement,
  type PanelInstance,
  type WorkbenchAudit,
  type WorkbenchPreference,
  type WorkbenchRecord,
} from "./models.js";

export interface KvTableLike<V> {
  get(key: string): V | undefined;
  entries(): IterableIterator<[string, V]>;
  put(key: string, value: V): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface WorkbenchPrincipal {
  userId: string;
  name?: string;
  role?: "admin" | "owner" | "member" | "guest";
}

interface TeamServiceLike {
  members(workspaceId: string): readonly { userId: string }[];
}

interface TeammateWorkloadPort {
  snapshot(principal: WorkbenchPrincipal): Promise<unknown>;
}

export interface WorkbenchTemplatePlan {
  id: string;
  version: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  panelPlan: readonly Omit<PanelInstance, "id">[];
}

export interface WorkbenchV2Tables {
  workbenches: KvTableLike<WorkbenchRecord>;
  preferences: KvTableLike<WorkbenchPreference>;
  panelEntitlements: KvTableLike<PanelEntitlement>;
  idempotency: KvTableLike<{
    key: string;
    userId: string;
    operation: string;
    result: unknown;
    createdAt: string;
  }>;
  audit: KvTableLike<WorkbenchAudit>;
}

export interface CreateWorkbenchInput {
  name?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  visibility?: "private" | "team" | undefined;
  sharedWorkspaceIds?: string[] | undefined;
  panels?: readonly Omit<PanelInstance, "id">[] | undefined;
  sourceTemplate?: { id: string; version: string } | undefined;
}

const DEFAULT_PANELS: readonly Omit<PanelInstance, "id">[] = [
  {
    pluginId: "pluginmax.daily-brief",
    pluginVersion: "1.0.0",
    span: 4,
    order: 0,
    config: {},
  },
  {
    pluginId: "pluginmax.task-focus",
    pluginVersion: "1.0.0",
    span: 2,
    order: 1,
    config: {},
  },
  {
    pluginId: "pluginmax.kpi-overview",
    pluginVersion: "1.0.0",
    span: 3,
    order: 2,
    config: {},
  },
  {
    pluginId: "pluginmax.workflow-runs",
    pluginVersion: "1.0.0",
    span: 3,
    order: 3,
    config: {},
  },
  {
    pluginId: "pluginmax.meeting-insights",
    pluginVersion: "1.0.0",
    span: 2,
    order: 4,
    config: {},
  },
  {
    pluginId: "pluginmax.supplier-risk",
    pluginVersion: "1.0.0",
    span: 4,
    order: 5,
    config: {},
  },
];

const PANEL_VERSIONS: Record<string, string> = {
  "pluginmax.kpi-overview": "1.0.0",
  "pluginmax.daily-brief": "1.0.0",
  "pluginmax.task-focus": "1.0.0",
  "pluginmax.following": "1.0.0",
  "pluginmax.meeting-insights": "1.0.0",
  "pluginmax.supply-exceptions": "1.0.0",
  "pluginmax.supplier-risk": "1.0.0",
  "pluginmax.workflow-runs": "1.0.0",
  "pluginmax.team-load": "1.0.0",
  "pluginmax.industry-radar": "1.0.0",
  "pluginmax.data-agent": "1.0.0",
};

export class WorkbenchV2Error extends Error {
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
    this.name = "WorkbenchV2Error";
  }
}

function sortedPanels(panels: readonly PanelInstance[]): PanelInstance[] {
  return [...panels]
    .sort((left, right) => left.order - right.order)
    .map((panel, index) => ({ ...panel, order: index }));
}

function clonePanels(
  panels: readonly Omit<PanelInstance, "id">[],
): PanelInstance[] {
  return panels.map((panel, index) => ({
    ...panel,
    id: `pi-${randomUUID()}`,
    order: index,
    config: { ...panel.config },
  }));
}

export class WorkbenchV2Service {
  constructor(
    private readonly tables: WorkbenchV2Tables,
    private readonly options: {
      team: () => TeamServiceLike | undefined;
      teammateWorkload?: () => TeammateWorkloadPort | undefined;
      now?: () => Date;
      id?: () => string;
    },
  ) {}

  private now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private id(prefix: string): string {
    return `${prefix}-${this.options.id?.() ?? randomUUID()}`;
  }

  private owned(userId: string): WorkbenchRecord[] {
    return Array.from(this.tables.workbenches.entries())
      .map(([, record]) => record)
      .filter((record) => record.ownerId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private canView(
    principal: WorkbenchPrincipal,
    record: WorkbenchRecord,
  ): boolean {
    if (record.ownerId === principal.userId) return true;
    if (record.visibility !== "team") return false;
    const team = this.options.team();
    if (team === undefined) return false;
    return record.sharedWorkspaceIds.some((workspaceId) =>
      team.members(workspaceId).some(
        (member) => member.userId === principal.userId,
      ),
    );
  }

  private visible(principal: WorkbenchPrincipal): WorkbenchRecord[] {
    return Array.from(this.tables.workbenches.entries())
      .map(([, record]) => record)
      .filter((record) => this.canView(principal, record))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private requireVisible(
    principal: WorkbenchPrincipal,
    workbenchId: string,
  ): WorkbenchRecord {
    const record = this.tables.workbenches.get(workbenchId);
    if (record === undefined || !this.canView(principal, record)) {
      throw new WorkbenchV2Error("not_found", "工作台不存在或无权查看");
    }
    return record;
  }

  private requireOwner(
    principal: WorkbenchPrincipal,
    workbenchId: string,
  ): WorkbenchRecord {
    const record = this.requireVisible(principal, workbenchId);
    if (record.ownerId !== principal.userId) {
      throw new WorkbenchV2Error("forbidden", "仅工作台创建者可以编辑");
    }
    return record;
  }

  private async audit(
    principal: WorkbenchPrincipal,
    action: string,
    workbenchId?: string,
    result: "ok" | "failed" = "ok",
    detail: Record<string, string> = {},
  ): Promise<void> {
    const at = this.now();
    await this.tables.audit.put(`${at}\u0000${randomUUID()}`, {
      id: `${at}:${randomUUID()}`,
      actorId: principal.userId,
      action,
      ...(workbenchId === undefined ? {} : { workbenchId }),
      result,
      detail,
      createdAt: at,
    });
  }

  preference(userId: string): WorkbenchPreference {
    const existing = this.tables.preferences.get(userId);
    if (existing !== undefined) return existing;
    return {
      userId,
      favoriteIds: [],
      order: [],
      updatedAt: this.now(),
    };
  }

  private async savePreference(
    preference: WorkbenchPreference,
  ): Promise<WorkbenchPreference> {
    const normalized: WorkbenchPreference = {
      ...preference,
      favoriteIds: [...new Set(preference.favoriteIds)].slice(0, 5),
      order: [...new Set(preference.order)],
      updatedAt: this.now(),
    };
    await this.tables.preferences.put(normalized.userId, normalized);
    return normalized;
  }

  private async createRecord(
    principal: WorkbenchPrincipal,
    input: CreateWorkbenchInput,
    now = this.now(),
  ): Promise<WorkbenchRecord> {
    const name = (input.name ?? "新建工作台").trim();
    if (name.length < 1 || name.length > 40) {
      throw new WorkbenchV2Error("invalid_input", "名称长度必须为 1～40 字符");
    }
    const visibility = input.visibility ?? "private";
    const sharedWorkspaceIds = [...new Set(input.sharedWorkspaceIds ?? [])];
    if (visibility === "team" && sharedWorkspaceIds.length === 0) {
      throw new WorkbenchV2Error(
        "invalid_input",
        "团队工作台必须选择共享工作区",
      );
    }
    const record: WorkbenchRecord = {
      id: this.id("wb"),
      ownerId: principal.userId,
      name,
      description: input.description?.trim() ?? "",
      icon: input.icon ?? "layout",
      color: input.color ?? "#3f6ef3",
      visibility,
      sharedWorkspaceIds: visibility === "team" ? sharedWorkspaceIds : [],
      layout: { columns: 6, density: "comfortable" },
      panels: clonePanels(input.panels ?? []),
      ...(input.sourceTemplate === undefined
        ? {}
        : { sourceTemplate: input.sourceTemplate }),
      revision: 1,
      publishedRevision: 1,
      updatedBy: principal.userId,
      updatedByName: principal.name ?? principal.userId,
      createdAt: now,
      updatedAt: now,
    };
    await this.tables.workbenches.put(record.id, record);
    return record;
  }

  private async ensureUser(principal: WorkbenchPrincipal): Promise<void> {
    const owned = this.owned(principal.userId);
    const preference = this.preference(principal.userId);
    if (owned.length > 0) {
      const current =
        owned.find((item) => item.id === preference.activeWorkbenchId) ??
        owned[0];
      if (current !== undefined) {
        await this.savePreference({
          ...preference,
          activeWorkbenchId: current.id,
          defaultWorkbenchId:
            preference.defaultWorkbenchId ?? current.id,
          order:
            preference.order.length > 0
              ? preference.order
              : owned.map((item) => item.id),
        });
      }
      return;
    }
    const record = await this.createRecord(principal, {
      name: "我的工作台",
      description: "聚合今天需要判断、推进和关注的事项。",
      icon: "layout",
      color: "#3f6ef3",
      panels: DEFAULT_PANELS,
    });
    await this.savePreference({
      ...preference,
      activeWorkbenchId: record.id,
      defaultWorkbenchId: record.id,
      favoriteIds: [record.id],
      order: [record.id],
    });
  }

  async list(principal: WorkbenchPrincipal): Promise<{
    workbenches: WorkbenchRecord[];
    preference: WorkbenchPreference;
  }> {
    await this.ensureUser(principal);
    const preference = this.preference(principal.userId);
    const all = this.visible(principal);
    const order = new Map(preference.order.map((id, index) => [id, index]));
    all.sort((left, right) => {
      const leftFavorite = preference.favoriteIds.indexOf(left.id);
      const rightFavorite = preference.favoriteIds.indexOf(right.id);
      if (leftFavorite !== -1 || rightFavorite !== -1) {
        if (leftFavorite === -1) return 1;
        if (rightFavorite === -1) return -1;
        return leftFavorite - rightFavorite;
      }
      return (
        (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
    return { workbenches: all, preference };
  }

  async detail(
    principal: WorkbenchPrincipal,
    workbenchId: string,
  ): Promise<WorkbenchRecord> {
    return this.requireVisible(principal, workbenchId);
  }

  async create(
    principal: WorkbenchPrincipal,
    input: CreateWorkbenchInput,
  ): Promise<WorkbenchRecord> {
    if (this.owned(principal.userId).length >= 20) {
      throw new WorkbenchV2Error("invalid_input", "最多创建 20 个工作台");
    }
    const record = await this.createRecord(principal, input);
    const preference = this.preference(principal.userId);
    await this.savePreference({
      ...preference,
      activeWorkbenchId: record.id,
      defaultWorkbenchId: preference.defaultWorkbenchId ?? record.id,
      favoriteIds: preference.favoriteIds.includes(record.id)
        ? preference.favoriteIds
        : [...preference.favoriteIds, record.id].slice(0, 5),
      order: [record.id, ...preference.order.filter((id) => id !== record.id)],
    });
    await this.audit(principal, "workbench_created", record.id);
    return record;
  }

  async update(
    principal: WorkbenchPrincipal,
    workbenchId: string,
    input: {
      name?: string | undefined;
      description?: string | undefined;
      icon?: string | undefined;
      color?: string | undefined;
      visibility?: "private" | "team" | undefined;
      sharedWorkspaceIds?: string[] | undefined;
    },
  ): Promise<WorkbenchRecord> {
    const record = this.requireOwner(principal, workbenchId);
    const name = input.name?.trim() ?? record.name;
    if (name.length < 1 || name.length > 40) {
      throw new WorkbenchV2Error("invalid_input", "名称长度必须为 1～40 字符");
    }
    const visibility = input.visibility ?? record.visibility;
    const sharedWorkspaceIds =
      input.sharedWorkspaceIds ?? record.sharedWorkspaceIds;
    if (visibility === "team" && sharedWorkspaceIds.length === 0) {
      throw new WorkbenchV2Error(
        "invalid_input",
        "团队工作台必须选择共享工作区",
      );
    }
    const next: WorkbenchRecord = {
      ...record,
      name,
      description: input.description?.trim() ?? record.description,
      icon: input.icon ?? record.icon,
      color: input.color ?? record.color,
      visibility,
      sharedWorkspaceIds:
        visibility === "team" ? [...new Set(sharedWorkspaceIds)] : [],
      revision: record.revision + 1,
      updatedBy: principal.userId,
      updatedByName: principal.name ?? principal.userId,
      updatedAt: this.now(),
    };
    await this.tables.workbenches.put(next.id, next);
    await this.audit(principal, "workbench_updated", next.id);
    return next;
  }

  async saveDraft(
    principal: WorkbenchPrincipal,
    input: {
      workbenchId: string;
      expectedRevision: number;
      panels: PanelInstance[];
      name?: string | undefined;
      description?: string | undefined;
    },
  ): Promise<WorkbenchRecord> {
    const record = this.requireOwner(principal, input.workbenchId);
    if (record.revision !== input.expectedRevision) {
      throw new WorkbenchV2Error("conflict", "工作台已被其他页面更新");
    }
    const name = input.name?.trim() ?? record.name;
    if (name.length < 1 || name.length > 40) {
      throw new WorkbenchV2Error("invalid_input", "名称长度必须为 1～40 字符");
    }
    const panels = sortedPanels(input.panels).map((panel) => ({
      ...panel,
      order: panel.order,
    }));
    const next: WorkbenchRecord = {
      ...record,
      name,
      description: input.description?.trim() ?? record.description,
      panels,
      revision: record.revision + 1,
      updatedBy: principal.userId,
      updatedByName: principal.name ?? principal.userId,
      updatedAt: this.now(),
    };
    await this.tables.workbenches.put(next.id, next);
    await this.audit(principal, "workbench_saved", next.id, "ok", {
      panelCount: String(panels.length),
    });
    return next;
  }

  async duplicate(
    principal: WorkbenchPrincipal,
    workbenchId: string,
    name?: string,
  ): Promise<WorkbenchRecord> {
    const source = this.requireVisible(principal, workbenchId);
    if (this.owned(principal.userId).length >= 20) {
      throw new WorkbenchV2Error("invalid_input", "最多创建 20 个工作台");
    }
    const record = await this.createRecord(principal, {
      name: name?.trim() || `${source.name} 副本`,
      description: source.description,
      icon: source.icon,
      color: source.color,
      panels: source.panels,
      ...(source.sourceTemplate === undefined
        ? {}
        : { sourceTemplate: source.sourceTemplate }),
    });
    const preference = this.preference(principal.userId);
    await this.savePreference({
      ...preference,
      activeWorkbenchId: record.id,
      order: [record.id, ...preference.order],
    });
    await this.audit(principal, "workbench_duplicated", record.id);
    return record;
  }

  async remove(
    principal: WorkbenchPrincipal,
    workbenchId: string,
  ): Promise<{ workbenches: WorkbenchRecord[]; preference: WorkbenchPreference }> {
    const record = this.requireOwner(principal, workbenchId);
    await this.tables.workbenches.delete(record.id);
    const preference = this.preference(principal.userId);
    const remaining = this.owned(principal.userId);
    const fallback =
      remaining.find((item) => item.id === preference.defaultWorkbenchId) ??
      remaining[0];
    await this.savePreference({
      ...preference,
      activeWorkbenchId:
        preference.activeWorkbenchId === record.id
          ? fallback?.id
          : preference.activeWorkbenchId,
      defaultWorkbenchId:
        preference.defaultWorkbenchId === record.id
          ? fallback?.id
          : preference.defaultWorkbenchId,
      favoriteIds: preference.favoriteIds.filter((id) => id !== record.id),
      order: preference.order.filter((id) => id !== record.id),
    });
    await this.audit(principal, "workbench_deleted", record.id);
    return this.list(principal);
  }

  async preferenceUpdate(
    principal: WorkbenchPrincipal,
    input: {
      activeWorkbenchId?: string | undefined;
      defaultWorkbenchId?: string | undefined;
      favoriteIds?: string[] | undefined;
      order?: string[] | undefined;
    },
  ): Promise<WorkbenchPreference> {
    const preference = this.preference(principal.userId);
    for (const id of [
      input.activeWorkbenchId,
      input.defaultWorkbenchId,
      ...(input.favoriteIds ?? []),
      ...(input.order ?? []),
    ]) {
      if (id !== undefined) this.requireVisible(principal, id);
    }
    return this.savePreference({
      ...preference,
      ...(input.activeWorkbenchId === undefined
        ? {}
        : { activeWorkbenchId: input.activeWorkbenchId }),
      ...(input.defaultWorkbenchId === undefined
        ? {}
        : { defaultWorkbenchId: input.defaultWorkbenchId }),
      favoriteIds: input.favoriteIds ?? preference.favoriteIds,
      order: input.order ?? preference.order,
    });
  }

  entitlements(userId: string): string[] {
    return Array.from(this.tables.panelEntitlements.entries())
      .map(([, record]) => record)
      .filter((record) => record.userId === userId && record.enabled)
      .map((record) => record.pluginId);
  }

  async idempotent<T>(
    principal: WorkbenchPrincipal,
    operation: string,
    key: string | undefined,
    run: () => Promise<T>,
  ): Promise<T> {
    if (key === undefined || key.trim() === "") return run();
    const normalizedKey = key.trim();
    const storageKey = `${principal.userId}\u0000${operation}\u0000${normalizedKey}`;
    const existing = this.tables.idempotency.get(storageKey);
    if (existing !== undefined) return existing.result as T;
    const result = await run();
    await this.tables.idempotency.put(storageKey, {
      key: normalizedKey,
      userId: principal.userId,
      operation,
      result,
      createdAt: this.now(),
    });
    return result;
  }

  async enablePlugin(
    principal: WorkbenchPrincipal,
    pluginId: string,
  ): Promise<PanelEntitlement> {
    const record: PanelEntitlement = {
      userId: principal.userId,
      pluginId,
      enabled: true,
      updatedAt: this.now(),
    };
    await this.tables.panelEntitlements.put(
      entitlementKey(principal.userId, pluginId),
      record,
    );
    await this.audit(principal, "panel_plugin_enabled", undefined, "ok", {
      pluginId,
    });
    return record;
  }

  async enablePlugins(
    principal: WorkbenchPrincipal,
    pluginIds: readonly string[],
  ): Promise<PanelEntitlement[]> {
    const records: PanelEntitlement[] = [];
    for (const pluginId of new Set(pluginIds)) {
      records.push(await this.enablePlugin(principal, pluginId));
    }
    return records;
  }

  async addPanel(
    principal: WorkbenchPrincipal,
    input: {
      workbenchId?: string | undefined;
      pluginId: string;
      pluginVersion?: string | undefined;
      title?: string | undefined;
      span?: PanelInstance["span"] | undefined;
      config?: Record<string, unknown> | undefined;
      expectedRevision?: number | undefined;
    },
  ): Promise<WorkbenchRecord> {
    const preference = this.preference(principal.userId);
    const workbenchId = input.workbenchId ?? preference.activeWorkbenchId;
    if (workbenchId === undefined) {
      throw new WorkbenchV2Error("not_found", "没有当前工作台");
    }
    if (!this.entitlements(principal.userId).includes(input.pluginId)) {
      throw new WorkbenchV2Error("forbidden", "请先启用该面板能力");
    }
    const record = this.requireOwner(principal, workbenchId);
    if (
      input.expectedRevision !== undefined &&
      record.revision !== input.expectedRevision
    ) {
      throw new WorkbenchV2Error("conflict", "工作台已被其他页面更新");
    }
    const panel: PanelInstance = {
      id: this.id("pi"),
      pluginId: input.pluginId,
      pluginVersion:
        input.pluginVersion ?? PANEL_VERSIONS[input.pluginId] ?? "1.0.0",
      ...(input.title === undefined ? {} : { title: input.title }),
      span: input.span ?? 3,
      order: record.panels.length,
      config: input.config ?? {},
    };
    const next: WorkbenchRecord = {
      ...record,
      panels: [...record.panels, panel],
      revision: record.revision + 1,
      updatedBy: principal.userId,
      updatedByName: principal.name ?? principal.userId,
      updatedAt: this.now(),
    };
    await this.tables.workbenches.put(next.id, next);
    await this.audit(principal, "panel_added", next.id, "ok", {
      pluginId: input.pluginId,
    });
    return next;
  }

  async installTemplate(
    principal: WorkbenchPrincipal,
    template: WorkbenchTemplatePlan,
    requestedName?: string,
  ): Promise<WorkbenchRecord> {
    if (this.owned(principal.userId).length >= 20) {
      throw new WorkbenchV2Error("invalid_input", "最多创建 20 个工作台");
    }
    const existingNames = new Set(
      this.owned(principal.userId).map((item) => item.name),
    );
    const base = (requestedName?.trim() || template.name).slice(0, 40);
    let name = base;
    let suffix = 2;
    while (existingNames.has(name)) {
      const tail = ` (${suffix})`;
      name = `${base.slice(0, 40 - tail.length)}${tail}`;
      suffix += 1;
    }
    const record = await this.createRecord(principal, {
      name,
      description: template.description,
      icon: template.icon,
      color: template.color,
      panels: template.panelPlan,
      sourceTemplate: { id: template.id, version: template.version },
    });
    const preference = this.preference(principal.userId);
    await this.savePreference({
      ...preference,
      activeWorkbenchId: record.id,
      order: [record.id, ...preference.order],
    });
    await this.audit(principal, "template_installed", record.id, "ok", {
      templateId: template.id,
      version: template.version,
    });
    return record;
  }

  async bootstrap(
    principal: WorkbenchPrincipal,
    input: {
      layouts: Array<{
        id?: string | undefined;
        name?: string | undefined;
        order: string[];
        modules: Record<
          string,
          { cols?: number | undefined; height?: number | null | undefined } | undefined
        >;
      }>;
    },
  ): Promise<WorkbenchRecord[]> {
    const owned = this.owned(principal.userId);
    if (owned.length > 0) return owned;
    const mapping: Record<string, string> = {
      metrics: "pluginmax.kpi-overview",
      brief: "pluginmax.daily-brief",
      todo: "pluginmax.task-focus",
      focus: "pluginmax.following",
      "meeting-minutes": "pluginmax.meeting-insights",
      control: "pluginmax.supply-exceptions",
      supplier: "pluginmax.supplier-risk",
    };
    const layouts = input.layouts.slice(0, 20);
    const created: WorkbenchRecord[] = [];
    for (const [layoutIndex, layout] of layouts.entries()) {
      const panelPlan = layout.order
        .filter((id) => mapping[id] !== undefined)
        .slice(0, 100)
        .map((id, index) => {
          const cols = Math.max(
            1,
            Math.min(6, Math.round(layout.modules[id]?.cols ?? 3)),
          );
          const height = layout.modules[id]?.height;
          return {
            pluginId: mapping[id] as string,
            pluginVersion: "1.0.0",
            span: cols as PanelInstance["span"],
            order: index,
            ...(typeof height === "number" ? { height } : {}),
            config: {},
          };
        });
      const record = await this.createRecord(
        principal,
        {
          name: (layout.name ?? `旧工作台 ${layoutIndex + 1}`).slice(0, 40),
          description: "从旧工作台布局导入",
          panels: panelPlan.length > 0 ? panelPlan : DEFAULT_PANELS,
        },
        new Date(Date.now() + layoutIndex).toISOString(),
      );
      created.push(record);
    }
    if (created.length === 0) {
      const record = await this.createRecord(principal, {
        name: "我的工作台",
        description: "聚合今天需要判断、推进和关注的事项。",
        panels: DEFAULT_PANELS,
      });
      created.push(record);
    }
    await this.savePreference({
      userId: principal.userId,
      activeWorkbenchId: created[0]?.id,
      defaultWorkbenchId: created[0]?.id,
      favoriteIds: created.slice(0, 5).map((item) => item.id),
      order: created.map((item) => item.id),
      updatedAt: this.now(),
    });
    await this.audit(principal, "legacy_layout_imported", created[0]?.id, "ok", {
      workbenchCount: String(created.length),
    });
    return created;
  }

  async panelData(
    principal: WorkbenchPrincipal,
    pluginId: string,
  ): Promise<{
    id: string;
    pluginId: string;
    title: string;
    updatedAt: string;
    source: "live" | "seed" | "empty";
    refreshable: boolean;
    data: unknown;
  }> {
    const now = this.now();
    if (pluginId === "pluginmax.workflow-runs") {
      return {
        id: pluginId,
        pluginId,
        title: "工作流运行",
        updatedAt: now,
        source: "seed",
        refreshable: true,
        data: {
          items: [
            {
              id: "WF-197",
              title: "华南仓缺料处置",
              status: "进行中",
              progress: 67,
              note: "已到替代产能确认 · 预计 14:00 完成",
            },
            {
              id: "WF-203",
              title: "客户提前验收准备",
              status: "等待",
              progress: 42,
              note: "等待测试窗口确认",
            },
            {
              id: "WF-211",
              title: "供应商 B 质量复核",
              status: "阻塞",
              progress: 28,
              note: "缺少 8D 报告，已阻塞 6 小时",
            },
          ],
        },
      };
    }
    if (pluginId === "pluginmax.team-load") {
      const workload = this.options.teammateWorkload?.();
      if (workload === undefined) {
        return {
          id: pluginId,
          pluginId,
          title: "AI伙伴负载",
          updatedAt: now,
          source: "empty",
          refreshable: true,
          data: {
            generatedAt: now,
            activeCount: 0,
            inactiveCount: 0,
            items: [],
            unavailable: true,
          },
        };
      }
      return {
        id: pluginId,
        pluginId,
        title: "AI伙伴负载",
        updatedAt: now,
        source: "live",
        refreshable: true,
        data: await workload.snapshot(principal),
      };
    }
    if (pluginId === "pluginmax.industry-radar") {
      return {
        id: pluginId,
        pluginId,
        title: "行业雷达",
        updatedAt: now,
        source: "seed",
        refreshable: true,
        data: {
          items: [
            {
              id: "radar-1",
              title: "连接器现货价格连续两周上行",
              level: "中影响",
              summary: "与你负责的 3 个物料直接相关。",
            },
            {
              id: "radar-2",
              title: "区域仓新增临时运力政策",
              level: "机会",
              summary: "可能降低本月底补货的空运成本。",
            },
          ],
        },
      };
    }
    throw new WorkbenchV2Error("not_found", "未知面板插件");
  }
}
