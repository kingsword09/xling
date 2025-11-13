/**
 * settings:set command
 * Edit Claude settings files through an IDE
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type { ToolId, Scope } from "@/domain/types.ts";

export default class SettingsSet extends Command {
  static summary = "Open settings files in your IDE";

  static description = `
    Create or open settings files for AI CLI tools in your preferred editor.
    For Claude: provide --name to edit settings.<name>.json (default: settings.json).
    For Xling: edits ~/.claude/xling.json configuration.
  `;

  static examples: Command.Example[] = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user --name hxi",
    "<%= config.bin %> <%= command.id %> --tool claude --scope project --name default --ide cursor",
    "<%= config.bin %> <%= command.id %> --tool xling --scope user --ide cursor",
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
        "Claude variant name (e.g., hxi). Creates settings.<name>.json if missing and opens it in the IDE.",
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

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: "edit",
        name: flags.name,
        ide: flags.ide,
      });

      if (flags.json) {
        this.log(formatJson(result));
      } else {
        this.log(result.message ?? "Opened settings file");
        if (result.filePath) {
          this.log(`File: ${result.filePath}`);
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
