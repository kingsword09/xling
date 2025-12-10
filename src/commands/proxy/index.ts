import { Command, Flags, Interfaces } from "@oclif/core";

import {
  DEFAULT_PROXY_PORT,
  startProxyServer,
} from "@/services/proxy/server.ts";
import { validatePort, validateHost } from "@/domain/validators.ts";
import * as open from "open";

export default class ProxyCommand extends Command {
  static summary =
    "Start an OpenAI-compatible proxy server with load balancing and key rotation";

  static description = `Boot a local proxy server that forwards requests to configured upstream AI providers.

Features:
- OpenAI Chat Completions API (/v1/chat/completions)
- Anthropic Messages API (/v1/messages) with automatic format conversion
- OpenAI Responses API (/responses) for Codex CLI compatibility
- Multiple upstream providers with automatic failover
- Load balancing strategies: round-robin, random, weighted, failover
- API key rotation with automatic cooldown on errors
- Model mapping and aliasing
- Optional access key protection
- Optional DevTools-style UI on the same port (pass --ui)

Configuration is read from ~/.claude/xling.json under the 'proxy' section.`;

  static examples: Command.Example[] = [
    {
      description: "Start proxy server on default port (4320)",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Start on custom port with access key protection",
      command:
        "<%= config.bin %> <%= command.id %> --port 8080 --access-key my-secret-key",
    },
    {
      description: "Bind to all interfaces for external access",
      command: "<%= config.bin %> <%= command.id %> --host 0.0.0.0",
    },
    {
      description: "Start with verbose logging disabled",
      command: "<%= config.bin %> <%= command.id %> --no-logger",
    },
    {
      description: "Start proxy with DevTools-style UI on the same port",
      command: "<%= config.bin %> <%= command.id %> --ui",
    },
  ];

  static flags: Interfaces.FlagInput = {
    port: Flags.integer({
      char: "p",
      description: "Port for the proxy server",
      default: DEFAULT_PROXY_PORT,
    }),
    host: Flags.string({
      description: "Host/interface to bind",
      default: "127.0.0.1",
    }),
    "access-key": Flags.string({
      char: "k",
      description:
        "Access key for proxy authentication (overrides config file)",
    }),
    logger: Flags.boolean({
      description: "Enable request logging",
      default: true,
      allowNo: true,
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging (full request/response bodies)",
      default: false,
    }),
    ui: Flags.boolean({
      description: "Serve DevTools-style proxy UI on the same host/port",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProxyCommand);

    try {
      // Validate inputs
      const port = validatePort(flags.port);
      const host = validateHost(flags.host);

      const context = await startProxyServer({
        host,
        port,
        accessKey: flags["access-key"],
        logger: flags.logger,
        verbose: flags.verbose,
        ui: flags.ui,
      });

      this.#printStartup(context, flags["access-key"], flags.ui);

      if (flags.ui) {
        const uiUrl = `${context.baseUrl}/proxy`;
        this.log(`\nOpening UI at ${uiUrl} ...`);
        try {
          // @ts-ignore open types
          await open.default(uiUrl);
        } catch (err) {
          this.warn(
            `Failed to auto-open browser: ${(err as Error).message}. Open ${uiUrl} manually.`,
          );
        }
      }

      this.log("\nPress Ctrl+C to stop the proxy server.");

      // Keep the process alive
      await new Promise(() => {});
    } catch (error) {
      this.error(
        `Failed to start proxy server: ${(error as Error).message ?? error}`,
      );
    }
  }

  #printStartup(
    context: { baseUrl: string; providers: string[]; models: string[] },
    accessKey?: string,
    ui?: boolean,
  ): void {
    this.log(`Proxy server running at ${context.baseUrl}`);
    this.log(`Providers: ${context.providers.join(", ")}`);

    const sampleModels =
      context.models.length > 5
        ? `${context.models.slice(0, 5).join(", ")} ...`
        : context.models.join(", ");

    this.log(
      context.models.length ? `Models: ${sampleModels}` : "No models detected.",
    );

    if (accessKey) {
      this.log("\nAccess key protection: ENABLED");
      this.log("Include 'Authorization: Bearer <access-key>' in requests.");
    }

    this.log("\nEndpoints:");
    this.log(`  ${context.baseUrl}/v1/chat/completions  - OpenAI Chat API`);
    this.log(
      `  ${context.baseUrl}/v1/responses         - OpenAI Responses API (Codex)`,
    );
    this.log(
      `  ${context.baseUrl}/v1/messages          - Anthropic Messages API`,
    );
    this.log(
      `  ${context.baseUrl}/v1/completions       - OpenAI Completions API`,
    );
    this.log(`  ${context.baseUrl}/health               - Health check`);
    this.log(`  ${context.baseUrl}/stats                - Provider statistics`);
    if (ui) {
      this.log(`  ${context.baseUrl}/proxy               - Proxy UI`);
    }

    this.log("\nUsage with Claude Code:");
    this.log(
      `  Set ANTHROPIC_BASE_URL=${context.baseUrl} (without /v1 suffix)`,
    );

    this.log("\nUsage with Codex (config.toml):");
    this.log(`  [model_providers.xling]`);
    this.log(`  name = "xling"`);
    this.log(`  base_url = "${context.baseUrl}"`);
    this.log(`  wire_api = "responses"`);
    if (accessKey) {
      this.log(`  experimental_bearer_token = "<your-access-key>"`);
    }

    this.log("\nUsage with curl:");
    this.log(`  curl ${context.baseUrl}/v1/chat/completions \\`);
    this.log(`    -H "Content-Type: application/json" \\`);
    if (accessKey) {
      this.log(`    -H "Authorization: Bearer <access-key>" \\`);
    }
    this.log(
      `    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'`,
    );
  }
}
