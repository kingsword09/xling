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
import { XlingAdapter } from "./adapters/xling.ts";
import {
  UnsupportedToolError,
  InvalidPayloadError,
  UnsupportedActionError,
} from "@/utils/errors.ts";

/**
 * Applies SOLID principles:
 * - OCP: add new tools by registering adapters in the constructor
 * - DIP: depends on the SettingsAdapter interface
 * - SRP: only handles dispatching, not business logic
 */
export class SettingsDispatcher {
  #adapters: Map<ToolId, SettingsAdapter>;

  constructor() {
    // Register built-in adapters
    this.#adapters = new Map<ToolId, SettingsAdapter>();
    this.#adapters.set("claude", new ClaudeAdapter());
    this.#adapters.set("codex", new CodexAdapter());
    this.#adapters.set("gemini", new GeminiAdapter());
    this.#adapters.set("xling", new XlingAdapter());
  }

  /**
   * Execute the requested settings action
   */
  async execute(payload: SettingsPayload): Promise<SettingsResult> {
    const adapter = this.#getAdapter(payload.tool);

    switch (payload.action) {
      case "list":
        return {
          success: true,
          data: await adapter.list(payload.scope),
        };

      case "switch-profile":
        if (!payload.profile) {
          throw new InvalidPayloadError(
            "Profile is required for switch-profile action",
          );
        }
        if (!adapter.switchProfile) {
          throw new UnsupportedActionError("switch-profile", payload.tool);
        }
        return await adapter.switchProfile(
          payload.scope,
          payload.profile,
          payload.switchOptions,
        );

      case "edit":
        if (!adapter.edit) {
          throw new UnsupportedActionError("edit", payload.tool);
        }
        return await adapter.edit(payload.scope, {
          name: payload.name,
          ide: payload.ide,
          provider: payload.provider,
        });

      case "inspect":
        if (!adapter.inspect) {
          throw new UnsupportedActionError("inspect", payload.tool);
        }
        return {
          success: true,
          data: await adapter.inspect(payload.scope, payload.name),
        };

      default:
        throw new UnsupportedActionError(payload.action);
    }
  }

  /**
   * Return the adapter for a tool (or throw)
   */
  #getAdapter(tool: ToolId): SettingsAdapter {
    const adapter = this.#adapters.get(tool);
    if (!adapter) {
      throw new UnsupportedToolError(tool);
    }
    return adapter;
  }

  /**
   * Register a new adapter (extension point)
   */
  registerAdapter(adapter: SettingsAdapter): void {
    this.#adapters.set(adapter.toolId, adapter);
  }

  /**
   * Return all supported tool IDs
   */
  getSupportedTools(): ToolId[] {
    return Array.from(this.#adapters.keys());
  }
}
