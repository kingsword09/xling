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
 * - Default interactive session: `codex`
 */
export class CodexLaunchAdapter extends BaseLaunchAdapter {
  readonly toolId = "codex" as const;
  readonly executable = "codex";

  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
  }): LaunchCommandSpec {
    const baseArgs: string[] = [];

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
}
