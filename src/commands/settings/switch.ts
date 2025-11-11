/**
 * settings:switch 命令
 * 切换 profile（仅 Codex 支持）
 */

import { Args, Command, Flags } from '@oclif/core';
import { SettingsDispatcher } from '../../services/settings/dispatcher.ts';
import type { ToolId } from '../../domain/types.ts';

export default class SettingsSwitch extends Command {
  static summary = 'Switch profile (Codex only)';

  static description = `
    Switch to a different profile configuration.
    Currently only supported by Codex.
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> oss --tool codex',
    '<%= config.bin %> <%= command.id %> production --tool codex',
  ];

  static args = {
    profile: Args.string({
      description: 'Profile name to switch to',
      required: true,
    }),
  };

  static flags = {
    tool: Flags.string({
      char: 't',
      description: 'AI CLI tool to manage',
      options: ['claude', 'codex', 'gemini'],
      default: 'codex',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsSwitch);

    try {
      const dispatcher = new SettingsDispatcher();
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        scope: 'user', // Profile switching uses user scope
        action: 'switch-profile',
        profile: args.profile,
      });

      if (this.jsonEnabled()) {
        this.logJson(result);
      } else {
        this.log(`✓ Switched to profile: ${args.profile}`);
        if (result.filePath) {
          this.log(`  File: ${result.filePath}`);
        }
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
