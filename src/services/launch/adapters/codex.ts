/**
 * Codex Launch 适配器
 */

import { BaseLaunchAdapter } from "./base.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

/**
 * Codex 启动适配器
 *
 * Yolo 模式: --dangerously-bypass-approvals-and-sandbox
 * Resume 模式: resume (显示会话列表选择)
 * Continue 模式: resume --last (继续最后一个会话)
 * 启动交互式会话: codex --dangerously-bypass-approvals-and-sandbox
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

    // Resume 和 Continue 是互斥的
    if (payload.continue) {
      // codex resume --last
      baseArgs.push("resume", "--last");
    } else if (payload.resume) {
      // codex resume
      baseArgs.push("resume");
    }
    // 否则直接启动交互式会话，baseArgs 为空

    return {
      executable: this.executable,
      baseArgs,
      yoloArgs: payload.yolo
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : undefined,
    };
  }
}
