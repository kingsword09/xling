/**
 * Xling prompt configuration types and validation
 */

import { z } from "zod";

/**
 * Provider configuration schema
 */
export const ProviderConfigSchema: z.ZodType<{
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  priority?: number;
  timeout?: number;
  headers?: Record<string, string>;
}> = z.object({
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
    .min(1, "API key cannot be empty")
    .describe("API authentication key"),
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
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Retry policy schema
 */
export const RetryPolicySchema: z.ZodType<{
  maxRetries: number;
  backoffMs: number;
}> = z.object({
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
    .describe("Initial backoff delay in milliseconds (exponential)"),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Prompt configuration schema (AI-related settings)
 */
export const PromptConfigSchema: z.ZodType<{
  providers: Array<{
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    priority?: number;
    timeout?: number;
    headers?: Record<string, string>;
  }>;
  defaultModel?: string;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}> = z.object({
  providers: z
    .array(ProviderConfigSchema)
    .min(1, "At least one provider must be configured")
    .refine(
      (providers) => {
        const names = providers.map((p) => p.name);
        return names.length === new Set(names).size;
      },
      {
        message: "Provider names must be unique",
      },
    )
    .describe("List of API providers"),
  defaultModel: z
    .string()
    .optional()
    .describe("Default model to use when not specified"),
  retryPolicy: RetryPolicySchema.optional().describe(
    "Retry policy for failed requests",
  ),
});

export type PromptConfig = z.infer<typeof PromptConfigSchema>;

/**
 * Pipeline step schema
 */
export const PipelineStepSchema: z.ZodType<{
  command: string;
  args?: string[];
}> = z.object({
  command: z.string().min(1, "Command cannot be empty"),
  args: z.array(z.string()).optional(),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

/**
 * Shortcut configuration schema
 * Supports three types:
 * 1. Command: Execute xling command with args
 * 2. Shell: Execute arbitrary shell command
 * 3. Pipeline: Execute a series of commands with piped output
 */
export const ShortcutConfigSchema: z.ZodType<{
  command?: string;
  args?: string[];
  shell?: string;
  pipeline?: Array<{ command: string; args?: string[] }>;
  description?: string;
}> = z
  .object({
    command: z.string().min(1).optional().describe("Xling command to execute"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    shell: z.string().min(1).optional().describe("Shell command to execute"),
    pipeline: z
      .array(PipelineStepSchema)
      .min(1)
      .optional()
      .describe("Pipeline of commands to execute"),
    description: z.string().optional().describe("Human-readable description"),
  })
  .refine(
    (data) => {
      // Exactly one of: command, shell, or pipeline must be specified
      const hasCommand = !!data.command;
      const hasShell = !!data.shell;
      const hasPipeline = !!data.pipeline;
      const count = [hasCommand, hasShell, hasPipeline].filter(Boolean).length;
      return count === 1;
    },
    {
      message:
        "Exactly one of 'command', 'shell', or 'pipeline' must be specified",
    },
  )
  .refine(
    (data) => {
      // If command is specified, args can be used
      // If shell or pipeline is specified, args should not be used
      if (data.args && (data.shell || data.pipeline)) {
        return false;
      }
      return true;
    },
    {
      message:
        "'args' can only be used with 'command', not with 'shell' or 'pipeline'",
    },
  );

export type ShortcutConfig = z.infer<typeof ShortcutConfigSchema>;

/**
 * Xling configuration schema
 */
export const XlingConfigSchema: z.ZodType<{
  prompt: {
    providers: Array<{
      name: string;
      baseUrl: string;
      apiKey: string;
      models: string[];
      priority?: number;
      timeout?: number;
      headers?: Record<string, string>;
    }>;
    defaultModel?: string;
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };
  shortcuts?: Record<
    string,
    {
      command?: string;
      args?: string[];
      shell?: string;
      pipeline?: Array<{ command: string; args?: string[] }>;
      description?: string;
    }
  >;
}> = z.object({
  prompt: PromptConfigSchema.describe("AI prompt configuration"),
  shortcuts: z
    .record(z.string(), ShortcutConfigSchema)
    .optional()
    .describe("Command shortcuts/aliases"),
});

export type XlingConfig = z.infer<typeof XlingConfigSchema>;

/**
 * Validate and parse Xling configuration
 * Automatically migrates old format to new format
 */
export function validateXlingConfig(data: unknown): XlingConfig {
  // Check if data is an object
  if (typeof data !== "object" || data === null) {
    return XlingConfigSchema.parse(data);
  }

  const config = data as Record<string, unknown>;

  // Auto-migrate old format to new format
  // Old format: { providers, defaultModel, retryPolicy, shortcuts }
  // New format: { prompt: { providers, defaultModel, retryPolicy }, shortcuts }
  if ("providers" in config && !("prompt" in config)) {
    const migratedConfig = {
      prompt: {
        providers: config.providers,
        defaultModel: config.defaultModel,
        retryPolicy: config.retryPolicy,
      },
      shortcuts: config.shortcuts,
    };
    return XlingConfigSchema.parse(migratedConfig);
  }

  // Already in new format
  return XlingConfigSchema.parse(data);
}

/**
 * Validate provider models uniqueness within the array
 */
export function validateProviderModels(
  provider: ProviderConfig,
): string[] | null {
  const uniqueModels = new Set(provider.models);
  if (uniqueModels.size !== provider.models.length) {
    const duplicates = provider.models.filter(
      (model: string, index: number) =>
        provider.models.indexOf(model) !== index,
    );
    return duplicates;
  }
  return null;
}

/**
 * Get normalized priority (undefined becomes MAX_SAFE_INTEGER)
 */
export function getNormalizedPriority(priority?: number): number {
  return priority ?? Number.MAX_SAFE_INTEGER;
}
