/**
 * git:view command
 * Open PR in web browser with configurable browser
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitViewRequest } from "@/domain/git.ts";
import { SUPPORTED_BROWSERS } from "@/domain/git.ts";

export default class View extends Command {
  static summary = "Open PR in web browser";

  static description = `
    Open a pull request in your web browser using GitHub CLI.
    Supports multiple browsers: Chrome (default), Safari, Firefox, Arc, Edge, Dia.
  `;

  static examples: Command.Example[] = [
    {
      description: "Open PR in Chrome (default)",
      command: '<%= config.bin %> <%= command.id %> 123',
    },
    {
      description: "Open PR in Safari",
      command: '<%= config.bin %> <%= command.id %> 456 --browser safari',
    },
    {
      description: "Open PR in Firefox",
      command: '<%= config.bin %> <%= command.id %> 789 --browser firefox',
    },
    {
      description: "Open PR in Arc",
      command: '<%= config.bin %> <%= command.id %> 999 --browser arc',
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
      description: 'Browser to use',
      options: [...SUPPORTED_BROWSERS],
      default: 'chrome',
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
