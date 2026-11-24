import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Router / Worker client contract", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../client/index.js"),
    "utf8",
  );

  it("registers settings and gated task-detail chain slots", () => {
    expect(source).toContain('ctx.slots.inject("pluginmax.task.settings"');
    expect(source).toContain(
      'ctx.slots.inject("pluginmax.task.detail.actions"',
    );
    expect(source).toContain('ctx.slots.inject("pluginmax.task.detail.main"');
    expect(source).toContain('ctx.slots.inject("pluginmax.task.detail.side"');
    expect(source).toContain("ExtensionSettings");
    expect(source).toContain("owner.open === true && locallyEnabled");
  });

  it("keeps toolbar settings lazy while project settings load their scope", () => {
    const effect = source.slice(
      source.indexOf("function ExtensionSettings"),
      source.indexOf("const load ="),
    );
    expect(effect).not.toContain("fetch(");
    expect(effect).toContain("if (projectEntry)");
    expect(effect).toContain("void load(initialWorkspace)");
    expect(source).toContain("if (!open) return;");
    expect(source).toContain("const openSettings = () =>");
    expect(source).toContain("void load(target);");
  });

  it("labels the workspace selector as project and shows project names", () => {
    expect(source).toContain('"项目"');
    expect(source).toContain("workspaceOptions");
    expect(source).toContain("workspaceName(id)");
    expect(source).not.toContain('"Workspace"');
  });

  it("places the master switch left of the project selector", () => {
    expect(source).toContain('className: "pmrw-project-row"');
    expect(source).toContain(
      ".pmrw-project-row>.pmrw-master-switch-wrap{grid-column:1;grid-row:2;}",
    );
    expect(source).toContain(
      ".pmrw-project-row>.pmrw-select{grid-column:2;grid-row:2;width:100%;}",
    );
    const modalHeader = source.slice(
      source.indexOf('className: "pmrw-modal-head"'),
      source.indexOf('className: "pmrw-modal-body"'),
    );
    expect(modalHeader).not.toContain("renderMasterSwitch()");
    const projectRow = source.slice(
      source.indexOf('className: "pmrw-project-row"'),
      source.indexOf('"AI 任务规划服务"'),
    );
    expect(projectRow).toContain("renderMasterSwitch()");
    expect(projectRow).toContain('className: "pmrw-project-label"');
    expect(projectRow).toContain('"aria-label": "项目"');
  });

  it("matches task management select styling and right-aligns planning mode", () => {
    expect(source).toContain("pmrw-select,.pmrw-field select");
    expect(source).toContain('className: "pmrw-select pmrw-planning-mode"');
    expect(
      source.match(/className: "pmrw-select pmrw-planning-mode"/g),
    ).toHaveLength(1);
    expect(source).toContain(
      ".pmrw-planning-mode{width:92px;flex:none;align-self:center;margin-left:auto;}",
    );
    expect(source).toContain("pmrw-planning-card");
    expect(source).toContain(
      "grid-template-columns:minmax(0,1fr) auto;align-items:start;",
    );
    expect(source).toContain('className: projectEntry ? "pmproj-btn"');
    expect(source).toContain('? "保存"');
    expect(source).toContain("renderMasterSwitch");
    expect(source).toContain("pmrw-switch-track");
    expect(source).toContain("pmrw-planning-off-hint");
    expect(source).toContain(
      ".pmrw-master-switch-wrap{flex:none;display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.2;}",
    );
    const projectSettings = source.slice(
      source.indexOf('className: "pmrw-project-settings-inline"'),
      source.indexOf('className: "pmrw-task-actions"'),
    );
    expect(projectSettings).not.toContain("pmrw-scope-badge");
    expect(source).toContain(
      "启用任务规划后，可配置 AI 自动解析和 Agent 执行策略。",
    );
  });

  it("hands the project settings save action to the shared sticky footer", () => {
    expect(source).toContain("const saveRef = react.useRef(null)");
    expect(source).toContain("saveRef.current = save");
    expect(source).toContain(
      "props.onFooterChange(renderSettingsSaveButton())",
    );
    expect(source).toContain("return () => props.onFooterChange(null)");
    expect(source).toContain(
      "onClick: () => void saveRef.current?.(featureEnabled)",
    );
    expect(source).toContain(
      'h(\n                "div",\n                { className: "pmrw-modal-body pmrw-project-settings-body" },\n                renderSettingsSections(),\n              ),\n            )',
    );
  });

  it("refreshes stale settings revisions and retries the save once", () => {
    expect(source).toContain("function isRevisionConflict(cause)");
    expect(source).toContain(
      "result = await updateRouterSettings(refreshed.settings.revision)",
    );
    expect(source).toContain("planningResult = await updatePlanningSettings(");
    expect(source).toContain("currentSettings?.revision");
    expect(source).not.toContain("willEnable");
  });

  it("declares no polling timer", () => {
    expect(source).not.toContain("setInterval");
  });

  it("waits for the Planning Run before opening the generated draft", () => {
    expect(source).toContain("${result.plan.rootTaskId} ·");
    expect(source).not.toContain("`${result.plan.id} · ${props.taskTitle");
    expect(source).toContain("/api/collab/router-worker/planning/start");
    expect(source).toContain(
      "/api/collab/router-worker/planning/status?runId=",
    );
    expect(source).toContain("mountedRef.current &&");
    expect(source).toContain("props.open &&");
    expect(source).not.toContain("setTimeout(resolve, 1200)");
    expect(source).toContain("setTimeout(resolve, 1500)");
  });

  it("uses one compact plan header without duplicate summary or Router copy", () => {
    expect(source).toContain("pmrw-plan-title-line");
    expect(source).toContain("pmrw-plan-title-meta");
    expect(source).toContain(
      'h("span", { className: "pmrw-plan-tag" }, "任务规划")',
    );
    expect(source).toContain("`任务规划 ${");
    expect(source).toContain(
      "`${result.plan.rootTaskId} · v${result.plan.currentVersion}`",
    );
    expect(source).not.toContain(
      "`${result.plan.rootTaskId} · v${result.plan.currentVersion} · ${result.plan.status}`",
    );
    expect(source).not.toContain("pmrw-plan-summary");
    expect(source).not.toContain("`Router ${");
  });

  it("keeps plan navigation and toolbar actions in the requested order", () => {
    const header = source.slice(
      source.indexOf('className: "pmrw-plan-head"'),
      source.indexOf('className: "pmrw-plan-toolbar"'),
    );
    expect(header.indexOf("pmrw-plan-back")).toBeGreaterThan(-1);
    expect(header.indexOf("pmrw-plan-back")).toBeLessThan(
      header.indexOf("pmrw-plan-head-copy"),
    );
    expect(header).toContain('"aria-label": "返回对话"');
    expect(header).toContain('h("path", { d: "M19 12H5" })');
    expect(header).not.toContain("pmrw-plan-head-actions");

    const toolbar = source.slice(
      source.indexOf('className: "pmrw-plan-toolbar"'),
      source.indexOf('className: "pmrw-plan-content"'),
    );
    expect(toolbar).toContain('"网络"');
    expect(toolbar).not.toContain(
      'onClick: () => setView("graph"),\n              },\n              "图",',
    );
    expect(toolbar.indexOf("planConfirmation.label")).toBeLessThan(
      toolbar.indexOf('addOpen ? "取消添加" : "添加任务"'),
    );
  });

  it("keeps planning available for every task owner and supports Router selection", () => {
    expect(source).toContain("/router-agents?workspaceId=");
    expect(source).toContain("defaultRouterAgentId");
    expect(source).toContain('"自动解析执行计划"');
    expect(source).toContain('"人工创建执行计划"');
    expect(source).toContain('"按预置工作流执行"');
    expect(source).toContain("plans/router/status?cycleId=");
  });

  it("limits workflow choices to the current project's active business templates", () => {
    expect(source).toContain("/api/collab/projects/detail?workspaceId=");
    expect(source).toContain("projectTemplate.workflowTemplateIds");
    expect(source).toContain('definition.status === "active"');
    expect(source).toContain('definition.kind !== "business-chain"');
    expect(source).toContain("allowedTemplateIds.has(definition.id)");
  });

  it("keeps one task entry and moves AI planning into project settings", () => {
    expect(source).toContain("pluginmax.router-worker.planning.enabled.");
    expect(source).toContain("/api/collab/router-worker/planning/settings?");
    expect(source).toContain("/api/collab/router-worker/planning/start");
    expect(source).toContain(
      "/api/collab/router-worker/planning/status?runId=",
    );
    expect(source).toContain(
      "await fetchPlan(props.taskId, props.workspaceId)",
    );
    expect(source).not.toContain("new PlanEditor");
    expect(source).not.toContain('"AI 规划"');
    expect(source).toContain(
      'ctx.slots.inject("pluginmax.project.settings.other"',
    );
    expect(source).toContain('"项目级"');
    expect(source).toContain('"Agent 自动规划"');
    expect(source).toContain('"执行前计划门禁"');
    expect(source).toContain("autoPlanOnSpecChange");
    expect(source).toContain("requirePlanBeforeExecution");
    expect(source).toContain("pmrw-project-settings-inline");
    expect(source).toContain("renderSettingsSections()");
    expect(source).not.toContain("配置任务规划");
    expect(source).toContain("autoPlanningMode");
    expect(source).toContain('"开始自动解析"');
    expect(source).toContain("const enableAiPlanning = async () =>");
    const enableAiPlanning = source.slice(
      source.indexOf("const enableAiPlanning = async () =>"),
      source.indexOf("const startAutoPlanning = async () =>"),
    );
    expect(enableAiPlanning).toContain(
      "/api/collab/router-worker/planning/settings/update",
    );
    expect(enableAiPlanning).toContain("enabled: true");
    expect(source).toContain(
      "const currentPlanningSettings = await enableAiPlanning()",
    );
    expect(source).not.toContain('"AI 任务规划服务未启用"');
    expect(source).not.toContain('"前往项目设置"');
  });

  it("creates a manual plan immediately without a second confirmation", () => {
    expect(source).toContain(
      'const [startMode, setStartMode] = react.useState("")',
    );
    expect(source).toContain('startMode === ""');
    expect(source).toContain('startMode === "auto"');
    expect(source).toContain("pmrw-start-option");
    expect(source).toContain("onClick: beginAutoParse");
    expect(source).toContain("onClick: beginManualCreate");
    expect(source).toContain("const beginManualCreate = () =>");
    expect(source).toContain("void createDefaultPlan(props)");
    expect(source).not.toContain('startMode === "manual"');
    expect(source).not.toContain('"创建人工执行计划"');
    expect(source).toContain("正在解析执行计划");
    expect(source).toContain("pmrw-router-progress-track");
    expect(source).toContain('"aria-valuenow": routerProgress');
    expect(source).toContain("routerElapsedSeconds");
    expect(source).toContain("通常需要 20–60 秒");
    expect(source).not.toContain("尚未生成执行计划");
    expect(source).not.toContain("选择执行计划的创建方式");
    expect(source).toContain("const startAutoPlanning = async () =>");
    expect(source).toContain('h("option", { value: "quick" }, "快速")');
    expect(source).toContain(
      "const plannerAgentId =\n            currentPlanningSettings?.defaultPlannerAgentId ??",
    );
    expect(source).toContain("if (checked) setPlanningEnabled(true)");
    expect(source).toContain("任务规划伙伴由当前工作区自动选择。");
    expect(source).not.toContain("plannerAgentId: routerAgentId");
    expect(source).not.toContain(
      "选择本次规划模式和 Router Agent 后开始解析。",
    );
    expect(source).not.toContain(
      "规划任务已提交，但 Router 尚未返回 Plan Draft",
    );
    expect(source).toContain("开始自动解析");
  });

  it("keeps the master task side panel until a plan node is selected", () => {
    const main = source.slice(
      source.indexOf('"pluginmax.task.detail.main"'),
      source.indexOf('"pluginmax.task.detail.side"'),
    );
    const side = source.slice(
      source.indexOf('"pluginmax.task.detail.side"'),
      source.length,
    );
    expect(main).not.toContain("owner.nodeId");
    expect(side).toContain('typeof owner.nodeId === "string"');
    expect(side).toContain('owner.nodeId !== ""');
  });

  it("supports draggable graph nodes with persisted view positions", () => {
    expect(source).toContain("onPointerDown: (event) =>");
    expect(source).toContain("setPointerCapture?.(event.pointerId)");
    expect(source).toContain("graphPositionsKey");
    expect(source).toContain('"pluginmax.router-worker.graph-positions"');
    expect(source).toContain("draggingGraphNodeId");
    expect(source).toContain("const savedBend = activeGraphEdges[edgeKey]");
    expect(source).toContain("suppressGraphClickRef");
  });

  it("supports edge routing, infinite canvas pan, organize, and fullscreen graph", () => {
    expect(source).toContain("pmrw-graph-edge-hit");
    expect(source).toContain("beginGraphEdgeDrag");
    expect(source).toContain("beginCanvasPan");
    expect(source).toContain("pmrw-graph-controls");
    expect(source).toContain("pmrw-graph-icon-button");
    expect(source).toContain("pmrw-graph-title-row");
    expect(source).toContain("pmrw-graph-meta-line");
    expect(source).not.toContain("pmrw-plan-node-type");
    expect(source).toContain("h(GraphOrganizeIcon)");
    expect(source).toContain("h(GraphExpandIcon");
    expect(source).toContain("const direction = ex >= sx ? 1 : -1");
    expect(source).toContain("const childOnRight =");
    expect(source).toContain("M ${sx} ${sy} C ${sx + direction * curve}");
    expect(source).toContain("Q ${savedBend.x} ${savedBend.y}");
    expect(source).toContain("一键整理");
    expect(source).toContain("pmrw-task-plan-center.graph-fullscreen");
    expect(source).toContain("退出全屏");
    expect(source).toContain("transform: `translate(${canvasPan.x}px");
    expect(source).not.toContain(
      "节点权限由“项目权限范围 ∩ 任务负责人权限范围”实时计算；Router 不读取或保存权限快照。",
    );
  });

  it("renders the Demo-style list table with metadata and AI tags", () => {
    expect(source).toContain("pmrw-plan-table-head");
    expect(source).toContain("pmrw-plan-table-row");
    expect(source).toContain("pmrw-plan-owner");
    expect(source).toContain("pmrw-plan-status-pill");
    expect(source).not.toContain("pmrw-plan-type-mark");
    expect(source).toContain("pmrw-plan-table-title");
    expect(source).toContain(
      "color:var(--dsw-alias-label-primary);font-size:11px",
    );
    expect(source).toContain("pmrw-plan-dep-chip");
    expect(source).toContain(
      "grid-template-columns:minmax(300px,1.75fr) minmax(150px,.62fr) minmax(230px,1fr)",
    );
    expect(source).not.toContain("minmax(230px,max-content)");
    expect(source).toContain("-webkit-line-clamp:2");
    expect(source).toContain("grid-template-rows:repeat(2,24px)");
    expect(source).not.toContain("pmrw-plan-add-dep");
    expect(source).not.toContain('"＋ 添加前置"');
    expect(source).not.toContain("主任务 · 容器");
    expect(source).not.toContain("pmrw-plan-table-indent");
    expect(source).toContain('node.receiverType === "agent"');
    expect(source).toContain("pmrw-executor-ai-tag");
    expect(source).toContain('"删除任务"');
  });

  it("edits a new task in the right panel and keeps only status copy in the center", () => {
    expect(source).toContain("useAddNodeDraft");
    expect(source).toContain("正在右侧编辑新任务");
    expect(source).toContain("新建子任务");
    expect(source).toContain("创建任务");
    expect(source).not.toContain("pmrw-plan-settings pmrw-add-node");
    expect(source).toContain("pmrw-add-status");
  });

  it("edits the full task creation field set before the plan is confirmed", () => {
    expect(source).toContain('"任务标题"');
    expect(source).toContain('"类型"');
    expect(source).toContain('"初始状态"');
    expect(source).toContain('"责任人"');
    expect(source).toContain('"到期时间"');
    expect(source).toContain('"Review 设置"');
    expect(source).toContain('"执行策略"');
    expect(source).toContain("ExecutionRuntimeFields");
    expect(source).toContain("buildExecutionPolicy");
    expect(source).toContain("executionPolicy");
    expect(source).not.toContain('"负责人 ID"');
    expect(source).not.toContain('"负责人名称"');
  });

  it("keeps new subtask content empty and uses placeholders instead", () => {
    const draft = source.slice(
      source.indexOf("function defaultAddNodeDraft"),
      source.indexOf("function updateAddNodeDraft"),
    );
    expect(draft).toContain('description: ""');
    expect(draft).toContain('acceptance: ""');
    expect(draft).toContain('priority: "P2"');
    expect(draft).toContain("due: defaultPlanNodeDueDate()");
    expect(source).toContain("说明任务目标、范围和预期交付");
    expect(source).toContain("每行一条，可留空");
    expect(source).toContain("留空时按描述完成并自查");
    expect(source).toContain('"请输入任务标题"');
    expect(source).toContain('"请输入任务描述"');
    expect(source).not.toContain('"请填写验收标准"');
    expect(source).toContain('["按描述完成并自查"]');
    expect(source).toContain("defaultAddNodeDraft(props.currentUser)");
    expect(source).toContain("pmrw-node-section");
    expect(source).toContain("pmrw-node-section-grid");
    expect(source).toContain("pmrw-node-field wide");
    expect(source).toContain('"基本信息"');
    expect(source).toContain('"任务设置"');
    expect(source).toContain('"执行设置"');
    expect(source).toContain('"验收标准（选填）"');
    expect(source).not.toContain("填写任务信息后加入当前执行计划");
    expect(source).not.toContain("归属项目：${props.workspaceId}");
    expect(source).not.toContain("完成新增任务节点并提交可验收结果。");
    expect(source).not.toContain('acceptance.length === 0 ? ["提交任务结果"]');
  });

  it("guards unsaved node edits when clicking outside the side panel", () => {
    expect(source).toContain("const hasUnsavedChanges =");
    expect(source).toContain('"pointerdown", guardOutsideEdit, true');
    expect(source).toContain("pmrw-unsaved-backdrop");
    expect(source).toContain("pmrw-unsaved-dialog");
    expect(source).toContain('"保存节点修改？"');
    expect(source).toContain('"继续编辑"');
    expect(source).toContain('"不保存"');
    expect(source).toContain('saving ? "保存中..." : "保存节点"');
  });

  it("renders selected dependencies as removable chips with fuzzy search", () => {
    expect(source).toContain("const [dependencyOpen, setDependencyOpen]");
    expect(source).toContain("dependencyEditorRef");
    expect(source).toContain("dependencySearchTerms");
    expect(source).toContain("candidate.title,");
    expect(source).toContain("candidate.id,");
    expect(source).toContain("candidate.receiverName,");
    expect(source).toContain('"aria-label": `移除前置任务');
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain("firstAvailableDependency");
    expect(source).toContain("pmrw-dependency-option-empty");
    expect(source).toContain("按 Enter 添加首个可用任务");
  });

  it("edits materialized child tasks through the task service", () => {
    expect(source).toContain('request("/api/collab/tasks/update"');
    expect(source).toContain('request("/api/collab/tasks/assign"');
    expect(source).toContain('materializedTask.status !== "cancelled"');
    expect(source).toContain("materializedTask.archivedAt === undefined");
    expect(source).toContain("materializedTask.workflow === undefined");
    expect(source).toContain("任务详情编辑仅支持一个前置任务");
    expect(source).toContain("plans/nodes/ensure-task");
  });

  it("renders plan-stage and load-failure content in every side tab", () => {
    expect(source).toContain(
      "const resolvedTaskId = binding?.taskId ?? nodeState?.taskId",
    );
    expect(source).toContain("state.version === result?.plan?.currentVersion");
    expect(source).toContain(
      "function planSideStageCopy(planStatus, ownerName)",
    );
    expect(source).toContain(
      "计划已保存，等待“确认派发”；成功后会创建全部子任务。",
    );
    expect(source).toContain("该节点由人工执行");
    expect(source).toContain("function planSideNotice(");
    expect(source).toContain("子任务详情加载失败");
    expect(source).toContain("正在读取产出文档");
    expect(source).toContain("计划阶段暂无产出文档");
    expect(source).toContain("节点状态 · ");
    expect(source).toContain("前置任务");
    expect(source).not.toContain("子任务尚未加载。");
  });

  it("reuses the ordinary task detail side after the two-step publish completes", () => {
    expect(source).toContain(
      '!["active", "paused", "resume_required"].includes(',
    );
    expect(source).toContain("result.plan.status,");
    expect(source).toContain("window.__pluginmaxTaskDetailSide");
    expect(source).toContain("pmrw-task-plan-side-embedded");
    expect(source).toContain("initialTask: taskDetail");
  });

  it("regenerates an existing plan through Router or a workflow template", () => {
    expect(source).toContain("const regeneratePlan = async () =>");
    expect(source).toContain("plans/regenerate/router");
    expect(source).toContain("plans/regenerate/template");
    expect(source).toContain("由 Router Agent 重新生成");
    expect(source).toContain("按工作流模板重新生成");
    expect(source).toContain('"重新生成"');
  });

  it("switches the plan workspace to settings instead of stacking the form", () => {
    expect(source).toContain('className: "pmrw-plan-content"');
    expect(source).toContain(
      'className: "pmrw-plan-settings pmrw-plan-settings-page"',
    );
    expect(source).toContain('!settingsOpen && busy === "loading"');
    expect(source).toContain(".pmrw-plan-settings-page{min-height:0;flex:1;");
  });

  it("splits saving a plan from confirming dispatch", () => {
    expect(source).toContain("const approveAndDispatch = async () =>");
    expect(source).toContain("const savePlanOnly = async () =>");
    expect(source).toContain('"保存规划"');
    expect(source).toContain('"保存中..."');
    expect(source).toContain('"确认派发中..."');
    expect(source).toContain('"确认派发"');
    expect(source).not.toContain('"确认并派发"');
    expect(source).not.toContain('"更新并派发"');
    expect(source).not.toContain("const materialize = async () =>");
    expect(source).toContain(
      '["draft", "proposed", "approved"].includes(result?.plan?.status)',
    );
    expect(source).not.toContain('"确认计划"');
    expect(
      source.indexOf('"/api/collab/router-worker/plans/approve"'),
    ).toBeLessThan(
      source.indexOf('"/api/collab/router-worker/plans/materialize"'),
    );
  });

  it("marks a pending plan draft in the task detail action", () => {
    expect(source).toContain(
      "pmtask-detail-action neutral pmrw-detail-plan-entry",
    );
    expect(source).toContain("pmrw-plan-unread-dot");
    expect(source).toContain('position: "absolute"');
    expect(source).toContain('width: "7px"');
    expect(source).toMatch(
      /background:\s*"var\(--dsw-alias-state-error-primary/,
    );
    expect(source).toContain("function planConfirmationMeta(status)");
    expect(source).toContain('label: "计划待确认"');
    expect(source).toContain('label: "派发未完成"');
    expect(source).toContain('label: "已派发"');
    expect(source).toContain("const confirmation = planConfirmationMeta(");
    expect(source).toContain("任务规划待确认，打开任务规划图");
    expect(source).toContain("任务规划派发未完成，打开继续处理");
    expect(source).toContain('"任务规划"');
    expect(source).not.toContain("pmrw-plan-entry-status");
    expect(source).toContain("canRecoverPlan");
    expect(source).toContain("canRecoverPlan || (enabled && plan === null)");
    expect(source).toContain('message.content.includes("Plan Draft")');
    expect(source).toContain("setRecoveredEnabled(true)");
    expect(source).toContain('"data-plan-confirmation"');
  });

  it("returns a read-only plan surface when the user cannot manage it", () => {
    expect(source).toContain(
      "const canManagePlan = result?.permissions?.canManage === true",
    );
    expect(source).toContain('"你没有编辑或确认该任务规划的权限"');
    expect(source).toContain("result?.plan && canManagePlan");
    expect(source).toContain("canManagePlan &&");
    expect(source).toContain("settingsOpen && canManagePlan && result?.plan");
    expect(source).toContain("function planNodePreviewTask(");
    expect(source).toContain("window.__pluginmaxTaskDetailSide");
    expect(source).toContain("readOnlyPreview: true");
  });

  it("can save the default Router without disabling the extension", () => {
    expect(source).toContain("保存 Router 设置");
    expect(source).toContain("onClick: () => void save(true)");
    expect(source).toContain(
      "onClick: () => void save(enabled ? false : true)",
    );
  });

  it("keeps the persistence note without redundant settings copy or status card", () => {
    expect(source).not.toContain(
      "管理当前 Workspace 的 Router / Worker 任务规划能力。默认关闭。",
    );
    expect(source).not.toContain(
      "保存后仅影响当前项目的任务规划与 AI 自动化策略。",
    );
    expect(source).not.toContain('"Router / Worker 任务规划"');
    expect(source).not.toContain("关闭态除设置图标外不渲染计划入口");
    expect(source).toContain("pmrw-plan-persistence-note");
    expect(source).toContain(
      "计划创建后会固化 Router Agent；修改这里只影响新计划。",
    );
    expect(source).not.toContain('className: "pmrw-boundary"');
  });

  it("renders a non-approving final draft state", () => {
    expect(source).toContain('result?.plan?.status === "finalizing"');
    expect(source).toContain("等待主任务负责人确认");
    expect(source).toContain("finalDraft.acceptance");
  });

  it("does not publish a partial save response into the plan cache", () => {
    expect(source).not.toContain("publishPlan(props.taskId, body.result)");
    expect(source).toContain(
      'result?.nodeStates?.filter((state) => state.status === "accepted").length ?? 0',
    );
  });

  it("locks plan settings after the plan starts executing", () => {
    expect(source).toContain(
      'result?.plan !== undefined &&\n        canManagePlan &&\n        ["draft", "proposed", "approved"].includes(result.plan.status)',
    );
    expect(source).toContain("计划已进入执行阶段，当前设置为只读");
    expect(source).toContain("disabled: !planEditable");
  });

  it("adds task-plan details under the task breakdown tab", () => {
    expect(source).toContain("function TaskPlanBreakdown(props)");
    const breakdownStart = source.indexOf("function TaskPlanBreakdown(props)");
    const breakdownEnd = source.indexOf(
      "\n    function formatPlanTime",
      breakdownStart,
    );
    const breakdown = source.slice(breakdownStart, breakdownEnd);
    expect(source).toContain('"pluginmax.task.detail.relations"');
    expect(source).toContain("pluginmax-router-worker-task-plan-breakdown");
    expect(source).toContain('h("h3", null, "任务规划")');
    expect(breakdown).not.toContain(
      '"/api/collab/router-worker/plans/nodes/ensure-task"',
    );
    expect(source).toContain(
      "await props.onOpenTask?.(taskId, props.workspaceId)",
    );
    expect(source).toContain(
      "当前任务仍是规划草稿，确认派发后才会生成任务详情",
    );
    expect(source).toContain('"暂无任务规划明细"');
    expect(source).toContain("function PlanNodeTable(props)");
    expect(source).toContain("compact: true");
    expect(source).toContain("pmrw-plan-table.compact");
    expect(source).toContain(
      "display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 10px",
    );
    expect(source).toContain(
      ".pmrw-plan-table.compact .pmrw-plan-table-owner{flex:0 1 auto;max-width:100%;}",
    );
    expect(source).toContain(
      ".pmrw-plan-table.compact .pmrw-plan-deps{display:flex;flex-wrap:wrap;",
    );
    expect(source).toContain("pmrw-plan-draft-badge");
    expect(source).toContain('"草稿"');
  });
});
