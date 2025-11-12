/**
 * Base class for settings adapters
 * Provides shared logic to keep subclasses DRY
 */

import type { SettingsAdapter } from "@/domain/interfaces.ts";
import type {
  ToolId,
  Scope,
  InspectResult,
  SettingsListData,
  SettingsResult,
  EditOptions,
  SwitchOptions,
} from "@/domain/types.ts";
import { InvalidScopeError } from "@/utils/errors.ts";
import * as fsStore from "@/services/settings/fsStore.ts";

/**
 * Abstract adapter implementation
 */
export abstract class BaseAdapter implements SettingsAdapter {
  abstract readonly toolId: ToolId;

  /**
   * Methods every adapter must implement
   */
  abstract resolvePath(scope: Scope): string;
  abstract validateScope(scope: Scope): boolean;

  /**
   * List all configuration entries for a scope
   */
  async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);

    return {
      type: "entries",
      entries: config,
      filePath: path,
    };
  }

  /**
   * Default switchProfile implementation (throws unless overridden)
   */
  async switchProfile(
    _scope: Scope,
    _profile: string,
    _options?: SwitchOptions,
  ): Promise<SettingsResult> {
    throw new Error(`Tool ${this.toolId} does not support profile switching`);
  }

  /**
   * Inspect the configuration file
   */
  async inspect(scope: Scope): Promise<InspectResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const exists = fsStore.fileExists(path);

    if (!exists) {
      return {
        path,
        exists: false,
      };
    }

    const fileInfo = fsStore.getFileInfo(path);
    const config = this.readConfig(path);

    return {
      path,
      exists: true,
      content: JSON.stringify(config, null, 2),
      size: fileInfo?.size,
      lastModified: fileInfo?.lastModified,
    };
  }

  /**
   * Default edit implementation (throws unless overridden)
   */
  async edit(scope: Scope, _options: EditOptions): Promise<SettingsResult> {
    throw new Error(`Tool ${this.toolId} does not support edit for ${scope}`);
  }

  /**
   * Read the configuration file (subclasses may override)
   */
  protected readConfig(path: string): Record<string, unknown> {
    return fsStore.readJSON(path);
  }

  /**
   * Write the configuration file (subclasses may override)
   */
  protected writeConfig(
    path: string,
    data: Record<string, unknown>,
    backup = true,
  ): void {
    fsStore.writeJSON(path, data, backup);
  }
}
