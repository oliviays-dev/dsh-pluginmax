import { describe, expect, it } from "vitest";
import { canAccessWorkspace } from "./index.js";

const team = {
  resolveToken: () => undefined,
  users: () => [],
  members: (workspaceId: string) =>
    workspaceId === "workspace-demo"
      ? [{ userId: "zhouning", memberRole: "member" as const }]
      : [],
};

describe("task capture workspace access", () => {
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
