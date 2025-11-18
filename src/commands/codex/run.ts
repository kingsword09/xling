/**
 * codex:run command
 *
 * Execute non-interactive Codex tasks programmatically.
 * Suitable for CI/CD, automation scripts, and batch processing.
 */

import { Args, Command, Flags, Interfaces } from '@oclif/core';
import { createCodexSDKClient } from '@/services/codex/sdkClient.ts';
import type { CodexRunOptions } from '@/domain/codex.ts';

export default class CodexRun extends Command {
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
    'Run a non-interactive Codex task programmatically';

  static override examples: Command.Example[] = [
    {
      description: 'Simple code review',
      command:
        '<%= config.bin %> <%= command.id %> "Review the current git diff for security issues"',
    },
    {
      description: 'With JSON output',
      command:
        '<%= config.bin %> <%= command.id %> "Analyze code complexity" --format json',
    },
    {
      description: 'From stdin',
      command:
        'echo "Add type definitions to user.js" | <%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Custom model',
      command:
        '<%= config.bin %> <%= command.id %> "Optimize performance" --model gpt-5.1-codex',
    },
    {
      description: 'Full auto mode (no approvals)',
      command:
        '<%= config.bin %> <%= command.id %> "Fix ESLint errors" --full-auto',
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
    format: Flags.string({
      description: 'Output format',
      options: ['plain', 'json'],
      default: 'plain',
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
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CodexRun);

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
      if (flags.format === 'plain') {
        this.log('🤖 Starting Codex task...');
        this.log('');
      }

      // Execute the task
      const result = await client.run(runOptions);

      // Output results
      if (flags.format === 'json') {
        this.log(
          JSON.stringify(
            {
              success: result.success,
              threadId: result.threadId,
              output: result.output,
              filesModified: result.filesModified,
              error: result.error,
              exitCode: result.exitCode,
            },
            null,
            2
          )
        );
      } else {
        if (result.success) {
          this.log('✅ Task completed successfully!');
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

          if (result.threadId) {
            this.log(`Thread ID: ${result.threadId}`);
            this.log(
              `Resume with: xling codex:threads resume ${result.threadId}`
            );
          }
        } else {
          this.error(
            `❌ Task failed: ${result.error || 'Unknown error'}`,
            { exit: result.exitCode || 1 }
          );
        }
      }
    } catch (error) {
      if (flags.format === 'json') {
        this.log(
          JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2
          )
        );
        this.exit(1);
      } else {
        this.error(
          `❌ Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
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
