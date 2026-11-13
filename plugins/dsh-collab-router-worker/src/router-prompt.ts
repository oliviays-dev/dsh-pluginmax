import type { PlanGraph, PlanRecord } from "./models.js";
import type { RootTaskLike } from "./service.js";

export interface RouterCandidate {
  readonly id: string;
  readonly name: string;
  readonly kind: "human" | "agent";
  readonly role?: string | undefined;
  readonly ownerName?: string | undefined;
  readonly available: boolean;
}

export interface RouterPromptInput {
  readonly rootTask: RootTaskLike;
  readonly kind: "plan" | "replan" | "finalize";
  readonly trigger: string;
  readonly routerAgentName: string;
  readonly candidates: readonly RouterCandidate[];
  readonly currentPlan?:
    | {
        readonly plan: PlanRecord;
        readonly graph: PlanGraph;
        readonly nodeStates: readonly {
          readonly nodeId: string;
          readonly status: string;
          readonly taskId?: string | undefined;
          readonly lastError?: string | undefined;
          readonly resultSummary?: string | undefined;
        }[];
      }
    | undefined;
  readonly constraints: {
    readonly maxNodes: number;
    readonly maxDepth: number;
    readonly maxFanOut: number;
    readonly maxConcurrency: number;
  };
}

const PLAN_GRAPH_EXAMPLE = `{
  "nodes": [
    {
      "id": "research",
      "title": "梳理需求与约束",
      "description": "读取主任务资料，整理目标、约束和风险，形成可供后续节点使用的结论。",
      "type": "task",
      "receiverType": "agent",
      "receiverId": "candidate-id",
      "receiverName": "候选负责人名称",
      "priority": "P2",
      "acceptance": ["形成结构化结论", "列出关键风险"],
      "dependencies": [],
      "reviewMode": "human",
      "maxAttempts": 2,
      "timeoutSeconds": 86400
    },
    {
      "id": "delivery",
      "title": "完成交付",
      "description": "基于前置节点结论完成主任务要求的交付物。",
      "type": "task",
      "receiverType": "human",
      "receiverId": "human-user-id",
      "receiverName": "人类负责人名称",
      "priority": "P2",
      "acceptance": ["交付物满足验收标准"],
      "dependencies": ["research"],
      "reviewMode": "human",
      "maxAttempts": 2,
      "timeoutSeconds": 86400
    }
  ],
  "startNodeIds": ["research"],
  "warnings": []
}`;

function lines(value: string | undefined): readonly string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function candidateLines(candidates: readonly RouterCandidate[]): string[] {
  if (candidates.length === 0) return ["- 无可用的 Worker 候选"];
  return candidates.map((candidate) =>
    [
      `- ${candidate.kind === "agent" ? "AI" : "人类"}：${candidate.name}`,
      `id=${candidate.id}`,
      candidate.role === undefined ? undefined : `role=${candidate.role}`,
      candidate.ownerName === undefined
        ? undefined
        : `owner=${candidate.ownerName}`,
      candidate.available ? "available=true" : "available=false",
    ]
      .filter(Boolean)
      .join(" · "),
  );
}

function currentPlanLines(input: RouterPromptInput): string[] {
  if (input.currentPlan === undefined) return ["当前尚无执行计划。"];
  const { plan, graph, nodeStates } = input.currentPlan;
  const stateById = new Map(nodeStates.map((state) => [state.nodeId, state]));
  return [
    `计划版本：v${plan.currentVersion}，状态 ${plan.status}`,
    ...graph.nodes.map((node) => {
      const state = stateById.get(node.id);
      return [
        `- ${node.id}：${node.title}`,
        `负责人=${node.receiverName ?? node.receiverId ?? "待指派"}`,
        `状态=${state?.status ?? "waiting"}`,
        `依赖=${node.dependencies.join("、") || "无"}`,
        state?.taskId === undefined ? undefined : `任务=${state.taskId}`,
        state?.lastError === undefined ? undefined : `错误=${state.lastError}`,
        state?.resultSummary === undefined
          ? undefined
          : `结果摘要=${state.resultSummary}`,
      ]
        .filter(Boolean)
        .join(" · ");
    }),
  ];
}

export function buildRouterCyclePrompt(input: RouterPromptInput): string {
  const task = input.rootTask;
  const acceptance =
    task.acceptance === undefined || task.acceptance.length === 0
      ? ["未单独填写验收标准，请从任务描述提取可验收结果"]
      : task.acceptance;
  const ownerPolicy =
    task.receiverType === "agent"
      ? [
          "主任务负责人是 AI Agent。",
          "完成全部 required 节点后，可以生成最终汇总；平台会按既有治理规则提交主任务人工 Review。",
          "你不能代替人类通过 Review，也不能把主任务直接标记为 Done。",
        ]
      : [
          "主任务负责人不是 AI Agent。",
          "完成全部 required 节点后，只生成一份非约束性的交付草稿，供主任务负责人跟进处理。",
          "不要自动提交 Review，不要自动完成 Master Task，不要替负责人作出最终业务承诺。",
        ];

  if (input.kind === "finalize") {
    return [
      "# Router / Worker 最终交付草稿",
      "",
      `你是 Workspace Router Agent「${input.routerAgentName}」。当前 Cycle 只负责整理执行结果，不继续拆解节点。`,
      "",
      "## Master Task",
      `- 编号：${task.id}`,
      `- 标题：${task.title}`,
      `- 负责人类型：${task.receiverType ?? "unassigned"}`,
      `- 负责人：${task.receiverName ?? task.receiverId ?? "未指派"}`,
      `- 优先级：${task.priority}`,
      `- DDL：${task.due ?? "不限"}`,
      "",
      "## 任务描述",
      task.description?.trim() || "未填写描述",
      "",
      "## 验收标准",
      ...acceptance.map((item, index) => `${index + 1}. ${item}`),
      "",
      "## 当前执行结果",
      ...currentPlanLines(input),
      "",
      "## 收口规则",
      ...ownerPolicy.map((line) => `- ${line}`),
      "",
      "## 输出要求",
      "必须调用 `router_worker_submit_final_draft` 工具提交结构化交付草稿，不要只用普通文本回复。",
      "草稿必须区分已完成结果、证据引用、风险、待确认问题和验收覆盖情况。",
      "不得声称未在节点结果中出现的产出已经完成，不得编造链接、运行 ID 或验收结论。",
    ].join("\n");
  }

  return [
    "# Router / Worker 任务规划",
    "",
    `你是 Workspace Router Agent「${input.routerAgentName}」。你不是主任务负责人，也不是 Worker。你只负责生成可编辑、可验证的任务计划。`,
    `当前 Cycle：${input.kind === "replan" ? "重新规划" : "首次规划"}；触发事件：${input.trigger}。`,
    "",
    "## Master Task",
    `- 编号：${task.id}`,
    `- 标题：${task.title}`,
    `- 优先级：${task.priority}`,
    `- DDL：${task.due ?? "不限"}`,
    `- 负责人类型：${task.receiverType ?? "unassigned"}`,
    `- 负责人：${task.receiverName ?? task.receiverId ?? "未指派"}`,
    "",
    "## 任务描述",
    ...(task.description === undefined || task.description.trim() === ""
      ? ["未填写描述"]
      : lines(task.description)),
    "",
    "## 验收标准",
    ...acceptance.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Worker 候选",
    ...candidateLines(
      input.candidates.filter((candidate) => candidate.available),
    ),
    "",
    "只能使用上面列出的 id 作为 `receiverId`。不要编造人员、Agent、角色或任务 ID。",
    "Router 不读取权限快照；节点有效权限由平台在确认和每次派发前按“项目权限范围 ∩ 任务负责人权限范围”计算。",
    "",
    "## 当前计划",
    ...currentPlanLines(input),
    "",
    "## 约束",
    `- 最大节点数：${input.constraints.maxNodes}`,
    `- 最大依赖深度：${input.constraints.maxDepth}`,
    `- 单节点最大出度：${input.constraints.maxFanOut}`,
    `- 最大并发：${input.constraints.maxConcurrency}`,
    "- 只支持无环 DAG 和 AND-join。",
    "- 人工审批、不可逆操作和最终验收不能被 Router 或 Worker 代签。",
    "- 只调整尚未执行或已安全停止的节点；不得覆盖已完成事实。",
    "",
    "## 规划规则",
    "1. 把任务拆成可独立负责、可独立验收的节点。",
    "2. 明确串行和并行关系，只使用 dependencies 表达硬依赖。",
    "3. 根据候选能力选择人类或 AI Worker；主任务负责人不是任何节点的权限继承源。",
    "4. 对需求不清、需要资料补充或高风险确认的环节，创建独立节点。",
    "5. 所有 `id` 使用稳定的 lower-kebab-case，且只能引用本计划内节点。",
    "6. 所有节点都必须有描述、至少一项验收标准、负责人和优先级。",
    "7. 所有节点必须属于同一个弱连通 DAG：允许并行起点，但每个节点都必须通过直接或间接下游最终汇入同一个终点；禁止孤立节点、独立决策门或与主链路无关的尾巴节点。",
    "",
    "## 输出契约",
    "必须调用 `router_worker_submit_plan` 工具提交 Plan Draft，不要只输出 Markdown 计划。",
    "工具参数中的 graph 必须符合以下结构：",
    PLAN_GRAPH_EXAMPLE,
    "",
    "如果 Validator 返回错误，只能根据错误修复同一份 Plan Draft，最多修复一次；不得绕过 Validator，不得确认、派发或完成计划。",
    "",
    "## Master Task 收口规则",
    ...ownerPolicy.map((line) => `- ${line}`),
  ].join("\n");
}
