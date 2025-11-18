/**
 * Output Renderer for Codex Stream Events
 *
 * Renders stream events in a user-friendly format with progress indicators,
 * timestamps, and structured output.
 *
 * Follows SRP: Single responsibility of event formatting and rendering.
 */

import type { CodexStreamEvent } from '@/domain/codex.ts';

export interface RenderOptions {
  /**
   * Show timestamps for each event
   */
  timestamps?: boolean;

  /**
   * Use colored output (ANSI codes)
   */
  colors?: boolean;

  /**
   * Show verbose event details
   */
  verbose?: boolean;
}

/**
 * Output renderer for stream events
 */
export class OutputRenderer {
  #options: Required<RenderOptions>;
  #startTime: Date;
  #eventCount: number = 0;

  constructor(options: RenderOptions = {}) {
    this.#options = {
      timestamps: options.timestamps ?? true,
      colors: options.colors ?? true,
      verbose: options.verbose ?? false,
    };
    this.#startTime = new Date();
  }

  /**
   * Render a stream event
   */
  render(event: CodexStreamEvent): string[] {
    this.#eventCount++;
    const lines: string[] = [];

    switch (event.type) {
      case 'thread_started':
        lines.push(this.#renderThreadStarted(event));
        break;
      case 'turn_started':
        lines.push(this.#renderTurnStarted(event));
        break;
      case 'turn_completed':
        lines.push(this.#renderTurnCompleted(event));
        break;
      case 'turn_failed':
        lines.push(this.#renderTurnFailed(event));
        break;
      case 'item_started':
        lines.push(...this.#renderItemStarted(event));
        break;
      case 'item_updated':
        lines.push(...this.#renderItemUpdated(event));
        break;
      case 'item_completed':
        lines.push(...this.#renderItemCompleted(event));
        break;
      case 'thread_error':
        lines.push(this.#renderThreadError(event));
        break;
      default:
        if (this.#options.verbose) {
          lines.push(this.#renderUnknown(event));
        }
    }

    return lines.filter((line) => line.length > 0);
  }

  /**
   * Render thread started event
   */
  #renderThreadStarted(event: CodexStreamEvent): string {
    const icon = '🤖';
    const message = 'Codex stream started';
    return this.#formatLine(icon, message, 'cyan');
  }

  /**
   * Render turn started event
   */
  #renderTurnStarted(event: CodexStreamEvent): string {
    const icon = '▶️';
    const message = 'Processing your request...';
    return this.#formatLine(icon, message, 'blue');
  }

  /**
   * Render turn completed event
   */
  #renderTurnCompleted(event: CodexStreamEvent): string {
    const duration = this.#getElapsedTime();
    const icon = '✅';
    const message = `Turn completed in ${duration}`;
    return this.#formatLine(icon, message, 'green');
  }

  /**
   * Render turn failed event
   */
  #renderTurnFailed(event: CodexStreamEvent): string {
    const icon = '❌';
    const data = event.data as any;
    const message = `Turn failed: ${data?.error || 'Unknown error'}`;
    return this.#formatLine(icon, message, 'red');
  }

  /**
   * Render item started event
   */
  #renderItemStarted(event: CodexStreamEvent): string[] {
    const data = event.data as any;
    const item = data?.item;

    if (!item) return [];

    const lines: string[] = [];

    switch (item.type) {
      case 'command_execution':
        lines.push(
          this.#formatLine('🔧', `Running: ${item.command}`, 'yellow')
        );
        break;
      case 'file_change':
        const fileCount = item.changes?.length || 0;
        lines.push(
          this.#formatLine(
            '📝',
            `Modifying ${fileCount} file(s)...`,
            'yellow'
          )
        );
        break;
      case 'mcp_tool_call':
        lines.push(
          this.#formatLine(
            '🔌',
            `Calling tool: ${item.server}/${item.tool}`,
            'yellow'
          )
        );
        break;
      case 'agent_message':
        // Agent messages are handled in item_completed
        break;
      case 'reasoning':
        lines.push(this.#formatLine('🧠', 'Thinking...', 'magenta'));
        break;
      case 'web_search':
        lines.push(
          this.#formatLine('🔍', `Searching: ${item.query}`, 'yellow')
        );
        break;
      case 'todo_list':
        if (item.items && item.items.length > 0) {
          lines.push(this.#formatLine('📋', 'Plan:', 'cyan'));
          for (const todo of item.items) {
            const checkbox = todo.completed ? '✓' : '○';
            lines.push(`     ${checkbox} ${todo.text}`);
          }
        }
        break;
      default:
        if (this.#options.verbose) {
          lines.push(
            this.#formatLine('ℹ️', `Started: ${item.type}`, 'gray')
          );
        }
    }

    return lines;
  }

  /**
   * Render item updated event
   */
  #renderItemUpdated(event: CodexStreamEvent): string[] {
    const data = event.data as any;
    const item = data?.item;

    if (!item) return [];

    const lines: string[] = [];

    // Show updates for certain item types
    switch (item.type) {
      case 'command_execution':
        if (item.aggregated_output && this.#options.verbose) {
          const output = item.aggregated_output.trim().split('\n').slice(-3);
          for (const line of output) {
            lines.push(`     ${line}`);
          }
        }
        break;
      case 'todo_list':
        // Show updated todo list
        if (item.items) {
          const completedCount = item.items.filter(
            (t: any) => t.completed
          ).length;
          const totalCount = item.items.length;
          lines.push(
            this.#formatLine(
              '📊',
              `Progress: ${completedCount}/${totalCount}`,
              'cyan'
            )
          );
        }
        break;
    }

    return lines;
  }

  /**
   * Render item completed event
   */
  #renderItemCompleted(event: CodexStreamEvent): string[] {
    const data = event.data as any;
    const item = data?.item;

    if (!item) return [];

    const lines: string[] = [];

    switch (item.type) {
      case 'command_execution':
        const success = item.exit_code === 0;
        const icon = success ? '✓' : '✗';
        const color = success ? 'green' : 'red';
        lines.push(
          this.#formatLine(
            icon,
            `Command ${success ? 'succeeded' : 'failed'} (exit: ${item.exit_code})`,
            color
          )
        );
        break;
      case 'file_change':
        if (item.status === 'completed') {
          lines.push(
            this.#formatLine('✓', 'File changes applied', 'green')
          );
          if (item.changes) {
            for (const change of item.changes) {
              const symbol =
                change.kind === 'add'
                  ? '+'
                  : change.kind === 'delete'
                    ? '-'
                    : '~';
              lines.push(`     ${symbol} ${change.path}`);
            }
          }
        } else {
          lines.push(
            this.#formatLine('✗', 'File changes failed', 'red')
          );
        }
        break;
      case 'mcp_tool_call':
        if (item.status === 'completed') {
          lines.push(
            this.#formatLine('✓', 'Tool call succeeded', 'green')
          );
        } else {
          lines.push(
            this.#formatLine(
              '✗',
              `Tool call failed: ${item.error?.message || 'Unknown error'}`,
              'red'
            )
          );
        }
        break;
      case 'agent_message':
        if (item.text) {
          lines.push(this.#formatLine('💬', 'Agent:', 'blue'));
          lines.push('');
          lines.push(item.text);
          lines.push('');
        }
        break;
      case 'reasoning':
        if (item.text && this.#options.verbose) {
          lines.push(this.#formatLine('💭', 'Reasoning:', 'magenta'));
          lines.push(`     ${item.text}`);
        }
        break;
      case 'web_search':
        lines.push(this.#formatLine('✓', 'Search completed', 'green'));
        break;
    }

    return lines;
  }

  /**
   * Render thread error event
   */
  #renderThreadError(event: CodexStreamEvent): string {
    const data = event.data as any;
    const message = data?.error?.message || 'Unknown error';
    return this.#formatLine('❌', `Error: ${message}`, 'red');
  }

  /**
   * Render unknown event
   */
  #renderUnknown(event: CodexStreamEvent): string {
    return this.#formatLine(
      'ℹ️',
      `Event: ${event.type}`,
      'gray'
    );
  }

  /**
   * Format a line with timestamp and color
   */
  #formatLine(icon: string, message: string, color?: string): string {
    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.#options.timestamps) {
      const elapsed = this.#getElapsedTime();
      parts.push(`[${elapsed}]`);
    }

    // Add icon and message
    parts.push(icon);
    parts.push(message);

    let line = parts.join(' ');

    // Apply color if enabled
    if (this.#options.colors && color) {
      line = this.#colorize(line, color);
    }

    return line;
  }

  /**
   * Get elapsed time since start
   */
  #getElapsedTime(): string {
    const elapsed = Date.now() - this.#startTime.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }

  /**
   * Apply ANSI color codes
   */
  #colorize(text: string, color: string): string {
    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      reset: '\x1b[0m',
    };

    const colorCode = colors[color] || '';
    const resetCode = colors.reset;

    return `${colorCode}${text}${resetCode}`;
  }

  /**
   * Get statistics about rendered events
   */
  getStats(): { eventCount: number; duration: string } {
    return {
      eventCount: this.#eventCount,
      duration: this.#getElapsedTime(),
    };
  }
}
