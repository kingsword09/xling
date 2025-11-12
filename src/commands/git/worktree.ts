/**
 * git:worktree command
 * Manage git worktrees (list, add, remove, prune)
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest, GitWorktreeAction } from "@/domain/git.ts";

export default class Worktree extends Command {
  static summary = "Manage git worktrees";

  static description = `
    Manage git worktrees: list existing worktrees, add new ones, remove, or prune stale entries.
    Git worktrees allow multiple working directories from a single repository.
  `;

  static examples: Command.Example[] = [
    {
      description: "List all worktrees",
      command: '<%= config.bin %> <%= command.id %> --list',
    },
    {
      description: "Add new worktree",
      command: '<%= config.bin %> <%= command.id %> --add --path ../repo-feature --branch feature/login',
    },
    {
      description: "Remove worktree",
      command: '<%= config.bin %> <%= command.id %> --remove --path ../repo-feature',
    },
    {
      description: "Prune stale worktrees",
      command: '<%= config.bin %> <%= command.id %> --prune',
    },
  ];

  static flags: Interfaces.FlagInput = {
    list: Flags.boolean({
      char: 'l',
      description: 'List worktrees (default)',
      default: false,
    }),
    add: Flags.boolean({
      char: 'a',
      description: 'Add new worktree',
      default: false,
    }),
    remove: Flags.boolean({
      char: 'r',
      description: 'Remove worktree',
      default: false,
    }),
    prune: Flags.boolean({
      char: 'p',
      description: 'Prune stale worktrees',
      default: false,
    }),
    path: Flags.string({
      description: 'Worktree path',
    }),
    branch: Flags.boolean({
      char: 'b',
      description: 'Branch name for new worktree',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force operation',
      default: false,
    }),
    detach: Flags.boolean({
      description: 'Detach HEAD in new worktree',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Worktree);

    // Determine action based on flags
    let action: GitWorktreeAction = 'list';
    if (flags.add) action = 'add';
    else if (flags.remove) action = 'remove';
    else if (flags.prune) action = 'prune';

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action,
      path: flags.path,
      branch: flags.branch as any,
      force: flags.force,
      detach: flags.detach,
    };

    try {
      const result = await dispatcher.execute({
        command: 'worktree',
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);

      // Display worktree list if available
      if (result.details?.output) {
        this.log('\n' + result.details.output);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
