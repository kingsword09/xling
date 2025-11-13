/**
 * settings:inspect command
 * Check the status of configuration files
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import type { ToolId, Scope, InspectResult } from "@/domain/types.ts";

export default class SettingsInspect extends Command {
  static summary = "Inspect configuration file status";

  static description = `
    Display information about the configuration file, including:
    - File path
    - Existence status
    - File size
    - Last modified date
    - File contents (if exists)
  `;

  static examples: Command.Example[] = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user",
    "<%= config.bin %> <%= command.id %> --tool codex --json",
  ];

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
    json: Flags.boolean({
      description: "Output JSON (default)",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsInspect);

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
      this.log(`Path: ${data.path}`);
      this.log(`Exists: ${data.exists ? "Yes" : "No"}`);

      if (data.exists) {
        if (data.size !== undefined) {
          this.log(`Size: ${data.size} bytes`);
        }
        if (data.lastModified) {
          this.log(`Last Modified: ${data.lastModified.toISOString()}`);
        }
        if (data.content) {
          this.log("\nContents:");
          this.log(data.content);
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
