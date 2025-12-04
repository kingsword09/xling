/**
 * settings:set command
 * Edit settings files or add Codex providers
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command, Flags, Interfaces } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type {
  ToolId,
  Scope,
  SettingsResult,
  CodexProviderInput,
} from "@/domain/types.ts";

export default class SettingsSet extends Command {
  static summary = "Edit settings or add model providers";

  static description = `
    Create or open settings files for AI CLI tools in your preferred editor,
    or interactively add Codex model providers.

    For Claude: provide --name to edit settings.<name>.json (default: settings.json).
    For Codex: answer prompts to create a [model_providers.<name>] entry.
    For Xling: edits ~/.claude/xling.json configuration.
  `;

  static examples: Command.Example[] = [
    {
      description: "Create or edit a Claude variant in VS Code",
      command:
        "<%= config.bin %> <%= command.id %> --tool claude --scope user --name hxi",
    },
    {
      description: "Open Claude project settings in Cursor without JSON output",
      command:
        "<%= config.bin %> <%= command.id %> --tool claude --scope project --name default --ide cursor --no-json",
    },
    {
      description: "Add a Codex provider interactively",
      command: "<%= config.bin %> <%= command.id %> --tool codex --scope user",
    },
    {
      description: "Edit xling shortcut config in Cursor",
      command: "<%= config.bin %> <%= command.id %> --tool xling --ide cursor",
    },
  ];

  static args: Interfaces.ArgInput = {};

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      char: "t",
      description: "AI CLI tool to manage",
      options: ["claude", "codex", "gemini", "xling"],
      default: "claude",
    }),
    scope: Flags.string({
      char: "s",
      description: "Configuration scope",
      options: ["user", "project", "local", "system"],
      default: "user",
    }),
    name: Flags.string({
      description:
        "Claude variant name or Codex provider key. Defaults to prompt input if omitted.",
    }),
    ide: Flags.string({
      description: "Editor command or alias (default: code for VS Code)",
      default: "code",
    }),
    json: Flags.boolean({
      description: "Output JSON (default)",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsSet);

    const dispatcher = new SettingsDispatcher();

    try {
      const result =
        flags.tool === "codex"
          ? await this.#handleCodexSet(dispatcher, flags)
          : await dispatcher.execute({
              tool: flags.tool as ToolId,
              scope: flags.scope as Scope,
              action: "edit",
              name: flags.name,
              ide: flags.ide,
            });

      this.#printResult(result, flags);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  async #handleCodexSet(
    dispatcher: SettingsDispatcher,
    flags: Interfaces.InferredFlags<(typeof SettingsSet)["flags"]>,
  ): Promise<SettingsResult> {
    const provider = await this.#promptCodexProvider(flags.name);

    return dispatcher.execute({
      tool: "codex",
      scope: flags.scope as Scope,
      action: "edit",
      provider,
      ide: flags.ide,
    });
  }

  async #promptCodexProvider(
    defaultName?: string,
  ): Promise<CodexProviderInput> {
    const rl = readline.createInterface({ input, output });

    try {
      const namePrompt = defaultName
        ? `Provider name [${defaultName}]: `
        : "Provider name: ";
      const nameAnswer = (await rl.question(namePrompt)).trim();
      const name = nameAnswer || defaultName?.trim() || "";

      if (!name) {
        this.error("Provider name cannot be empty.", { exit: 1 });
      }

      const baseUrl = (
        await rl.question("Base URL (e.g., https://api.example.com/v1): ")
      ).trim();

      if (!baseUrl) {
        this.error("Base URL is required.", { exit: 1 });
      }

      const token = (
        await rl.question("Experimental bearer token (required): ")
      ).trim();

      if (!token) {
        this.error("Experimental bearer token cannot be empty.", { exit: 1 });
      }

      return {
        id: name,
        name,
        base_url: baseUrl,
        experimental_bearer_token: token,
      };
    } finally {
      rl.close();
    }
  }

  #printResult(
    result: SettingsResult,
    flags: Interfaces.InferredFlags<(typeof SettingsSet)["flags"]>,
  ): void {
    if (flags.json) {
      this.log(formatJson(result));
      return;
    }

    this.log(result.message ?? "Opened settings file");
    if (result.filePath) {
      this.log(`File: ${result.filePath}`);
    }
  }
}
