/**
 * Adapter interfaces
 */

import type {
  ToolId,
  Scope,
  SettingsResult,
  InspectResult,
  SettingsListData,
  EditOptions,
  SwitchOptions,
  LaunchCommandSpec,
} from "./types.ts";

/**
 * Settings adapter contract (all adapters must honor it per LSP)
 */
export interface SettingsAdapter {
  /**
   * Tool identifier
   */
  readonly toolId: ToolId;

  /**
   * List all configuration entries for a scope
   */
  list(scope: Scope): Promise<SettingsListData>;

  /**
   * Switch profiles (optional, Codex only)
   */
  switchProfile?(
    scope: Scope,
    profile: string,
    options?: SwitchOptions,
  ): Promise<SettingsResult>;

  /**
   * Open the configuration file for editing (optional)
   */
  edit?(scope: Scope, options: EditOptions): Promise<SettingsResult>;

  /**
   * Inspect the configuration file
   */
  inspect?(scope: Scope, name?: string): Promise<InspectResult>;

  /**
   * Resolve the configuration file path
   */
  resolvePath(scope: Scope): string;

  /**
   * Validate that the scope is supported
   */
  validateScope(scope: Scope): boolean;
}

/**
 * Launch adapter interface (separate from settings adapters per ISP)
 */
export interface LaunchAdapter {
  /**
   * Tool identifier
   */
  readonly toolId: ToolId;

  /**
   * Executable name
   */
  readonly executable: string;

  /**
   * Build the launch command specification
   * @param payload Launch request payload
   */
  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
    settings?: string;
  }): LaunchCommandSpec;

  /**
   * Verify that the tool is available on PATH
   */
  validateAvailability(): Promise<boolean>;

  /**
   * Optional: fetch the tool version
   */
  getVersion?(): Promise<string>;
}
