/**
 * settings:get 命令
 * 获取指定配置项的值
 */

import { Args, Command, Flags } from '@oclif/core';
import { SettingsDispatcher } from '../../services/settings/dispatcher.ts';
import type { ToolId, Scope } from '../../domain/types.ts';

export default class SettingsGet extends Command {
  static summary = 'Get a specific setting value';

  static description = `
    Retrieve the value of a specific configuration key.
    Supports nested keys using dot notation (e.g., theme.dark.background).
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> theme --tool claude',
    '<%= config.bin %> <%= command.id %> model --tool codex --scope user',
    '<%= config.bin %> <%= command.id %> theme.dark.background --tool claude --json',
  ];

  static args = {
    key: Args.string({
      description: 'Setting key to retrieve',
      required: true,
    }),
  };

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
    const { args, flags } = await this.parse(SettingsGet);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: 'get',
        key: args.key,
      });

      if (this.jsonEnabled()) {
        this.logJson(result);
      } else {
        const value = result.data;
        if (typeof value === 'object' && value !== null) {
          this.log(JSON.stringify(value, null, 2));
        } else {
          this.log(String(value));
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
