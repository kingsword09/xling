/**
 * Codex settings adapter
 */

import type {
  Scope,
  SettingsResult,
  SettingsListData,
  SwitchOptions,
  ConfigObject,
  ConfigValue,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import { InvalidScopeError } from "@/utils/errors.ts";
import * as fsStore from "@/services/settings/fsStore.ts";

/**
 * Resolves ~/.codex/config.toml (user scope) and supports profile switching
 */
export class CodexAdapter extends BaseAdapter {
  readonly toolId = "codex" as const;

  /**
   * Custom list implementation that focuses on model_providers
   */
  override async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);
    const providers = this.#extractProviders(config);

    return {
      type: "entries",
      entries: providers,
      filePath: path,
    };
  }

  /**
   * Resolve the config path
   */
  resolvePath(scope: Scope): string {
    switch (scope) {
      case "user":
        return "~/.codex/config.toml";
      default:
        throw new Error(`Unsupported scope for Codex: ${scope}`);
    }
  }

  /**
   * Validate the supported scope
   */
  validateScope(scope: Scope): boolean {
    return scope === "user";
  }

  /**
   * Switch to a different Codex profile
   */
  async switchProfile(
    scope: Scope,
    profile: string,
    _options?: SwitchOptions,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);

    const profilesValue = config.profiles;
    const profiles = isConfigObject(profilesValue) ? profilesValue : undefined;
    const profileValue = profiles?.[profile];

    // If a named profile exists, merge it as before
    if (isConfigObject(profileValue)) {
      const newConfig = { ...config };
      for (const [key, value] of Object.entries(profileValue)) {
        newConfig[key] = value;
      }
      newConfig.current_profile = profile;

      this.writeConfig(path, newConfig);

      return {
        success: true,
        message: `Switched to profile: ${profile}`,
        filePath: path,
      };
    }

    // Fallback: treat the profile name as the desired model_provider value
    const newConfig = { ...config, model_provider: profile };
    this.writeConfig(path, newConfig);

    return {
      success: true,
      message: `Set model_provider to: ${profile}`,
      filePath: path,
    };
  }

  /**
   * Read the TOML configuration
   */
  protected readConfig(path: string): ConfigObject {
    return fsStore.readTOML(path);
  }

  /**
   * Write the TOML configuration
   */
  protected writeConfig(path: string, data: ConfigObject): void {
    fsStore.writeTOML(path, data, false);
  }

  #extractProviders(config: ConfigObject): ConfigObject {
    const providers = config.model_providers;
    if (isConfigObject(providers)) {
      return providers;
    }
    return {};
  }
}

export const isConfigObject = (
  value: ConfigValue | undefined,
): value is ConfigObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);
