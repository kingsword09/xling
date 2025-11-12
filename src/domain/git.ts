/**
 * Git command types and interfaces
 * Defines the contract for git-related operations
 */

// Supported git subcommands
export type GitSubcommand = "worktree" | "prr" | "prv" | "prc";

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

/**
 * Base payload for all git commands
 */
export interface GitCommandPayload {
  cwd?: string;
  command: GitSubcommand;
  data: GitWorktreeRequest | GitPrRequest | GitViewRequest | GitCreatePrRequest;
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

/**
 * Result of a git command execution
 */
export interface GitCommandResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}
