import type { PlanGraph, PlanNode, PlanSettings } from "./models.js";

export interface PlanValidationIssue {
  readonly level: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

function hasPath(
  graph: Map<string, PlanNode>,
  from: string,
  target: string,
  seen = new Set<string>(),
): boolean {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (graph.get(from)?.dependencies ?? []).some((dependency) =>
    hasPath(graph, dependency, target, seen),
  );
}

export function validatePlanGraph(
  graph: PlanGraph,
  settings: PlanSettings,
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  const byId = new Map<string, PlanNode>();
  for (const node of graph.nodes) {
    if (byId.has(node.id)) {
      issues.push({
        level: "error",
        code: "duplicate-node",
        message: `节点 ID 重复：${node.id}`,
        nodeId: node.id,
      });
      continue;
    }
    byId.set(node.id, node);
    if (node.receiverType !== "unassigned" && node.receiverId === undefined) {
      issues.push({
        level: "error",
        code: "missing-executor",
        message: `节点「${node.title}」缺少负责人`,
        nodeId: node.id,
      });
    }
    if (
      node.receiverType !== "unassigned" &&
      !settings.allowedWorkers.includes(node.receiverType)
    ) {
      issues.push({
        level: "error",
        code: "worker-type-disabled",
        message: `计划设置不允许 ${node.receiverType} 类型的 Worker`,
        nodeId: node.id,
      });
    }
    if (node.acceptance.length === 0 || node.description.trim() === "") {
      issues.push({
        level: "error",
        code: "incomplete-node",
        message: `节点「${node.title}」缺少描述或验收标准`,
        nodeId: node.id,
      });
    }
  }

  for (const node of graph.nodes) {
    for (const dependency of node.dependencies) {
      if (dependency === node.id) {
        issues.push({
          level: "error",
          code: "self-dependency",
          message: `节点「${node.title}」不能依赖自身`,
          nodeId: node.id,
        });
      } else if (!byId.has(dependency)) {
        issues.push({
          level: "error",
          code: "missing-dependency",
          message: `节点「${node.title}」引用了不存在的前置节点：${dependency}`,
          nodeId: node.id,
        });
      } else if (hasPath(byId, dependency, node.id)) {
        issues.push({
          level: "error",
          code: "cycle",
          message: `节点「${node.title}」形成循环依赖`,
          nodeId: node.id,
        });
      }
    }
  }

  const starts =
    graph.startNodeIds.length > 0
      ? graph.startNodeIds
      : graph.nodes
          .filter((node) => node.dependencies.length === 0)
          .map((node) => node.id);
  if (starts.length === 0) {
    issues.push({
      level: "error",
      code: "missing-start",
      message: "计划至少需要一个起始节点",
    });
  }
  for (const start of starts) {
    if (!byId.has(start)) {
      issues.push({
        level: "error",
        code: "missing-start",
        message: `起始节点不存在：${start}`,
      });
    }
  }

  const reachable = new Set(starts);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodes) {
      if (
        !reachable.has(node.id) &&
        node.dependencies.some((dependency) => reachable.has(dependency))
      ) {
        reachable.add(node.id);
        changed = true;
      }
    }
  }
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        level: "warning",
        code: "unreachable",
        message: `节点「${node.title}」无法从起始节点到达`,
        nodeId: node.id,
      });
    }
  }

  const undirected = new Map<string, Set<string>>(
    graph.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const node of graph.nodes) {
    for (const dependency of node.dependencies) {
      if (!byId.has(dependency)) continue;
      undirected.get(node.id)?.add(dependency);
      undirected.get(dependency)?.add(node.id);
    }
  }
  const components: string[][] = [];
  const visited = new Set<string>();
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const pending = [node.id];
    visited.add(node.id);
    while (pending.length > 0) {
      const current = pending.shift()!;
      component.push(current);
      for (const neighbor of undirected.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
    components.push(component);
  }
  if (components.length > 1) {
    issues.push({
      level: "error",
      code: "disconnected-graph",
      message: `计划包含 ${components.length} 个互不相连的分量；允许并行起点，但所有节点必须通过后续依赖汇入同一个 DAG`,
    });
  }
  return issues;
}
