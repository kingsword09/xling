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

    if (payload.command === "worktree") {
      return manageWorktree(payload.data, payload.cwd);
    }

    if (payload.command === "prr") {
      return checkoutPr(payload.data, payload.cwd);
    }

    if (payload.command === "prv") {
      return viewPr(payload.data, payload.cwd);
    }

    if (payload.command === "prc") {
      return createPr(payload.data, payload.cwd);
    }

    const _exhaustive: never = payload;
    throw new Error(`Unknown git command: ${_exhaustive}`);
  }
}
