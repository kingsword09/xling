/**
 * Configuration validators
 */

import { z } from "zod";
import type { SettingsPayload } from "./types.ts";

/**
 * ToolId schema
 */
export const ToolIdSchema: z.ZodEnum<["claude", "codex", "gemini"]> = z.enum([
  "claude",
  "codex",
  "gemini",
]);

/**
 * Scope schema
 */
export const ScopeSchema: z.ZodEnum<["user", "project", "local", "system"]> =
  z.enum(["user", "project", "local", "system"]);

/**
 * SettingAction schema
 */
export const SettingActionSchema: z.ZodEnum<
  ["list", "edit", "switch-profile", "inspect"]
> = z.enum(["list", "edit", "switch-profile", "inspect"]);

/**
 * SettingsPayload schema
 */
export const SettingsPayloadSchema: z.ZodType<SettingsPayload> = z.object({
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
export function validatePayload(payload: unknown): SettingsPayload {
  return SettingsPayloadSchema.parse(payload);
}
