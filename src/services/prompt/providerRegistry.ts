/**
 * Provider Registry
 * Manages provider lookup and routing logic
 */

import type { XlingConfig, ProviderConfig } from "@/domain/xling/config.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";
import { getNormalizedPriority } from "@/domain/xling/config.ts";

const BUILTIN_TOOL_PROVIDERS: ProviderConfig[] = [
  {
    name: "tool-claude-code",
    baseUrl: "cli:claude",
    apiKey: "",
    models: ["claude-code"],
    priority: 999,
    timeout: 60000,
  },
  {
    name: "tool-codex",
    baseUrl: "cli:codex",
    apiKey: "",
    models: ["codex"],
    priority: 999,
    timeout: 60000,
  },
  {
    name: "tool-gemini-cli",
    baseUrl: "cli:gemini",
    apiKey: "",
    models: ["gemini-cli"],
    priority: 999,
    timeout: 60000,
  },
];

/**
 * Registry for managing AI providers and model routing
 *
 * Responsibilities:
 * - Load and cache configuration
 * - Sort providers by priority
 * - Index models for quick lookup
 * - Provide routing API for model requests
 */
export class ProviderRegistry {
  #providers: ProviderConfig[];
  #modelIndex: Map<string, ProviderConfig[]>;
  #defaultModel?: string;

  constructor(config: XlingConfig) {
    this.#providers = this.#sortByPriority(
      mergeWithBuiltinProviders(config.prompt.providers),
    );
    this.#defaultModel = config.prompt.defaultModel;
    this.#modelIndex = this.#buildModelIndex();
  }

  /**
   * Sort providers by priority (lower number = higher priority)
   * Undefined priority is treated as lowest priority
   */
  #sortByPriority(providers: ProviderConfig[]): ProviderConfig[] {
    return [...providers].sort((a, b) => {
      const priorityA = getNormalizedPriority(a.priority);
      const priorityB = getNormalizedPriority(b.priority);
      return priorityA - priorityB;
    });
  }

  /**
   * Build model index: model name -> [providers that support it]
   * Providers are already sorted by priority
   */
  #buildModelIndex(): Map<string, ProviderConfig[]> {
    const index = new Map<string, ProviderConfig[]>();

    for (const provider of this.#providers) {
      for (const model of provider.models) {
        if (!index.has(model)) {
          index.set(model, []);
        }
        index.get(model)!.push(provider);
      }
    }

    return index;
  }

  /**
   * Get all providers that support a specific model, sorted by priority
   * Returns empty array if model is not supported
   */
  getProvidersForModel(modelId: string): ProviderConfig[] {
    return this.#modelIndex.get(modelId) || [];
  }

  /**
   * Get all available models across all providers
   */
  getAllModels(): string[] {
    return Array.from(this.#modelIndex.keys()).sort();
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): ProviderConfig[] {
    return [...this.#providers];
  }

  /**
   * Get provider by name
   */
  getProviderByName(name: string): ProviderConfig | undefined {
    return this.#providers.find((p) => p.name === name);
  }

  /**
   * Get default model
   */
  getDefaultModel(): string | undefined {
    return this.#defaultModel;
  }

  /**
   * Check if a model is supported by any provider
   */
  isModelSupported(modelId: string): boolean {
    return this.#modelIndex.has(modelId);
  }

  /**
   * Get statistics about the registry
   */
  getStats(): {
    providerCount: number;
    modelCount: number;
    defaultModel?: string;
  } {
    return {
      providerCount: this.#providers.length,
      modelCount: this.#modelIndex.size,
      defaultModel: this.#defaultModel,
    };
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<void> {
    const adapter = new XlingAdapter();
    const config = adapter.readConfig(adapter.resolvePath("user"));

    this.#providers = this.#sortByPriority(
      mergeWithBuiltinProviders(config.prompt.providers),
    );
    this.#defaultModel = config.prompt.defaultModel;
    this.#modelIndex = this.#buildModelIndex();
  }

  /**
   * Factory method to create registry from configuration file
   */
  static async fromConfig(): Promise<ProviderRegistry> {
    const adapter = new XlingAdapter();
    const config = adapter.readConfig(adapter.resolvePath("user"));
    return new ProviderRegistry(config);
  }

  /**
   * Get providers for a model, with fallback to default model if specified model is not found
   */
  getProvidersWithFallback(
    modelId?: string,
  ): { model: string; providers: ProviderConfig[] } | null {
    // Try requested model first
    if (modelId) {
      const providers = this.getProvidersForModel(modelId);
      if (providers.length > 0) {
        return { model: modelId, providers };
      }
    }

    // Try default model
    if (this.#defaultModel) {
      const providers = this.getProvidersForModel(this.#defaultModel);
      if (providers.length > 0) {
        return { model: this.#defaultModel, providers };
      }
    }

    return null;
  }
}

/**
 * Singleton instance for global access
 * Lazy-loaded on first access
 */
let registryInstance: ProviderRegistry | null = null;

/**
 * Get the global registry instance
 * Creates it if it doesn't exist
 */
export async function getRegistry(): Promise<ProviderRegistry> {
  if (!registryInstance) {
    registryInstance = await ProviderRegistry.fromConfig();
  }
  return registryInstance;
}

/**
 * Reset the global registry instance
 * Useful for testing or forcing a reload
 */
export function resetRegistry(): void {
  registryInstance = null;
}

function mergeWithBuiltinProviders(
  providers: ProviderConfig[],
): ProviderConfig[] {
  const names = new Set(providers.map((p) => p.name));
  const extras = BUILTIN_TOOL_PROVIDERS.filter((p) => !names.has(p.name));
  return [...providers, ...extras];
}
