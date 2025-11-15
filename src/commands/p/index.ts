/**
 * xling p - Prompt command
 * Similar to `claude -p` but with multi-provider support
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import * as fs from "fs";
import * as readline from "readline";
import * as tty from "tty";
import { createRouter } from "@/services/prompt/router.ts";
import type { PromptRequest, ChatMessage } from "@/services/prompt/types.ts";
import {
  ModelNotSupportedError,
  AllProvidersFailedError,
} from "@/services/prompt/types.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";

export default class PCommand extends Command {
  static description =
    "Execute a prompt using configured AI providers with automatic fallback";

  static examples: Command.Example[] = [
    {
      description: "Simple prompt",
      command:
        '<%= config.bin %> <%= command.id %> "Explain quantum computing"',
    },
    {
      description: "Specify model",
      command:
        '<%= config.bin %> <%= command.id %> --model gpt-4-turbo "Write a poem"',
    },
    {
      description: "Read from file",
      command:
        '<%= config.bin %> <%= command.id %> -f README.md "Summarize this"',
    },
    {
      description: "Read from stdin",
      command:
        'git diff | <%= config.bin %> <%= command.id %> --stdin "Review this diff"',
    },
    {
      description: "JSON output",
      command: '<%= config.bin %> <%= command.id %> --json "What is 2+2?"',
    },
  ];

  static flags: Interfaces.FlagInput = {
    model: Flags.string({
      char: "m",
      description: "Model to use (defaults to configured defaultModel)",
      required: false,
    }),
    prompt: Flags.string({
      char: "p",
      description: "Prompt text (alternative to positional arg)",
      required: false,
    }),
    system: Flags.string({
      char: "s",
      description: "System prompt",
      required: false,
    }),
    file: Flags.string({
      char: "f",
      description: "Read additional context from file",
      required: false,
      multiple: true,
    }),
    stdin: Flags.boolean({
      description: "Read prompt from stdin",
      required: false,
      default: false,
    }),
    temperature: Flags.string({
      char: "t",
      description: "Temperature (0.0-2.0)",
      required: false,
    }),
    "max-tokens": Flags.integer({
      description: "Maximum tokens to generate",
      required: false,
    }),
    json: Flags.boolean({
      description: "Output as JSON",
      required: false,
      default: false,
    }),
    stream: Flags.boolean({
      description: "Stream output (default: true)",
      required: false,
      default: true,
      allowNo: true,
    }),
    interactive: Flags.boolean({
      char: "i",
      description: "Enter interactive chat mode after first response",
      required: false,
      default: false,
    }),
  };

  static args: Interfaces.ArgInput = {
    prompt: Args.string({
      description: "The prompt text",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PCommand);

    try {
      // Check if config exists, if not provide helpful error
      const adapter = new XlingAdapter();
      const configPath = adapter.resolvePath("user");

      if (!fs.existsSync(configPath.replace("~", process.env.HOME || ""))) {
        this.error(
          `Configuration not found at ${configPath}\n\n` +
            `Please create a configuration file with at least one provider.\n` +
            `Example:\n` +
            `{\n` +
            `  "prompt": {\n` +
            `    "providers": [\n` +
            `      {\n` +
            `        "name": "openai",\n` +
            `        "baseUrl": "https://api.openai.com/v1",\n` +
            `        "apiKey": "sk-...",\n` +
            `        "models": ["gpt-4", "gpt-4-turbo"]\n` +
            `      }\n` +
            `    ],\n` +
            `    "defaultModel": "gpt-4"\n` +
            `  }\n` +
            `}`,
        );
      }

      // Build prompt from various sources
      const prompt = await this.#buildPrompt(args, flags);

      if (!prompt.trim()) {
        this.error(
          "No prompt provided. Use argument, --prompt, --file, or --stdin",
        );
      }

      // Build request
      const request: PromptRequest = {
        prompt,
        model: flags.model,
        system: flags.system,
        temperature: flags.temperature
          ? parseFloat(flags.temperature)
          : undefined,
        maxTokens: flags["max-tokens"],
        stream: flags.stream,
      };

      // Create router
      const router = await createRouter();

      // Execute first request
      let firstResponse: string;
      let usage:
        | {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          }
        | undefined;
      let providerInfo: { provider: string; model: string } | undefined;

      if (flags.stream && !flags.json) {
        // Stream output
        const streamResult = await router.executeStream(request);
        firstResponse = await this.#displayStream(streamResult); // Use default stdout

        // Get usage from final result
        const finalResult = await streamResult.usage;
        usage = finalResult
          ? {
              promptTokens: (finalResult as any).inputTokens ?? 0,
              completionTokens: (finalResult as any).outputTokens ?? 0,
              totalTokens: finalResult.totalTokens ?? 0,
            }
          : undefined;

        providerInfo = {
          provider: "streaming",
          model: flags.model || "default",
        };
      } else {
        // Non-streaming output
        const result = await router.execute(request);
        firstResponse = result.content;
        usage = result.usage;
        providerInfo = { provider: result.provider, model: result.model };

        if (flags.json) {
          this.log(JSON.stringify(result, null, 2));
        } else {
          this.log(result.content);
        }
      }

      // Display usage info
      if (!flags.json && usage && providerInfo) {
        this.log(
          `\n[${providerInfo.provider}/${providerInfo.model}] ` +
            `${usage.totalTokens} tokens ` +
            `(${usage.promptTokens} prompt + ${usage.completionTokens} completion)`,
        );
      }

      // Check if should enter interactive mode
      const shouldInteract = this.#shouldEnterInteractive(flags);

      // Auto-ask in TTY environment (after stdin pipe completes)
      let willEnterInteractive = shouldInteract;
      if (!shouldInteract && !flags.json && process.stdout.isTTY) {
        // Ask user if they want to continue
        willEnterInteractive = await this.#askContinueConversation();
      }

      if (willEnterInteractive) {
        await this.#enterInteractiveMode(prompt, firstResponse, flags, router);
      }
    } catch (error) {
      if (error instanceof ModelNotSupportedError) {
        this.error(error.message);
      } else if (error instanceof AllProvidersFailedError) {
        this.error(
          `All providers failed:\n${error.errors.map((e) => `  ${e.provider}: ${e.error.message}`).join("\n")}`,
        );
      } else {
        this.error((error as Error).message);
      }
    }
  }

  /**
   * Determine if should enter interactive mode
   */
  #shouldEnterInteractive(
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
  ): boolean {
    // Explicit flag takes precedence
    if (flags.interactive) {
      return true;
    }

    // Auto-detect: TTY environment (can be used with --stdin after pipe completes)
    if (process.stdout.isTTY && process.stdin.isTTY) {
      // For now, only enable with explicit flag to avoid surprise
      // User can use -i to explicitly enable
      return false;
    }

    return false;
  }

  /**
   * Ask user if they want to continue conversation
   * Uses /dev/tty to read from terminal even when stdin is piped
   */
  async #askContinueConversation(): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;

      try {
        // Open /dev/tty directly for both input and output
        const ttyFd = fs.openSync("/dev/tty", "r+");
        const ttyReadStream = new tty.ReadStream(ttyFd);
        const ttyWriteStream = new tty.WriteStream(ttyFd);

        const rl = readline.createInterface({
          input: ttyReadStream,
          output: ttyWriteStream,
        });

        rl.question("\nContinue conversation? (y/N): ", (answer) => {
          answered = true;
          const normalized = answer.trim().toLowerCase();
          const shouldContinue = normalized === "y" || normalized === "yes";
          if (!shouldContinue) {
            (ttyWriteStream ?? process.stdout).write(
              "\nOkay, not continuing the conversation.\n",
            );
          }
          rl.close();
          ttyReadStream.destroy();
          ttyWriteStream.destroy();
          fs.closeSync(ttyFd);
          resolve(shouldContinue);
        });

        // Auto-decline after 10 seconds
        setTimeout(() => {
          if (!answered) {
            rl.close();
            ttyReadStream.destroy();
            ttyWriteStream.destroy();
            fs.closeSync(ttyFd);
            process.stdout.write(
              "\nNo response received. Ending conversation prompt.\n",
            );
            resolve(false);
          }
        }, 10000);
      } catch {
        // If /dev/tty is not available (e.g., not a TTY environment), decline
        this.log("Skipping interactive follow-up (TTY not available).");
        resolve(false);
      }
    });
  }

  /**
   * Enter interactive REPL mode
   * Uses /dev/tty for proper terminal behavior when stdin is piped
   */
  async #enterInteractiveMode(
    initialPrompt: string,
    initialResponse: string,
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
    router: Awaited<ReturnType<typeof createRouter>>,
  ): Promise<void> {
    // Build message history
    const messages: ChatMessage[] = [];

    // Add system message if provided
    if (flags.system) {
      messages.push({ role: "system", content: flags.system });
    }

    // Add initial conversation
    messages.push({ role: "user", content: initialPrompt });
    messages.push({ role: "assistant", content: initialResponse });

    this.log(
      "\n--- Interactive mode (type 'exit', 'quit', or press Ctrl+D to end) ---\n",
    );

    try {
      let rl: readline.Interface;
      let ttyFd: number | null = null;
      let ttyReadStream: tty.ReadStream | null = null;
      let ttyWriteStream: tty.WriteStream | null = null;
      let wasRaw = false;
      let inputStream: NodeJS.ReadableStream;

      // Cleanup function to restore terminal state
      const cleanup = () => {
        // Restore raw mode state
        if (inputStream && "setRawMode" in inputStream) {
          try {
            (inputStream as tty.ReadStream).setRawMode(wasRaw);
          } catch {
            // Ignore errors during cleanup
          }
        }

        // Close TTY streams if opened
        if (ttyReadStream) {
          try {
            ttyReadStream.destroy();
          } catch {
            // Ignore errors during cleanup
          }
        }
        if (ttyWriteStream) {
          try {
            ttyWriteStream.destroy();
          } catch {
            // Ignore errors during cleanup
          }
        }
        if (ttyFd !== null) {
          try {
            fs.closeSync(ttyFd);
          } catch {
            // Ignore errors during cleanup
          }
        }
      };

      if (process.stdin.isTTY) {
        // stdin is available, use it directly
        inputStream = process.stdin;

        // Save raw mode state and enable it for proper input handling
        wasRaw = process.stdin.isRaw || false;
        if (!wasRaw) {
          process.stdin.setRawMode(true);
        }

        rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: "> ",
        });
      } else {
        // stdin is piped, open /dev/tty directly
        ttyFd = fs.openSync("/dev/tty", "r+");
        ttyReadStream = new tty.ReadStream(ttyFd);
        ttyWriteStream = new tty.WriteStream(ttyFd);
        inputStream = ttyReadStream;

        // Enable raw mode on the TTY stream for proper input handling
        // This prevents terminal echo conflicts with readline
        wasRaw = ttyReadStream.isRaw || false;
        if (!wasRaw) {
          ttyReadStream.setRawMode(true);
        }

        rl = readline.createInterface({
          input: ttyReadStream,
          output: ttyWriteStream,
          prompt: "> ",
        });
      }

      const outputStream = ttyWriteStream || process.stdout;

      rl.prompt();

      rl.on("line", async (input: string) => {
        const trimmed = input.trim();

        // Check for exit commands
        if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
          rl.close();
          return;
        }

        // Ignore empty input
        if (!trimmed) {
          rl.prompt();
          return;
        }

        // Add user message
        messages.push({ role: "user", content: trimmed });

        try {
          // Execute and stream response
          const request: PromptRequest = {
            messages,
            model: flags.model,
            temperature: flags.temperature
              ? parseFloat(flags.temperature)
              : undefined,
            maxTokens: flags["max-tokens"],
            stream: true,
          };

          const streamResult = await router.executeStream(request);
          const responseText = await this.#displayStream(
            streamResult,
            outputStream,
          );

          // Add assistant response to history
          messages.push({ role: "assistant", content: responseText });

          rl.prompt();
        } catch (error) {
          outputStream.write(`\n[Error] ${(error as Error).message}\n\n`);
          rl.prompt();
        }
      });

      rl.on("close", () => {
        cleanup();
        this.log("\nGoodbye!");
        process.exit(0);
      });

      // Handle Ctrl+C gracefully
      rl.on("SIGINT", () => {
        outputStream.write(
          "\n\nInterrupted. Type 'exit' to quit or continue chatting.\n",
        );
        rl.prompt();
      });

      // Register cleanup on process signals
      const signalHandler = () => {
        cleanup();
        process.exit(0);
      };
      process.once("SIGTERM", signalHandler);
      process.once("SIGINT", signalHandler);
    } catch (error) {
      this.error(`Cannot enter interactive mode: ${(error as Error).message}`);
    }
  }

  /**
   * Display streaming output and return full text
   */
  async #displayStream(
    streamResult: Awaited<
      ReturnType<Awaited<ReturnType<typeof createRouter>>["executeStream"]>
    >,
    outputStream: NodeJS.WritableStream = process.stdout,
  ): Promise<string> {
    let fullText = "";

    outputStream.write("\n");

    for await (const chunk of streamResult.textStream) {
      outputStream.write(chunk);
      fullText += chunk;

      // Force flush to ensure immediate output
      // This is especially important for TTY streams
      if ("flush" in outputStream && typeof outputStream.flush === "function") {
        outputStream.flush();
      }
    }

    outputStream.write("\n");

    return fullText;
  }

  /**
   * Build prompt from various sources
   */
  async #buildPrompt(
    args: Interfaces.InferredArgs<typeof PCommand.args>,
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
  ): Promise<string> {
    const parts: string[] = [];

    // From positional argument
    if (args.prompt) {
      parts.push(args.prompt);
    }

    // From --prompt flag
    if (flags.prompt) {
      parts.push(flags.prompt);
    }

    // From --file
    if (flags.file && flags.file.length > 0) {
      for (const file of flags.file) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          parts.push(`\n--- File: ${file} ---\n${content}`);
        } catch (error) {
          this.warn(`Failed to read file ${file}: ${(error as Error).message}`);
        }
      }
    }

    // From stdin
    if (flags.stdin) {
      const stdin = await this.#readStdin();
      if (stdin) {
        parts.push(stdin);
      }
    }

    return parts.join("\n").trim();
  }

  /**
   * Read from stdin
   */
  async #readStdin(): Promise<string> {
    return new Promise((resolve) => {
      const chunks: string[] = [];

      process.stdin.setEncoding("utf-8");

      process.stdin.on("data", (chunk: string | Buffer) => {
        chunks.push(chunk.toString());
      });

      process.stdin.on("end", () => {
        resolve(chunks.join(""));
      });

      // If stdin is a TTY, it means no piped input
      if (process.stdin.isTTY) {
        resolve("");
      }
    });
  }
}
