/**
 * Base class for launch adapters
 * Implements shared logic to keep subclasses DRY
 */

import type { LaunchAdapter } from "@/domain/interfaces.ts";
import type { ToolId, LaunchCommandSpec } from "@/domain/types.ts";
import { checkExecutable, getExecutableVersion } from "@/utils/runner.ts";

/**
 * Abstract base implementing SOLID principles:
 * - SRP: only responsible for building command specs
 * - Template Method: subclasses override specific pieces
 * - DRY: shares validateAvailability and getVersion logic
 */
export abstract class BaseLaunchAdapter implements LaunchAdapter {
  /**
   * Tool identifier (implemented by subclasses)
   */
  abstract readonly toolId: ToolId;

  /**
   * Executable name (implemented by subclasses)
   */
  abstract readonly executable: string;

  /**
   * Build the command spec for launching the tool
   */
  abstract buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
    settings?: string;
  }): LaunchCommandSpec;

  /**
   * Default availability check (subclasses may override)
   */
  async validateAvailability(): Promise<boolean> {
    return checkExecutable(this.executable);
  }

  /**
   * Default version check (subclasses may override)
   */
  async getVersion(): Promise<string> {
    try {
      return await getExecutableVersion(this.executable);
    } catch {
      return "unknown";
    }
  }
}
