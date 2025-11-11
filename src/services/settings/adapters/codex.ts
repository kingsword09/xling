/**
 * Codex 适配器
 */

import type {
  Scope,
  SettingsResult,
  SettingsListData,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import { InvalidScopeError, ProfileNotFoundError } from "@/utils/errors.ts";
import * as fsStore from "@/services/settings/fsStore.ts";

/**
 * Codex 配置适配器
 *
 * 配置文件路径：
 * - user: ~/.codex/config.toml
 *
 * 支持 profile 切换
 */
export class CodexAdapter extends BaseAdapter {
  readonly toolId = "codex" as const;

  /**
   * 自定义 list：聚焦 model_providers
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
   * 解析配置文件路径
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
   * 验证 scope 是否有效
   */
  validateScope(scope: Scope): boolean {
    return scope === "user";
  }

  /**
   * 切换 profile
   */
  async switchProfile(scope: Scope, profile: string): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);

    // 检查 profile 是否存在
    const profiles = config.profiles as Record<string, unknown> | undefined;
    if (!profiles || !(profile in profiles)) {
      throw new ProfileNotFoundError(profile);
    }

    // 获取 profile 配置
    const profileConfig = profiles[profile] as Record<string, unknown>;

    // 将 profile 配置合并到根配置
    const newConfig = { ...config };
    for (const [key, value] of Object.entries(profileConfig)) {
      newConfig[key] = value;
    }

    // 设置当前 profile
    newConfig.current_profile = profile;

    // 写入配置
    this.writeConfig(path, newConfig);

    return {
      success: true,
      message: `Switched to profile: ${profile}`,
      filePath: path,
    };
  }

  /**
   * 读取 TOML 配置文件
   */
  protected readConfig(path: string): Record<string, unknown> {
    return fsStore.readTOML(path);
  }

  /**
   * 写入 TOML 配置文件
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
