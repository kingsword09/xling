/**
 * Gemini CLI settings adapter
 */

import type { Scope } from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Resolves the following config paths:
 * - user: ~/.gemini/settings.json
 * - project: <cwd>/.gemini/settings.json
 * - system: platform-specific path
 */
export class GeminiAdapter extends BaseAdapter {
  readonly toolId = "gemini" as const;

  /**
   * Resolve the configuration path for each scope
   */
  resolvePath(scope: Scope): string {
    switch (scope) {
      case "user":
        return "~/.gemini/settings.json";
      case "project":
        return ".gemini/settings.json";
      case "system":
        return this.#getSystemConfigPath();
      default:
        throw new Error(`Unsupported scope for Gemini: ${scope}`);
    }
  }

  /**
   * Validate supported scopes
   */
  validateScope(scope: Scope): boolean {
    return ["user", "project", "system"].includes(scope);
  }

  /**
   * Determine the system-level config path across platforms
   */
  #getSystemConfigPath(): string {
    const platform = os.platform();

    switch (platform) {
      case "darwin": // macOS
        return "/Library/Application Support/Gemini/settings.json";
      case "win32": // Windows
        return path.join(
          process.env.PROGRAMDATA || "C:\\ProgramData",
          "Gemini",
          "settings.json",
        );
      case "linux":
        return "/etc/gemini/settings.json";
      default:
        return "/etc/gemini/settings.json";
    }
  }
}
