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

  it("does not request settings before the user opens the modal", () => {
    const effect = source.slice(
      source.indexOf("function ExtensionSettings"),
      source.indexOf("const load ="),
    );
    expect(effect).not.toContain("fetch(");
    expect(effect).not.toContain("void load(");
    expect(source).toContain("if (!open) return;");
    expect(source).toContain("const openSettings = () =>");
    expect(source).toContain("void load(target);");
  });

  it("declares no polling timer", () => {
    expect(source).not.toContain("setInterval");
  });

  it("shows the root task code and waits for an actual Router draft", () => {
    expect(source).toContain("${result.plan.rootTaskId} ·");
    expect(source).not.toContain("`${result.plan.id} · ${props.taskTitle");
    expect(source).toContain('latest?.plan?.source === "router"');
    expect(source).toContain("mountedRef.current &&");
    expect(source).toContain("props.open &&");
    expect(source).not.toContain("setTimeout(resolve, 1200)");
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

  it("keeps planning available for every task owner and supports Router selection", () => {
    expect(source).toContain("/router-agents?workspaceId=");
    expect(source).toContain("defaultRouterAgentId");
    expect(source).toContain('"自动解析执行计划"');
    expect(source).toContain('"人工创建执行计划"');
    expect(source).toContain('"按预置工作流执行"');
    expect(source).toContain("plans/router/status?cycleId=");
  });

  it("shows mode-specific configuration only after choosing a start action", () => {
    expect(source).toContain(
      'const [startMode, setStartMode] = react.useState("")',
    );
    expect(source).toContain('startMode === ""');
    expect(source).toContain('startMode === "auto"');
    expect(source).toContain('startMode === "manual"');
    expect(source).toContain("pmrw-start-option");
    expect(source).toContain("onClick: beginAutoParse");
    expect(source).toContain("正在解析执行计划");
    expect(source).toContain("pmrw-router-progress-track");
    expect(source).toContain('"aria-valuenow": routerProgress');
    expect(source).toContain("routerElapsedSeconds");
    expect(source).toContain("通常需要 20–60 秒");
    expect(source).toMatch(/startMode === "auto"[\s\S]{0,40}\? null/);
    expect(source).toContain('cycle?.runStatus === "waiting_input"');
    expect(source).not.toContain(
      "规划任务已提交，但 Router 尚未返回 Plan Draft",
    );
    expect(source).not.toContain("开始自动解析");
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
      "第二步“确认并派发”尚未完成，请重试；成功后会创建全部子任务。",
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

  it("confirms and dispatches a new plan with one primary action", () => {
    expect(source).toContain("const approveAndDispatch = async () =>");
    expect(source).toContain('"确认并派发中..."');
    expect(source).toContain('"确认并派发"');
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
    expect(source).toContain(
      'background: "var(--dsw-alias-state-error-primary',
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

  it("keeps the Router persistence note without extra settings copy or frame", () => {
    expect(source).not.toContain(
      "管理当前 Workspace 的 Router / Worker 任务规划能力。默认关闭。",
    );
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
});
