/**
 * Codex launch adapter
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

/**
 * Applies Codex-specific behavior:
 * - Yolo mode: --dangerously-bypass-approvals-and-sandbox
 * - Resume picker: `codex resume`
 * - Continue last session: `codex resume --last`
 * - Settings: -c key=value (can be repeated)
 * - Default interactive session: `codex`
 */
export class CodexLaunchAdapter extends BaseLaunchAdapter {
  readonly toolId = "codex" as const;
  readonly executable = "codex";

  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
    settings?: string;
  }): LaunchCommandSpec {
    const baseArgs: string[] = [];

    // Handle settings parameter (before resume/continue to ensure proper order)
    if (payload.settings) {
      const configArgs = this.#parseSettings(payload.settings);
      baseArgs.push(...configArgs);
    }

    // Resume and continue flags are mutually exclusive
    if (payload.continue) {
      // codex resume --last
      baseArgs.push("resume", "--last");
    } else if (payload.resume) {
      // codex resume
      baseArgs.push("resume");
    }
    // Otherwise launch the default interactive session

    return {
      executable: this.executable,
      baseArgs,
      yoloArgs: payload.yolo
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : undefined,
    };
  }

  /**
   * Parse settings string into Codex config arguments
   * Supports:
   * - Single config: "model=o3"
   * - Multiple configs separated by semicolon: "model=o3;shell_environment_policy.inherit=all"
   * - Profile name (for documentation purposes - users should use settings:switch instead)
   */
  #parseSettings(settings: string): string[] {
    const args: string[] = [];

    // Check if it contains "=" (config key-value pair)
    if (settings.includes("=")) {
      // Split by semicolon to support multiple configs
      const configs = settings.split(";").map((c) => c.trim());
      for (const config of configs) {
        if (config) {
          args.push("-c", config);
        }
      }
    } else {
      // Treat as profile name - note that Codex doesn't support direct profile switching
      // Users should use `xling settings:switch <profile> --tool codex` first
      // For now, we'll pass it as a model config assuming it's a model name
      args.push("-c", `model=${settings}`);
    }

    return args;
  }
}
