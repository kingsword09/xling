/**
 * Codex SDK Client Wrapper
 *
 * Wraps the @openai/codex-sdk with error handling, configuration management,
 * and dependency injection support for testing.
 *
 * Follows SOLID principles:
 * - SRP: Single responsibility of SDK client management
 * - DIP: Depends on abstractions (interfaces)
 * - ISP: Exposes minimal necessary interface
 */

import { Codex, Thread } from '@openai/codex-sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type {
  CodexSDKConfig,
  CodexRunOptions,
  CodexRunResult,
  CodexStreamEvent,
  CodexThread,
} from '@/domain/codex.ts';

/**
 * Load API key from Codex CLI auth configuration
 */
async function loadCodexApiKey(): Promise<string | null> {
  const authPath = join(homedir(), '.codex', 'auth.json');

  // Try environment variable first
  if (process.env.CODEX_API_KEY) {
    return process.env.CODEX_API_KEY;
  }

  // Try reading from Codex CLI auth file
  if (existsSync(authPath)) {
    try {
      const authContent = await readFile(authPath, 'utf-8');
      const authData = JSON.parse(authContent);
      return authData.OPENAI_API_KEY || null;
    } catch (error) {
      console.warn(`Warning: Could not read Codex auth file at ${authPath}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * SDK Client interface for dependency injection
 */
export interface ICodexSDKClient {
  run(options: CodexRunOptions): Promise<CodexRunResult>;
  runStreamed(
    options: CodexRunOptions
  ): Promise<AsyncGenerator<CodexStreamEvent>>;
  resumeThread(threadId: string): any;
  validateConnection(): Promise<boolean>;
}

/**
 * Codex SDK Client implementation
 */
export class CodexSDKClient implements ICodexSDKClient {
  #client: Codex;
  #config: Required<CodexSDKConfig>;

  private constructor(config: Required<CodexSDKConfig>) {
    this.#config = config;

    // Initialize SDK client
    this.#client = new Codex({
      apiKey: this.#config.apiKey,
      baseUrl: this.#config.baseUrl || undefined,
    });
  }

  /**
   * Create a new SDK client instance
   * Automatically loads API key from Codex CLI auth or environment
   */
  static async create(config: CodexSDKConfig = {}): Promise<CodexSDKClient> {
    // Load API key from various sources
    const apiKey = config.apiKey ?? (await loadCodexApiKey());
    if (!apiKey) {
      throw new Error(
        'CODEX_API_KEY not found. Please:\n' +
          '1. Login with Codex CLI: codex login\n' +
          '2. Or set CODEX_API_KEY environment variable\n' +
          '3. Or pass apiKey in config'
      );
    }

    // Merge with defaults
    const fullConfig: Required<CodexSDKConfig> = {
      apiKey,
      baseUrl: config.baseUrl ?? process.env.CODEX_BASE_URL ?? '',
      workingDir: config.workingDir ?? process.cwd(),
      skipGitRepoCheck: config.skipGitRepoCheck ?? false,
      model: config.model ?? 'gpt-5.1-codex',
      timeout: config.timeout ?? 300000, // 5 minutes default
    };

    return new CodexSDKClient(fullConfig);
  }

  /**
   * Run a Codex task
   *
   * @param options - Run options including prompt and configuration
   * @returns Result with success status and output
   */
  async run(options: CodexRunOptions): Promise<CodexRunResult> {
    const startTime = Date.now();

    try {
      // Map sandbox mode to SDK's expected values
      const sandboxMode =
        options.sandbox === 'read-only'
          ? 'read-only'
          : options.sandbox === 'read-write'
            ? 'workspace-write'
            : 'danger-full-access';

      const approvalPolicy =
        options.fullAuto ?? true ? 'never' : 'on-request';

      // Start a new thread
      const thread = this.#client.startThread({
        model: options.model ?? this.#config.model,
        workingDirectory: options.workingDir ?? this.#config.workingDir,
        skipGitRepoCheck:
          options.skipGitRepoCheck ?? this.#config.skipGitRepoCheck,
        sandboxMode,
        approvalPolicy,
      });

      // Build turn options
      const turnOptions: {
        outputSchema?: unknown;
      } = {};

      if (options.config?.outputSchema) {
        turnOptions.outputSchema = options.config.outputSchema;
      }

      // Prepare input - handle images if provided
      type UserInput =
        | { type: 'text'; text: string }
        | { type: 'local_image'; path: string };
      let input: string | UserInput[];

      if (options.images && options.images.length > 0) {
        // Multi-modal input with images
        input = [
          { type: 'text' as const, text: options.prompt },
          ...options.images.map((imagePath) => ({
            type: 'local_image' as const,
            path: imagePath,
          })),
        ];
      } else {
        // Text-only input
        input = options.prompt;
      }

      // Run the turn
      const turn = await thread.run(input, turnOptions);

      // Extract output and file changes from turn result
      const output = turn.finalResponse || '';
      const filesModified = this.#extractModifiedFiles(turn);

      return {
        success: true,
        threadId: thread.id ?? undefined,
        output,
        filesModified,
        exitCode: 0,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Validate connection to Codex API
   *
   * @returns True if connection is valid
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Try to start a thread as a connection test
      const thread = this.#client.startThread({
        workingDirectory: this.#config.workingDir,
        skipGitRepoCheck: true,
      });

      // If we can create a thread, connection is valid
      return thread.id !== null && thread.id !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Extract modified files from turn result
   */
  #extractModifiedFiles(turn: any): string[] {
    const files: string[] = [];

    // Extract from items array
    if (turn && turn.items && Array.isArray(turn.items)) {
      for (const item of turn.items) {
        if (item.type === 'file_change' && Array.isArray(item.changes)) {
          for (const change of item.changes) {
            if (change.path) {
              files.push(change.path);
            }
          }
        }
      }
    }

    return files;
  }

  /**
   * Run a Codex task with streaming events
   *
   * @param options - Run options including prompt and configuration
   * @returns Async generator of stream events
   */
  async runStreamed(
    options: CodexRunOptions
  ): Promise<AsyncGenerator<CodexStreamEvent>> {
    // Map sandbox mode
    const sandboxMode =
      options.sandbox === 'read-only'
        ? 'read-only'
        : options.sandbox === 'read-write'
          ? 'workspace-write'
          : 'danger-full-access';

    const approvalPolicy = options.fullAuto ?? true ? 'never' : 'on-request';

    // Start thread
    const thread = this.#client.startThread({
      model: options.model ?? this.#config.model,
      workingDirectory: options.workingDir ?? this.#config.workingDir,
      skipGitRepoCheck:
        options.skipGitRepoCheck ?? this.#config.skipGitRepoCheck,
      sandboxMode,
      approvalPolicy,
    });

    // Prepare input
    type UserInput =
      | { type: 'text'; text: string }
      | { type: 'local_image'; path: string };
    let input: string | UserInput[];

    if (options.images && options.images.length > 0) {
      input = [
        { type: 'text' as const, text: options.prompt },
        ...options.images.map((imagePath) => ({
          type: 'local_image' as const,
          path: imagePath,
        })),
      ];
    } else {
      input = options.prompt;
    }

    // Run streamed
    const turnOptions: { outputSchema?: unknown } = {};
    if (options.config?.outputSchema) {
      turnOptions.outputSchema = options.config.outputSchema;
    }

    const streamedTurn = await thread.runStreamed(input, turnOptions);

    // Convert SDK events to our event format
    return this.#convertStreamEvents(streamedTurn.events);
  }

  /**
   * Resume an existing thread
   *
   * @param threadId - Thread ID to resume
   * @returns Thread object for continuing conversation
   */
  resumeThread(threadId: string): Thread {
    return this.#client.resumeThread(threadId, {
      workingDirectory: this.#config.workingDir,
      skipGitRepoCheck: this.#config.skipGitRepoCheck,
    });
  }

  /**
   * Convert SDK stream events to our format
   */
  async *#convertStreamEvents(
    events: AsyncGenerator<any>
  ): AsyncGenerator<CodexStreamEvent> {
    for await (const event of events) {
      yield {
        type: event.type as any,
        timestamp: new Date(),
        data: event,
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<CodexSDKConfig>> {
    return { ...this.#config };
  }
}

/**
 * Factory function for creating SDK client with config from adapter
 * Automatically loads API key from Codex CLI auth or environment
 */
export async function createCodexSDKClient(
  config?: CodexSDKConfig
): Promise<ICodexSDKClient> {
  return await CodexSDKClient.create(config);
}
