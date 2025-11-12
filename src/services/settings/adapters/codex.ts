/**
 * Codex settings adapter
 */

import type {
  Scope,
  SettingsResult,
  SettingsListData,
  SwitchOptions,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import { InvalidScopeError, ProfileNotFoundError } from "@/utils/errors.ts";
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
    const providers = this.extractProviders(config);

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

    // Ensure the requested profile exists
    const profiles = config.profiles as Record<string, unknown> | undefined;
    if (!profiles || !(profile in profiles)) {
      throw new ProfileNotFoundError(profile);
    }

    // Pull the profile configuration
    const profileConfig = profiles[profile] as Record<string, unknown>;

    // Merge profile values into the root config
    const newConfig = { ...config };
    for (const [key, value] of Object.entries(profileConfig)) {
      newConfig[key] = value;
    }

    // Record the active profile
    newConfig.current_profile = profile;

    // Persist the updated config
    this.writeConfig(path, newConfig);

    return {
      success: true,
      message: `Switched to profile: ${profile}`,
      filePath: path,
    };
  }

  /**
   * Read the TOML configuration
   */
  protected readConfig(path: string): Record<string, unknown> {
    return fsStore.readTOML(path);
  }

  /**
   * Write the TOML configuration
   */
  protected writeConfig(path: string, data: Record<string, unknown>): void {
    fsStore.writeTOML(path, data);
  }

  private extractProviders(
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const providers = config.model_providers;
    if (
      typeof providers === "object" &&
      providers !== null &&
      !Array.isArray(providers)
    ) {
      return providers as Record<string, unknown>;
    }
    return {};
  }
}
