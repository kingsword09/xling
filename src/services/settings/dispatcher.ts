/**
 * Settings 调度器
 * 负责将请求路由到对应的适配器（DIP 原则）
 */

import type { SettingsAdapter } from "@/domain/interfaces.ts";
import type {
  SettingsPayload,
  SettingsResult,
  ToolId,
} from "@/domain/types.ts";
import { ClaudeAdapter } from "./adapters/claude.ts";
import { CodexAdapter } from "./adapters/codex.ts";
import { GeminiAdapter } from "./adapters/gemini.ts";
import { UnsupportedToolError } from "@/utils/errors.ts";

/**
 * Settings 调度器
 *
 * 体现 SOLID 原则：
 * - OCP: 新增工具只需在构造函数中注册适配器
 * - DIP: 依赖 SettingsAdapter 接口，不依赖具体实现
 * - SRP: 只负责调度，不处理具体逻辑
 */
export class SettingsDispatcher {
  private adapters: Map<ToolId, SettingsAdapter>;

  constructor() {
    // 注册所有适配器
    this.adapters = new Map<ToolId, SettingsAdapter>();
    this.adapters.set("claude", new ClaudeAdapter());
    this.adapters.set("codex", new CodexAdapter());
    this.adapters.set("gemini", new GeminiAdapter());
  }

  /**
   * 执行 settings 操作
   */
  async execute(payload: SettingsPayload): Promise<SettingsResult> {
    const adapter = this.getAdapter(payload.tool);

    switch (payload.action) {
      case "list":
        return {
          success: true,
          data: await adapter.list(payload.scope),
        };

      case "switch-profile":
        if (!payload.profile) {
          throw new Error("Profile is required for switch-profile action");
        }
        if (!adapter.switchProfile) {
          throw new Error(
            `Tool ${payload.tool} does not support profile switching`,
          );
        }
        return await adapter.switchProfile(payload.scope, payload.profile);

      case "edit":
        if (!adapter.edit) {
          throw new Error(
            `Tool ${payload.tool} does not support editing via CLI`,
          );
        }
        return await adapter.edit(payload.scope, {
          name: payload.name,
          ide: payload.ide,
        });

      case "inspect":
        if (!adapter.inspect) {
          throw new Error(
            `Tool ${payload.tool} does not support inspect action`,
          );
        }
        return {
          success: true,
          data: await adapter.inspect(payload.scope),
        };

      default:
        throw new Error(`Unsupported action: ${payload.action}`);
    }
  }

  /**
   * 获取适配器
   */
  private getAdapter(tool: ToolId): SettingsAdapter {
    const adapter = this.adapters.get(tool);
    if (!adapter) {
      throw new UnsupportedToolError(tool);
    }
    return adapter;
  }

  /**
   * 注册新的适配器（扩展点）
   */
  registerAdapter(adapter: SettingsAdapter): void {
    this.adapters.set(adapter.toolId, adapter);
  }

  /**
   * 获取所有支持的工具
   */
  getSupportedTools(): ToolId[] {
    return Array.from(this.adapters.keys());
  }
}
