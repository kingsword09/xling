/**
 * git:wtp command
 * Prune stale git worktrees
 */

import { Command } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";

export default class Wtp extends Command {
  static summary = "Prune stale git worktrees";

  static description = `
    Remove stale worktree administrative files.
    This cleans up worktrees that have been manually deleted from the filesystem.
  `;

  static examples: Command.Example[] = [
    {
      description: "Prune stale worktrees",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Clean up after manually deleting a worktree folder",
      command: "cd ~/repo && <%= config.bin %> <%= command.id %>",
    },
    {
      description: "Prune then list worktrees to verify",
      command:
        "<%= config.bin %> <%= command.id %> && <%= config.bin %> git:wtl",
    },
  ];

  async run(): Promise<void> {
    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "prune",
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
