/**
 * settings:list 命令
 * 列出指定工具的所有配置
 */

import { Command, Flags } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatFilesTable, formatJson, formatTable } from "@/utils/format.ts";
import type {
  ToolId,
  Scope,
  SettingsListData,
  SettingsFileEntry,
} from "@/domain/types.ts";

export default class SettingsList extends Command {
  static summary = "List all settings for a tool";

  static description = `
    Display all configuration settings for the specified AI CLI tool.
    Supports multiple scopes (user, project, local, system).
  `;

  static examples = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user",
    "<%= config.bin %> <%= command.id %> --tool codex --scope user --table",
    "<%= config.bin %> -t gemini -s project --no-json",
  ];

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
      description: "Output JSON instead of text summary",
      default: false,
    }),
    table: Flags.boolean({
      description: "Render table output instead of JSON",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsList);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: "list",
      });

      if (flags.table) {
        this.renderDetailed(result.data as SettingsListData | undefined);
        return;
      }

      if (flags.json) {
        this.log(formatJson(result));
        return;
      }

      this.renderSummary(result.data as SettingsListData | undefined);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  private renderSummary(data?: SettingsListData): void {
    if (!data) {
      this.log("No settings found.");
      return;
    }

    if (data.type === "files") {
      if (data.files.length === 0) {
        this.log("No settings files found.");
        return;
      }
      this.log(this.formatFilesSummary(data.files));
      return;
    }

    if (Object.keys(data.entries).length === 0) {
      this.log("No settings found.");
      return;
    }

    this.log(this.formatEntriesSummary(data.entries, data.filePath));
  }

  private renderDetailed(data?: SettingsListData): void {
    if (!data) {
      this.log("No settings found.");
      return;
    }

    if (data.type === "files") {
      if (data.files.length === 0) {
        this.log("No settings files found.");
        return;
      }
      this.log(formatFilesTable(data.files));
      return;
    }

    if (Object.keys(data.entries).length === 0) {
      this.log("No settings found.");
      return;
    }

    this.log(formatTable(data.entries));
    this.log(`File: ${data.filePath}`);
  }

  private formatFilesSummary(files: SettingsFileEntry[]): string {
    const lines = files.map((file) => {
      const prefix = file.active ? "* " : "- ";
      return (
        `${prefix}${file.variant} -> ${file.path}` +
        (file.exists ? "" : " (missing)")
      );
    });
    return ["files:"].concat(lines).join("\n");
  }

  private formatEntriesSummary(
    entries: Record<string, unknown>,
    filePath: string,
  ): string {
    const lines = ["entries:"];
    for (const [key, value] of Object.entries(entries)) {
      const formatted = this.stringify(value);
      if (formatted.includes("\n")) {
        lines.push(`- ${key}:`);
        for (const line of formatted.split("\n")) {
          lines.push(`  ${line}`);
        }
      } else {
        lines.push(`- ${key}: ${formatted}`);
      }
    }
    lines.push(`file: ${filePath}`);
    return lines.join("\n");
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }
}
