import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpProviderRegistry } from "dsh-collab-resource-market";
import { AiServer120McpProvider } from "./provider.js";

const expectedAssetIds = [
  "mcp-mock-oms-ai-server-120",
  "mcp-mock-srm-ai-server-120",
  "mcp-mock-aps-planning-ai-server-120",
  "mcp-mock-mes-ai-server-120",
  "mcp-mock-wms-ai-server-120",
  "mcp-mock-qms-ai-server-120",
] as const;

describe("AI Server 120 mock MCP provider", () => {
  let provider: AiServer120McpProvider;

  beforeAll(async () => {
    provider = await AiServer120McpProvider.create();
  });

  afterAll(async () => {
    await provider.dispose();
  });

  it("lists six read-only mock MCP assets", async () => {
    const assets = await provider.list({ userId: "case-owner" });
    expect(assets.map((asset) => asset.id)).toEqual(expectedAssetIds);
    expect(assets.every((asset) => asset.protocol === "MCP · stdio")).toBe(true);
    expect(assets.every((asset) => asset.initialStatus === "off")).toBe(true);
  });

  it("connects and calls a tool on every asset", async () => {
    for (const asset of await provider.list({ userId: "case-owner" })) {
      const connected = await provider.connect(
        { userId: "case-owner" },
        asset.id,
      );
      expect(connected.status).toBe("connected");
      const result = await provider.callTool({
        userId: "case-owner",
        mcpId: asset.id,
        toolName:
          asset.id === "mcp-mock-oms-ai-server-120"
            ? "oms.getCommercialRisk"
            : asset.id === "mcp-mock-srm-ai-server-120"
              ? "srm.getGpuSupplyCommitment"
              : asset.id === "mcp-mock-aps-planning-ai-server-120"
                ? "planning.simulateFulfillmentOptions"
                : asset.id === "mcp-mock-mes-ai-server-120"
                  ? "mes.getEfficiencyImpact"
                  : asset.id === "mcp-mock-wms-ai-server-120"
                    ? "wms.getAirFreightQuote"
                    : "qms.getScenarioReleasePlan",
        arguments: {},
      });
      expect(result).toMatchObject({
        ok: true,
        source: {
          isMock: true,
          readOnly: true,
        },
      });
    }
  }, 20_000);

  it("rejects calls before connection", async () => {
    await expect(
      provider.callTool({
        userId: "not-connected",
        mcpId: "mcp-mock-oms-ai-server-120",
        toolName: "oms.getOrderSnapshot",
        arguments: {},
      }),
    ).rejects.toThrow(/not connected/);
  });

  it("is routable through the shared MCP provider registry", async () => {
    const registry = new McpProviderRegistry();
    const dispose = registry.register(provider);
    try {
      const assets = await registry.list({ userId: "registry-user" });
      expect(assets.map((asset) => asset.id)).toEqual(expectedAssetIds);
      expect(
        await registry.connect(
          { userId: "registry-user" },
          "mcp-mock-oms-ai-server-120",
        ),
      ).toEqual({ status: "connected" });
      await expect(
        registry.callTool({
          userId: "registry-user",
          mcpId: "mcp-mock-oms-ai-server-120",
          toolName: "oms.getCommercialRisk",
          arguments: {},
        }),
      ).resolves.toMatchObject({
        ok: true,
        data: {
          commercialRiskIfBelowMinimum: 15,
        },
      });
    } finally {
      dispose();
    }
  });
});
