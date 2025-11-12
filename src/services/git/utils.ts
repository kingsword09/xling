/**
 * Git utility functions
 * Shared helpers for git operations
 */

import { GitRepositoryError } from "@/utils/errors.ts";
import { runCommand, checkExecutable } from "@/utils/runner.ts";

/**
 * Ensure we're in a git repository
 * @param cwd Working directory to check
 * @throws GitRepositoryError if not in a git repo
 */
export async function ensureGitRepo(
  cwd: string = process.cwd(),
): Promise<void> {
  try {
    const result = await runCommand(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      {
        cwd,
        silent: true,
        throwOnError: false,
      },
    );

    if (!result.success || result.stdout.trim() !== "true") {
      throw new GitRepositoryError(cwd);
    }
  } catch {
    throw new GitRepositoryError(cwd);
  }
}

/**
 * Check if GitHub CLI is available
 * @returns True if gh CLI is installed
 */
export async function detectGhCli(): Promise<boolean> {
  return await checkExecutable("gh");
}
