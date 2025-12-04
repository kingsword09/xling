/**
 * Discuss command - Multi-model roundtable discussions
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { createRouter } from "@/services/prompt/router.ts";
import { runUIMode } from "@/services/discuss/ui-mode.ts";
import { runCliMode } from "@/services/discuss/cli-mode.ts";

export default class DiscussCommand extends Command {
  static summary =
    "Run a roundtable between multiple AI models via CLI or Web UI";

  static description = `
    Start a discussion between multiple AI models.

    In CLI mode, models take turns responding to each other's messages.
    In Web UI mode, a browser-based interface provides real-time visualization.

    Models are configured via ~/.claude/xling.json providers.
  `;

  static examples: Command.Example[] = [
    {
      description: "CLI mode, pick topic/models interactively",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Provide topic and models up front (comma-separated)",
      command:
        '<%= config.bin %> <%= command.id %> --topic "Rust vs Go" --models "gpt-4o,claude-3.5-sonnet"',
    },
    {
      description: "Round-robin turns with shorter per-turn timeout",
      command:
        "<%= config.bin %> <%= command.id %> --strategy round-robin --timeout 10",
    },
    {
      description: "Launch the web UI",
      command: "<%= config.bin %> <%= command.id %> --ui",
    },
  ];

  static flags: Interfaces.FlagInput = {
    ui: Flags.boolean({
      description: "Launch Web UI",
      default: false,
    }),
    topic: Flags.string({
      char: "t",
      description: "Topic to discuss",
    }),
    models: Flags.string({
      char: "m",
      description: "Comma-separated list of models to participate",
    }),
    strategy: Flags.string({
      char: "s",
      description: "Turn-taking strategy (random, round-robin)",
      options: ["random", "round-robin"],
      default: "random",
    }),
    timeout: Flags.integer({
      description: "Timeout per turn in seconds",
      default: 30,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DiscussCommand);

    if (flags.ui) {
      await runUIMode((msg) => this.log(msg));
      return;
    }

    const router = await createRouter();

    await runCliMode(
      {
        topic: flags.topic,
        models: flags.models,
        strategy: flags.strategy as "random" | "round-robin",
        timeout: flags.timeout,
      },
      router,
      (msg) => this.log(msg),
      (msg) => this.error(msg),
    );
  }
}
