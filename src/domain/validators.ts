/**
 * 配置验证器
 */

import { z } from "zod";

/**
 * ToolId 验证 schema
 */
export const ToolIdSchema = z.enum(["claude", "codex", "gemini"]);

/**
 * Scope 验证 schema
 */
export const ScopeSchema = z.enum(["user", "project", "local", "system"]);

/**
 * SettingAction 验证 schema
 */
export const SettingActionSchema = z.enum([
  "list",
  "edit",
  "switch-profile",
  "inspect",
]);

/**
 * SettingsPayload 验证 schema
 */
export const SettingsPayloadSchema = z.object({
  tool: ToolIdSchema,
  scope: ScopeSchema,
  action: SettingActionSchema,
  profile: z.string().optional(),
  name: z.string().optional(),
  ide: z.string().optional(),
  format: z.enum(["json", "table"]).optional(),
});

/**
 * 验证 SettingsPayload
 */
export function validatePayload(payload: unknown) {
  return SettingsPayloadSchema.parse(payload);
}
