/**
 * Git worktree service
 * Manages git worktrees (list, add, remove, prune)
 */

import type { GitWorktreeRequest, GitCommandResult } from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { GitCommandError } from "@/utils/errors.ts";

/**
 * Manage git worktrees
 * @param request Worktree operation request
 * @param cwd Working directory
 * @returns Command result
 */
export async function manageWorktree(
  request: GitWorktreeRequest,
  cwd?: string
): Promise<GitCommandResult> {
  const { action, path, branch, force, detach } = request;

  switch (action) {
    case 'list': {
      const result = await runCommand('git', ['worktree', 'list', '--porcelain'], {
        cwd,
        throwOnError: false
      });

      if (!result.success) {
        throw new GitCommandError('git worktree list', result.stderr);
      }

      return {
        success: true,
        message: 'Worktree list retrieved',
        details: { output: result.stdout },
      };
    }

    case 'add': {
      if (!path || !branch) {
        throw new Error('--path and --branch required for add action');
      }

      const args = ['worktree', 'add'];
      if (force) args.push('--force');
      if (detach) args.push('--detach');
      args.push(path, branch);

      const result = await runCommand('git', args, { cwd, throwOnError: false });

      if (!result.success) {
        throw new GitCommandError(`git worktree add ${path} ${branch}`, result.stderr);
      }

      return {
        success: true,
        message: `Created worktree at ${path} for branch ${branch}`,
        details: { path, branch },
      };
    }

    case 'remove': {
      if (!path) {
        throw new Error('--path required for remove action');
      }

      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(path);

      const result = await runCommand('git', args, { cwd, throwOnError: false });

      if (!result.success) {
        throw new GitCommandError(`git worktree remove ${path}`, result.stderr);
      }

      return {
        success: true,
        message: `Removed worktree at ${path}`,
        details: { path },
      };
    }

    case 'prune': {
      const result = await runCommand('git', ['worktree', 'prune'], {
        cwd,
        throwOnError: false
      });

      if (!result.success) {
        throw new GitCommandError('git worktree prune', result.stderr);
      }

      return {
        success: true,
        message: 'Pruned stale worktrees',
        details: { output: result.stdout },
      };
    }

    default:
      throw new Error(`Unknown worktree action: ${action}`);
  }
}
