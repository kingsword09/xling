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
