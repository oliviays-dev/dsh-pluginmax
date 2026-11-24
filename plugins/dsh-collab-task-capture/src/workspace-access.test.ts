import { describe, expect, it } from "vitest";
import { canAccessWorkspace, projectSelectionTitle } from "./index.js";

const team = {
  resolveToken: () => undefined,
  users: () => [],
  members: (workspaceId: string) =>
    workspaceId === "workspace-demo"
      ? [{ userId: "zhouning", memberRole: "member" as const }]
      : [],
};

describe("task capture workspace access", () => {
  it("turns selected project text into a concise task title", () => {
    expect(
      projectSelectionTitle(
        "- GPU 到货延迟，预计影响 6 台。请采购专员今天确认替代供应方案。",
      ),
    ).toBe("GPU 到货延迟，预计影响 6 台");
    expect(projectSelectionTitle("")).toBe("跟进项目中的选中事项");
  });

  it("allows any authenticated user to use the virtual default project", () => {
    expect(
      canAccessWorkspace(
        team,
        { userId: "zhouning", role: "member" },
        "system.default",
      ),
    ).toBe(true);
  });

  it("keeps real workspace access membership-scoped", () => {
    expect(
      canAccessWorkspace(
        team,
        { userId: "zhouning", role: "member" },
        "workspace-demo",
      ),
    ).toBe(true);
    expect(
      canAccessWorkspace(
        team,
        { userId: "zhouning", role: "member" },
        "workspace-other",
      ),
    ).toBe(false);
    expect(
      canAccessWorkspace(
        team,
        { userId: "admin", role: "admin" },
        "workspace-other",
      ),
    ).toBe(true);
  });
});
