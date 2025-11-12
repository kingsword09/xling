/**
 * Configuration validators
 */

import { z, type ZodType } from "zod";
import type { SettingsPayload } from "./types.ts";

const TOOL_IDS = ["claude", "codex", "gemini"] as const;
const SCOPES = ["user", "project", "local", "system"] as const;
const ACTIONS = ["list", "edit", "switch-profile", "inspect"] as const;

/**
 * ToolId schema
 */
export const ToolIdSchema = z.enum(TOOL_IDS);

/**
 * Scope schema
 */
export const ScopeSchema = z.enum(SCOPES);

/**
 * SettingAction schema
 */
export const SettingActionSchema = z.enum(ACTIONS);

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
}) as ZodType<SettingsPayload>;

/**
 * Validate an incoming settings payload
 */
export function validatePayload(payload: unknown): SettingsPayload {
  return SettingsPayloadSchema.parse(payload);
}
