/**
 * 核心类型定义
 */

export type ToolId = "claude" | "codex" | "gemini";
export type Scope = "user" | "project" | "local" | "system";
export type SettingAction = "list" | "edit" | "switch-profile" | "inspect";
export type OutputFormat = "json" | "table";

export interface EditOptions {
  name?: string;
  ide?: string;
}

export interface SwitchOptions {
  preview?: boolean;
  backup?: boolean;
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
      type: "entries";
      entries: Record<string, unknown>;
      filePath: string;
    }
  | {
      type: "files";
      files: SettingsFileEntry[];
    };

/**
 * Settings 操作的输入参数
 */
export interface SettingsPayload {
  tool: ToolId;
  scope: Scope;
  action: SettingAction;
  profile?: string;
  name?: string;
  ide?: string;
  format?: OutputFormat;
  switchOptions?: SwitchOptions;
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
  preview?: boolean;
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
