/**
 * Git command types and interfaces
 * Defines the contract for git-related operations
 */

// Worktree actions
export type GitWorktreeAction = "list" | "add" | "remove" | "prune" | "switch";

// Supported browsers for PR viewing
export const SUPPORTED_BROWSERS = [
  "chrome",
  "safari",
  "firefox",
  "arc",
  "edge",
  "dia",
] as const;
export type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];

export type GitCommandPayload =
  | { cwd?: string; command: "worktree"; data: GitWorktreeRequest }
  | { cwd?: string; command: "prr"; data: GitPrRequest }
  | { cwd?: string; command: "prv"; data: GitViewRequest }
  | { cwd?: string; command: "prc"; data: GitCreatePrRequest };

/**
 * Worktree operation request
 */
export interface GitWorktreeRequest {
  action: GitWorktreeAction;
  path?: string;
  branch?: string;
  base?: string; // starting point when creating a new branch (defaults to main)
  force?: boolean;
  detach?: boolean;
  interactive?: boolean;
  create?: boolean; // create branch if missing (uses -b)
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
 * PR create request
 */
export interface GitCreatePrRequest {
  title?: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
  web?: boolean;
  browser?: string;
  assignee?: string[];
  reviewer?: string[];
  label?: string[];
}

export interface WorktreeStatus {
  path: string;
  branch?: string;
  head?: string;
}

export interface GitCommandDetails {
  output?: string;
  worktrees?: WorktreeStatus[];
  path?: string;
  branch?: string;
  strategy?: "gh" | "git";
  remote?: string;
  draft?: boolean;
  web?: boolean;
  base?: string;
  head?: string;
  title?: string;
  browser?: string;
  platform?: NodeJS.Platform;
  id?: string;
}

/**
 * Result of a git command execution
 */
export interface GitCommandResult {
  success: boolean;
  message: string;
  details?: GitCommandDetails;
}
