import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ORDER_CONNECTOR_MANIFEST } from "./models.js";

const root = resolve(import.meta.dirname, "..");

describe("order domain configuration contracts", () => {
  it("keeps the shipped manifest synchronized with the connector contract", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, "config/order-connector.manifest.json"),
        "utf8",
      ),
    );
    expect(manifest).toEqual(ORDER_CONNECTOR_MANIFEST);
    expect(manifest).toMatchObject({
      readOnly: true,
      supports: { rawSql: false, writes: false },
    });
  });

  it("publishes runtime, template, AI partner, policy and demo boundaries", () => {
    const config = readFileSync(
      resolve(root, "config/order-domain.yaml"),
      "utf8",
    );
    expect(config).toContain("runtimeProfile:");
    expect(config).toContain("resourceMarket:");
    expect(config).toContain("mcp-orders-mock");
    expect(config).toContain("orders_query");
    expect(config).toContain("dataConnectionScopes:");
    expect(config).toContain("template:");
    expect(config).toContain("skill.order-exception-analysis");
    expect(config).toContain("aiPartner:");
    expect(config).toContain("order_exception_rate");
    expect(config).toContain("env:ORDERS_READONLY_ENDPOINT");
    expect(config).toContain("datasetIsFixture: true");
    expect(config).toContain("demo:orders-demo-v1");
  });

  it("implements the resource-market MCP tool provider contract", () => {
    const provider = readFileSync(resolve(root, "src/mcp.ts"), "utf8");
    expect(provider).toContain("implements McpToolProvider");
    expect(provider).toContain("async connect(");
    expect(provider).toContain('method: "tools/call"');
    expect(provider).toContain(
      "order MCP is not connected in the resource market",
    );
    const server = readFileSync(
      resolve(root, "mock/order-mcp-server.mjs"),
      "utf8",
    );
    expect(server).toContain('"orders_health"');
    expect(server).toContain('"orders_query"');
    expect(server).not.toContain("orders_write");
    expect(server).not.toContain("orders_delete");
    expect(server).not.toContain("rawSql");
  });

  it("shows explicit demo/production status without a SQL editor or write path", () => {
    const client = readFileSync(resolve(root, "client/index.js"), "utf8");
    expect(client).toContain("演示数据 · 非生产");
    expect(client).toContain("生产凭据只保存环境引用");
    expect(client).toContain('exports.inject = ["slots"]');
    expect(client).toContain('ctx.slots.inject("settings.section"');
    expect(client).not.toContain("execute SQL");
    expect(client).not.toContain("writeDatabase");
    expect(client).not.toContain("method: \"POST\"");
  });
});
