/**
 * settings:list 命令
 * 列出指定工具的所有配置
 */

import { Command, Flags } from '@oclif/core';
import { SettingsDispatcher } from '../../services/settings/dispatcher.ts';
import { formatTable } from '../../utils/format.ts';
import type { ToolId, Scope } from '../../domain/types.ts';

export default class SettingsList extends Command {
  static summary = 'List all settings for a tool';

  static description = `
    Display all configuration settings for the specified AI CLI tool.
    Supports multiple scopes (user, project, local, system).
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> --tool claude --scope user',
    '<%= config.bin %> <%= command.id %> --tool codex --scope user --json',
    '<%= config.bin %> <%= command.id %> -t gemini -s project',
  ];

  static flags = {
    tool: Flags.string({
      char: 't',
      description: 'AI CLI tool to manage',
      options: ['claude', 'codex', 'gemini'],
      default: 'claude',
    }),
    scope: Flags.string({
      char: 's',
      description: 'Configuration scope',
      options: ['user', 'project', 'local', 'system'],
      default: 'user',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SettingsList);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: 'list',
      });

      if (this.jsonEnabled()) {
        this.logJson(result);
      } else {
        const data = result.data as Record<string, unknown>;
        if (Object.keys(data).length === 0) {
          this.log('No settings found.');
        } else {
          this.log(formatTable(data));
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
