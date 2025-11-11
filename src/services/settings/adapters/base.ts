/**
 * 适配器抽象基类
 * 实现通用逻辑，减少重复代码（DRY 原则）
 */

import type { SettingsAdapter } from '../../../domain/interfaces.ts';
import type {
  ToolId,
  Scope,
  SettingsResult,
  InspectResult,
  SettingsListData,
} from '../../../domain/types.ts';
import {
  InvalidScopeError,
  ConfigKeyNotFoundError,
} from '../../../utils/errors.ts';
import * as fsStore from '../fsStore.ts';
import { generateDiff } from '../../../utils/format.ts';
import { parseValue } from '../../../domain/validators.ts';

/**
 * 抽象基类
 */
export abstract class BaseAdapter implements SettingsAdapter {
  abstract readonly toolId: ToolId;

  /**
   * 子类必须实现的方法
   */
  abstract resolvePath(scope: Scope): string;
  abstract validateScope(scope: Scope): boolean;

  /**
   * 列出所有配置
   */
  async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);

    return {
      type: 'entries',
      entries: config,
      filePath: path,
    };
  }

  /**
   * 获取配置值
   */
  async get(scope: Scope, key: string): Promise<unknown> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);
    const value = fsStore.getNestedValue(config, key);

    if (value === undefined) {
      throw new ConfigKeyNotFoundError(key);
    }

    return value;
  }

  /**
   * 设置配置值
   */
  async set(
    scope: Scope,
    key: string,
    value: unknown,
    dryRun = false,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    let config: Record<string, unknown> = {};

    // 读取现有配置（如果存在）
    try {
      config = this.readConfig(path);
    } catch {
      // 文件不存在，使用空对象
      config = {};
    }

    // 获取旧值用于 diff
    const oldValue = fsStore.getNestedValue(config, key);

    // 解析值
    const parsedValue = typeof value === 'string' ? parseValue(value) : value;

    // 设置新值
    const newConfig = fsStore.setNestedValue(config, key, parsedValue);

    // 生成 diff
    const diff = generateDiff(oldValue, parsedValue, key);

    // Dry run 模式
    if (dryRun) {
      return {
        success: true,
        message: 'Dry run - no changes applied',
        filePath: path,
        diff,
      };
    }

    // 写入配置
    this.writeConfig(path, newConfig);

    return {
      success: true,
      message: `Set ${key} = ${parsedValue}`,
      filePath: path,
      diff,
    };
  }

  /**
   * 删除配置项
   */
  async unset(
    scope: Scope,
    key: string,
    dryRun = false,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const path = this.resolvePath(scope);
    const config = this.readConfig(path);

    // 检查键是否存在
    const oldValue = fsStore.getNestedValue(config, key);
    if (oldValue === undefined) {
      throw new ConfigKeyNotFoundError(key);
    }

    // 删除键
    const newConfig = fsStore.deleteNestedKey(config, key);

    // 生成 diff
    const diff = generateDiff(oldValue, undefined, key);

    // Dry run 模式
    if (dryRun) {
      return {
        success: true,
        message: 'Dry run - no changes applied',
        filePath: path,
        diff,
      };
    }

    // 写入配置
    this.writeConfig(path, newConfig);

    return {
      success: true,
      message: `Unset ${key}`,
      filePath: path,
      diff,
    };
  }

  /**
   * 检查配置文件
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
   * 读取配置文件（子类可覆盖）
   */
  protected readConfig(path: string): Record<string, unknown> {
    return fsStore.readJSON(path);
  }

  /**
   * 写入配置文件（子类可覆盖）
   */
  protected writeConfig(path: string, data: Record<string, unknown>): void {
    fsStore.writeJSON(path, data);
  }
}
