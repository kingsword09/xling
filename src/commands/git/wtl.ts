/**
 * git:wtl command
 * List git worktrees
 */

import { Command } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";

export default class Wtl extends Command {
  static summary = "List git worktrees";

  static description = `
    List all git worktrees in a friendly format.
    Shows the path and branch for each worktree.
  `;

  static examples: Command.Example[] = [
    {
      description: "List all worktrees",
      command: "<%= config.bin %> <%= command.id %>",
    },
  ];

  async run(): Promise<void> {
    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "list",
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
