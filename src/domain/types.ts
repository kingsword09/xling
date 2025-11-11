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
  | 'edit'
  | 'switch-profile'
  | 'inspect';
export type OutputFormat = 'json' | 'table';

export interface EditOptions {
  name?: string;
  ide?: string;
}

export interface SettingsFileEntry {
  filename: string;
  variant: string;
  path: string;
  scope: Scope;
  active: boolean;
  exists: boolean;
  size?: number;
  lastModified?: Date;
}

export type SettingsListData =
  | {
      type: 'entries';
      entries: Record<string, unknown>;
      filePath: string;
    }
  | {
      type: 'files';
      files: SettingsFileEntry[];
    };

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
  name?: string;
  ide?: string;
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
