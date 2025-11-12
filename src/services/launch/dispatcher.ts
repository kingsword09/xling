/**
 * Launch dispatcher
 * Routes requests to adapters (DIP-friendly)
 */

import type { LaunchAdapter } from "@/domain/interfaces.ts";
import type {
  LaunchPayload,
  LaunchResult,
  ToolId,
  ConfigValue,
} from "@/domain/types.ts";
import { ClaudeLaunchAdapter } from "./adapters/claude.ts";
import { CodexLaunchAdapter } from "./adapters/codex.ts";
import { spawnProcess } from "@/utils/runner.ts";
import { UnsupportedToolError } from "@/utils/errors.ts";

/**
 * Applies SOLID principles:
 * - SRP: only handles dispatching and process launch
 * - OCP: registerAdapter enables extension
 * - DIP: depends on LaunchAdapter, not concrete classes
 * - LSP: adapters are interchangeable
 */
export class LaunchDispatcher {
  private adapters: Map<ToolId, LaunchAdapter>;

  constructor() {
    this.adapters = new Map();

    // Register built-in adapters
    this.adapters.set("claude", new ClaudeLaunchAdapter());
    this.adapters.set("codex", new CodexLaunchAdapter());
    // Gemini adapter will be added later
  }

  /**
   * Execute a launch request
   */
  async execute(payload: LaunchPayload): Promise<LaunchResult> {
    const adapter = this.getAdapter(payload.tool);

    // 1. Check tool availability
    const isAvailable = await adapter.validateAvailability();
    if (!isAvailable) {
      return {
        success: false,
        message: `Tool "${payload.tool}" is not installed or not found in PATH`,
      };
    }

    // 2. Build the command spec
    const yolo = payload.yolo ?? true; // yolo mode is on by default
    const spec = adapter.buildCommandSpec({
      yolo,
      resume: payload.resume,
      continue: payload.continue,
    });

    // 3. Spawn the process
    try {
      const { pid, command } = await spawnProcess(spec, {
        cwd: payload.cwd,
        args: payload.args,
      });

      const telemetry = {
        tool: payload.tool,
        yolo,
        args: payload.args ?? [],
      } as Record<string, ConfigValue>;

      if (payload.resume !== undefined) {
        telemetry.resume = payload.resume;
      }

      if (payload.continue !== undefined) {
        telemetry.continue = payload.continue;
      }

      if (payload.cwd) {
        telemetry.cwd = payload.cwd;
      }

      return {
        success: true,
        pid,
        command,
        message: `Launched ${payload.tool} successfully (PID: ${pid})`,
        data: telemetry,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to launch ${payload.tool}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Resolve the adapter for a tool
   * @throws UnsupportedToolError when the tool is unknown
   */
  private getAdapter(tool: ToolId): LaunchAdapter {
    const adapter = this.adapters.get(tool);
    if (!adapter) {
      throw new UnsupportedToolError(tool);
    }
    return adapter;
  }

  /**
   * Register a new adapter (OCP extension point)
   */
  registerAdapter(adapter: LaunchAdapter): void {
    this.adapters.set(adapter.toolId, adapter);
  }

  /**
   * Return all supported tool IDs
   */
  getSupportedTools(): ToolId[] {
    return Array.from(this.adapters.keys());
  }
}
