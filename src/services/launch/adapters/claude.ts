/**
 * Claude Code launch adapter
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

/**
 * Applies Claude-specific flags:
 * - Yolo mode: --dangerously-skip-permissions
 * - Resume picker: -r
 * - Continue last conversation: -c
 * - Settings: --settings <file-or-json>
 */
export class ClaudeLaunchAdapter extends BaseLaunchAdapter {
  readonly toolId = "claude" as const;
  readonly executable = "claude";

  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
    settings?: string;
  }): LaunchCommandSpec {
    const baseArgs: string[] = [];

    // Resume and continue are mutually exclusive
    if (payload.continue) {
      baseArgs.push("-c");
    } else if (payload.resume) {
      baseArgs.push("-r");
    }

    // Handle settings parameter
    if (payload.settings) {
      const settingsValue = this.#resolveSettingsValue(payload.settings);
      baseArgs.push("--settings", settingsValue);
    }

    return {
      executable: this.executable,
      baseArgs,
      yoloArgs: payload.yolo ? ["--dangerously-skip-permissions"] : undefined,
    };
  }

  /**
   * Resolve settings value to proper format for Claude Code
   * - If it's a JSON string, use as-is
   * - If it's an absolute path, use as-is
   * - If it's a variant name (e.g., "hxi"), resolve to user settings path
   * - If it's a relative path, resolve relative to cwd
   */
  #resolveSettingsValue(settings: string): string {
    // Check if it's JSON
    if (settings.trim().startsWith("{")) {
      return settings;
    }

    // Check if it's an absolute path
    if (path.isAbsolute(settings)) {
      return settings;
    }

    // Check if it ends with .json (relative path)
    if (settings.endsWith(".json")) {
      return settings;
    }

    // Otherwise, treat as variant name and resolve to user settings path
    const userSettingsDir = path.join(os.homedir(), ".claude");
    const variantPath = path.join(userSettingsDir, `settings.${settings}.json`);

    // Check if the variant file exists
    if (fs.existsSync(variantPath)) {
      return variantPath;
    }

    // Try alternate naming patterns
    const alternatePath = path.join(
      userSettingsDir,
      `settings-${settings}.json`,
    );
    if (fs.existsSync(alternatePath)) {
      return alternatePath;
    }

    // If file doesn't exist, still return the path - Claude will handle the error
    return variantPath;
  }
}
