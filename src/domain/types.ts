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

/**
 * Launch 功能相关类型
 */

/**
 * Launch 操作的输入参数
 */
export interface LaunchPayload {
  tool: ToolId;
  yolo?: boolean; // 默认 true
  args?: string[]; // 透传给工具的额外参数
  cwd?: string; // 工作目录
  resume?: boolean; // 显示对话列表选择 (claude -r, codex resume)
  continue?: boolean; // 继续最后一个对话 (claude -c, codex resume --last)
}

/**
 * Launch 操作的返回结果
 */
export interface LaunchResult {
  success: boolean;
  pid?: number; // 进程 ID
  command?: string; // 执行的完整命令
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * 进程启动命令规范
 */
export interface LaunchCommandSpec {
  executable: string; // 可执行文件名或路径
  baseArgs: string[]; // 基础参数
  yoloArgs?: string[]; // yolo 模式的参数
  envVars?: Record<string, string>; // 环境变量
}
