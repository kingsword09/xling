/**
 * settings:auth command
 * Manage auth profiles for Codex
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { CodexAdapter } from "@/services/settings/adapters/codex.ts";
import { formatJson } from "@/utils/format.ts";
import type { SettingsResult } from "@/domain/types.ts";

export default class SettingsAuth extends Command {
  static summary = "Manage auth profiles for Codex";

  static description = `
    Save, list, and delete auth profiles for Codex.
    Use settings:switch to switch between auth profiles and providers.

    Auth profiles allow you to save multiple Codex login credentials
    and switch between them without having to logout and login again.
  `;

  static examples: Command.Example[] = [
    {
      description: "List all saved auth profiles",
      command: "<%= config.bin %> <%= command.id %> --tool codex",
    },
    {
      description: "Save current auth as a named profile",
      command:
        "<%= config.bin %> <%= command.id %> --save personal --tool codex",
    },
    {
      description: "Overwrite an existing profile",
      command:
        "<%= config.bin %> <%= command.id %> --save personal --tool codex --force",
    },
    {
      description: "Delete an auth profile",
      command:
        "<%= config.bin %> <%= command.id %> --delete old-account --tool codex",
    },
    {
      description: "Restore a saved auth profile back to auth.json",
      command:
        "<%= config.bin %> <%= command.id %> --restore personal --tool codex",
    },
  ];

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      char: "t",
      description: "AI CLI tool (currently only codex is supported)",
      options: ["codex"],
      default: "codex",
    }),
    save: Flags.string({
      char: "s",
      description: "Save current auth as a named profile",
    }),
    delete: Flags.string({
      char: "d",
      description: "Delete an auth profile",
    }),
    restore: Flags.string({
      char: "r",
      description: "Restore a saved auth profile back to auth.json",
    }),
    force: Flags.boolean({
      char: "f",
      description: "Overwrite existing profile without confirmation",
      default: false,
    }),
    json: Flags.boolean({
      description: "Output JSON instead of text",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsAuth);

    if (flags.tool !== "codex") {
      this.error(
        "Auth profile management is currently only supported for Codex.",
        { exit: 1 },
      );
    }

    const adapter = new CodexAdapter();
    const force = Boolean(flags.force);
    const json = Boolean(flags.json);
    const saveName = flags.save;
    const deleteName = flags.delete;
    const restoreName = flags.restore;

    const chosen = [saveName, deleteName, restoreName].filter(Boolean);
    if (chosen.length > 1) {
      this.error("Please specify only one of --save, --delete, or --restore.", {
        exit: 1,
      });
    }

    // Determine action based on flags
    if (saveName) {
      await this.#handleSave(adapter, saveName, { force, json });
    } else if (deleteName) {
      await this.#handleDelete(adapter, deleteName, { json });
    } else if (restoreName) {
      await this.#handleRestore(adapter, restoreName, { json });
    } else {
      // Default: list profiles
      await this.#handleList(adapter, { json });
    }
  }

  async #handleList(
    adapter: CodexAdapter,
    flags: { json: boolean },
  ): Promise<void> {
    const profiles = adapter.listAuthProfiles();

    if (flags.json) {
      this.log(formatJson({ profiles }));
      return;
    }

    if (profiles.length === 0) {
      this.log("No auth profiles found.");
      this.log("\nTo save your current auth, run:");
      this.log("  xling settings:auth --save <name> --tool codex");
      return;
    }

    this.log("Auth profiles:");
    for (const profile of profiles) {
      this.log(`  - ${profile}`);
    }
    this.log(`\nTotal: ${profiles.length} profile(s)`);
  }

  async #handleSave(
    adapter: CodexAdapter,
    name: string,
    flags: { force: boolean; json: boolean },
  ): Promise<void> {
    const result = adapter.saveAuthProfile(name, flags.force);
    this.#printResult(result, flags.json);

    if (!result.success) {
      this.exit(1);
    }
  }

  async #handleDelete(
    adapter: CodexAdapter,
    name: string,
    flags: { json: boolean },
  ): Promise<void> {
    const result = adapter.deleteAuthProfile(name);
    this.#printResult(result, flags.json);

    if (!result.success) {
      this.exit(1);
    }
  }

  async #handleRestore(
    adapter: CodexAdapter,
    name: string,
    flags: { json: boolean },
  ): Promise<void> {
    const result = await adapter.switchProfile("user", name);
    this.#printResult(result, flags.json);

    if (!result.success) {
      this.exit(1);
    }
  }

  #printResult(result: SettingsResult, json: boolean): void {
    if (json) {
      this.log(formatJson(result));
      return;
    }

    if (result.success) {
      this.log(result.message ?? "Operation completed successfully.");
      if (result.filePath) {
        this.log(`  File: ${result.filePath}`);
      }
    } else {
      this.error(result.message ?? "Operation failed.", { exit: 1 });
    }
  }
}
