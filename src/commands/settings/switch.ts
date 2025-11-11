/**
 * settings:switch 命令
 * 切换 profile（仅 Codex 支持）
 */

import { Args, Command, Flags } from "@oclif/core";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type { ToolId, Scope, SettingsResult } from "@/domain/types.ts";

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
      default: "claude",
    }),
    scope: Flags.string({
      char: "s",
      description: "Configuration scope",
      options: ["user", "project", "local", "system"],
      default: "user",
    }),
    json: Flags.boolean({
      description: "Output JSON instead of interactive text",
      default: false,
    }),
    force: Flags.boolean({
      description: "Skip confirmation prompts (Claude only)",
      default: false,
    }),
    backup: Flags.boolean({
      description: "Create a .bak backup when switching (Claude only)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsSwitch);

    try {
      const dispatcher = new SettingsDispatcher();
      const result =
        flags.tool === "claude"
          ? await this.handleClaudeSwitch(dispatcher, args.profile, flags)
          : await dispatcher.execute({
              tool: flags.tool as ToolId,
              scope: flags.scope as Scope,
              action: "switch-profile",
              profile: args.profile,
            });

      if (!result) {
        return;
      }

      this.printResult(result, args.profile, flags);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  private async handleClaudeSwitch(
    dispatcher: SettingsDispatcher,
    profile: string,
    flags: Record<string, any>,
  ): Promise<SettingsResult | null> {
    if (flags.json && !flags.force) {
      this.error("--json requires --force when switching Claude settings.", {
        exit: 1,
      });
    }

    const preview = await dispatcher.execute({
      tool: "claude",
      scope: flags.scope as Scope,
      action: "switch-profile",
      profile,
      switchOptions: { preview: true },
    });

    if (preview.diff) {
      this.log("Proposed changes:\n" + preview.diff);
    } else {
      this.log(
        "No differences detected. Current settings already match the selected variant.",
      );
      return preview;
    }

    let backup = Boolean(flags.backup);
    if (!flags.force && !backup) {
      const action = await this.promptClaudeAction();
      if (action === "cancel") {
        this.log("Switch cancelled.");
        return null;
      }
      backup = action === "backup";
    }

    const result = await dispatcher.execute({
      tool: "claude",
      scope: flags.scope as Scope,
      action: "switch-profile",
      profile,
      switchOptions: { backup },
    });
    result.diff = preview.diff;
    return result;
  }

  private async promptClaudeAction(): Promise<
    "overwrite" | "backup" | "cancel"
  > {
    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const answer = (
          await rl.question("Choose action ([o]verwrite/[b]ackup/[c]ancel): ")
        )
          .trim()
          .toLowerCase();
        if (["overwrite", "backup", "cancel"].includes(answer)) {
          return answer as "overwrite" | "backup" | "cancel";
        }
        if (["o", "b", "c"].includes(answer)) {
          return {
            o: "overwrite",
            b: "backup",
            c: "cancel",
          }[answer] as "overwrite" | "backup" | "cancel";
        }
      }
    } finally {
      rl.close();
    }
  }

  private printResult(
    result: SettingsResult,
    profile: string,
    flags: Record<string, any>,
  ): void {
    if (flags.json) {
      this.log(formatJson(result));
      return;
    }

    if (result.preview) {
      this.log("Preview only. No changes applied.");
      if (result.diff) {
        this.log(result.diff);
      }
      return;
    }

    this.log(result.message ?? `✓ Switched to profile: ${profile}`);
    if (result.filePath) {
      this.log(`  File: ${result.filePath}`);
    }
    if (result.diff) {
      this.log("Applied diff:\n" + result.diff);
    }
  }
}
