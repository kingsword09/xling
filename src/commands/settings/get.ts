/**
 * settings:get 命令
 * 获取指定配置项的值
 */

import { Command, Flags } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type { ToolId, Scope, InspectResult } from "@/domain/types.ts";

export default class SettingsGet extends Command {
  static summary = "View the full configuration file";

  static description = `
    Print the entire configuration file for the selected tool/scope.
    Use --json for structured output or --no-json for plain text.
  `;

  static examples = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user",
    "<%= config.bin %> <%= command.id %> --tool codex --no-json",
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
    json: Flags.boolean({
      description: "Output JSON (default)",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsGet);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: "inspect",
      });

      if (flags.json) {
        this.log(formatJson(result));
        return;
      }

      const data = result.data as InspectResult;
      if (!data.exists) {
        this.warn(`Config file not found: ${data.path}`);
        return;
      }

      if (data.content) {
        this.log(data.content);
      } else {
        this.log("File is empty.");
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
