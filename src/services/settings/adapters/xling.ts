/**
 * Xling settings adapter
 * Manages configuration at ~/.claude/xling.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type {
  Scope,
  SettingsListData,
  SettingsResult,
  ConfigObject,
  ConfigValue,
  EditOptions,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import { ConfigParseError } from "@/utils/errors.ts";
import {
  type XlingConfig,
  type ProviderConfig,
  type PlatformPipeline,
  type PlatformShell,
  type PipelineStep,
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
  resolvePath(_scope: Scope): string {
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
  protected override writeConfig(configPath: string, data: XlingConfig): void {
    const resolvedPath = fsStore.resolveHome(configPath);

    // Ensure directory exists
    fsStore.ensureDir(path.dirname(resolvedPath));

    try {
      // Atomic write
      const tempPath = `${resolvedPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");

      // Set secure permissions (cross-platform)
      this.#setSecurePermissions(tempPath);

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
  #setSecurePermissions(filePath: string): void {
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
    const configPath = this.validateAndResolvePath(scope);
    const resolvedPath = fsStore.resolveHome(configPath);
    const resolvedEditor = resolveEditorCommand(options.ide);

    // Ensure directory exists
    const directory = path.dirname(resolvedPath);
    fsStore.ensureDir(directory);

    // Create config file with default template if it doesn't exist
    if (!fs.existsSync(resolvedPath)) {
      this.writeConfig(configPath, DEFAULT_XLING_CONFIG);
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
    const configPath = this.validateAndResolvePath(scope);
    const config = this.readConfig(configPath);

    const serializeShell = (shell?: string | PlatformShell): ConfigValue => {
      if (!shell) return null;
      if (typeof shell === "string") return shell;

      return {
        win32: shell.win32 ?? null,
        darwin: shell.darwin ?? null,
        linux: shell.linux ?? null,
        default: shell.default,
      } satisfies ConfigObject;
    };

    const serializePipelineStep = (step: PipelineStep): ConfigObject => ({
      command:
        typeof step.command === "string"
          ? step.command
          : {
              win32: step.command.win32 ?? null,
              darwin: step.command.darwin ?? null,
              linux: step.command.linux ?? null,
              default: step.command.default,
            },
      args: Array.isArray(step.args)
        ? step.args
        : step.args
          ? {
              win32: step.args.win32 ?? null,
              darwin: step.args.darwin ?? null,
              linux: step.args.linux ?? null,
              default: step.args.default,
            }
          : null,
    });

    const serializePipeline = (
      pipeline?: PipelineStep[] | PlatformPipeline,
    ): ConfigValue => {
      if (!pipeline) return null;
      if (Array.isArray(pipeline)) {
        return pipeline.map((step) =>
          serializePipelineStep(step),
        ) as ConfigValue;
      }

      return {
        win32: pipeline.win32?.map(serializePipelineStep) ?? null,
        darwin: pipeline.darwin?.map(serializePipelineStep) ?? null,
        linux: pipeline.linux?.map(serializePipelineStep) ?? null,
        default: pipeline.default?.map(serializePipelineStep) ?? [],
      } satisfies ConfigObject;
    };

    // Convert to ConfigObject format
    const entries: ConfigObject = {
      defaultModel: config.defaultModel || null,
      retryPolicy: config.retryPolicy
        ? {
            maxRetries: config.retryPolicy.maxRetries ?? null,
            backoffMs: config.retryPolicy.backoffMs ?? null,
          }
        : null,
      providers: config.providers.map(
        (p: ProviderConfig): ConfigObject => ({
          name: p.name,
          baseUrl: p.baseUrl,
          models: p.models,
          priority: p.priority ?? null,
          timeout: p.timeout ?? null,
          apiKey: p.apiKey ? this.#maskApiKey(p.apiKey) : null,
          apiKeys: p.apiKeys ? p.apiKeys.map((k) => this.#maskApiKey(k)) : null,
        }),
      ),
      proxy: config.proxy
        ? {
            enabled: config.proxy.enabled ?? null,
            port: config.proxy.port ?? null,
            host: config.proxy.host ?? null,
            accessKey: config.proxy.accessKey ?? null,
            loadBalance: config.proxy.loadBalance ?? null,
            modelMapping: config.proxy.modelMapping ?? null,
            keyRotation: config.proxy.keyRotation
              ? {
                  enabled: config.proxy.keyRotation.enabled ?? null,
                  onError: config.proxy.keyRotation.onError ?? null,
                  cooldownMs: config.proxy.keyRotation.cooldownMs ?? null,
                }
              : null,
          }
        : null,
      shortcuts: config.shortcuts
        ? Object.fromEntries(
            Object.entries(config.shortcuts).map(([name, shortcut]) => [
              name,
              {
                command: shortcut.command ?? null,
                args: shortcut.args ?? null,
                shell: serializeShell(shortcut.shell),
                pipeline: serializePipeline(shortcut.pipeline),
                description: shortcut.description ?? null,
              } satisfies ConfigObject,
            ]),
          )
        : null,
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
    const configPath = this.validateAndResolvePath(scope);
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
      config.providers.some((p: ProviderConfig) => p.name === provider.name)
    ) {
      return {
        success: false,
        message: `Provider "${provider.name}" already exists`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    config.providers.push(provider);
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

    const index = config.providers.findIndex(
      (p: ProviderConfig) => p.name === name,
    );
    if (index === -1) {
      return {
        success: false,
        message: `Provider "${name}" not found`,
        filePath: fsStore.resolveHome(configPath),
      };
    }

    if (config.providers.length === 1) {
      return {
        success: false,
        message:
          "Cannot remove the last provider. At least one provider is required.",
        filePath: fsStore.resolveHome(configPath),
      };
    }

    config.providers.splice(index, 1);
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

    const provider = config.providers.find(
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

    config.defaultModel = model;
    this.writeConfig(configPath, config);

    return {
      success: true,
      message: `Set default model to "${model}"`,
      filePath: fsStore.resolveHome(configPath),
    };
  }

  /**
   * Switch profile (set default model)
   */
  override async switchProfile(
    scope: Scope,
    profile: string,
  ): Promise<SettingsResult> {
    return await this.setDefaultModel(scope, profile);
  }

  /**
   * Get all models from all providers for interactive selection
   */
  getAllModels(
    scope: Scope,
  ): Array<{ label: string; model: string; provider: string }> {
    const configPath = this.validateAndResolvePath(scope);
    const config = this.readConfig(configPath);

    const models: Array<{ label: string; model: string; provider: string }> =
      [];
    for (const provider of config.providers) {
      for (const model of provider.models) {
        models.push({
          label: `[${provider.name}] ${model}`,
          model,
          provider: provider.name,
        });
      }
    }
    return models;
  }

  /**
   * Get current default model
   */
  getDefaultModel(scope: Scope): string | undefined {
    const configPath = this.validateAndResolvePath(scope);
    const config = this.readConfig(configPath);
    return config.defaultModel;
  }

  /**
   * Mask API key for display (show first 4 and last 4 characters)
   */
  #maskApiKey(apiKey: string): string {
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
