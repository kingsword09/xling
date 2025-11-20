/**
 * git:prr command
 * Checkout a PR branch using gh CLI or git fallback
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitPrRequest } from "@/domain/git.ts";

export default class Prr extends Command {
  static summary = "Checkout a PR branch (PR Read/Retrieve)";

  static description = `
    Checkout a pull request branch using GitHub CLI (gh) or git fallback.
    Automatically detects gh availability and falls back to git fetch if needed.
  `;

  static examples: Command.Example[] = [
    {
      description: "Checkout PR using gh or git fallback",
      command: "<%= config.bin %> <%= command.id %> 123",
    },
    {
      description: "Checkout PR to specific branch",
      command: "<%= config.bin %> <%= command.id %> 456 --branch my-pr-branch",
    },
    {
      description: "Force git fallback with custom remote",
      command:
        "<%= config.bin %> <%= command.id %> 789 --no-gh --remote upstream",
    },
    {
      description: "Checkout a PR from another repo (owner:repo#id)",
      command:
        "<%= config.bin %> <%= command.id %> octo/demo-repo#321 --branch demo-pr",
    },
  ];

  static args: Interfaces.ArgInput = {
    id: Args.string({
      description: "PR number or owner:repo#123 format",
      required: true,
    }),
  };

  static flags: Interfaces.FlagInput = {
    branch: Flags.string({
      char: "b",
      description: "Branch name (default: pr/<id>)",
    }),
    remote: Flags.string({
      char: "r",
      description: "Remote name",
      default: "origin",
    }),
    "no-gh": Flags.boolean({
      description: "Skip GitHub CLI, use git directly",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Prr);

    const dispatcher = new GitDispatcher();
    const request: GitPrRequest = {
      id: args.id,
      branch: flags.branch,
      strategy: flags["no-gh"] ? "git" : "gh",
      remote: flags.remote,
    };

    try {
      const result = await dispatcher.execute({
        command: "prr",
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);
      if (result.details) {
        this.log(`  Strategy: ${result.details.strategy}`);
        this.log(`  Branch: ${result.details.branch}`);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
