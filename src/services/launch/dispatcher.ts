/**
 * Launch 调度器
 * 负责将请求路由到对应的适配器（DIP 原则）
 */

import type { LaunchAdapter } from "@/domain/interfaces.ts";
import type { LaunchPayload, LaunchResult, ToolId } from "@/domain/types.ts";
import { ClaudeLaunchAdapter } from "./adapters/claude.ts";
import { CodexLaunchAdapter } from "./adapters/codex.ts";
import { spawnProcess } from "@/utils/runner.ts";
import { UnsupportedToolError } from "@/utils/errors.ts";

/**
 * Launch 调度器
 *
 * 体现 SOLID 原则：
 * - SRP: 只负责调度和进程启动
 * - OCP: 通过 registerAdapter 支持扩展
 * - DIP: 依赖 LaunchAdapter 接口，不依赖具体实现
 * - LSP: 所有适配器可互换使用
 */
export class LaunchDispatcher {
  private adapters: Map<ToolId, LaunchAdapter>;

  constructor() {
    this.adapters = new Map();

    // 注册 Claude 和 Codex 适配器
    this.adapters.set("claude", new ClaudeLaunchAdapter());
    this.adapters.set("codex", new CodexLaunchAdapter());
    // Gemini 适配器将在后续实现
  }

  /**
   * 执行 launch 操作
   * @param payload Launch 请求参数
   * @returns Launch 结果
   */
  async execute(payload: LaunchPayload): Promise<LaunchResult> {
    const adapter = this.getAdapter(payload.tool);

    // 1. 检查工具是否可用
    const isAvailable = await adapter.validateAvailability();
    if (!isAvailable) {
      return {
        success: false,
        message: `Tool "${payload.tool}" is not installed or not found in PATH`,
      };
    }

    // 2. 构建命令配置
    const yolo = payload.yolo ?? true; // 默认启用 yolo 模式
    const spec = adapter.buildCommandSpec({
      yolo,
      resume: payload.resume,
      continue: payload.continue,
    });

    // 3. 启动进程
    try {
      const { pid, command } = await spawnProcess(spec, {
        cwd: payload.cwd,
        args: payload.args,
      });

      return {
        success: true,
        pid,
        command,
        message: `Launched ${payload.tool} successfully (PID: ${pid})`,
        data: {
          tool: payload.tool,
          yolo,
          resume: payload.resume,
          continue: payload.continue,
          args: payload.args ?? [],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to launch ${payload.tool}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取适配器
   * @param tool 工具 ID
   * @returns 对应的适配器
   * @throws UnsupportedToolError 如果工具不支持
   */
  private getAdapter(tool: ToolId): LaunchAdapter {
    const adapter = this.adapters.get(tool);
    if (!adapter) {
      throw new UnsupportedToolError(tool);
    }
    return adapter;
  }

  /**
   * 注册新适配器（扩展点，体现 OCP）
   * @param adapter 适配器实例
   */
  registerAdapter(adapter: LaunchAdapter): void {
    this.adapters.set(adapter.toolId, adapter);
  }

  /**
   * 获取所有支持的工具
   * @returns 工具 ID 列表
   */
  getSupportedTools(): ToolId[] {
    return Array.from(this.adapters.keys());
  }
}
