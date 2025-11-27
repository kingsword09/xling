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

/** Auth profiles directory path */
const AUTH_PROFILES_DIR = "~/.codex/auth-profiles";
/** Auth file path */
const AUTH_FILE_PATH = "~/.codex/auth.json";
/** Auth backup file path */
const AUTH_BACKUP_PATH = "~/.codex/auth.json.bak";

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
   * Switch to a different Codex profile (provider or auth profile)
   */
  async switchProfile(
    scope: Scope,
    profile: string,
    _options?: SwitchOptions,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    // Check if it's an auth profile first
    if (this.isAuthProfile(profile)) {
      return this.#switchToAuthProfile(profile);
    }

    // Otherwise treat as provider
    return this.#switchToProvider(scope, profile);
  }

  // ========== Auth Profile Management ==========

  /**
   * List all auth profiles
   */
  listAuthProfiles(): string[] {
    const files = fsStore.listFiles(AUTH_PROFILES_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  /**
   * Check if a name is an auth profile
   */
  isAuthProfile(name: string): boolean {
    const profilePath = `${AUTH_PROFILES_DIR}/${name}.json`;
    return fsStore.fileExists(profilePath);
  }

  /**
   * Save current auth as a profile
   * After saving, deletes auth.json so user can login with another account
   */
  saveAuthProfile(name: string, force = false): SettingsResult {
    const targetPath = `${AUTH_PROFILES_DIR}/${name}.json`;

    // Validate auth.json exists
    if (!fsStore.fileExists(AUTH_FILE_PATH)) {
      return {
        success: false,
        message: "No auth.json found. Please run 'codex login' first.",
      };
    }

    // Check if profile already exists
    if (!force && fsStore.fileExists(targetPath)) {
      return {
        success: false,
        message: `Profile "${name}" already exists. Use --force to overwrite.`,
      };
    }

    // Ensure directory exists and copy file
    fsStore.ensureDir(AUTH_PROFILES_DIR);
    fsStore.copyFile(AUTH_FILE_PATH, targetPath);

    // Delete auth.json after saving, so user can login with another account
    fsStore.deleteFile(AUTH_FILE_PATH);

    return {
      success: true,
      message: `Saved current auth as profile: ${name}\nauth.json has been removed. You can now login with another account.`,
      filePath: fsStore.resolveHome(targetPath),
    };
  }

  /**
   * Delete an auth profile
   */
  deleteAuthProfile(name: string): SettingsResult {
    const profilePath = `${AUTH_PROFILES_DIR}/${name}.json`;

    if (!fsStore.fileExists(profilePath)) {
      return {
        success: false,
        message: `Auth profile "${name}" not found.`,
      };
    }

    fsStore.deleteFile(profilePath);

    return {
      success: true,
      message: `Deleted auth profile: ${name}`,
    };
  }

  /**
   * Get all switchable profiles (providers + auth profiles)
   */
  getAllSwitchableProfiles(scope: Scope): {
    providers: string[];
    authProfiles: string[];
  } {
    const configPath = this.resolvePath(scope);
    let providers: string[] = [];

    try {
      const config = this.readConfig(configPath);
      const modelProviders = config.model_providers;
      if (isConfigObject(modelProviders)) {
        providers = Object.keys(modelProviders);
      }

      // Also include profiles from config
      const profiles = config.profiles;
      if (isConfigObject(profiles)) {
        providers = [...new Set([...providers, ...Object.keys(profiles)])];
      }
    } catch {
      // Config file may not exist
    }

    const authProfiles = this.listAuthProfiles();

    return { providers, authProfiles };
  }

  // ========== Private Methods ==========

  /**
   * Switch to an auth profile
   * Simply copies the saved profile to auth.json (overwriting any existing)
   */
  #switchToAuthProfile(name: string): SettingsResult {
    const profilePath = `${AUTH_PROFILES_DIR}/${name}.json`;
    const configPath = "~/.codex/config.toml";

    // Validate profile exists
    if (!fsStore.fileExists(profilePath)) {
      return {
        success: false,
        message: `Auth profile "${name}" not found.`,
      };
    }

    // Copy profile to auth.json (overwrites existing)
    fsStore.copyFile(profilePath, AUTH_FILE_PATH);

    // Remove model_provider from config.toml (if exists)
    try {
      const config = this.readConfig(configPath);
      if (config.model_provider) {
        delete config.model_provider;
        this.writeConfig(configPath, config);
      }
    } catch {
      // Config file may not exist, that's ok
    }

    return {
      success: true,
      message: `Switched to auth profile: ${name}`,
      filePath: fsStore.resolveHome(AUTH_FILE_PATH),
    };
  }

  /**
   * Switch to a provider
   * Deletes auth.json since we're using provider instead
   */
  #switchToProvider(scope: Scope, name: string): SettingsResult {
    const configPath = this.resolvePath(scope);

    // Delete auth.json if exists (it's a copy from profiles, safe to delete)
    if (fsStore.fileExists(AUTH_FILE_PATH)) {
      fsStore.deleteFile(AUTH_FILE_PATH);
    }

    // Read config and check for named profile first
    const config = this.readConfig(configPath);

    const profilesValue = config.profiles;
    const profiles = isConfigObject(profilesValue) ? profilesValue : undefined;
    const profileValue = profiles?.[name];

    // If a named profile exists, merge it
    if (isConfigObject(profileValue)) {
      const newConfig = { ...config };
      for (const [key, value] of Object.entries(profileValue)) {
        newConfig[key] = value;
      }
      newConfig.current_profile = name;

      this.writeConfig(configPath, newConfig);

      return {
        success: true,
        message: `Switched to profile: ${name}`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    // Otherwise set model_provider
    const newConfig = { ...config, model_provider: name };
    this.writeConfig(configPath, newConfig);

    return {
      success: true,
      message: `Switched to provider: ${name}`,
      filePath: fsStore.resolveHome(configPath),
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
