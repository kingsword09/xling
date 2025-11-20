/**
 * Gemini CLI launch adapter
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

/**
 * Maps xling launch options to Gemini CLI flags:
 * - Yolo mode: -y
 * - Continue last session: --resume latest
 * - List sessions: --list-sessions
 * - Model selection: -m <model> (reuse settings flag)
 */
export class GeminiLaunchAdapter extends BaseLaunchAdapter {
  readonly toolId = "gemini" as const;
  readonly executable = "gemini";

  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
    settings?: string;
  }): LaunchCommandSpec {
    const baseArgs: string[] = [];

    // Session handling mirrors x command semantics
    if (payload.continue) {
      baseArgs.push("--resume", "latest");
    } else if (payload.resume) {
      baseArgs.push("--list-sessions");
    }

    // Use settings flag to pass a model selection (first non-empty token)
    if (payload.settings) {
      const model = payload.settings.split(";").map((value) => value.trim())[0];
      if (model) {
        baseArgs.push("-m", model);
      }
    }

    return {
      executable: this.executable,
      baseArgs,
      yoloArgs: payload.yolo ? ["-y"] : undefined,
    };
  }
}
