import type {
  MarketPrincipal,
  McpCatalogProvider,
  McpProviderAsset,
} from "./service.js";

export interface McpToolCallInput {
  readonly userId: string;
  readonly mcpId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface McpToolProvider extends McpCatalogProvider {
  callTool(input: McpToolCallInput): Promise<Record<string, unknown>>;
  dispose?(): Promise<void> | void;
}

export type McpRegistryErrorCode =
  | "conflict"
  | "not_found"
  | "unavailable";

export class McpRegistryError extends Error {
  constructor(
    readonly code: McpRegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "McpRegistryError";
  }
}

interface RegisteredProvider {
  readonly provider: McpCatalogProvider;
}

/**
 * Routes MCP assets by public asset id. Providers own transport and
 * connection semantics; the registry only owns lifecycle and dispatch.
 */
export class McpProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();
  private disposed = false;

  get size(): number {
    return this.providers.size;
  }

  register(provider: McpCatalogProvider): () => void {
    if (this.disposed) {
      throw new McpRegistryError(
        "unavailable",
        "MCP provider registry is disposed",
      );
    }
    const id = provider.id.trim();
    if (id === "") {
      throw new McpRegistryError(
        "conflict",
        "MCP provider id must not be empty",
      );
    }
    if (this.providers.has(id)) {
      throw new McpRegistryError(
        "conflict",
        `MCP provider is already registered: ${id}`,
      );
    }
    const entry = { provider };
    this.providers.set(id, entry);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.providers.get(id) !== entry) return;
      this.providers.delete(id);
      void this.disposeProvider(provider);
    };
  }

  async list(principal: MarketPrincipal): Promise<readonly McpProviderAsset[]> {
    const assets = new Map<string, McpProviderAsset>();
    for (const { provider } of this.providers.values()) {
      let catalog: readonly McpProviderAsset[];
      try {
        catalog = await provider.list(principal);
      } catch (cause) {
        throw new McpRegistryError(
          "unavailable",
          cause instanceof Error
            ? `MCP provider ${provider.id} list failed: ${cause.message}`
            : `MCP provider ${provider.id} list failed`,
        );
      }
      for (const asset of catalog) {
        if (assets.has(asset.id)) {
          throw new McpRegistryError(
            "conflict",
            `MCP asset id is registered more than once: ${asset.id}`,
          );
        }
        assets.set(asset.id, asset);
      }
    }
    return [...assets.values()];
  }

  async connect(
    principal: MarketPrincipal,
    mcpId: string,
  ): Promise<{ status: "pending" | "connected" }> {
    const provider = await this.resolve(principal, mcpId);
    if (provider.connect === undefined) {
      return { status: "pending" };
    }
    try {
      return await provider.connect(principal, mcpId);
    } catch (cause) {
      throw new McpRegistryError(
        "unavailable",
        cause instanceof Error
          ? `MCP connect failed: ${cause.message}`
          : "MCP connect failed",
      );
    }
  }

  async callTool(
    input: McpToolCallInput,
  ): Promise<Record<string, unknown>> {
    const provider = await this.resolve(
      { userId: input.userId },
      input.mcpId,
    );
    if (!("callTool" in provider) || typeof provider.callTool !== "function") {
      throw new McpRegistryError(
        "unavailable",
        `MCP asset does not expose tool calls: ${input.mcpId}`,
      );
    }
    try {
      return await (
        provider as McpToolProvider
      ).callTool({
        userId: input.userId,
        mcpId: input.mcpId,
        toolName: input.toolName,
        arguments: input.arguments,
      });
    } catch (cause) {
      if (cause instanceof McpRegistryError) throw cause;
      throw new McpRegistryError(
        "unavailable",
        cause instanceof Error ? cause.message : "MCP tool call failed",
      );
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const providers = [...this.providers.values()];
    this.providers.clear();
    await Promise.all(
      providers.map(({ provider }) => this.disposeProvider(provider)),
    );
  }

  private async resolve(
    principal: MarketPrincipal,
    mcpId: string,
  ): Promise<McpCatalogProvider> {
    if (this.disposed) {
      throw new McpRegistryError(
        "unavailable",
        "MCP provider registry is disposed",
      );
    }
    const matches: McpCatalogProvider[] = [];
    for (const { provider } of this.providers.values()) {
      let catalog: readonly McpProviderAsset[];
      try {
        catalog = await provider.list(principal);
      } catch (cause) {
        throw new McpRegistryError(
          "unavailable",
          cause instanceof Error
            ? `MCP provider ${provider.id} list failed: ${cause.message}`
            : `MCP provider ${provider.id} list failed`,
        );
      }
      if (catalog.some((asset) => asset.id === mcpId)) {
        matches.push(provider);
      }
    }
    if (matches.length === 0) {
      throw new McpRegistryError("not_found", `MCP asset not found: ${mcpId}`);
    }
    if (matches.length > 1) {
      throw new McpRegistryError(
        "conflict",
        `MCP asset has ambiguous providers: ${mcpId}`,
      );
    }
    return matches[0]!;
  }

  private async disposeProvider(provider: McpCatalogProvider): Promise<void> {
    if (
      "dispose" in provider &&
      typeof (provider as McpToolProvider).dispose === "function"
    ) {
      await Promise.resolve((provider as McpToolProvider).dispose?.()).catch(
        () => undefined,
      );
    }
  }
}
