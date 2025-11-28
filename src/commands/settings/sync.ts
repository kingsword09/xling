/**
 * settings:sync command
 * Sync Claude Code config.toml to Codex config.toml
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { formatJson } from "@/utils/format.ts";
import {
  DEFAULT_CLAUDE_CODE_TOML_PATH,
  DEFAULT_CODEX_CONFIG_PATH,
  syncClaudeTomlToCodex,
  syncCodexTomlToClaude,
} from "@/services/settings/sync.ts";

export default class SettingsSync extends Command {
  static summary = "Sync config.toml between Claude Code and Codex";

  static description = `
    Copy Claude Code config.toml into Codex (default) or reverse the direction
    with --reverse. Shows a diff first, then lets you choose overwrite,
    backup+overwrite, or cancel (similar to settings:switch).
    Use --force to skip prompts.
  `;

  static examples: Command.Example[] = [
    {
      description: "Sync Claude -> Codex with optional backup",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Dry-run and emit JSON (no writes)",
      command: "<%= config.bin %> <%= command.id %> --dry-run --json",
    },
    {
      description: "Explicitly set source/target paths",
      command:
        "<%= config.bin %> <%= command.id %> --source ~/.claude/config.toml --target ~/.codex/config.toml",
    },
    {
      description: "Reverse sync (Codex -> Claude)",
      command: "<%= config.bin %> <%= command.id %> --reverse",
    },
  ];

  static flags: Interfaces.FlagInput = {
    source: Flags.string({
      description: "Path to Claude Code config.toml",
    }),
    target: Flags.string({
      description: "Path to Codex config.toml",
    }),
    backup: Flags.boolean({
      description: "Create a .bak of the target before overwriting",
      default: false,
      allowNo: true,
    }),
    dryRun: Flags.boolean({
      description: "Show what would change without writing files",
      default: false,
    }),
    force: Flags.boolean({
      description: "Apply without prompts (overwrites unless --backup is set)",
      default: false,
    }),
    json: Flags.boolean({
      description: "Output JSON instead of human-readable text",
      default: false,
    }),
    reverse: Flags.boolean({
      description:
        "Reverse sync: copy Codex config.toml into Claude Code config.toml",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsSync);

    if (flags.json && !flags.force && !flags.dryRun) {
      this.error("--json requires --force or --dry-run (no prompts allowed).", {
        exit: 1,
      });
    }

    const reverse = Boolean(flags.reverse);
    const defaultSource = reverse
      ? DEFAULT_CODEX_CONFIG_PATH
      : DEFAULT_CLAUDE_CODE_TOML_PATH;
    const defaultTarget = reverse
      ? DEFAULT_CLAUDE_CODE_TOML_PATH
      : DEFAULT_CODEX_CONFIG_PATH;

    const syncFn = reverse ? syncCodexTomlToClaude : syncClaudeTomlToCodex;

    try {
      const preview = syncFn({
        sourcePath: flags.source ?? defaultSource,
        targetPath: flags.target ?? defaultTarget,
        backup: false,
        dryRun: true,
      });

      if (!preview.data?.changed) {
        if (flags.json) {
          this.log(formatJson(preview));
        } else {
          this.log(preview.message ?? "Already in sync.");
        }
        return;
      }

      if (flags.dryRun) {
        if (flags.json) {
          this.log(formatJson(preview));
        } else {
          this.#printDiff(preview.diff);
          this.log("Dry-run only; no files were written.");
        }
        return;
      }

      this.#printDiff(preview.diff);

      let backup = Boolean(flags.backup);

      if (!flags.force) {
        const action = await this.#promptAction();
        if (action === "cancel") {
          if (flags.json) {
            this.log(formatJson({ ...preview, message: "Sync cancelled." }));
          } else {
            this.log("Sync cancelled.");
          }
          return;
        }
        backup = action === "backup";
      }

      const result = syncFn({
        sourcePath: flags.source ?? defaultSource,
        targetPath: flags.target ?? defaultTarget,
        backup,
        dryRun: false,
      });

      if (flags.json) {
        this.log(formatJson(result));
        return;
      }

      this.log(result.message ?? "Sync completed.");
      if (result.data) {
        this.log(`Source: ${result.data.source}`);
        this.log(`Target: ${result.data.target}`);
        if (result.data.backupPath) {
          this.log(`Backup: ${result.data.backupPath}`);
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  #printDiff(diff?: string | null): void {
    if (!diff) {
      this.log("No diff available; files may already match.");
      return;
    }
    this.log("Proposed changes:");
    this.log(diff);
  }

  async #promptAction(): Promise<"overwrite" | "backup" | "cancel"> {
    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const answer = (
          await rl.question(
            "Choose action ([o]verwrite/[b]ackup+overwrite/[c]ancel): ",
          )
        )
          .trim()
          .toLowerCase();

        if (["overwrite", "backup", "cancel"].includes(answer)) {
          return answer as "overwrite" | "backup" | "cancel";
        }

        if (["o", "b", "c"].includes(answer)) {
          const mapping = {
            o: "overwrite",
            b: "backup",
            c: "cancel",
          } as const;
          return mapping[answer as "o" | "b" | "c"];
        }

        this.log("Invalid selection. Please try again.");
      }
    } finally {
      rl.close();
    }
  }
}
