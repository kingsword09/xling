/**
 * settings:switch 命令
 * 切换 profile（仅 Codex 支持）
 */

import { Args, Command, Flags } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type { ToolId, Scope } from "@/domain/types.ts";

export default class SettingsSwitch extends Command {
  static summary = "Switch Codex profiles or Claude settings variants";

  static description = `
    Switch to a different profile configuration for Codex
    or activate a specific settings.<variant>.json for Claude.
  `;

  static examples = [
    "<%= config.bin %> <%= command.id %> oss --tool codex",
    "<%= config.bin %> <%= command.id %> production --tool codex",
    "<%= config.bin %> <%= command.id %> hxi --tool claude --scope user",
  ];

  static args = {
    profile: Args.string({
      description: "Profile name to switch to",
      required: true,
    }),
  };

  static flags = {
    tool: Flags.string({
      char: "t",
      description: "AI CLI tool to manage",
      options: ["claude", "codex", "gemini"],
      default: "codex",
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
    const { args, flags } = await this.parse(SettingsSwitch);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: "switch-profile",
        profile: args.profile,
      });

      if (flags.json) {
        this.log(formatJson(result));
        return;
      }

      this.log(`✓ Switched to profile: ${args.profile}`);
      if (result.filePath) {
        this.log(`  File: ${result.filePath}`);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
