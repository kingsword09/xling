/**
 * Git command types and interfaces
 * Defines the contract for git-related operations
 */

// Supported git subcommands
export type GitSubcommand = "worktree" | "pr" | "view";

// Worktree actions
export type GitWorktreeAction = "list" | "add" | "remove" | "prune";

/**
 * Base payload for all git commands
 */
export interface GitCommandPayload {
  cwd?: string;
  command: GitSubcommand;
  data: GitWorktreeRequest | GitPrRequest | GitViewRequest;
}

/**
 * Worktree operation request
 */
export interface GitWorktreeRequest {
  action: GitWorktreeAction;
  path?: string;
  branch?: string;
  force?: boolean;
  detach?: boolean;
}

/**
 * PR checkout request
 */
export interface GitPrRequest {
  id: string;
  branch?: string;
  strategy: "gh" | "git";
  remote?: string;
}

/**
 * PR view request
 */
export interface GitViewRequest {
  id: string;
  browser?: string;
  openFlags?: string[];
}

/**
 * Result of a git command execution
 */
export interface GitCommandResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}
