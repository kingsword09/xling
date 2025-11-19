/**
 * git:wta command
 * Add a new git worktree
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";

export default class Wta extends Command {
  static summary = "Add a new git worktree";

  static description = `
    Create a new git worktree with automatic path generation.
    Defaults to main branch if not specified.
    Use --select to choose a branch from an interactive list.
  `;

  static examples: Command.Example[] = [
    {
      description: "Add worktree for main branch (default)",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Add worktree for specific branch",
      command: "<%= config.bin %> <%= command.id %> -b feature/login",
    },
    {
      description: "Add worktree with custom path",
      command:
        "<%= config.bin %> <%= command.id %> -b feature/login -p ../my-worktree",
    },
    {
      description: "Pick a branch interactively",
      command: "<%= config.bin %> <%= command.id %> --select",
    },
  ];

  static flags: Interfaces.FlagInput = {
    branch: Flags.string({
      char: "b",
      description: "Branch name (defaults to main)",
    }),
    path: Flags.string({
      char: "p",
      description: "Custom worktree path (auto-generated if not specified)",
    }),
    force: Flags.boolean({
      char: "f",
      description: "Force operation",
      default: false,
    }),
    detach: Flags.boolean({
      description: "Detach HEAD in new worktree",
      default: false,
    }),
    select: Flags.boolean({
      description: "Use an interactive selector to choose the branch",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Wta);

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "add",
      branch: flags.branch,
      path: flags.path,
      force: flags.force,
      detach: flags.detach,
      interactive: flags.select,
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
