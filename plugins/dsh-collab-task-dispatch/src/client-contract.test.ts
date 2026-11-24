import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("task dispatch client contract", () => {
  it("registers the task dispatch slot", () => {
    const source = readFileSync(join(root, "client/index.js"), "utf8");
    expect(source).toContain('"pluginmax.task.dispatch-view"');
    expect(source).toContain("/api/collab/tasks/dispatch/assignees");
    expect(source).toContain("/api/collab/tasks/dispatch/candidates");
    expect(source).toContain("/api/collab/tasks/dispatch/reassign");
    expect(source).toContain("/api/collab/tasks/dispatch/execute");
    expect(source).toContain("/api/collab/tasks/dispatch/validate");
    expect(source).toContain("/api/collab/tasks/dispatch/commit");
    expect(source).toContain("/api/collab/tasks/dispatch/reassign");
    expect(source).toContain("应用已选建议");
    expect(source).toContain("确认批量入队");
    expect(source).toContain("width:240px");
    expect(source).toContain("overflow-x:auto");
    expect(source).toContain("创建人：");
    expect(source).toContain("Asia/Shanghai");
    expect(source).toContain("承接成员");
    expect(source).toContain("人类员工");
    expect(source).toContain('["agent", "AI伙伴"]');
    expect(source).toContain('task.receiverType === "unassigned"');
    expect(source).toContain("pmd-lane-plan assigned");
    expect(source).toContain("pmd-human-avatar");
    expect(source).toContain("pmd-running-spinner");
    expect(source).toContain("drop-before");
    expect(source).toContain("drop-after");
    expect(source).toContain("data-lane-task-id");
    expect(source).toContain("laneDropTargetAt");
    expect(source).toContain("handleLaneDrop");
    expect(source).toContain("focusedLaneTask");
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("just-added");
    expect(source).toContain('selectedCandidate.kind === "human"');
    expect(source).toContain("人工承接");
    expect(source).toContain("项目参与、执行可用性与队列负载均满足。");
    expect(source).toContain("shelfTasks");
    expect(source).toContain("待派发任务已全部排入成员车道");
    expect(source).toContain("pmd-task-detail");
    expect(source).toContain("inspectAssignedTask");
    expect(source).toContain("pmd-lane-summary");
    expect(source).toContain("总计 ");
    expect(source).toContain("确认派发");
    expect(source).toContain("移出车道，改为待指派");
    expect(source).toContain("确认改派进行中的任务");
    expect(source).toContain("改派可能造成的影响");
    expect(source).toContain("改派前建议完成");
    expect(source).toContain("勾选全部");
    expect(source).toContain("已勾选");
    expect(source).toContain("pmd-task-desc");
    expect(source).not.toContain("pmd-task-expand");
    expect(source).toContain("pmd-task-id");
    expect(source).toContain("创建人：");
    expect(source).toContain("3000");
    expect(source).toContain("pmd-status-close");
    expect(source).toContain('change.task.status === "progress"');
    expect(source).toContain('modeRef.current === "dispatch"');
    expect(source).toContain("selected.length === pendingDispatchTasks.length");
    expect(source).toContain("border-style:dashed");
  });

  it("keeps the task page integration admin-gated and additive", () => {
    const source = readFileSync(
      join(root, "../dsh-collab-task/client/index.js"),
      "utf8",
    );
    expect(source).toContain("pluginmax:task-dispatch-ready");
    expect(source).toContain('"pluginmax.task.dispatch-view"');
    expect(source).toContain('currentUser?.role === "admin"');
    expect(source).toContain('taskView === "dispatch"');
  });
});
