export interface Publisher {
  id: string;
  name: string;
  verified: boolean;
  kind: "official" | "certified" | "community";
}

export interface PanelManifest {
  id: string;
  name: string;
  version: string;
  publisher: Publisher;
  category: string;
  icon: string;
  description: string;
  defaultSpan: 1 | 2 | 3 | 4 | 5 | 6;
  minSpan: 1 | 2 | 3 | 4 | 5 | 6;
  maxSpan: 1 | 2 | 3 | 4 | 5 | 6;
  capabilities: string[];
  dataScopes: string[];
  compatibleHost: string;
  configSchema?: Record<string, unknown>;
  providerPluginId: string;
  panelSlotKey: "workbench.canvas.panel";
  runtimeStatus?: "packaged" | "not_packaged" | "disabled";
}

export interface TemplatePanel {
  pluginId: string;
  pluginVersion: string;
  title?: string;
  span: 1 | 2 | 3 | 4 | 5 | 6;
  order: number;
  config: Record<string, unknown>;
}

export interface WorkbenchTemplateAsset {
  id: string;
  version: string;
  name: string;
  description: string;
  preview: string;
  category: string;
  tags: string[];
  requiredPlugins: { id: string; versionRange: string }[];
  panelPlan: TemplatePanel[];
  permissions: string[];
  publisher: Publisher;
  visibility: "official" | "team" | "public";
  updatedAt: string;
  icon: string;
  color: string;
  installs: number;
  rating: number;
}

export interface SkillAsset {
  id: string;
  name: string;
  category: string;
  description: string;
  publisher: Publisher;
  version: string;
  icon: string;
  permissions: string[];
  usage: string;
}

export interface McpAsset {
  id: string;
  name: string;
  description: string;
  protocol: string;
  toolCount: number;
  publisher: Publisher;
  version: string;
  icon: string;
  permissions: string[];
  /** Seed assets never claim a live connection. */
  initialStatus: "pending" | "off";
}

const official: Publisher = {
  id: "pluginmax",
  name: "Pluginmax 官方",
  verified: true,
  kind: "official",
};

const panel = (
  id: string,
  name: string,
  category: string,
  icon: string,
  description: string,
  defaultSpan: PanelManifest["defaultSpan"],
  dataScopes: string[],
): PanelManifest => ({
  id,
  name,
  version: "1.0.0",
  publisher: official,
  category,
  icon,
  description,
  defaultSpan,
  minSpan: 1,
  maxSpan: 6,
  capabilities: [id],
  dataScopes,
  compatibleHost: "DSH 0.1.x",
  providerPluginId: "dsh-collab-workbench-panels",
  panelSlotKey: "workbench.canvas.panel",
  runtimeStatus: "packaged",
});

export const PANEL_MANIFESTS: readonly PanelManifest[] = [
  panel(
    "pluginmax.daily-brief",
    "每日简报",
    "AI",
    "sparkles",
    "聚合与你相关的风险、进展和待决策事项。",
    4,
    ["任务、工作流和 Agent 运行摘要"],
  ),
  panel(
    "pluginmax.task-focus",
    "我的待办",
    "任务",
    "list-checks",
    "集中处理待处理、待验收和逾期任务。",
    2,
    ["当前账号有权查看的任务"],
  ),
  panel(
    "pluginmax.kpi-overview",
    "核心指标",
    "数据",
    "chart",
    "用一屏内的关键指标判断业务是否正常。",
    3,
    ["工作区指标"],
  ),
  panel(
    "pluginmax.following",
    "重点关注",
    "任务",
    "star",
    "展示主动关注的任务、工作流和会议。",
    3,
    ["当前账号的关注记录"],
  ),
  panel(
    "pluginmax.meeting-insights",
    "会议纪要",
    "协作",
    "message",
    "把会议结论和待确认事项转为下一步行动。",
    2,
    ["当前账号可查看的会议纪要"],
  ),
  panel(
    "pluginmax.supply-exceptions",
    "供给例外",
    "供应链",
    "alert",
    "跟踪供应异常、影响范围与承诺日期。",
    2,
    ["供应链例外摘要"],
  ),
  panel(
    "pluginmax.supplier-risk",
    "供应商风险",
    "供应链",
    "shield",
    "按影响和紧迫度聚合供应商风险。",
    4,
    ["供应商风险摘要"],
  ),
  panel(
    "pluginmax.workflow-runs",
    "工作流运行",
    "流程",
    "workflow",
    "查看运行、等待和阻塞中的流程实例。",
    3,
    ["当前账号可查看的工作流"],
  ),
  panel(
    "pluginmax.team-load",
    "AI伙伴负载",
    "管理",
    "users",
    "查看 AI 伙伴过去 24/72 小时的会议、任务、Token 用量与阻塞异常。",
    3,
    ["授权范围内 AI 伙伴的运行、任务与 Token 摘要"],
  ),
  panel(
    "pluginmax.industry-radar",
    "行业雷达",
    "研究",
    "radar",
    "汇总竞品、政策和市场变化的外部信号。",
    4,
    ["已配置的外部情报源"],
  ),
  panel(
    "pluginmax.data-agent",
    "Data Agent",
    "AI",
    "sparkles",
    "查看平台内置 Data Agent 的最近配置与入口。",
    3,
    ["当前工作区的 Data Agent 配置与会话索引"],
  ),
];

const tpl = (
  id: string,
  name: string,
  category: string,
  description: string,
  preview: string,
  icon: string,
  color: string,
  panels: [string, 1 | 2 | 3 | 4 | 5 | 6][],
  permissions: string[],
): WorkbenchTemplateAsset => ({
  id,
  version: "1.0.0",
  name,
  description,
  preview,
  category,
  tags: [category, "官方"],
  requiredPlugins: panels.map(([pluginId]) => ({
    id: pluginId,
    versionRange: "^1.0.0",
  })),
  panelPlan: panels.map(([pluginId, span], order) => ({
    pluginId,
    pluginVersion: "1.0.0",
    span,
    order,
    config: {},
  })),
  permissions,
  publisher: official,
  visibility: "official",
  updatedAt: "2026-10-28T00:00:00.000Z",
  icon,
  color,
  installs: 1280,
  rating: 4.8,
});

export const TEMPLATES: readonly WorkbenchTemplateAsset[] = [
  tpl(
    "tpl-legacy",
    "经典工作台（旧版）",
    "运营",
    "完整保留原工作台的七个固定模块、信息优先级和执行视角。",
    "legacy",
    "layout",
    "#58708f",
    [
      ["pluginmax.kpi-overview", 6],
      ["pluginmax.daily-brief", 6],
      ["pluginmax.task-focus", 4],
      ["pluginmax.following", 2],
      ["pluginmax.meeting-insights", 4],
      ["pluginmax.supply-exceptions", 2],
      ["pluginmax.supplier-risk", 4],
    ],
    ["沿用原工作台的模块权限与数据访问范围"],
  ),
  tpl(
    "tpl-supply",
    "供应链作战台",
    "运营",
    "把供应异常、承诺日期、任务和会议决策放在同一张桌面上。",
    "supply",
    "box",
    "#3f6ef3",
    [
      ["pluginmax.daily-brief", 4],
      ["pluginmax.task-focus", 2],
      ["pluginmax.kpi-overview", 3],
      ["pluginmax.workflow-runs", 3],
      ["pluginmax.meeting-insights", 2],
      ["pluginmax.supplier-risk", 4],
    ],
    ["读取有关联权限的待办、会议和供应风险摘要"],
  ),
  tpl(
    "tpl-review",
    "经营周复盘",
    "管理",
    "按指标、流程、资源和结论组织每周复盘。",
    "review",
    "chart",
    "#168a74",
    [
      ["pluginmax.kpi-overview", 6],
      ["pluginmax.workflow-runs", 3],
      ["pluginmax.supplier-risk", 3],
      ["pluginmax.meeting-insights", 3],
      ["pluginmax.following", 3],
    ],
    ["读取你所在项目的指标、工作流与会议"],
  ),
  tpl(
    "tpl-radar",
    "产品发现台",
    "情报",
    "把外部情报、待办和项目会议放到同一上下文。",
    "radar",
    "radar",
    "#7057ca",
    [
      ["pluginmax.industry-radar", 4],
      ["pluginmax.daily-brief", 2],
      ["pluginmax.task-focus", 3],
      ["pluginmax.meeting-insights", 3],
    ],
    ["读取公开外部情报源与你有权访问的任务"],
  ),
  tpl(
    "tpl-launch",
    "项目上线指挥台",
    "项目",
    "围绕上线窗口管理发布任务、阻塞项和跨团队依赖。",
    "launch",
    "layout",
    "#c65d48",
    [
      ["pluginmax.daily-brief", 4],
      ["pluginmax.task-focus", 2],
      ["pluginmax.workflow-runs", 4],
      ["pluginmax.meeting-insights", 2],
    ],
    ["读取项目任务、工作流与会议结论"],
  ),
];

export const SKILLS: readonly SkillAsset[] = [
  {
    id: "skill-supplier-risk",
    name: "供应商交期风险评估",
    category: "供应链",
    description: "结合订单、承诺日期和履约记录输出风险与处置建议。",
    publisher: official,
    version: "2.1.0",
    icon: "alert",
    permissions: ["读取有权访问的订单与供应商摘要"],
    usage: "1.2k 次调用",
  },
  {
    id: "skill-cost-variance",
    name: "采购价格差异分析",
    category: "采购",
    description: "对比目标价、合同价与实际结算价并识别异常差异。",
    publisher: {
      id: "ops-guild",
      name: "Operations Guild",
      verified: true,
      kind: "certified",
    },
    version: "1.8.3",
    icon: "chart",
    permissions: ["读取当前账号有权查看的采购数据"],
    usage: "846 次调用",
  },
  {
    id: "skill-8d-summary",
    name: "8D 报告摘要",
    category: "质量",
    description: "抽取根因、纠正措施、责任人和待确认证据。",
    publisher: {
      id: "quality-lab",
      name: "Quality Lab",
      verified: true,
      kind: "certified",
    },
    version: "1.4.0",
    icon: "shield",
    permissions: ["读取有关联权限的质量报告"],
    usage: "532 次调用",
  },
  {
    id: "skill-meeting-actions",
    name: "会议行动项提取",
    category: "协作",
    description: "从会议记录中提取决策、负责人和截止时间。",
    publisher: official,
    version: "3.0.1",
    icon: "message",
    permissions: ["读取当前账号可访问的会议纪要"],
    usage: "2.4k 次调用",
  },
];

export const MCPS: readonly McpAsset[] = [
  {
    id: "mcp-sap-mm",
    name: "SAP MM 采购订单",
    description: "查询采购订单、收货状态和供应商承诺日期。",
    protocol: "HTTP / OAuth 2.0",
    toolCount: 8,
    publisher: official,
    version: "1.6.0",
    icon: "box",
    permissions: ["采购订单只读"],
    initialStatus: "pending",
  },
  {
    id: "mcp-feishu",
    name: "飞书项目空间",
    description: "读取项目群消息、任务、文档和会议纪要。",
    protocol: "SSE / App Token",
    toolCount: 12,
    publisher: official,
    version: "2.0.0",
    icon: "message",
    permissions: ["项目消息读写"],
    initialStatus: "pending",
  },
  {
    id: "mcp-wecom",
    name: "企业微信通讯录",
    description: "按权限查询成员、组织关系和值班信息。",
    protocol: "HTTP / OAuth 2.0",
    toolCount: 5,
    publisher: official,
    version: "1.2.0",
    icon: "users",
    permissions: ["通讯录只读"],
    initialStatus: "pending",
  },
  {
    id: "mcp-qcc",
    name: "企查查企业风险",
    description: "查询供应商工商、司法和经营异常信号。",
    protocol: "HTTP / API Key",
    toolCount: 4,
    publisher: official,
    version: "1.1.0",
    icon: "radar",
    permissions: ["公开企业信息"],
    initialStatus: "off",
  },
];
