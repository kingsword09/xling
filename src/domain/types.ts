/**
 * 核心类型定义
 */

export type ToolId = 'claude' | 'codex' | 'gemini';
export type Scope = 'user' | 'project' | 'local' | 'system';
export type SettingAction =
  | 'list'
  | 'get'
  | 'set'
  | 'unset'
  | 'switch-profile'
  | 'inspect';
export type OutputFormat = 'json' | 'table';

/**
 * Settings 操作的输入参数
 */
export interface SettingsPayload {
  tool: ToolId;
  scope: Scope;
  action: SettingAction;
  key?: string;
  value?: string;
  profile?: string;
  format?: OutputFormat;
  dryRun?: boolean;
  filePath?: string;
}

/**
 * Settings 操作的返回结果
 */
export interface SettingsResult {
  success: boolean;
  data?: Record<string, unknown> | unknown;
  message?: string;
  filePath?: string;
  diff?: string;
}

/**
 * 配置文件检查结果
 */
export interface InspectResult {
  path: string;
  exists: boolean;
  content?: string;
  size?: number;
  lastModified?: Date;
}
