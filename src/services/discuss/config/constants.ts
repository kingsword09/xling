/**
 * Discussion Configuration Constants
 * Centralized configuration to address magic numbers and maintenance debt
 */

export const DISCUSSION_CONFIG = {
  /**
   * Timeout configurations in milliseconds
   */
  timeouts: {
    default: 300_000, // 5 minutes
    human: 600_000, // 10 minutes
    api: 120_000, // 2 minutes
    cli: 180_000, // 3 minutes
    min: 30_000, // 30 seconds minimum
    max: 600_000, // 10 minutes maximum
  },

  /**
   * Maximum turn limits for different discussion types
   */
  maxTurns: {
    default: 50,
    quick: 10,
    deep: 100,
    maximum: 200, // Absolute maximum
  },

  /**
   * Termination patterns for auto-detecting discussion completion
   */
  terminationPatterns: [
    /\b(done|complete|finished|concluded)\b/i,
    /discussion\s+(ends?|concludes|is\s+over)/i,
    /\b(we\s+are|we're|we\s+have)\s+(done|finished|concluded)/i,
    /\b(thank\s+you|thanks|goodbye|bye)\b/i,
    /\b(no\s+further|no\s+more|nothing\s+else)\s+(to\s+add|to\s+discuss|to\s+say)/i,
  ] as RegExp[],

  /**
   * Security configurations
   */
  security: {
    inputMaxLength: 50_000, // 50KB max input
    maxInputLines: 1000, // Maximum lines for TTY input
    allowedEditors: [
      'vim', 'vi', 'emacs', 'nano', 'code', 'code-insiders',
      'subl', 'atom', 'gedit', 'kate', 'mousepad'
    ] as string[],
    cliToolWhitelist: [
      'codex', 'claude', 'git', 'npm', 'yarn', 'pnpm', 'bun',
      'node', 'python', 'python3', 'python3.8', 'python3.9', 'python3.10', 'python3.11'
    ] as string[],
    maxTempFileSize: 1_048_576, // 1MB
    tempFilePermissions: 0o600, // Only owner can read/write
  },

  /**
   * Performance configurations
   */
  performance: {
    maxHistoryTurns: 20, // Maximum turns to include in context
    contextWindowTokens: 50_000, // Leave room for model limits
    maxCacheSize: 1_000, // Maximum cached contexts
    cleanupInterval: 300_000, // 5 minutes
    gcThreshold: 100, // Minimum items before GC
  },

  /**
   * File and path configurations
   */
  paths: {
    historyDir: '.claude/discuss/history',
    tempDir: '.claude/discuss/temp',
    maxFilenameLength: 100,
    dateFormat: 'YYYY-MM-DD',
  },

  /**
   * Logging configurations
   */
  logging: {
    levels: ['error', 'warn', 'info', 'debug', 'trace'] as string[],
    defaultLevel: 'info',
    maxLogSize: 10_000_000, // 10MB
    maxLogFiles: 5,
  },

  /**
   * API configurations
   */
  api: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second base delay
    retryBackoffMultiplier: 2,
    maxRetryDelay: 10_000, // 10 seconds max delay
    concurrentRequests: 3, // Max concurrent API requests
  },

  /**
   * Context window management
   */
  context: {
    minTurnsToKeep: 5, // Always keep at least this many turns
    maxContextAge: 3_600_000, // 1 hour in ms
    summaryLength: 200, // Characters for turn summaries
    overlapTokens: 500, // Tokens to overlap between context windows
  },

  /**
   * CLI security patterns
   */
  cli: {
    // Patterns that might indicate command injection
    dangerousPatterns: [
      /[;&|`$(){}[\]]/, // Shell metacharacters
      /\b(rm|del|format|fdisk|mkfs)\b/i, // Dangerous commands
      /\b(--?dangerously|--?force|--?skip[-_]?permissions)\b/, // Dangerous flags
      /\$[({]/, // Variable expansion
      />\s*\//, // Output redirection to system paths
      /\.\.[\\/]/, // Path traversal
    ] as RegExp[],

    // Safe argument separator
    argSeparator: '--',

    // Maximum CLI arguments
    maxArgs: 50,
  },

  /**
   * Default system prompts by model type
   */
  systemPrompts: {
    architect: "You are a software architect analyzing system design and providing expert recommendations on patterns, structure, and scalability.",
    security: "You are a security expert identifying vulnerabilities, risks, and providing security best practices.",
    performance: "You are a performance engineer analyzing bottlenecks, optimization opportunities, and providing performance recommendations.",
    code_reviewer: "You are a code reviewer focusing on code quality, maintainability, and best practices.",
    developer: "You are a software developer providing practical implementation suggestions and code improvements.",
  },
} as const;

/**
 * Type helpers for configuration
 */
export type TimeoutKey = keyof typeof DISCUSSION_CONFIG.timeouts;
export type MaxTurnsKey = keyof typeof DISCUSSION_CONFIG.maxTurns;
export type SystemPromptKey = keyof typeof DISCUSSION_CONFIG.systemPrompts;

/**
 * Utility functions
 */
export const getTimeout = (key: TimeoutKey): number => DISCUSSION_CONFIG.timeouts[key];
export const getMaxTurns = (key: MaxTurnsKey): number => DISCUSSION_CONFIG.maxTurns[key];
export const getSystemPrompt = (key: SystemPromptKey): string => DISCUSSION_CONFIG.systemPrompts[key];