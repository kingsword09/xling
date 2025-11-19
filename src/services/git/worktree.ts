/**
 * Git worktree service
 * Manages git worktrees (list, add, remove, prune, switch)
 */

import type {
  GitWorktreeRequest,
  GitCommandResult,
  WorktreeStatus,
} from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { GitCommandError } from "@/utils/errors.ts";
import path from "node:path";
import { existsSync } from "node:fs";
import readline from "node:readline";
import type { Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";

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
type WorktreeParseRecord = Partial<WorktreeStatus>;

function pushWorktreeRecord(
  collection: WorktreeStatus[],
  record: WorktreeParseRecord,
): void {
  if (record.path) {
    collection.push({
      path: record.path,
      branch: record.branch,
      head: record.head,
    });
  }
}

function parseWorktreeList(output: string): WorktreeStatus[] {
  const worktrees: WorktreeStatus[] = [];
  const lines = output.trim().split("\n");

  let current: WorktreeParseRecord = {};

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      pushWorktreeRecord(worktrees, current);
      current = { path: line.substring(9) };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.substring(5);
    } else if (line.startsWith("branch ")) {
      const branchRef = line.substring(7);
      current.branch = branchRef.replace("refs/heads/", "");
    } else if (line === "") {
      pushWorktreeRecord(worktrees, current);
      current = {};
    }
  }

  pushWorktreeRecord(worktrees, current);

  return worktrees;
}

/**
 * Get all worktrees for the current repo
 */
async function getWorktrees(cwd: string): Promise<WorktreeStatus[]> {
  const result = await runCommand("git", ["worktree", "list", "--porcelain"], {
    cwd,
    throwOnError: false,
  });

  if (!result.success) {
    throw new GitCommandError("git worktree list", result.stderr);
  }

  return parseWorktreeList(result.stdout);
}

/**
 * Get local branches for selection
 */
async function getLocalBranches(cwd: string): Promise<string[]> {
  const result = await runCommand(
    "git",
    ["branch", "--format=%(refname:short)", "--sort=-committerdate"],
    {
      cwd,
      throwOnError: false,
    },
  );

  if (!result.success) {
    throw new GitCommandError(
      "git branch --format=%(refname:short)",
      result.stderr,
    );
  }

  return result.stdout
    .split("\n")
    .map((branch) => branch.trim())
    .filter(Boolean);
}

/**
 * Reusable interactive selector
 */
type SelectionOption<T> = { label: string; value: T };

async function selectOption<T>(
  title: string,
  options: SelectionOption<T>[],
  initialIndex = 0,
): Promise<T> {
  if (options.length === 0) {
    throw new Error("No options available for selection.");
  }

  const stdin = process.stdin as ReadStream;
  const stdout = process.stdout as WriteStream;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Interactive selection requires a TTY. Remove --select to continue.",
    );
  }

  readline.emitKeypressEvents(stdin);
  stdin.resume();

  const originalRawMode = Boolean(stdin.isRaw);
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }

  let index = Math.min(Math.max(initialIndex, 0), options.length - 1);
  let renderedLines = 0;

  const render = (): void => {
    stdout.moveCursor(0, -renderedLines);
    stdout.clearScreenDown();

    const lines = [
      title,
      "Use ↑/↓ then Enter to confirm. Press q or Ctrl+C to cancel.",
      ...options.map((option, optionIndex) => {
        const prefix = optionIndex === index ? "➜" : " ";
        const line = `${prefix} ${option.label}`;
        return optionIndex === index ? `\x1B[36m${line}\x1B[0m` : line;
      }),
    ];

    stdout.write(lines.join("\n") + "\n");
    renderedLines = lines.length;
  };

  return await new Promise<T>((resolve, reject) => {
    const cleanup = (error?: Error, value?: T): void => {
      stdin.off("keypress", onKeypress);
      if (stdin.setRawMode) {
        stdin.setRawMode(originalRawMode);
      }
      stdin.pause();
      stdout.write("\x1B[?25h\n");
      if (error) {
        reject(error);
      } else {
        resolve(value as T);
      }
    };

    const onKeypress = (_: string, key: Key): void => {
      if (!key) {
        return;
      }

      if (key.name === "up") {
        index = (index - 1 + options.length) % options.length;
        render();
        return;
      }

      if (key.name === "down") {
        index = (index + 1) % options.length;
        render();
        return;
      }

      if (key.name === "return") {
        cleanup(undefined, options[index].value);
        return;
      }

      if ((key.name === "c" && key.ctrl) || key.name === "q") {
        cleanup(new Error("Selection cancelled."));
      }
    };

    stdin.on("keypress", onKeypress);
    stdout.write("\x1B[?25l");
    render();
  });
}

/**
 * Find worktree by branch name or path pattern within a list
 */
function findWorktree(
  identifier: string,
  worktrees: WorktreeStatus[],
): string | null {
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
  const {
    action,
    path: userPath,
    branch,
    force,
    detach,
    interactive,
  } = request;

  switch (action) {
    case "list": {
      const worktrees = await getWorktrees(currentCwd);

      const worktreeList =
        worktrees.length === 0
          ? "  (no worktrees found)"
          : worktrees
              .map(
                (wt, idx) =>
                  `  [${idx + 1}] ${wt.path}\n      Branch: ${wt.branch || "detached"}`,
              )
              .join("\n\n");

      return {
        success: true,
        message: "Available worktrees:",
        details: { output: worktreeList, worktrees },
      };
    }

    case "switch": {
      const worktrees = await getWorktrees(currentCwd);

      if (worktrees.length === 0) {
        throw new Error("No worktrees found");
      }

      if (interactive) {
        const inferredPath =
          (branch && findWorktree(branch, worktrees)) || null;
        const initialIndex =
          inferredPath !== null
            ? Math.max(
                0,
                worktrees.findIndex((wt) => wt.path === inferredPath),
              )
            : 0;

        const selected = await selectOption(
          "Select worktree to switch to:",
          worktrees.map((wt) => ({
            label: `${wt.branch || "detached"} — ${wt.path}`,
            value: wt,
          })),
          initialIndex,
        );

        return {
          success: true,
          message: selected.path,
          details: { path: selected.path, branch: selected.branch },
        };
      }

      // Default to main branch if not specified
      const targetBranch = branch || "main";

      // Find worktree by branch/directory name
      const foundPath = findWorktree(targetBranch, worktrees);
      if (!foundPath) {
        throw new Error(
          `Could not find worktree matching "${targetBranch}". Use --list to see available worktrees.`,
        );
      }

      // Only output the path for easy use with cd $()
      return {
        success: true,
        message: foundPath,
        details: { path: foundPath, branch: targetBranch },
      };
    }

    case "add": {
      // Use main branch if not specified
      let targetBranch = branch || "main";
      const worktrees = await getWorktrees(currentCwd);

      if (interactive) {
        const branches = await getLocalBranches(currentCwd);

        if (branches.length === 0) {
          throw new Error(
            "No local branches found. Create one or fetch remote branches before adding a worktree.",
          );
        }

        const options = branches.map((branchName) => {
          const alreadyUsed = worktrees.some((wt) => wt.branch === branchName);
          const label = alreadyUsed
            ? `${branchName} (already has a worktree)`
            : branchName;
          return { label, value: branchName };
        });

        const defaultIndex = Math.max(
          0,
          options.findIndex((option) => option.value === targetBranch),
        );

        targetBranch = await selectOption(
          "Select branch to create a worktree for:",
          options,
          defaultIndex,
        );
      }

      // Check if branch is already used by another worktree
      const existingWorktree = worktrees.find(
        (wt) => wt.branch === targetBranch,
      );

      if (existingWorktree) {
        throw new Error(
          `Branch "${targetBranch}" is already used by worktree at "${existingWorktree.path}".\n` +
            `Choose a different branch name, or switch that worktree to another branch first.`,
        );
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
      const worktrees = await getWorktrees(currentCwd);
      // Determine what to remove: by name (branch/worktree) or by path
      let targetPath: string;

      if (interactive) {
        if (worktrees.length === 0) {
          throw new Error("No worktrees found");
        }

        const inferredPath =
          (branch && findWorktree(branch, worktrees)) || userPath || null;
        const initialIndex =
          inferredPath !== null
            ? Math.max(
                0,
                worktrees.findIndex((wt) => wt.path === inferredPath),
              )
            : 0;

        const selected = await selectOption(
          "Select worktree to remove:",
          worktrees.map((wt) => ({
            label: `${wt.branch || "detached"} — ${wt.path}`,
            value: wt,
          })),
          initialIndex,
        );

        targetPath = selected.path;
      } else if (branch) {
        // Remove by name: branch name or worktree name (e.g., "main" or "xling-main")
        const foundPath = findWorktree(branch, worktrees);
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
