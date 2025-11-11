/**
 * 配置验证器
 */

import { z } from 'zod';

/**
 * ToolId 验证 schema
 */
export const ToolIdSchema = z.enum(['claude', 'codex', 'gemini']);

/**
 * Scope 验证 schema
 */
export const ScopeSchema = z.enum(['user', 'project', 'local', 'system']);

/**
 * SettingAction 验证 schema
 */
export const SettingActionSchema = z.enum([
  'list',
  'get',
  'set',
  'unset',
  'switch-profile',
  'inspect',
]);

/**
 * SettingsPayload 验证 schema
 */
export const SettingsPayloadSchema = z.object({
  tool: ToolIdSchema,
  scope: ScopeSchema,
  action: SettingActionSchema,
  key: z.string().optional(),
  value: z.string().optional(),
  profile: z.string().optional(),
  format: z.enum(['json', 'table']).optional(),
  dryRun: z.boolean().optional(),
  filePath: z.string().optional(),
});

/**
 * 验证 SettingsPayload
 */
export function validatePayload(payload: unknown) {
  return SettingsPayloadSchema.parse(payload);
}

/**
 * 验证配置 key 格式
 * 支持嵌套键，如 "theme.dark.background"
 */
export function validateKey(key: string): boolean {
  // 允许字母、数字、下划线、连字符和点号
  const keyPattern = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/;
  return keyPattern.test(key);
}

/**
 * 验证配置 value 格式
 * 尝试解析 JSON，如果失败则作为字符串
 */
export function parseValue(value: string): unknown {
  // 尝试解析为 JSON
  try {
    return JSON.parse(value);
  } catch {
    // 如果不是有效的 JSON，返回原始字符串
    return value;
  }
}
