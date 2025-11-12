/**
 * PR checkout service
 * Handles PR branch checkout with gh/git fallback strategy
 */

import type { GitPrRequest, GitCommandResult } from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { GitCommandError } from "@/utils/errors.ts";
import { detectGhCli } from "./utils.ts";

/**
 * Checkout a PR branch
 * Strategy: Try gh CLI first, fallback to git fetch if unavailable
 * @param request PR checkout request
 * @param cwd Working directory
 * @returns Command result
 */
export async function checkoutPr(
  request: GitPrRequest,
  cwd?: string
): Promise<GitCommandResult> {
  const { id, branch = `pr/${id}`, strategy, remote = 'origin' } = request;

  // Strategy 1: Try GitHub CLI
  if (strategy !== 'git') {
    const hasGh = await detectGhCli();
    if (hasGh) {
      try {
        const result = await runCommand('gh', ['pr', 'checkout', id], {
          cwd,
          throwOnError: false
        });

        if (result.success) {
          return {
            success: true,
            message: `Checked out PR #${id} using GitHub CLI`,
            details: { strategy: 'gh', branch },
          };
        }
      } catch {
        // Fall back to git strategy
      }
    }
  }

  // Strategy 2: Fallback to git fetch
  const prRef = `pull/${id}/head:${branch}`;

  const fetchResult = await runCommand(
    'git',
    ['fetch', remote, prRef],
    { cwd, throwOnError: false }
  );

  if (!fetchResult.success) {
    throw new GitCommandError(`git fetch ${remote} ${prRef}`, fetchResult.stderr);
  }

  // Switch to the branch
  const switchResult = await runCommand(
    'git',
    ['switch', branch],
    { cwd, throwOnError: false }
  );

  if (!switchResult.success) {
    throw new GitCommandError(`git switch ${branch}`, switchResult.stderr);
  }

  return {
    success: true,
    message: `Checked out PR #${id} to branch '${branch}' using git`,
    details: { strategy: 'git', branch, remote },
  };
}
