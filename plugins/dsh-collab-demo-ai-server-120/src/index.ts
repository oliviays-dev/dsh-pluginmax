import type {
  McpProviderRegistry,
  McpToolProvider,
} from "dsh-collab-resource-market";
import { PLUGIN_ID } from "./models.js";
import { AiServer120McpProvider } from "./provider.js";

export const name = PLUGIN_ID;
export const inject = [];

interface ProviderRegistryContext {
  readonly collabMcpProviderRegistry?: McpProviderRegistry | undefined;
}

interface PluginContext {
  inject?:
    | ((
        services: string[],
        callback: (child: ProviderRegistryContext) => void,
      ) => { dispose(): void })
    | undefined;
  effect(effect: () => () => void): void;
}

export async function apply(ctx: PluginContext): Promise<void> {
  const provider = await AiServer120McpProvider.create();
  let disposeRegistryProvider: (() => void) | undefined;
  const registryFiber = ctx.inject?.(
    ["collabMcpProviderRegistry"],
    (child) => {
      const registry = child.collabMcpProviderRegistry;
      if (registry === undefined) return;
      disposeRegistryProvider = registry.register(provider as McpToolProvider);
    },
  );
  ctx.effect(() => () => {
    disposeRegistryProvider?.();
    registryFiber?.dispose();
    void provider.dispose();
  });
}
