import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");
const SERVER = resolve(import.meta.dirname, "./index.ts");

describe("Data Fabric client contract", () => {
  it("registers a Data Fabric diagnostics section", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain('ctx.slots.inject("settings.section"');
    expect(source).toContain('id: "pluginmax-data-fabric"');
    expect(source).toContain("Data Fabric");
    expect(source).toContain(
      "/api/collab/data-fabric/bootstrap?workspaceId=",
    );
  });

  it("exposes catalog, query runs and fixture-only status", () => {
    const source = readFileSync(CLIENT, "utf8");
    expect(source).toContain("可发现数据集");
    expect(source).toContain("最近查询");
    expect(source).toContain("Fixture Connector");
    expect(source).toContain("queryRuns");
    expect(source).toContain("dataset.metrics");
  });

  it("registers permission-aware server routes", () => {
    const source = readFileSync(SERVER, "utf8");
    expect(source).toContain('"/api/collab/data-fabric/bootstrap"');
    expect(source).toContain('"/api/collab/data-fabric/catalog"');
    expect(source).toContain('"/api/collab/data-fabric/query/explain"');
    expect(source).toContain('"/api/collab/data-fabric/query"');
    expect(source).toContain("actorFor(");
    expect(source).toContain("sameOrigin");
  });
});
