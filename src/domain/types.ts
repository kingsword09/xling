/**
 * Core type definitions
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
 * Input payload for settings operations
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
 * Result returned by settings operations
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
 * Inspect command result
 */
export interface InspectResult {
  path: string;
  exists: boolean;
  content?: string;
  size?: number;
  lastModified?: Date;
}

/**
 * Launch-related types
 */

/**
 * Launch payload
 */
export interface LaunchPayload {
  tool: ToolId;
  yolo?: boolean; // defaults to true
  args?: string[]; // additional args forwarded to the tool
  cwd?: string; // working directory
  resume?: boolean; // show session picker (claude -r, codex resume)
  continue?: boolean; // continue most recent session (claude -c, codex resume --last)
}

/**
 * Launch result
 */
export interface LaunchResult {
  success: boolean;
  pid?: number; // spawned process ID
  command?: string; // full command string
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Launch command specification
 */
export interface LaunchCommandSpec {
  executable: string; // binary name or path
  baseArgs: string[]; // default arguments
  yoloArgs?: string[]; // extra arguments used in yolo mode
  envVars?: Record<string, string>; // environment variables
}
