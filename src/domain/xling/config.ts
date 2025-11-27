/**
 * Xling configuration types and validation
 * Unified provider configuration for both proxy and prompt services
 */

import { z } from "zod";

// ============================================================================
// Provider Configuration (Unified)
// ============================================================================

/**
 * Provider configuration type
 */
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiKeys?: string[];
  models: string[];
  priority?: number;
  timeout?: number;
  headers?: Record<string, string>;
  weight?: number;
}

/**
 * Unified provider configuration schema
 * Supports both single apiKey and multiple apiKeys for rotation
 */
export const ProviderConfigSchema: z.ZodType<ProviderConfig> = z
  .object({
    name: z
      .string()
      .min(1, "Provider name cannot be empty")
      .describe("Provider name (unique identifier)"),
    baseUrl: z
      .string()
      .url("Base URL must be a valid URL")
      .describe("API base URL"),
    apiKey: z
      .string()
      .optional()
      .describe("Single API key (use apiKey or apiKeys, not both)"),
    apiKeys: z
      .array(z.string().min(1))
      .optional()
      .describe("Multiple API keys for rotation"),
    models: z
      .array(z.string().min(1))
      .min(1, "Provider must support at least one model")
      .describe("List of supported models"),
    priority: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Provider priority (lower = higher priority)"),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Request timeout in milliseconds"),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Custom headers to include in requests"),
    weight: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Weight for weighted load balancing"),
  })
  .refine((data) => data.apiKey || (data.apiKeys && data.apiKeys.length > 0), {
    message: "Either apiKey or apiKeys must be provided",
  });

/**
 * Get all API keys from a provider config
 * Normalizes apiKey and apiKeys into a single array
 */
export function getProviderApiKeys(provider: ProviderConfig): string[] {
  if (provider.apiKeys && provider.apiKeys.length > 0) {
    return provider.apiKeys;
  }
  if (provider.apiKey) {
    return [provider.apiKey];
  }
  return [];
}

// ============================================================================
// Load Balancing
// ============================================================================

export type LoadBalanceStrategy =
  | "round-robin"
  | "random"
  | "weighted"
  | "failover";

export const LoadBalanceStrategySchema: z.ZodType<LoadBalanceStrategy> = z.enum(
  ["round-robin", "random", "weighted", "failover"],
);

// ============================================================================
// Proxy Configuration (Simplified)
// ============================================================================

export interface ProxyConfig {
  enabled?: boolean;
  port?: number;
  host?: string;
  accessKey?: string;
  loadBalance?: LoadBalanceStrategy;
  modelMapping?: Record<string, string>;
  keyRotation?: {
    enabled?: boolean;
    onError?: boolean;
    cooldownMs?: number;
  };
}

export const ProxyConfigSchema: z.ZodType<ProxyConfig> = z.object({
  enabled: z.boolean().default(true).describe("Enable proxy server"),
  port: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Proxy server port (default: 4320)"),
  host: z
    .string()
    .optional()
    .describe("Proxy server host (default: 127.0.0.1)"),
  accessKey: z
    .string()
    .optional()
    .describe("Access key for proxy authentication (optional)"),
  loadBalance: LoadBalanceStrategySchema.optional()
    .default("failover")
    .describe("Load balancing strategy"),
  modelMapping: z
    .record(z.string(), z.string())
    .optional()
    .describe("Map client model names to actual models (proxy only)"),
  keyRotation: z
    .object({
      enabled: z.boolean().default(true),
      onError: z.boolean().default(true),
      cooldownMs: z.number().int().positive().optional(),
    })
    .optional()
    .describe("API key rotation settings"),
});

// ============================================================================
// Retry Policy
// ============================================================================

export interface RetryPolicy {
  maxRetries?: number;
  backoffMs?: number;
}

export const RetryPolicySchema: z.ZodType<RetryPolicy> = z.object({
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe("Maximum number of retries"),
  backoffMs: z
    .number()
    .int()
    .positive()
    .default(1000)
    .describe("Initial backoff delay in milliseconds"),
});

// ============================================================================
// Shortcut Configuration
// ============================================================================

export interface PlatformCommand {
  win32?: string;
  darwin?: string;
  linux?: string;
  default: string;
}

export const PlatformCommandSchema: z.ZodType<PlatformCommand> = z.object({
  win32: z.string().min(1).optional(),
  darwin: z.string().min(1).optional(),
  linux: z.string().min(1).optional(),
  default: z.string().min(1),
});

export interface PlatformArgs {
  win32?: string[];
  darwin?: string[];
  linux?: string[];
  default: string[];
}

export const PlatformArgsSchema: z.ZodType<PlatformArgs> = z.object({
  win32: z.array(z.string()).optional(),
  darwin: z.array(z.string()).optional(),
  linux: z.array(z.string()).optional(),
  default: z.array(z.string()),
});

export interface PipelineStep {
  command: string | PlatformCommand;
  args?: string[] | PlatformArgs;
}

export const PipelineStepSchema: z.ZodType<PipelineStep> = z.object({
  command: z.union([z.string().min(1), PlatformCommandSchema]),
  args: z.union([z.array(z.string()), PlatformArgsSchema]).optional(),
});

export interface PlatformShell {
  win32?: string;
  darwin?: string;
  linux?: string;
  default: string;
}

export const PlatformShellSchema: z.ZodType<PlatformShell> = z.object({
  win32: z.string().min(1).optional(),
  darwin: z.string().min(1).optional(),
  linux: z.string().min(1).optional(),
  default: z.string().min(1),
});

export interface PlatformPipeline {
  win32?: PipelineStep[];
  darwin?: PipelineStep[];
  linux?: PipelineStep[];
  default: PipelineStep[];
}

export const PlatformPipelineSchema: z.ZodType<PlatformPipeline> = z.object({
  win32: z.array(PipelineStepSchema).min(1).optional(),
  darwin: z.array(PipelineStepSchema).min(1).optional(),
  linux: z.array(PipelineStepSchema).min(1).optional(),
  default: z.array(PipelineStepSchema).min(1),
});

export type ShortcutConfig = {
  command?: string;
  args?: string[];
  shell?: string | PlatformShell;
  pipeline?: PipelineStep[] | PlatformPipeline;
  description?: string;
};

export const ShortcutConfigSchema: z.ZodType<ShortcutConfig> = z
  .object({
    command: z.string().min(1).optional(),
    args: z.array(z.string()).optional(),
    shell: z.union([z.string().min(1), PlatformShellSchema]).optional(),
    pipeline: z
      .union([z.array(PipelineStepSchema).min(1), PlatformPipelineSchema])
      .optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      const count = [data.command, data.shell, data.pipeline].filter(
        Boolean,
      ).length;
      return count === 1;
    },
    {
      message:
        "Exactly one of 'command', 'shell', or 'pipeline' must be specified",
    },
  )
  .refine((data) => !(data.args && (data.shell || data.pipeline)), {
    message: "'args' can only be used with 'command'",
  });

// ============================================================================
// Main Xling Configuration (Simplified)
// ============================================================================

/**
 * Simplified Xling configuration
 * - providers: Unified provider list (shared by proxy and prompt)
 * - defaultModel: Default model for all services
 * - proxy: Proxy-specific settings (port, accessKey, modelMapping, etc.)
 * - retryPolicy: Retry settings for prompt service
 * - shortcuts: Command shortcuts
 */
export interface XlingConfig {
  providers: ProviderConfig[];
  defaultModel?: string;
  proxy?: ProxyConfig;
  retryPolicy?: RetryPolicy;
  shortcuts?: Record<string, ShortcutConfig>;
}

export const XlingConfigSchema: z.ZodType<XlingConfig> = z.object({
  providers: z
    .array(ProviderConfigSchema)
    .min(1, "At least one provider must be configured")
    .refine(
      (providers) => {
        const names = providers.map((p) => p.name);
        return names.length === new Set(names).size;
      },
      { message: "Provider names must be unique" },
    ),
  defaultModel: z.string().optional(),
  proxy: ProxyConfigSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
  shortcuts: z.record(z.string(), ShortcutConfigSchema).optional(),
});

// ============================================================================
// Migration and Validation
// ============================================================================

/**
 * Validate and parse Xling configuration
 * Automatically migrates old format to new format
 */
export function validateXlingConfig(data: unknown): XlingConfig {
  if (typeof data !== "object" || data === null) {
    return XlingConfigSchema.parse(data);
  }

  const config = data as Record<string, unknown>;

  // Migration: Old format with prompt.providers
  if (
    "prompt" in config &&
    typeof config.prompt === "object" &&
    config.prompt !== null
  ) {
    const prompt = config.prompt as Record<string, unknown>;
    const proxy = config.proxy as Record<string, unknown> | undefined;

    // Merge providers from prompt and proxy
    const promptProviders = (prompt.providers as ProviderConfig[]) || [];
    const proxyProviders = (proxy?.providers as ProviderConfig[]) || [];

    // Use proxy providers if available (they have apiKeys), otherwise use prompt providers
    const providers =
      proxyProviders.length > 0 ? proxyProviders : promptProviders;

    // Normalize apiKey/apiKeys to always have apiKeys when a single key is provided
    const normalizedProviders: ProviderConfig[] = providers.map((provider) => {
      if (provider.apiKeys && provider.apiKeys.length > 0) {
        return provider;
      }

      if (provider.apiKey) {
        return { ...provider, apiKeys: [provider.apiKey] };
      }

      return provider;
    });

    const migratedConfig: XlingConfig = {
      providers: normalizedProviders,
      defaultModel:
        (prompt.defaultModel as string) || (proxy?.defaultModel as string),
      proxy: proxy
        ? {
            enabled: (proxy.enabled as boolean) ?? true,
            port: proxy.port as number | undefined,
            host: proxy.host as string | undefined,
            accessKey: proxy.accessKey as string | undefined,
            loadBalance: proxy.loadBalance as LoadBalanceStrategy | undefined,
            modelMapping: proxy.modelMapping as
              | Record<string, string>
              | undefined,
            keyRotation: proxy.keyRotation as ProxyConfig["keyRotation"],
          }
        : undefined,
      retryPolicy: prompt.retryPolicy as RetryPolicy | undefined,
      shortcuts: config.shortcuts as Record<string, ShortcutConfig> | undefined,
    };

    return XlingConfigSchema.parse(migratedConfig);
  }

  // Already in new format
  return XlingConfigSchema.parse(data);
}

/**
 * Get normalized priority (undefined becomes MAX_SAFE_INTEGER)
 */
export function getNormalizedPriority(priority?: number): number {
  return priority ?? Number.MAX_SAFE_INTEGER;
}

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

/** @deprecated Use ProviderConfig instead */
export type ProxyProviderConfig = ProviderConfig;

/** @deprecated Use XlingConfig.providers instead */
export interface PromptConfig {
  providers: ProviderConfig[];
  defaultModel?: string;
  retryPolicy?: RetryPolicy;
}
