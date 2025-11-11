/**
 * settings:unset 命令
 * 删除配置项
 */

import { Args, Command, Flags } from '@oclif/core';
import { SettingsDispatcher } from '../../services/settings/dispatcher.ts';
import type { ToolId, Scope } from '../../domain/types.ts';

export default class SettingsUnset extends Command {
  static summary = 'Remove a setting';

  static description = `
    Remove a specific configuration key.
    Supports nested keys using dot notation (e.g., theme.dark.background).
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> theme --tool claude',
    '<%= config.bin %> <%= command.id %> model --tool codex --scope user',
    '<%= config.bin %> <%= command.id %> theme.dark.background --tool claude --dry-run',
  ];

  static args = {
    key: Args.string({
      description: 'Setting key to remove',
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
    const { args, flags } = await this.parse(SettingsUnset);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: flags.scope as Scope,
        action: 'unset',
        key: args.key,
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
          this.log(`✓ Removed ${args.key}`);
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
