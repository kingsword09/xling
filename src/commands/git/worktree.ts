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
      command: "<%= config.bin %> <%= command.id %> --list",
    },
    {
      description: "Add new worktree with auto-generated path",
      command:
        "<%= config.bin %> <%= command.id %> --add --branch feature/login",
    },
    {
      description: "Add worktree with custom path",
      command:
        "<%= config.bin %> <%= command.id %> -a -p ../repo-feature -b feature/login",
    },
    {
      description: "Switch to another worktree",
      command: "<%= config.bin %> <%= command.id %> --switch",
    },
    {
      description: "Remove worktree by branch name",
      command: "<%= config.bin %> <%= command.id %> -r -b main",
    },
    {
      description: "Remove worktree by directory name",
      command: "<%= config.bin %> <%= command.id %> -r -b xling-feature",
    },
    {
      description: "Remove worktree by path",
      command: "<%= config.bin %> <%= command.id %> -r -p ../repo-feature",
    },
    {
      description: "Prune stale worktrees",
      command: "<%= config.bin %> <%= command.id %> --prune",
    },
  ];

  static flags: Interfaces.FlagInput = {
    list: Flags.boolean({
      char: "l",
      description: "List worktrees (default)",
      default: false,
    }),
    add: Flags.boolean({
      char: "a",
      description: "Add new worktree (auto-generates path if not specified)",
      default: false,
    }),
    switch: Flags.boolean({
      char: "s",
      description: "Switch to another worktree interactively",
      default: false,
    }),
    remove: Flags.boolean({
      char: "r",
      description: "Remove worktree",
      default: false,
    }),
    prune: Flags.boolean({
      description: "Prune stale worktrees",
      default: false,
    }),
    path: Flags.string({
      char: "p",
      description:
        "Worktree path (e.g., '../repo-feature' or absolute path). Auto-generated if not specified with --add.",
    }),
    branch: Flags.string({
      char: "b",
      description:
        "Branch or worktree name (e.g., 'main' or 'xling-main'). Defaults to main for --add. For --remove, intelligently matches branch name or directory name.",
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
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Worktree);

    // Determine action based on flags
    let action: GitWorktreeAction = "list";
    if (flags.add) action = "add";
    else if (flags.switch) action = "switch";
    else if (flags.remove) action = "remove";
    else if (flags.prune) action = "prune";

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action,
      path: flags.path,
      branch: flags.branch,
      force: flags.force,
      detach: flags.detach,
    };

    try {
      const result = await dispatcher.execute({
        command: "worktree",
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);

      // Display worktree list if available
      if (result.details?.output) {
        this.log("\n" + result.details.output);
      }

      // Display path for switch action
      if (action === "switch" && result.details?.path) {
        this.log(`\nTo switch to this worktree, run:`);
        this.log(`  cd ${result.details.path}`);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
