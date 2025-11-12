/**
 * git:wtr command
 * Remove a git worktree
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";

export default class Wtr extends Command {
  static summary = "Remove a git worktree";

  static description = `
    Remove a git worktree by branch name, directory name, or path.
    Intelligently matches branch or directory names.
  `;

  static examples: Command.Example[] = [
    {
      description: "Remove worktree by branch name",
      command: "<%= config.bin %> <%= command.id %> -b main",
    },
    {
      description: "Remove worktree by directory name",
      command: "<%= config.bin %> <%= command.id %> -b xling-feature",
    },
    {
      description: "Remove worktree by path",
      command: "<%= config.bin %> <%= command.id %> -p ../repo-feature",
    },
    {
      description: "Force remove worktree",
      command: "<%= config.bin %> <%= command.id %> -b main -f",
    },
  ];

  static flags: Interfaces.FlagInput = {
    branch: Flags.string({
      char: "b",
      description: "Branch or worktree directory name",
    }),
    path: Flags.string({
      char: "p",
      description: "Worktree path",
    }),
    force: Flags.boolean({
      char: "f",
      description: "Force removal",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Wtr);

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "remove",
      branch: flags.branch,
      path: flags.path,
      force: flags.force,
    };

    try {
      const result = await dispatcher.execute({
        command: "worktree",
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);

      if (result.details?.output) {
        this.log("\n" + result.details.output);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
