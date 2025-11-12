/**
 * Launch 适配器抽象基类
 * 实现通用逻辑，减少重复代码（DRY 原则）
 */

import type { LaunchAdapter } from "@/domain/interfaces.ts";
import type { ToolId, LaunchCommandSpec } from "@/domain/types.ts";
import { checkExecutable, getExecutableVersion } from "@/utils/runner.ts";

/**
 * 抽象基类
 * 体现 SOLID 原则：
 * - SRP: 只负责命令规范构建
 * - Template Method: 定义算法骨架，子类实现具体步骤
 * - DRY: 复用 validateAvailability 和 getVersion 实现
 */
export abstract class BaseLaunchAdapter implements LaunchAdapter {
  /**
   * 工具标识符（子类必须实现）
   */
  abstract readonly toolId: ToolId;

  /**
   * 可执行文件名称（子类必须实现）
   */
  abstract readonly executable: string;

  /**
   * 构建启动命令配置（子类必须实现）
   * @param payload Launch 请求参数
   * @returns 命令规范
   */
  abstract buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
  }): LaunchCommandSpec;

  /**
   * 默认实现：检查可执行文件是否存在
   * 子类可以覆盖此方法以提供自定义验证逻辑
   */
  async validateAvailability(): Promise<boolean> {
    return checkExecutable(this.executable);
  }

  /**
   * 默认版本检查实现
   * 子类可以覆盖此方法以使用不同的版本参数
   */
  async getVersion(): Promise<string> {
    try {
      return await getExecutableVersion(this.executable);
    } catch {
      return "unknown";
    }
  }
}
