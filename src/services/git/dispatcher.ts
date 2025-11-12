/**
 * Git command dispatcher
 * Routes git commands to appropriate service handlers (DIP: depends on abstractions)
 */

import type { GitCommandPayload, GitCommandResult } from "@/domain/git.ts";
import { checkoutPr } from "./pr.ts";
import { viewPr } from "./view.ts";
import { manageWorktree } from "./worktree.ts";
import { createPr } from "./create.ts";
import { ensureGitRepo } from "./utils.ts";

/**
 * Git command dispatcher
 * Orchestrates git operations by delegating to specialized services
 */
export class GitDispatcher {
  /**
   * Execute a git command
   * @param payload Command payload with subcommand and data
   * @returns Command execution result
   */
  async execute(payload: GitCommandPayload): Promise<GitCommandResult> {
    // Validate git repository (except for prv which can work outside repo)
    if (payload.command !== "prv") {
      await ensureGitRepo(payload.cwd);
    }

    // Route to appropriate handler
    switch (payload.command) {
      case "worktree":
        return manageWorktree(payload.data as any, payload.cwd);

      case "prr":
        return checkoutPr(payload.data as any, payload.cwd);

      case "prv":
        return viewPr(payload.data as any, payload.cwd);

      case "prc":
        return createPr(payload.data as any, payload.cwd);

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = payload.command;
        throw new Error(`Unknown git command: ${_exhaustive}`);
    }
  }
}
