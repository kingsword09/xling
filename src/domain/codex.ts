/**
 * Codex SDK domain types
 *
 * These types define the contracts for Codex SDK operations,
 * following the Interface Segregation Principle (ISP).
 */

/**
 * Configuration for Codex SDK client
 */
export interface CodexSDKConfig {
  /**
   * API key for authentication (from env or config)
   */
  apiKey?: string;

  /**
   * Base URL for Codex API
   */
  baseUrl?: string;

  /**
   * Working directory for Codex operations
   */
  workingDir?: string;

  /**
   * Skip Git repository check
   */
  skipGitRepoCheck?: boolean;

  /**
   * Model to use for code generation
   */
  model?: string;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Options for running a Codex task
 */
export interface CodexRunOptions {
  /**
   * The prompt/instruction to send to Codex
   */
  prompt: string;

  /**
   * Model to use (overrides config)
   */
  model?: string;

  /**
   * Working directory (overrides config)
   */
  workingDir?: string;

  /**
   * Skip Git repository check
   */
  skipGitRepoCheck?: boolean;

  /**
   * Additional images to include in context
   */
  images?: string[];

  /**
   * Sandbox mode (read-only, read-write, off)
   */
  sandbox?: 'read-only' | 'read-write' | 'off';

  /**
   * Full auto mode (no approval prompts)
   */
  fullAuto?: boolean;

  /**
   * Additional configuration options
   */
  config?: Record<string, unknown>;
}

/**
 * Result from a Codex run operation
 */
export interface CodexRunResult {
  /**
   * Whether the operation succeeded
   */
  success: boolean;

  /**
   * Thread ID for resuming
   */
  threadId?: string;

  /**
   * Output from Codex
   */
  output?: string;

  /**
   * Files that were modified
   */
  filesModified?: string[];

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Exit code from Codex CLI
   */
  exitCode?: number;
}

/**
 * Structured output format
 */
export interface CodexStructuredOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    threadId?: string;
    model?: string;
    duration?: number;
  };
}

/**
 * Thread event types from Codex SDK
 */
export type CodexEventType =
  | 'thread_started'
  | 'turn_started'
  | 'turn_completed'
  | 'turn_failed'
  | 'item_started'
  | 'item_updated'
  | 'item_completed'
  | 'thread_error';

/**
 * Codex stream event
 */
export interface CodexStreamEvent {
  type: CodexEventType;
  timestamp: Date;
  data: unknown;
}

/**
 * Thread information
 */
export interface CodexThread {
  id: string;
  createdAt?: Date;
  lastActive?: Date;
  status?: 'active' | 'completed' | 'failed';
}
