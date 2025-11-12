/**
 * git:wts command
 * Switch to a git worktree (outputs path for cd)
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";

export default class Wts extends Command {
  static summary = "Get worktree path for switching";

  static description = `
    Output the path of a worktree for easy switching.
    Defaults to main branch if not specified.
    Use with: cd $(xling git:wts -b <branch>)
  `;

  static examples: Command.Example[] = [
    {
      description: "Switch to main worktree",
      command: "cd $(<%= config.bin %> <%= command.id %>)",
    },
    {
      description: "Switch to specific worktree by branch name",
      command: "cd $(<%= config.bin %> <%= command.id %> -b feature/login)",
    },
    {
      description: "Switch by directory name",
      command: "cd $(<%= config.bin %> <%= command.id %> -b xling-feature)",
    },
  ];

  static flags: Interfaces.FlagInput = {
    branch: Flags.string({
      char: "b",
      description: "Branch or worktree directory name (defaults to main)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Wts);

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "switch",
      branch: flags.branch,
    };

    try {
      const result = await dispatcher.execute({
        command: "worktree",
        cwd: process.cwd(),
        data: request,
      });

      // Only output the path for cd $()
      this.log(result.message);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
