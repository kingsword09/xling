/**
 * Claude Code launch adapter
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

/**
 * Applies Claude-specific flags:
 * - Yolo mode: --dangerously-skip-permissions
 * - Resume picker: -r
 * - Continue last conversation: -c
 */
export class ClaudeLaunchAdapter extends BaseLaunchAdapter {
  readonly toolId = "claude" as const;
  readonly executable = "claude";

  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
  }): LaunchCommandSpec {
    const baseArgs: string[] = [];

    // Resume and continue are mutually exclusive
    if (payload.continue) {
      baseArgs.push("-c");
    } else if (payload.resume) {
      baseArgs.push("-r");
    }

    return {
      executable: this.executable,
      baseArgs,
      yoloArgs: payload.yolo ? ["--dangerously-skip-permissions"] : undefined,
    };
  }
}
