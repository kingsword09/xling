/**
 * 适配器抽象基类
 * 实现通用逻辑，减少重复代码（DRY 原则）
 */

import type { SettingsAdapter } from "../../../domain/interfaces.ts";
import type {
  ToolId,
  Scope,
  InspectResult,
  SettingsListData,
} from "../../../domain/types.ts";
import { InvalidScopeError } from "../../../utils/errors.ts";
import * as fsStore from "../fsStore.ts";

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
      type: "entries",
      entries: config,
      filePath: path,
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
