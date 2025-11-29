/**
 * Configuration validators
 */

import { z, type ZodType } from "zod";
import type {
  ConfigValue,
  SettingAction,
  SettingsPayload,
  Scope,
  ToolId,
} from "./types.ts";

/**
 * ToolId schema
 */
export const ToolIdSchema: z.ZodType<ToolId> = z.enum([
  "claude",
  "codex",
  "gemini",
] as const);

/**
 * Scope schema
 */
export const ScopeSchema: z.ZodType<Scope> = z.enum([
  "user",
  "project",
  "local",
  "system",
] as const);

/**
 * SettingAction schema
 */
export const SettingActionSchema: z.ZodType<SettingAction> = z.enum([
  "list",
  "edit",
  "switch-profile",
  "inspect",
] as const);

/**
 * SettingsPayload schema
 */
export const SettingsPayloadSchema: ZodType<SettingsPayload> = z.object({
  tool: ToolIdSchema,
  scope: ScopeSchema,
  action: SettingActionSchema,
  profile: z.string().optional(),
  name: z.string().optional(),
  ide: z.string().optional(),
  format: z.enum(["json", "table"]).optional(),
  switchOptions: z
    .object({
      preview: z.boolean().optional(),
      backup: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Validate an incoming settings payload
 */
export function validatePayload(payload: ConfigValue): SettingsPayload {
  return SettingsPayloadSchema.parse(payload);
}

/**
 * Port number schema (1-65535)
 */
export const PortSchema: z.ZodNumber = z.number().int().min(1).max(65535);

/**
 * Host/IP address schema
 */
export const HostSchema: z.ZodString = z
  .string()
  .regex(
    /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*)$/,
    "Invalid host format",
  );

/**
 * PR ID schema (number or owner/repo#number)
 */
export const PrIdSchema: z.ZodString = z
  .string()
  .regex(
    /^(\d+|[\w.-]+\/[\w.-]+#\d+)$/,
    "Invalid PR ID format. Use number or owner/repo#number",
  );

/**
 * Validate port number
 */
export function validatePort(port: number): number {
  return PortSchema.parse(port);
}

/**
 * Validate host/IP address
 */
export function validateHost(host: string): string {
  return HostSchema.parse(host);
}

/**
 * Validate PR ID
 */
export function validatePrId(id: string): string {
  return PrIdSchema.parse(id);
}
