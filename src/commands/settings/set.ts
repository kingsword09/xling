/**
 * settings:set 命令
 * 设置配置项的值
 */

import { Args, Command, Flags } from '@oclif/core';
import { SettingsDispatcher } from '../../services/settings/dispatcher.ts';
import type { ToolId, Scope } from '../../domain/types.ts';

export default class SettingsSet extends Command {
  static summary = 'Set a setting value';

  static description = `
    Set the value of a specific configuration key.
    Supports nested keys using dot notation (e.g., theme.dark.background).
    Values are automatically parsed as JSON if possible, otherwise treated as strings.
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> theme dark --tool claude',
    '<%= config.bin %> <%= command.id %> model gpt-4 --tool codex',
    '<%= config.bin %> <%= command.id %> theme.dark.background "#000000" --tool claude',
    '<%= config.bin %> <%= command.id %> enabled true --tool gemini --dry-run',
  ];

  static args = {
    key: Args.string({
      description: 'Setting key to set',
      required: true,
    }),
    value: Args.string({
      description: 'Setting value',
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
    'dry-run': Flags.boolean({
      description: 'Preview changes without applying',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsSet);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: 'set',
        key: args.key,
        value: args.value,
        dryRun: flags['dry-run'],
      });

      if (this.jsonEnabled()) {
        this.logJson(result);
      } else {
        if (flags['dry-run']) {
          this.warn('DRY RUN - No changes applied');
          if (result.diff) {
            this.log('\nPreview:');
            this.log(result.diff);
          }
        } else {
          this.log(`✓ Set ${args.key} = ${args.value}`);
          if (result.filePath) {
            this.log(`  File: ${result.filePath}`);
          }
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
