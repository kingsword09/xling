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
 * Xling configuration schema
 */
export const XlingConfigSchema: z.ZodType<{
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

export type XlingConfig = z.infer<typeof XlingConfigSchema>;

/**
 * Validate and parse Xling configuration
 */
export function validateXlingConfig(data: unknown): XlingConfig {
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
