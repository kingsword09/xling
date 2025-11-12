/**
 * git:view command
 * Open PR in web browser with configurable browser
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitViewRequest } from "@/domain/git.ts";

export default class View extends Command {
  static summary = "Open PR in web browser";

  static description = `
    Open a pull request in your web browser using GitHub CLI.
    Supports custom browser selection (Safari, Chrome, Firefox, etc.).
  `;

  static examples: Command.Example[] = [
    {
      description: "Open PR in default browser",
      command: '<%= config.bin %> <%= command.id %> 123',
    },
    {
      description: "Open PR in Chrome",
      command: '<%= config.bin %> <%= command.id %> 456 --browser Chrome',
    },
    {
      description: "Open PR in Firefox",
      command: '<%= config.bin %> <%= command.id %> 789 --browser Firefox',
    },
  ];

  static args: Interfaces.ArgInput = {
    id: Args.string({
      description: 'PR number',
      required: true,
    }),
  };

  static flags: Interfaces.FlagInput = {
    browser: Flags.string({
      char: 'b',
      description: 'Browser to use (Safari, Chrome, Firefox, etc.)',
      default: 'Safari',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(View);

    const dispatcher = new GitDispatcher();
    const request: GitViewRequest = {
      id: args.id,
      browser: flags.browser,
    };

    try {
      const result = await dispatcher.execute({
        command: 'view',
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
