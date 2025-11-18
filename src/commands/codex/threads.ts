/**
 * codex:threads command
 *
 * Manage Codex threads (conversations) including listing, resuming,
 * viewing history, and deleting threads.
 */

import { Args, Command, Flags, Interfaces } from '@oclif/core';
import { CodexThreadService } from '@/services/codex/threadService.ts';
import { OutputRenderer } from '@/services/codex/outputRenderer.ts';
import type { CodexRunOptions } from '@/domain/codex.ts';

export default class CodexThreads extends Command {
  static override description = 'Manage Codex conversation threads (list/view/resume/delete)';

  static override examples: Command.Example[] = [
    {
      description: 'List all threads',
      command: '<%= config.bin %> <%= command.id %> --list',
    },
    {
      description: 'View thread details',
      command: '<%= config.bin %> <%= command.id %> --view thread_abc123',
    },
    {
      description: 'Resume a thread',
      command:
        '<%= config.bin %> <%= command.id %> --resume thread_abc123 -p "Continue"',
    },
    {
      description: 'Delete a thread',
      command: '<%= config.bin %> <%= command.id %> --delete thread_abc123 --force',
    },
  ];

  static override flags: Interfaces.FlagInput = {
    list: Flags.boolean({
      char: 'l',
      description: 'List all threads',
      exclusive: ['view', 'resume', 'delete'],
    }),
    view: Flags.string({
      description: 'View thread details by ID',
      exclusive: ['list', 'resume', 'delete'],
    }),
    resume: Flags.string({
      char: 'r',
      description: 'Resume thread by ID',
      exclusive: ['list', 'view', 'delete'],
    }),
    delete: Flags.string({
      description: 'Delete thread by ID',
      exclusive: ['list', 'view', 'resume'],
    }),
    prompt: Flags.string({
      char: 'p',
      description: 'Prompt to send (for resume)',
    }),
    format: Flags.string({
      description: 'Output format',
      options: ['plain', 'json'],
      default: 'plain',
    }),
    stream: Flags.boolean({
      char: 's',
      description: 'Use streaming output (for resume)',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force deletion without confirmation',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CodexThreads);

    const service = new CodexThreadService();

    try {
      if (flags.list) {
        await this.#listThreads(service, flags);
      } else if (flags.view) {
        await this.#viewThread(service, flags.view, flags);
      } else if (flags.resume) {
        await this.#resumeThread(service, flags.resume, flags);
      } else if (flags.delete) {
        await this.#deleteThread(service, flags.delete, flags);
      } else {
        this.error(
          'Please specify an action: --list, --view, --resume, or --delete'
        );
      }
    } catch (error) {
      this.error(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List all threads
   */
  async #listThreads(service: CodexThreadService, flags: any) {
    const threads = await service.listThreads();

    if (flags.format === 'json') {
      this.log(JSON.stringify(threads, null, 2));
      return;
    }

    if (threads.length === 0) {
      this.log('No threads found.');
      this.log('');
      this.log('Threads are created when you run:');
      this.log('  xling codex:run "Your prompt"');
      this.log('  xling codex:stream "Your prompt"');
      return;
    }

    this.log('');
    this.log('📋 Codex Threads');
    this.log('');

    // Create table (simplified version without ux.table)
    const header = `${'Thread ID'.padEnd(18)} ${'Last Active'.padEnd(20)} ${'Status'.padEnd(10)}`;
    this.log(header);
    this.log('─'.repeat(50));

    for (const thread of threads) {
      const id = (thread.id.slice(0, 15) + '...').padEnd(18);
      const lastActive = this.#formatDate(thread.lastActive).padEnd(20);
      const status = (thread.status || 'active').padEnd(10);
      this.log(`${id} ${lastActive} ${status}`);
    }

    this.log('');
    this.log(`Total: ${threads.length} thread(s)`);
    this.log('');
    this.log('💡 Quick actions:');
    this.log(
      `   xling codex:threads view ${threads[0]?.id || '<thread-id>'}`
    );
    this.log(
      `   xling codex:threads resume ${threads[0]?.id || '<thread-id>'} -p "Continue"`
    );
  }

  /**
   * View thread details
   */
  async #viewThread(
    service: CodexThreadService,
    threadId: string | undefined,
    flags: any
  ) {
    if (!threadId) {
      this.error('Thread ID is required for view action');
    }

    const thread = await service.getThread(threadId);

    if (!thread) {
      this.error(`Thread ${threadId} not found`);
    }

    if (flags.format === 'json') {
      const history = await service.getThreadHistory(threadId);
      this.log(
        JSON.stringify(
          {
            thread,
            history,
          },
          null,
          2
        )
      );
      return;
    }

    this.log('');
    this.log(`🧵 Thread: ${thread.id}`);
    this.log('━'.repeat(50));
    this.log('');
    this.log(`Created: ${this.#formatDate(thread.createdAt)}`);
    this.log(`Last Active: ${this.#formatDate(thread.lastActive)}`);
    this.log(`Status: ${thread.status}`);
    this.log('');

    // Try to load history if verbose
    if (flags.verbose) {
      const history = await service.getThreadHistory(threadId);

      if (history) {
        this.log('━'.repeat(50));
        this.log('');
        this.log('📜 History:');
        this.log('');
        this.log(`Turn count: ${history.turnCount}`);
        this.log(`Total events: ${history.events.length}`);

        // Show recent events
        const recentEvents = history.events.slice(-10);
        this.log('');
        this.log('Recent events (last 10):');
        for (const event of recentEvents) {
          this.log(`  • ${event.type}`);
        }
      }
    }

    this.log('');
    this.log('💡 Next steps:');
    this.log(`   xling codex:threads resume ${threadId} -p "Your prompt"`);
    this.log(`   xling codex:threads delete ${threadId}`);
    this.log('');
  }

  /**
   * Resume a thread
   */
  async #resumeThread(
    service: CodexThreadService,
    threadId: string | undefined,
    flags: any
  ) {
    if (!threadId) {
      this.error('Thread ID is required for resume action');
    }

    if (!flags.prompt) {
      this.error('Prompt is required for resume action. Use --prompt flag.');
    }

    this.log('');
    this.log(`🧵 Resuming thread: ${threadId}`);
    this.log('');

    if (flags.stream) {
      // Use streaming output
      const renderer = new OutputRenderer({
        verbose: flags.verbose,
      });

      this.log('━'.repeat(50));
      this.log('');

      const eventGenerator = await service.resumeThreadStreamed(threadId, flags.prompt);

      for await (const event of eventGenerator) {
        const lines = renderer.render(event);
        for (const line of lines) {
          this.log(line);
        }
      }

      this.log('');
      this.log('━'.repeat(50));
      this.log('');

      const stats = renderer.getStats();
      this.log('✅ Turn completed!');
      this.log(`   Events: ${stats.eventCount}`);
      this.log(`   Duration: ${stats.duration}`);
    } else {
      // Use buffered output
      const result = await service.resumeThread(threadId, flags.prompt);

      if (flags.format === 'json') {
        this.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.success) {
        this.log('✅ Turn completed!');
        this.log('');

        if (result.output) {
          this.log('Output:');
          this.log('━'.repeat(50));
          this.log(result.output);
          this.log('━'.repeat(50));
          this.log('');
        }

        if (result.filesModified && result.filesModified.length > 0) {
          this.log('Files modified:');
          for (const file of result.filesModified) {
            this.log(`  • ${file}`);
          }
          this.log('');
        }
      } else {
        this.error('❌ Turn failed');
      }
    }
  }

  /**
   * Delete a thread
   */
  async #deleteThread(
    service: CodexThreadService,
    threadId: string | undefined,
    flags: any
  ) {
    if (!threadId) {
      this.error('Thread ID is required for delete action');
    }

    // Check force flag
    if (!flags.force) {
      this.warn(
        `⚠️  This will permanently delete thread ${threadId}. Use --force to confirm.`
      );
      this.log('');
      this.log('Example:');
      this.log(`  xling codex:threads delete ${threadId} --force`);
      return;
    }

    const success = await service.deleteThread(threadId);

    if (success) {
      this.log(`✅ Thread ${threadId} deleted successfully.`);
    } else {
      this.error(`Failed to delete thread ${threadId}. Thread may not exist.`);
    }
  }

  /**
   * Format date for display
   */
  #formatDate(date: Date | undefined): string {
    if (!date) return 'Unknown';

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  }
}
