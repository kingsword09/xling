import * as path from "node:path";
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
  EditOptions,
  InspectResult,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import { ConfigFileNotFoundError } from "@/utils/errors.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import { openInEditor, resolveEditorCommand } from "@/utils/editor.ts";

/** Auth profiles directory path */
const AUTH_PROFILES_DIR = "~/.codex/auth-profiles";
/** Auth file path */
const AUTH_FILE_PATH = "~/.codex/auth.json";
const DEFAULT_WIRE_API = "responses";

/**
 * Resolves ~/.codex/config.toml (user scope) and supports profile switching
 */
export class CodexAdapter extends BaseAdapter {
  readonly toolId = "codex" as const;

  /**
   * Custom list implementation that focuses on model_providers
   */
  override async list(scope: Scope): Promise<SettingsListData> {
    const path = this.validateAndResolvePath(scope);
    const config = this.readConfig(path);

    const providers = this.#extractProviders(config);
    const authProfiles = this.listAuthProfiles();
    const hasAuthFile = fsStore.fileExists(AUTH_FILE_PATH);
    const currentAuthProfile =
      typeof config.current_auth_profile === "string"
        ? config.current_auth_profile
        : hasAuthFile || authProfiles.length > 0
          ? this.#identifyAuthProfile()
          : null;
    const currentProvider =
      typeof config.model_provider === "string" ? config.model_provider : null;
    const currentProfile =
      typeof config.current_profile === "string"
        ? config.current_profile
        : null;

    return {
      type: "entries",
      entries: {
        current_provider: currentProvider,
        current_profile: currentProfile,
        current_auth_profile: currentAuthProfile,
        providers,
        auth_profiles: authProfiles,
      },
      filePath: path,
    };
  }

  /**
   * Override inspect to return the current active configuration
   */
  override async inspect(scope: Scope, name?: string): Promise<InspectResult> {
    const configPath = this.validateAndResolvePath(scope);
    const resolvedPath = fsStore.resolveHome(configPath);
    const configExists = fsStore.fileExists(configPath);
    const config = configExists ? this.#readConfigSafe(configPath) : {};
    const fileInfo = configExists ? fsStore.getFileInfo(configPath) : null;

    const target = name?.trim();

    if (target) {
      // 1) Explicit auth profile
      if (this.isAuthProfile(target)) {
        const authPath = `${AUTH_PROFILES_DIR}/${target}.json`;
        const authData = this.#readProfileData(authPath);
        const info = fsStore.getFileInfo(authPath);

        return {
          path: fsStore.resolveHome(authPath),
          exists: fsStore.fileExists(authPath),
          content: JSON.stringify(
            {
              mode: "auth",
              authProfile: target,
              authFile: fsStore.resolveHome(authPath),
              configFile: resolvedPath,
              authData,
            },
            null,
            2,
          ),
          size: info?.size,
          lastModified: info?.lastModified,
        };
      }

      // 2) Explicit provider name
      const providers = isConfigObject(config.model_providers)
        ? config.model_providers
        : {};
      if (providers[target]) {
        return {
          path: resolvedPath,
          exists: configExists,
          content: JSON.stringify(
            {
              mode: "provider",
              currentProvider: target,
              config: providers[target] ?? {},
            },
            null,
            2,
          ),
          size: fileInfo?.size,
          lastModified: fileInfo?.lastModified,
        };
      }

      // 3) Explicit named profile
      const profiles = isConfigObject(config.profiles) ? config.profiles : {};
      if (profiles[target]) {
        return {
          path: resolvedPath,
          exists: configExists,
          content: JSON.stringify(
            {
              mode: "profile",
              currentProfile: target,
              config: profiles[target] ?? {},
            },
            null,
            2,
          ),
          size: fileInfo?.size,
          lastModified: fileInfo?.lastModified,
        };
      }

      // 4) Not found
      return {
        path: resolvedPath,
        exists: configExists,
        content: JSON.stringify(
          {
            mode: "not_found",
            requested: target,
            availableProviders: Object.keys(providers),
            availableProfiles: Object.keys(profiles),
            availableAuthProfiles: this.listAuthProfiles(),
          },
          null,
          2,
        ),
        size: fileInfo?.size,
        lastModified: fileInfo?.lastModified,
      };
    }

    if (!configExists) {
      return this.#inspectWithoutConfig(resolvedPath);
    }

    if (config.current_profile && typeof config.current_profile === "string") {
      return this.#inspectProfileMode(config, resolvedPath, fileInfo);
    }

    if (config.model_provider && typeof config.model_provider === "string") {
      return this.#inspectProviderMode(config, resolvedPath, fileInfo);
    }

    const currentAuthProfile =
      typeof config.current_auth_profile === "string"
        ? config.current_auth_profile
        : null;

    if (currentAuthProfile || fsStore.fileExists(AUTH_FILE_PATH)) {
      return this.#inspectAuthMode(currentAuthProfile, resolvedPath, fileInfo);
    }

    return this.#inspectNoActiveConfig(resolvedPath, fileInfo);
  }

  #inspectWithoutConfig(resolvedPath: string): InspectResult {
    if (fsStore.fileExists(AUTH_FILE_PATH)) {
      const authData = this.#readAuthData();
      const profileName = this.#identifyAuthProfile();
      return {
        path: fsStore.resolveHome(AUTH_FILE_PATH),
        exists: true,
        content: JSON.stringify(
          {
            mode: "auth",
            currentAuthProfile: profileName,
            authFile: fsStore.resolveHome(AUTH_FILE_PATH),
            authData,
          },
          null,
          2,
        ),
      };
    }
    return { path: resolvedPath, exists: false };
  }

  #inspectProfileMode(
    config: ConfigObject,
    resolvedPath: string,
    fileInfo: { size?: number; lastModified?: Date } | null,
  ): InspectResult {
    const profileName = config.current_profile as string;
    const profiles = isConfigObject(config.profiles) ? config.profiles : {};
    const profileConfig = profiles[profileName];

    return {
      path: resolvedPath,
      exists: true,
      content: JSON.stringify(
        {
          mode: "profile",
          currentProfile: profileName,
          config: isConfigObject(profileConfig) ? profileConfig : {},
        },
        null,
        2,
      ),
      size: fileInfo?.size,
      lastModified: fileInfo?.lastModified,
    };
  }

  #inspectProviderMode(
    config: ConfigObject,
    resolvedPath: string,
    fileInfo: { size?: number; lastModified?: Date } | null,
  ): InspectResult {
    const providerName = config.model_provider as string;
    const providers = isConfigObject(config.model_providers)
      ? config.model_providers
      : {};
    const providerConfig = providers[providerName];

    return {
      path: resolvedPath,
      exists: true,
      content: JSON.stringify(
        {
          mode: "provider",
          currentProvider: providerName,
          config: isConfigObject(providerConfig) ? providerConfig : {},
        },
        null,
        2,
      ),
      size: fileInfo?.size,
      lastModified: fileInfo?.lastModified,
    };
  }

  #inspectAuthMode(
    currentAuthProfile: string | null,
    resolvedPath: string,
    fileInfo: { size?: number; lastModified?: Date } | null,
  ): InspectResult {
    const authData = this.#readAuthData();
    const profileName = currentAuthProfile || this.#identifyAuthProfile();

    return {
      path: fsStore.resolveHome(AUTH_FILE_PATH),
      exists: true,
      content: JSON.stringify(
        {
          mode: "auth",
          currentAuthProfile: profileName,
          authFile: fsStore.resolveHome(AUTH_FILE_PATH),
          configFile: resolvedPath,
          authData,
        },
        null,
        2,
      ),
      size: fileInfo?.size,
      lastModified: fileInfo?.lastModified,
    };
  }

  #inspectNoActiveConfig(
    resolvedPath: string,
    fileInfo: { size?: number; lastModified?: Date } | null,
  ): InspectResult {
    return {
      path: resolvedPath,
      exists: true,
      content: JSON.stringify(
        {
          mode: "none",
          message:
            "No active provider or auth configured. Run 'codex login' or configure a model_provider.",
          configFile: resolvedPath,
        },
        null,
        2,
      ),
      size: fileInfo?.size,
      lastModified: fileInfo?.lastModified,
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
    this.validateAndResolvePath(scope);

    // Check if it's an auth profile first
    if (this.isAuthProfile(profile)) {
      return this.#switchToAuthProfile(profile);
    }

    // Otherwise treat as provider
    return this.#switchToProvider(scope, profile);
  }

  override async edit(
    scope: Scope,
    options: EditOptions,
  ): Promise<SettingsResult> {
    const configPath = this.validateAndResolvePath(scope);

    if (!options.provider) {
      const resolvedPath = fsStore.resolveHome(configPath);
      fsStore.ensureDir(path.dirname(resolvedPath));

      if (!fsStore.fileExists(configPath)) {
        this.writeConfig(configPath, {});
      }

      const editor = resolveEditorCommand(options.ide);
      await openInEditor(editor, resolvedPath);

      return {
        success: true,
        message: `Opened Codex config in ${editor}`,
        filePath: resolvedPath,
      };
    }

    const providerId =
      options.provider.id?.trim() || options.provider.name?.trim();
    if (!providerId) {
      throw new Error("Provider name cannot be empty");
    }

    const baseUrl = options.provider.base_url?.trim();
    if (!baseUrl) {
      throw new Error("Base URL is required for Codex providers");
    }

    const providerName = options.provider.name?.trim() || providerId;
    const token = options.provider.experimental_bearer_token?.trim();
    if (!token) {
      throw new Error(
        "Experimental bearer token is required for Codex providers",
      );
    }

    const config = this.#readConfigSafe(configPath);
    const providers: ConfigObject = isConfigObject(config.model_providers)
      ? { ...config.model_providers }
      : {};

    providers[providerId] = {
      name: providerName,
      base_url: baseUrl,
      wire_api: DEFAULT_WIRE_API,
      experimental_bearer_token: token,
    };

    const nextConfig: ConfigObject = {
      ...config,
      model_providers: providers,
    };

    this.writeConfig(configPath, nextConfig);

    return {
      success: true,
      message: `Added model_providers.${providerId}`,
      filePath: fsStore.resolveHome(configPath),
      data: providers[providerId],
    };
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
   * Also records the profile name in config.toml for later reference
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

    // Update config.toml: remove model_provider, add current_auth_profile
    try {
      const config = this.#readConfigSafe(configPath);
      delete config.model_provider;
      delete config.current_profile;
      config.current_auth_profile = name;
      this.writeConfig(configPath, config);
    } catch {
      // Config file may not exist, create it with just the auth profile
      this.writeConfig(configPath, { current_auth_profile: name });
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
   * Also clears current_auth_profile from config.toml
   */
  #switchToProvider(scope: Scope, name: string): SettingsResult {
    const configPath = this.resolvePath(scope);

    // Delete auth.json if exists (it's a copy from profiles, safe to delete)
    if (fsStore.fileExists(AUTH_FILE_PATH)) {
      fsStore.deleteFile(AUTH_FILE_PATH);
    }

    // Read config and check for named profile first
    const config = this.#readConfigSafe(configPath);

    // Clear auth profile reference
    delete config.current_auth_profile;

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
      delete newConfig.model_provider;

      this.writeConfig(configPath, newConfig);

      return {
        success: true,
        message: `Switched to profile: ${name}`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    // Otherwise set model_provider
    delete config.current_profile;
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

  #readConfigSafe(path: string): ConfigObject {
    try {
      return this.readConfig(path);
    } catch (error) {
      if (error instanceof ConfigFileNotFoundError) {
        return {};
      }
      throw error;
    }
  }

  #extractProviders(config: ConfigObject): ConfigObject {
    const providers = config.model_providers;
    if (isConfigObject(providers)) {
      return providers;
    }
    return {};
  }

  /**
   * Read auth.json data
   * Returns the parsed content or null if file doesn't exist
   */
  #readAuthData(): ConfigObject | null {
    if (!fsStore.fileExists(AUTH_FILE_PATH)) {
      return null;
    }
    try {
      return fsStore.readJSON(AUTH_FILE_PATH);
    } catch {
      return null;
    }
  }

  #readProfileData(profilePath: string): ConfigObject | null {
    if (!fsStore.fileExists(profilePath)) {
      return null;
    }
    try {
      return fsStore.readJSON(profilePath);
    } catch {
      return null;
    }
  }

  /**
   * Identify which auth profile matches the current auth.json
   * Compares auth.json content with each profile in auth-profiles directory
   * Returns the matching profile name, or "default" if no match found
   */
  #identifyAuthProfile(): string {
    if (!fsStore.fileExists(AUTH_FILE_PATH)) {
      return "default";
    }

    let currentAuthContent: string;
    try {
      currentAuthContent = fsStore.readFile(AUTH_FILE_PATH);
    } catch {
      return "default";
    }

    const profiles = this.listAuthProfiles();
    for (const profileName of profiles) {
      const profilePath = `${AUTH_PROFILES_DIR}/${profileName}.json`;
      try {
        const profileContent = fsStore.readFile(profilePath);
        if (currentAuthContent === profileContent) {
          return profileName;
        }
      } catch {
        // Skip profiles that can't be read
        continue;
      }
    }

    return "default";
  }
}

export const isConfigObject = (
  value: ConfigValue | undefined,
): value is ConfigObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);
