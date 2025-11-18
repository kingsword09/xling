/**
 * codex:stream command
 *
 * Execute Codex tasks with real-time streaming output.
 * Shows progress, reasoning, and intermediate steps as they happen.
 */

import { Args, Command, Flags, Interfaces } from '@oclif/core';
import { createCodexSDKClient } from '@/services/codex/sdkClient.ts';
import { OutputRenderer } from '@/services/codex/outputRenderer.ts';
import type { CodexRunOptions } from '@/domain/codex.ts';

export default class CodexStream extends Command {
  static override args: {
    prompt: ReturnType<typeof Args.string>;
  } = {
    prompt: Args.string({
      description:
        'Prompt to send to Codex (or use --prompt flag or stdin)',
      required: false,
    }),
  };

  static override description =
    'Execute Codex tasks with real-time streaming output';

  static override examples: Command.Example[] = [
    {
      description: 'Watch refactoring progress in real-time',
      command:
        '<%= config.bin %> <%= command.id %> "Refactor the authentication module to use JWT"',
    },
    {
      description: 'Monitor long-running tasks',
      command:
        '<%= config.bin %> <%= command.id %> "Migrate database from MySQL to PostgreSQL"',
    },
    {
      description: 'Debug with visible reasoning',
      command:
        '<%= config.bin %> <%= command.id %> "Debug why user sessions expire prematurely" --verbose',
    },
    {
      description: 'From file input',
      command:
        '<%= config.bin %> <%= command.id %> --file task.txt',
    },
  ];

  static override flags: Interfaces.FlagInput = {
    prompt: Flags.string({
      char: 'p',
      description: 'Prompt to send to Codex',
      exclusive: ['file'],
    }),
    file: Flags.string({
      char: 'f',
      description: 'Read prompt from file',
      exclusive: ['prompt'],
    }),
    model: Flags.string({
      char: 'm',
      description: 'Model to use',
      default: 'gpt-5.1-codex',
    }),
    'working-dir': Flags.string({
      char: 'd',
      description: 'Working directory for Codex',
      default: process.cwd(),
    }),
    'skip-git-check': Flags.boolean({
      description: 'Skip Git repository check',
      default: false,
    }),
    sandbox: Flags.string({
      description: 'Sandbox mode',
      options: ['read-only', 'read-write', 'off'],
      default: 'read-only',
    }),
    'full-auto': Flags.boolean({
      description: 'Full auto mode (no approval prompts)',
      default: true,
    }),
    image: Flags.string({
      description: 'Path to image file to include in context (can be repeated)',
      multiple: true,
    }),
    config: Flags.string({
      description:
        'Additional config in KEY=VALUE format (can be repeated)',
      multiple: true,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output including reasoning',
      default: false,
    }),
    'no-timestamps': Flags.boolean({
      description: 'Hide timestamps from output',
      default: false,
    }),
    'no-colors': Flags.boolean({
      description: 'Disable colored output',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CodexStream);

    try {
      // Get prompt from args, flags, file, or stdin
      const prompt = await this.#getPrompt(args.prompt, flags);

      if (!prompt) {
        this.error(
          'No prompt provided. Use argument, --prompt, --file, or pipe via stdin.'
        );
      }

      // Parse config flags
      const config = this.#parseConfig(flags.config);

      // Create SDK client (automatically loads auth from Codex CLI)
      const client = await createCodexSDKClient({
        model: flags.model,
        workingDir: flags['working-dir'],
        skipGitRepoCheck: flags['skip-git-check'],
      });

      // Create output renderer
      const renderer = new OutputRenderer({
        timestamps: !flags['no-timestamps'],
        colors: !flags['no-colors'],
        verbose: flags.verbose,
      });

      // Prepare run options
      const runOptions: CodexRunOptions = {
        prompt,
        model: flags.model,
        workingDir: flags['working-dir'],
        skipGitRepoCheck: flags['skip-git-check'],
        sandbox: flags.sandbox as 'read-only' | 'read-write' | 'off',
        fullAuto: flags['full-auto'],
        images: flags.image,
        config,
      };

      // Show starting message
      this.log('');
      this.log('━'.repeat(50));
      this.log('');

      let threadId: string | null = null;

      // Execute the streaming task
      const eventGenerator = await client.runStreamed(runOptions);

      for await (const event of eventGenerator) {
        // Extract thread ID from thread_started event
        if (event.type === 'thread_started' && !threadId) {
          const data = event.data as any;
          threadId = data?.threadId;
        }

        // Render each event
        const lines = renderer.render(event);
        for (const line of lines) {
          this.log(line);
        }
      }

      // Show completion summary
      this.log('');
      this.log('━'.repeat(50));
      this.log('');

      const stats = renderer.getStats();
      this.log(`✅ Stream completed!`);
      this.log(`   Events processed: ${stats.eventCount}`);
      this.log(`   Duration: ${stats.duration}`);

      if (threadId) {
        this.log('');
        this.log(`Thread ID: ${threadId}`);
        this.log(`Resume with: xling codex:threads resume ${threadId}`);
      }
    } catch (error) {
      this.error(
        `❌ Stream failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get prompt from various sources
   */
  async #getPrompt(
    argPrompt: string | undefined,
    flags: any
  ): Promise<string> {
    // Priority: arg > --prompt flag > --file > stdin
    if (argPrompt) {
      return argPrompt;
    }

    if (flags.prompt) {
      return flags.prompt;
    }

    if (flags.file) {
      const fs = await import('node:fs/promises');
      return await fs.readFile(flags.file, 'utf-8');
    }

    // Check if stdin has data
    if (!process.stdin.isTTY) {
      return await this.#readStdin();
    }

    return '';
  }

  /**
   * Read from stdin
   */
  async #readStdin(): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => {
        resolve(data.trim());
      });
    });
  }

  /**
   * Parse config flags into object
   */
  #parseConfig(
    configFlags: string[] | undefined
  ): Record<string, unknown> | undefined {
    if (!configFlags || configFlags.length === 0) {
      return undefined;
    }

    const config: Record<string, unknown> = {};
    for (const flag of configFlags) {
      const [key, ...valueParts] = flag.split('=');
      if (key) {
        const value = valueParts.join('=');
        // Try to parse as JSON, fallback to string
        try {
          config[key] = JSON.parse(value);
        } catch {
          config[key] = value;
        }
      }
    }

    return config;
  }
}
