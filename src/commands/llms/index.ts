import { Command, Flags, Interfaces } from "@oclif/core";

import {
  DEFAULT_LLMS_PORT,
  startLlmsGateway,
  type LlmsToolTarget,
} from "@/services/llms/server.ts";

export default class LlmsCommand extends Command {
  static summary =
    "Start an llms gateway so Claude Code, Codex, or Gemini can use xling providers";

  static description =
    "Boot a local llms server seeded from ~/.claude/xling.json. The gateway exposes Anthropic, OpenAI, and Gemini compatible endpoints that forward to your configured providers.";

  static examples: Command.Example[] = [
    {
      description: "Start an Anthropic-compatible gateway on the default port",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Expose an OpenAI endpoint for Codex on port 5050",
      command: "<%= config.bin %> <%= command.id %> --tool codex --port 5050",
    },
    {
      description: "Bind to all interfaces for Gemini CLI",
      command:
        "<%= config.bin %> <%= command.id %> --tool gemini --host 0.0.0.0",
    },
    {
      description: "Show instructions for all client types",
      command: "<%= config.bin %> <%= command.id %> --tool all",
    },
  ];

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      char: "t",
      description:
        "Which client you plan to point at the gateway (controls usage hints)",
      options: ["claude", "codex", "gemini", "all"],
      default: "claude",
    }),
    port: Flags.integer({
      char: "p",
      description: "Port for the llms gateway",
      default: DEFAULT_LLMS_PORT,
    }),
    host: Flags.string({
      description: "Host/interface to bind",
      default: "127.0.0.1",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LlmsCommand);
    const target = (flags.tool ?? "claude") as LlmsToolTarget;

    try {
      const context = await startLlmsGateway({
        host: flags.host,
        port: flags.port,
      });

      this.#printStartup(target, context.baseUrl, context.modelAliases);

      if (context.warnings.length) {
        this.log("\nWarnings:");
        context.warnings.forEach((warning: string) => this.log(`- ${warning}`));
      }

      this.log(
        "\nPress Ctrl+C to stop the gateway. Client API keys are pulled from ~/.claude/xling.json; the client-side key can be any non-empty string.",
      );

      // Keep the process alive while the Fastify server runs
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      await new Promise(() => {});
    } catch (error) {
      this.error(
        `Failed to start llms gateway: ${(error as Error).message ?? error}`,
      );
    }
  }

  #printStartup(
    target: LlmsToolTarget,
    baseUrl: string,
    modelAliases: string[],
  ): void {
    this.log(`llms gateway running at ${baseUrl}`);

    const sampleAliases =
      modelAliases.length > 5
        ? `${modelAliases.slice(0, 5).join(", ")} ...`
        : modelAliases.join(", ");

    this.log(
      modelAliases.length
        ? `Models (use provider,model): ${sampleAliases}`
        : "No models were detected.",
    );

    this.log("\nUsage hints:");

    if (target === "claude" || target === "all") {
      this.log(
        `- Claude Code: set base_url to ${baseUrl}/claude so requests land on /v1/messages; model uses provider,model (e.g., ${modelAliases[0] ?? "provider,model"}).`,
      );
    }

    if (target === "codex" || target === "all") {
      this.log(
        `- Codex (OpenAI style): set API base to ${baseUrl}/codex (routes to /v1/responses; /v1/chat/completions still available). Model uses provider,model (e.g., ${modelAliases[0] ?? "provider,model"}).`,
      );
    }

    if (target === "gemini" || target === "all") {
      this.log(
        `- Gemini CLI: set API_ROOT to ${baseUrl}/gemini so /v1beta/models/* requests forward correctly; model uses provider,model (e.g., ${modelAliases[0] ?? "provider,model"}).`,
      );
    }
  }
}
