/**
 * settings command (main entry point)
 * Manage configuration for AI CLI tools (Claude Code, Codex, Gemini CLI)
 */

import { Command } from "@oclif/core";

export default class Settings extends Command {
  static summary = "Manage AI tool settings (Claude, Codex, Gemini, xling)";

  static description = `
    Unified settings management for multiple AI CLI tools.

    Supported tools:
    - Claude Code: Manage user, project, and local settings
    - Codex: Manage model providers, auth profiles, and settings
    - Gemini CLI: Manage user, project, and system settings
    - xling: Manage shortcuts and proxy configuration

    Use subcommands to list, view, edit, switch, and sync configurations.
  `;

  static examples: Command.Example[] = [
    {
      description: "List Claude user settings",
      command: "<%= config.bin %> <%= command.id %>:list --tool claude",
    },
    {
      description: "List Codex providers and auth profiles",
      command: "<%= config.bin %> <%= command.id %>:list --tool codex",
    },
    {
      description: "View full Gemini configuration",
      command: "<%= config.bin %> <%= command.id %>:get --tool gemini",
    },
    {
      description: "Switch Codex profile",
      command: "<%= config.bin %> <%= command.id %>:switch oss --tool codex",
    },
    {
      description: "Edit Claude settings",
      command: "<%= config.bin %> <%= command.id %>:set --tool claude",
    },
    {
      description: "Sync config between Claude and Codex",
      command: "<%= config.bin %> <%= command.id %>:sync",
    },
  ];

  async run(): Promise<void> {
    await this.parse(Settings);
    // Show help when running bare `xling settings`
    await this.config.runCommand("help", ["settings"]);
  }
}
