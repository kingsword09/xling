/**
 * Git worktree service
 * Manages git worktrees (list, add, remove, prune, switch)
 */

import type { GitWorktreeRequest, GitCommandResult } from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { GitCommandError } from "@/utils/errors.ts";
import path from "node:path";
import { existsSync } from "node:fs";

/**
 * Get repository name from current directory
 * @param cwd Current working directory
 * @returns Repository name
 */
function getRepoName(cwd: string): string {
  const repoPath = path.basename(cwd);
  return repoPath;
}

/**
 * Generate default worktree path
 * Format: ../repo-name-branch-name (following xlaude convention)
 * @param cwd Current working directory
 * @param branch Branch name
 * @returns Generated path
 */
function generateWorktreePath(cwd: string, branch: string): string {
  const repoName = getRepoName(cwd);
  // Sanitize branch name: replace / with -
  const sanitizedBranch = branch.replace(/\//g, "-");
  // Use format: ../repo-name-branch-name (dash separator, following xlaude)
  return path.join(cwd, "..", `${repoName}-${sanitizedBranch}`);
}

/**
 * Parse worktree list output
 * @param output Git worktree list porcelain output
 * @returns Array of worktree info
 */
function parseWorktreeList(
  output: string,
): Array<{ path: string; branch: string; head: string }> {
  const worktrees: Array<{ path: string; branch: string; head: string }> = [];
  const lines = output.trim().split("\n");

  let current: Partial<{ path: string; branch: string; head: string }> = {};

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as any);
      }
      current = { path: line.substring(9) };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.substring(5);
    } else if (line.startsWith("branch ")) {
      const branchRef = line.substring(7);
      current.branch = branchRef.replace("refs/heads/", "");
    } else if (line === "") {
      if (current.path) {
        worktrees.push(current as any);
        current = {};
      }
    }
  }

  if (current.path) {
    worktrees.push(current as any);
  }

  return worktrees;
}

/**
 * Find worktree by branch name or path pattern
 * @param identifier Branch name or path pattern
 * @param cwd Working directory
 * @returns Worktree path if found
 */
async function findWorktree(
  identifier: string,
  cwd: string,
): Promise<string | null> {
  const listResult = await runCommand(
    "git",
    ["worktree", "list", "--porcelain"],
    {
      cwd,
      throwOnError: false,
    },
  );

  if (!listResult.success) {
    return null;
  }

  const worktrees = parseWorktreeList(listResult.stdout);

  // First, try exact branch name match
  const exactMatch = worktrees.find((wt) => wt.branch === identifier);
  if (exactMatch) {
    return exactMatch.path;
  }

  // Then, try path basename match (e.g., "xling-main" matches branch "main")
  const basenameMatch = worktrees.find((wt) => {
    const basename = path.basename(wt.path);
    return basename === identifier || basename.endsWith(`-${identifier}`);
  });
  if (basenameMatch) {
    return basenameMatch.path;
  }

  // Finally, try partial path match
  const partialMatch = worktrees.find((wt) => wt.path.includes(identifier));
  if (partialMatch) {
    return partialMatch.path;
  }

  return null;
}

/**
 * Manage git worktrees
 * @param request Worktree operation request
 * @param cwd Working directory
 * @returns Command result
 */
export async function manageWorktree(
  request: GitWorktreeRequest,
  cwd?: string,
): Promise<GitCommandResult> {
  const currentCwd = cwd || process.cwd();
  const { action, path: userPath, branch, force, detach } = request;

  switch (action) {
    case "list": {
      const result = await runCommand(
        "git",
        ["worktree", "list", "--porcelain"],
        {
          cwd: currentCwd,
          throwOnError: false,
        },
      );

      if (!result.success) {
        throw new GitCommandError("git worktree list", result.stderr);
      }

      return {
        success: true,
        message: "Worktree list retrieved",
        details: { output: result.stdout },
      };
    }

    case "switch": {
      // Get list of worktrees
      const listResult = await runCommand(
        "git",
        ["worktree", "list", "--porcelain"],
        {
          cwd: currentCwd,
          throwOnError: false,
        },
      );

      if (!listResult.success) {
        throw new GitCommandError("git worktree list", listResult.stderr);
      }

      const worktrees = parseWorktreeList(listResult.stdout);

      if (worktrees.length === 0) {
        throw new Error("No worktrees found");
      }

      if (worktrees.length === 1) {
        throw new Error(
          "Only one worktree exists. Create more with --add first.",
        );
      }

      // For now, return the list for user to choose
      // In a future enhancement, we could use inquirer for interactive selection
      const worktreeList = worktrees
        .map(
          (wt, idx) => `  [${idx + 1}] ${wt.path} (${wt.branch || "detached"})`,
        )
        .join("\n");

      return {
        success: true,
        message: "Available worktrees:",
        details: {
          output: worktreeList,
          worktrees,
          path: worktrees[0].path, // Return first non-current worktree
        },
      };
    }

    case "add": {
      // Use main branch if not specified
      let targetBranch = branch || "main";

      // Check if branch is already used by another worktree
      const listResult = await runCommand(
        "git",
        ["worktree", "list", "--porcelain"],
        { cwd: currentCwd, throwOnError: false },
      );

      if (listResult.success) {
        const worktrees = parseWorktreeList(listResult.stdout);
        const existingWorktree = worktrees.find(
          (wt) => wt.branch === targetBranch,
        );

        if (existingWorktree) {
          throw new Error(
            `Branch "${targetBranch}" is already used by worktree at "${existingWorktree.path}".\n` +
              `Choose a different branch name, or switch that worktree to another branch first.`,
          );
        }
      }

      // Auto-generate path if not provided
      const worktreePath =
        userPath || generateWorktreePath(currentCwd, targetBranch);

      // Check if path already exists
      if (existsSync(worktreePath) && !force) {
        throw new Error(
          `Path "${worktreePath}" already exists. Use --force to override or specify a different path with --path`,
        );
      }

      const args = ["worktree", "add"];
      if (force) args.push("--force");
      if (detach) args.push("--detach");
      args.push(worktreePath, targetBranch);

      const result = await runCommand("git", args, {
        cwd: currentCwd,
        throwOnError: false,
      });

      if (!result.success) {
        throw new GitCommandError(
          `git worktree add ${worktreePath} ${targetBranch}`,
          result.stderr,
        );
      }

      return {
        success: true,
        message: `Created worktree at ${worktreePath} for branch ${targetBranch}`,
        details: { path: worktreePath, branch: targetBranch },
      };
    }

    case "remove": {
      // Determine what to remove: by name (branch/worktree) or by path
      let targetPath: string;

      if (branch) {
        // Remove by name: branch name or worktree name (e.g., "main" or "xling-main")
        const foundPath = await findWorktree(branch, currentCwd);
        if (!foundPath) {
          throw new Error(
            `Could not find worktree matching "${branch}". Use --list to see available worktrees.`,
          );
        }
        targetPath = foundPath;
      } else if (userPath) {
        // Remove by path: must be a valid file path
        if (!existsSync(userPath)) {
          throw new Error(
            `Path "${userPath}" does not exist. Use --branch (-b) to remove by name, or --list to see available worktrees.`,
          );
        }
        targetPath = userPath;
      } else {
        throw new Error(
          "--branch (-b) or --path (-p) is required for remove action.",
        );
      }

      const args = ["worktree", "remove"];
      if (force) args.push("--force");
      args.push(targetPath);

      const result = await runCommand("git", args, {
        cwd: currentCwd,
        throwOnError: false,
      });

      if (!result.success) {
        throw new GitCommandError(
          `git worktree remove ${targetPath}`,
          result.stderr,
        );
      }

      return {
        success: true,
        message: `Removed worktree at ${targetPath}`,
        details: { path: targetPath },
      };
    }

    case "prune": {
      const result = await runCommand("git", ["worktree", "prune"], {
        cwd: currentCwd,
        throwOnError: false,
      });

      if (!result.success) {
        throw new GitCommandError("git worktree prune", result.stderr);
      }

      return {
        success: true,
        message: "Pruned stale worktrees",
        details: { output: result.stdout },
      };
    }

    default:
      throw new Error(`Unknown worktree action: ${action}`);
  }
}
