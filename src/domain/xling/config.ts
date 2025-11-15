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
 * Platform-specific command/args schema for pipeline steps
 */
export const PlatformCommandSchema: z.ZodType<{
  win32?: string;
  darwin?: string;
  linux?: string;
  default: string;
}> = z.object({
  win32: z.string().min(1).optional().describe("Windows-specific command"),
  darwin: z.string().min(1).optional().describe("macOS-specific command"),
  linux: z.string().min(1).optional().describe("Linux-specific command"),
  default: z.string().min(1).describe("Default command for all platforms"),
});

export type PlatformCommand = z.infer<typeof PlatformCommandSchema>;

/**
 * Platform-specific args schema for pipeline steps
 */
export const PlatformArgsSchema: z.ZodType<{
  win32?: string[];
  darwin?: string[];
  linux?: string[];
  default: string[];
}> = z.object({
  win32: z.array(z.string()).optional().describe("Windows-specific args"),
  darwin: z.array(z.string()).optional().describe("macOS-specific args"),
  linux: z.array(z.string()).optional().describe("Linux-specific args"),
  default: z.array(z.string()).describe("Default args for all platforms"),
});

export type PlatformArgs = z.infer<typeof PlatformArgsSchema>;

/**
 * Pipeline step schema
 * Supports both simple and platform-specific command/args
 */
export const PipelineStepSchema: z.ZodType<{
  command: string | PlatformCommand;
  args?: string[] | PlatformArgs;
}> = z.object({
  command: z
    .union([z.string().min(1), PlatformCommandSchema])
    .describe("Command to execute (string or platform-specific object)"),
  args: z
    .union([z.array(z.string()), PlatformArgsSchema])
    .optional()
    .describe("Command arguments (array or platform-specific object)"),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

/**
 * Platform-specific shell command schema
 * Supports platform-specific commands with fallback to default
 */
export const PlatformShellSchema: z.ZodType<{
  win32?: string;
  darwin?: string;
  linux?: string;
  default: string;
}> = z.object({
  win32: z
    .string()
    .min(1)
    .optional()
    .describe("Windows-specific shell command"),
  darwin: z.string().min(1).optional().describe("macOS-specific shell command"),
  linux: z.string().min(1).optional().describe("Linux-specific shell command"),
  default: z
    .string()
    .min(1)
    .describe("Default shell command for all platforms"),
});

export type PlatformShell = z.infer<typeof PlatformShellSchema>;

/**
 * Platform-specific pipeline schema
 * Supports platform-specific pipelines with fallback to default
 */
export const PlatformPipelineSchema: z.ZodType<{
  win32?: PipelineStep[];
  darwin?: PipelineStep[];
  linux?: PipelineStep[];
  default: PipelineStep[];
}> = z.object({
  win32: z
    .array(PipelineStepSchema)
    .min(1)
    .optional()
    .describe("Windows-specific pipeline"),
  darwin: z
    .array(PipelineStepSchema)
    .min(1)
    .optional()
    .describe("macOS-specific pipeline"),
  linux: z
    .array(PipelineStepSchema)
    .min(1)
    .optional()
    .describe("Linux-specific pipeline"),
  default: z
    .array(PipelineStepSchema)
    .min(1)
    .describe("Default pipeline for all platforms"),
});

export type PlatformPipeline = z.infer<typeof PlatformPipelineSchema>;

/**
 * Shortcut configuration schema
 * Supports three types:
 * 1. Command: Execute xling command with args
 * 2. Shell: Execute arbitrary shell command (string or platform-specific object)
 * 3. Pipeline: Execute a series of commands with piped output (array or platform-specific object)
 */
export type ShortcutConfig = {
  command?: string;
  args?: string[];
  shell?: string | PlatformShell;
  pipeline?: PipelineStep[] | PlatformPipeline;
  description?: string;
};

export const ShortcutConfigSchema: z.ZodType<ShortcutConfig> = z
  .object({
    command: z.string().min(1).optional().describe("Xling command to execute"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    shell: z
      .union([z.string().min(1), PlatformShellSchema])
      .optional()
      .describe(
        "Shell command to execute (string or platform-specific object)",
      ),
    pipeline: z
      .union([z.array(PipelineStepSchema).min(1), PlatformPipelineSchema])
      .optional()
      .describe(
        "Pipeline of commands to execute (array or platform-specific object)",
      ),
    description: z.string().optional().describe("Human-readable description"),
  })
  .refine(
    (data) => {
      // Exactly one of: command, shell, or pipeline must be specified
      const hasCommand = Boolean(data.command);
      const hasShell = Boolean(data.shell);
      const hasPipeline = Boolean(data.pipeline);
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

/**
 * Xling configuration type
 */
export interface XlingConfig {
  prompt: PromptConfig;
  shortcuts?: Record<string, ShortcutConfig>;
}

/**
 * Xling configuration schema
 */
export const XlingConfigSchema: z.ZodType<XlingConfig> = z.object({
  prompt: PromptConfigSchema.describe("AI prompt configuration"),
  shortcuts: z
    .record(z.string(), ShortcutConfigSchema)
    .optional()
    .describe("Command shortcuts/aliases"),
});

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
