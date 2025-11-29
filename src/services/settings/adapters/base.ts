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
  ConfigObject,
} from "@/domain/types.ts";
import { InvalidScopeError, UnsupportedActionError } from "@/utils/errors.ts";
import * as fsStore from "@/services/settings/fsStore.ts";

/**
 * Abstract adapter implementation
 */
export abstract class BaseAdapter<TConfig = ConfigObject>
  implements SettingsAdapter
{
  abstract readonly toolId: ToolId;

  /**
   * Methods every adapter must implement
   */
  abstract resolvePath(scope: Scope): string;
  abstract validateScope(scope: Scope): boolean;

  /**
   * Validate scope and resolve path in one call - eliminates repetitive validation code
   */
  protected validateAndResolvePath(scope: Scope): string {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }
    return this.resolvePath(scope);
  }

  /**
   * List all configuration entries for a scope
   */
  async list(scope: Scope): Promise<SettingsListData> {
    const path = this.validateAndResolvePath(scope);
    const config = this.readConfig(path);

    return {
      type: "entries",
      entries: config as ConfigObject,
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
    throw new UnsupportedActionError("switch-profile", this.toolId);
  }

  /**
   * Inspect the configuration file
   */
  async inspect(scope: Scope, _name?: string): Promise<InspectResult> {
    const path = this.validateAndResolvePath(scope);
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
  async edit(_scope: Scope, _options: EditOptions): Promise<SettingsResult> {
    throw new UnsupportedActionError("edit", this.toolId);
  }

  /**
   * Read the configuration file (subclasses may override)
   */
  protected readConfig(path: string): TConfig {
    return fsStore.readJSON(path) as TConfig;
  }

  /**
   * Write the configuration file (subclasses may override)
   */
  protected writeConfig(path: string, data: TConfig, backup = true): void {
    fsStore.writeJSON(path, data as ConfigObject, backup);
  }
}
