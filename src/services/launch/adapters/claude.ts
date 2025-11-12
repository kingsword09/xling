/**
 * Claude Code Launch 适配器
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

/**
 * Claude Code 启动适配器
 *
 * Yolo 模式: --dangerously-skip-permissions
 * Resume 模式: -r (显示对话列表选择)
 * Continue 模式: -c (继续最后一个对话)
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

    // Resume 和 Continue 是互斥的
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
