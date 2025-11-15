/**
 * Xling settings adapter
 * Manages configuration at ~/.claude/xling.json
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type {
  Scope,
  SettingsListData,
  SettingsResult,
  ConfigObject,
  EditOptions,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import { InvalidScopeError, ConfigParseError } from "@/utils/errors.ts";
import {
  type XlingConfig,
  type ProviderConfig,
  validateXlingConfig,
} from "@/domain/xling/config.ts";
import { DEFAULT_XLING_CONFIG } from "@/domain/xling/template.ts";
import { openInEditor, resolveEditorCommand } from "@/utils/editor.ts";

/**
 * Xling adapter for managing prompt providers at ~/.claude/xling.json
 */
export class XlingAdapter extends BaseAdapter<XlingConfig> {
  readonly toolId = "xling" as const;

  /**
   * Resolve config path - cross-platform
   * macOS/Linux: ~/.claude/xling.json
   * Windows: %USERPROFILE%\.claude\xling.json
   */
  resolvePath(scope: Scope): string {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    // Use ~ which will be resolved by fsStore.resolveHome()
    // This works on all platforms
    return "~/.claude/xling.json";
  }

  /**
   * Validate scope - only "user" is supported
   */
  validateScope(scope: Scope): boolean {
    return scope === "user";
  }

  /**
   * Read Xling configuration
   * Returns default template if file doesn't exist
   */
  override readConfig(configPath: string): XlingConfig {
    const resolvedPath = fsStore.resolveHome(configPath);

    if (!fs.existsSync(resolvedPath)) {
      return DEFAULT_XLING_CONFIG;
    }

    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      const data = JSON.parse(content);
      return validateXlingConfig(data);
    } catch (error) {
      throw new ConfigParseError(resolvedPath, (error as Error).message);
    }
  }

  /**
   * Write Xling configuration with secure permissions
   * Unix: chmod 600
   * Windows: ACL to restrict access to current user only
   */
  protected override writeConfig(
    configPath: string,
    data: XlingConfig,
    backup = true,
  ): void {
    const resolvedPath = fsStore.resolveHome(configPath);

    // Ensure directory exists
    fsStore.ensureDir(path.dirname(resolvedPath));

    // Backup if needed
    if (backup && fs.existsSync(resolvedPath)) {
      const backupPath = `${resolvedPath}.bak`;
      fs.copyFileSync(resolvedPath, backupPath);
    }

    try {
      // Atomic write
      const tempPath = `${resolvedPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");

      // Set secure permissions (cross-platform)
      this.setSecurePermissions(tempPath);

      fs.renameSync(tempPath, resolvedPath);
    } catch (error) {
      throw new Error(
        `Failed to write config to ${resolvedPath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set secure file permissions (cross-platform)
   * Unix: chmod 600 (owner read/write only)
   * Windows: icacls to restrict access to current user only
   */
  private setSecurePermissions(filePath: string): void {
    try {
      if (process.platform === "win32") {
        // Windows: Remove inheritance and grant full control to current user only
        // /inheritance:r - Remove inherited permissions
        // /grant:r - Grant permissions (replace existing)
        // %USERNAME%:(F) - Full control for current user
        execSync(
          `icacls "${filePath}" /inheritance:r /grant:r "%USERNAME%:(F)"`,
          {
            stdio: "ignore",
            windowsHide: true,
          },
        );
      } else {
        // Unix: Standard chmod 600
        fs.chmodSync(filePath, 0o600);
      }
    } catch (error) {
      // Log warning but don't fail the operation
      // File permissions are a security enhancement, not a hard requirement
      console.warn(
        `Warning: Could not set secure permissions on ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Open xling.json in the specified IDE
   */
  override async edit(
    scope: Scope,
    options: EditOptions,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const configPath = this.resolvePath(scope);
    const resolvedPath = fsStore.resolveHome(configPath);
    const resolvedEditor = resolveEditorCommand(options.ide);

    // Ensure directory exists
    const directory = path.dirname(resolvedPath);
    fsStore.ensureDir(directory);

    // Create config file with default template if it doesn't exist
    if (!fs.existsSync(resolvedPath)) {
      this.writeConfig(configPath, DEFAULT_XLING_CONFIG, false);
    }

    // Open in editor
    await openInEditor(resolvedEditor, resolvedPath);

    return {
      success: true,
      message: `Opened ${configPath} in ${resolvedEditor}`,
      filePath: resolvedPath,
    };
  }

  /**
   * List all providers
   */
  override async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);

    // Convert to ConfigObject format
    const entries: ConfigObject = {
      prompt: {
        defaultModel: config.prompt.defaultModel || null,
        retryPolicy: config.prompt.retryPolicy || null,
        providers: config.prompt.providers.map((p: ProviderConfig) => ({
          name: p.name,
          baseUrl: p.baseUrl,
          models: p.models,
          priority: p.priority ?? null,
          timeout: p.timeout ?? null,
          // Mask API key for security
          apiKey: this.maskApiKey(p.apiKey),
        })),
      },
      shortcuts: config.shortcuts || null,
    };

    return {
      type: "entries",
      entries,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Get all configured shortcuts
   */
  getShortcuts(
    scope: Scope,
  ): Record<string, import("@/domain/xling/config.ts").ShortcutConfig> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);
    return config.shortcuts || {};
  }

  /**
   * Add a new provider
   */
  async addProvider(
    scope: Scope,
    provider: ProviderConfig,
  ): Promise<SettingsResult> {
    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);

    // Check for duplicate name
    if (
      config.prompt.providers.some(
        (p: ProviderConfig) => p.name === provider.name,
      )
    ) {
      return {
        success: false,
        message: `Provider "${provider.name}" already exists`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    config.prompt.providers.push(provider);
    this.writeConfig(configPath, config);

    return {
      success: true,
      message: `Added provider "${provider.name}"`,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Remove a provider by name
   */
  async removeProvider(scope: Scope, name: string): Promise<SettingsResult> {
    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);

    const index = config.prompt.providers.findIndex(
      (p: ProviderConfig) => p.name === name,
    );
    if (index === -1) {
      return {
        success: false,
        message: `Provider "${name}" not found`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    if (config.prompt.providers.length === 1) {
      return {
        success: false,
        message:
          "Cannot remove the last provider. At least one provider is required.",
        filePath: fsStore.resolveHome(configPath),
      };
    }

    config.prompt.providers.splice(index, 1);
    this.writeConfig(configPath, config);

    return {
      success: true,
      message: `Removed provider "${name}"`,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Update a provider
   */
  async updateProvider(
    scope: Scope,
    name: string,
    updates: Partial<ProviderConfig>,
  ): Promise<SettingsResult> {
    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);

    const provider = config.prompt.providers.find(
      (p: ProviderConfig) => p.name === name,
    );
    if (!provider) {
      return {
        success: false,
        message: `Provider "${name}" not found`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    // Apply updates (but prevent name changes for now)
    Object.assign(provider, { ...updates, name });

    this.writeConfig(configPath, config);

    return {
      success: true,
      message: `Updated provider "${name}"`,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Set default model
   */
  async setDefaultModel(scope: Scope, model: string): Promise<SettingsResult> {
    const configPath = this.resolvePath(scope);
    const config = this.readConfig(configPath);

    config.prompt.defaultModel = model;
    this.writeConfig(configPath, config);

    return {
      success: true,
      message: `Set default model to "${model}"`,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Mask API key for display (show first 4 and last 4 characters)
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return "***";
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Check file permissions and warn if not 600
   */
  checkPermissions(configPath: string): {
    secure: boolean;
    permissions: string;
  } {
    const resolvedPath = fsStore.resolveHome(configPath);

    if (!fs.existsSync(resolvedPath)) {
      return { secure: true, permissions: "N/A" };
    }

    try {
      const stats = fs.statSync(resolvedPath);
      const mode = stats.mode & 0o777;
      const permissions = mode.toString(8);

      return {
        secure: mode === 0o600,
        permissions,
      };
    } catch {
      return { secure: false, permissions: "unknown" };
    }
  }
}
