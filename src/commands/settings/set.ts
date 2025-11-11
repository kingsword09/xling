/**
 * settings:set 命令
 * 设置配置项的值
 */

import { Command, Flags } from "@oclif/core";
import { SettingsDispatcher } from "../../services/settings/dispatcher.ts";
import { formatJson } from "../../utils/format.ts";
import type { ToolId, Scope } from "../../domain/types.ts";

export default class SettingsSet extends Command {
  static summary = "Open settings files in your IDE (Claude only)";

  static description = `
    Create or open Claude settings variants in your preferred editor.
    Provide --name to edit settings.<name>.json (default: settings.json).
  `;

  static examples = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user --name hxi",
    "<%= config.bin %> <%= command.id %> --tool claude --scope project --name default --ide cursor",
  ];

  static args = {};

  static flags = {
    tool: Flags.string({
      char: "t",
      description: "AI CLI tool to manage",
      options: ["claude", "codex", "gemini"],
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
      if (flags.tool !== "claude") {
        this.error(
          "Editing settings files is currently only supported for Claude.",
          {
            exit: 1,
          },
        );
      }

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
