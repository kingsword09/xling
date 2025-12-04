/**
 * xling p - Prompt command
 * Similar to `claude -p` but with multi-provider support and optional CLI passthroughs
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import * as fs from "node:fs";
import { createRouter } from "@/services/prompt/router.ts";
import type { PromptRequest } from "@/services/prompt/types.ts";
import {
  ModelNotSupportedError,
  AllProvidersFailedError,
} from "@/services/prompt/types.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";
import { buildPrompt } from "@/services/p/prompt-builder.ts";
import {
  type CliBackend,
  checkBackendAvailable,
  executeViaCli,
  getExecutable,
} from "@/services/p/backend-router.ts";
import {
  askContinueConversation,
  enterInteractiveMode,
  displayStream,
} from "@/services/p/interactive-mode.ts";

type PromptBackend = "xling" | CliBackend;

export default class PCommand extends Command {
  static summary = "Execute prompts via xling router or AI CLI tools";

  static description = `
    Send prompts to AI models using xling's built-in router (default) or
    delegate to CLI tools like codex exec, claude -p, or gemini.

    The xling router uses configured providers in ~/.claude/xling.json
    with automatic failover and model routing.

    Use --tool to bypass the router and call CLI tools directly.
  `;

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
    {
      description: "Directly run codex exec (bypass xling providers)",
      command:
        '<%= config.bin %> <%= command.id %> --tool codex "Summarize this repo"',
    },
    {
      description: "Use Claude Code CLI with yolo by default",
      command:
        '<%= config.bin %> <%= command.id %> --tool claude "Review this diff"',
    },
    {
      description: "Shorthand for Codex backend (matches x command flag)",
      command: '<%= config.bin %> <%= command.id %> -t codex "Hello"',
    },
    {
      description: "Use Gemini CLI headless prompt",
      command:
        '<%= config.bin %> <%= command.id %> -t gemini "Summarize this diff"',
    },
  ];

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      description:
        "Choose backend: xling router (default) or call codex/claude/gemini CLI directly",
      options: ["xling", "codex", "claude", "gemini"],
      required: false,
      default: "xling",
      char: "t",
    }),
    yolo: Flags.boolean({
      description:
        "Use yolo flags when calling codex/claude/gemini directly (skip permission prompts)",
      required: false,
      default: true,
      allowNo: true,
    }),
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
      char: "T",
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
    const backend = (flags.tool ?? "xling") as PromptBackend;
    const yolo = flags.yolo !== false;

    try {
      const prompt = await buildPrompt({
        positionalArg: args.prompt,
        flagPrompt: flags.prompt,
        files: flags.file,
        stdin: flags.stdin,
        warn: (msg) => this.warn(msg),
      });

      if (!prompt.trim()) {
        this.error(
          "No prompt provided. Use argument, --prompt, --file, or --stdin",
        );
      }

      if (backend !== "xling") {
        await this.#handleDirectBackend(backend, prompt, yolo, flags);
        return;
      }

      await this.#handleXlingBackend(prompt, flags);
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

  async #handleDirectBackend(
    backend: CliBackend,
    prompt: string,
    yolo: boolean,
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
  ): Promise<void> {
    this.#guardDirectMode(backend, flags);

    const available = await checkBackendAvailable(backend);
    if (!available) {
      this.error(
        `Tool "${getExecutable(backend)}" is not installed or not found in PATH. Please install it before using --tool ${backend}.`,
      );
    }

    this.log(
      `[backend: ${backend}] ${yolo ? "yolo on" : "yolo off"} — handing output to ${getExecutable(backend)}`,
    );

    await executeViaCli(backend, prompt, { yolo, model: flags.model });
  }

  async #handleXlingBackend(
    prompt: string,
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
  ): Promise<void> {
    this.#ensureConfigExists();

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

    const router = await createRouter();

    let firstResponse: string;
    let usage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;
    let providerInfo: { provider: string; model: string } | undefined;

    if (flags.stream && !flags.json) {
      const streamResult = await router.executeStream(request);
      firstResponse = await displayStream(streamResult);

      const finalResult = await streamResult.usage;
      usage = finalResult
        ? {
            promptTokens: (finalResult as any).inputTokens ?? 0,
            completionTokens: (finalResult as any).outputTokens ?? 0,
            totalTokens: finalResult.totalTokens ?? 0,
          }
        : undefined;

      providerInfo = { provider: "streaming", model: flags.model || "default" };
    } else {
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

    if (!flags.json && usage && providerInfo) {
      this.log(
        `\n[${providerInfo.provider}/${providerInfo.model}] ` +
          `${usage.totalTokens} tokens ` +
          `(${usage.promptTokens} prompt + ${usage.completionTokens} completion)`,
      );
    }

    const shouldInteract = flags.interactive || false;
    let willEnterInteractive = shouldInteract;

    if (!shouldInteract && !flags.json && process.stdout.isTTY) {
      willEnterInteractive = await askContinueConversation((msg) =>
        this.log(msg),
      );
    }

    if (willEnterInteractive) {
      await enterInteractiveMode(
        {
          initialPrompt: prompt,
          initialResponse: firstResponse,
          system: flags.system,
          model: flags.model,
          temperature: flags.temperature
            ? parseFloat(flags.temperature)
            : undefined,
          maxTokens: flags["max-tokens"],
        },
        router,
        (msg) => this.log(msg),
        (msg) => this.error(msg),
      );
    }
  }

  #ensureConfigExists(): void {
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
  }

  #guardDirectMode(
    backend: CliBackend,
    flags: Interfaces.InferredFlags<typeof PCommand.flags>,
  ): void {
    if (flags.interactive) {
      this.error(
        "Interactive mode is not supported when using --tool codex/claude/gemini. Remove --interactive or use the default xling router.",
      );
    }

    const ignored: string[] = [];

    if (flags.json) ignored.push("--json");
    if (flags.model && backend !== "gemini") ignored.push("--model");
    if (flags.system) ignored.push("--system");
    if (flags.temperature !== undefined) ignored.push("--temperature");
    if (flags["max-tokens"] !== undefined) ignored.push("--max-tokens");
    if (flags.stream === false) ignored.push("--no-stream");

    if (ignored.length > 0) {
      this.warn(
        `Ignoring ${ignored.join(", ")} when using direct CLI backend; codex/claude will apply their own defaults.`,
      );
    }
  }
}
