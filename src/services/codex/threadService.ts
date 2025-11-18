/**
 * Codex Thread Service
 *
 * Manages Codex threads (conversations) including listing, resuming,
 * and continuing multi-turn interactions.
 *
 * Follows SRP: Single responsibility of thread lifecycle management.
 */

import { createCodexSDKClient, type ICodexSDKClient } from './sdkClient.ts';
import type { CodexThread, CodexRunOptions } from '@/domain/codex.ts';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Thread service for managing Codex conversations
 */
export class CodexThreadService {
  #client?: ICodexSDKClient;
  #sessionsDir: string;

  constructor(client?: ICodexSDKClient) {
    this.#client = client;
    this.#sessionsDir = join(homedir(), '.codex', 'sessions');
  }

  /**
   * Get or create SDK client (lazy initialization)
   */
  async #getClient(): Promise<ICodexSDKClient> {
    if (!this.#client) {
      this.#client = await createCodexSDKClient();
    }
    return this.#client;
  }

  /**
   * List all available threads
   */
  async listThreads(): Promise<CodexThread[]> {
    if (!existsSync(this.#sessionsDir)) {
      return [];
    }

    try {
      const entries = await readdir(this.#sessionsDir, { withFileTypes: true });
      const threads: CodexThread[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const threadPath = join(this.#sessionsDir, entry.name);
          const stats = await stat(threadPath);

          threads.push({
            id: entry.name,
            createdAt: stats.birthtime,
            lastActive: stats.mtime,
            status: 'active', // We don't have a way to determine actual status
          });
        }
      }

      // Sort by last active (most recent first)
      threads.sort((a, b) => {
        const timeA = a.lastActive?.getTime() || 0;
        const timeB = b.lastActive?.getTime() || 0;
        return timeB - timeA;
      });

      return threads;
    } catch (error) {
      // If sessions directory doesn't exist or is inaccessible
      return [];
    }
  }

  /**
   * Get thread details
   */
  async getThread(threadId: string): Promise<CodexThread | null> {
    const threadPath = join(this.#sessionsDir, threadId);

    if (!existsSync(threadPath)) {
      return null;
    }

    try {
      const stats = await stat(threadPath);

      return {
        id: threadId,
        createdAt: stats.birthtime,
        lastActive: stats.mtime,
        status: 'active',
      };
    } catch {
      return null;
    }
  }

  /**
   * Resume a thread and continue conversation
   */
  async resumeThread(
    threadId: string,
    prompt: string,
    options?: CodexRunOptions
  ): Promise<{
    success: boolean;
    threadId: string;
    output: string;
    filesModified: string[];
  }> {
    // Verify thread exists
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Resume the thread using SDK
    const client = await this.#getClient();
    const resumedThread = client.resumeThread(threadId);

    // Run new turn on the resumed thread
    const runOptions: CodexRunOptions = {
      prompt,
      ...options,
    };

    // Prepare input
    type UserInput =
      | { type: 'text'; text: string }
      | { type: 'local_image'; path: string };
    let input: string | UserInput[];

    if (options?.images && options.images.length > 0) {
      input = [
        { type: 'text' as const, text: prompt },
        ...options.images.map((imagePath) => ({
          type: 'local_image' as const,
          path: imagePath,
        })),
      ];
    } else {
      input = prompt;
    }

    // Run the turn
    const turn = await resumedThread.run(input);

    return {
      success: true,
      threadId,
      output: turn.finalResponse || '',
      filesModified: this.#extractModifiedFiles(turn),
    };
  }

  /**
   * Resume thread with streaming
   */
  async resumeThreadStreamed(
    threadId: string,
    prompt: string,
    options?: CodexRunOptions
  ): Promise<AsyncGenerator<any>> {
    // Verify thread exists
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Resume the thread using SDK
    const client = await this.#getClient();
    const resumedThread = client.resumeThread(threadId);

    // Prepare input
    type UserInput =
      | { type: 'text'; text: string }
      | { type: 'local_image'; path: string };
    let input: string | UserInput[];

    if (options?.images && options.images.length > 0) {
      input = [
        { type: 'text' as const, text: prompt },
        ...options.images.map((imagePath) => ({
          type: 'local_image' as const,
          path: imagePath,
        })),
      ];
    } else {
      input = prompt;
    }

    // Run streamed turn
    const streamedTurn = await resumedThread.runStreamed(input);

    return streamedTurn.events;
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<boolean> {
    const threadPath = join(this.#sessionsDir, threadId);

    if (!existsSync(threadPath)) {
      return false;
    }

    try {
      // Use rm -rf to delete directory recursively
      const { execSync } = await import('node:child_process');
      execSync(`rm -rf "${threadPath}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get thread history/transcript
   */
  async getThreadHistory(threadId: string): Promise<any> {
    const threadPath = join(this.#sessionsDir, threadId);
    const transcriptPath = join(threadPath, 'transcript.jsonl');

    if (!existsSync(transcriptPath)) {
      return null;
    }

    try {
      const content = await readFile(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');
      const events = lines.map((line) => JSON.parse(line));

      return {
        threadId,
        events,
        turnCount: events.filter((e: any) => e.type === 'turn_completed').length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract modified files from turn result
   */
  #extractModifiedFiles(turn: any): string[] {
    const files: string[] = [];

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
}
