/**
 * Settings dispatcher
 * Routes requests to the appropriate adapter (DIP)
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
 * Applies SOLID principles:
 * - OCP: add new tools by registering adapters in the constructor
 * - DIP: depends on the SettingsAdapter interface
 * - SRP: only handles dispatching, not business logic
 */
export class SettingsDispatcher {
  private adapters: Map<ToolId, SettingsAdapter>;

  constructor() {
    // Register built-in adapters
    this.adapters = new Map<ToolId, SettingsAdapter>();
    this.adapters.set("claude", new ClaudeAdapter());
    this.adapters.set("codex", new CodexAdapter());
    this.adapters.set("gemini", new GeminiAdapter());
  }

  /**
   * Execute the requested settings action
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
        return await adapter.switchProfile(
          payload.scope,
          payload.profile,
          payload.switchOptions,
        );

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
   * Return the adapter for a tool (or throw)
   */
  private getAdapter(tool: ToolId): SettingsAdapter {
    const adapter = this.adapters.get(tool);
    if (!adapter) {
      throw new UnsupportedToolError(tool);
    }
    return adapter;
  }

  /**
   * Register a new adapter (extension point)
   */
  registerAdapter(adapter: SettingsAdapter): void {
    this.adapters.set(adapter.toolId, adapter);
  }

  /**
   * Return all supported tool IDs
   */
  getSupportedTools(): ToolId[] {
    return Array.from(this.adapters.keys());
  }
}
