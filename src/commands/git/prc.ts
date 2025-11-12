/**
 * git:prc command
 * Create a pull request with optional browser preview
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitCreatePrRequest } from "@/domain/git.ts";
import { SUPPORTED_BROWSERS } from "@/domain/git.ts";

export default class Prc extends Command {
  static summary = "Create a pull request (PR Create)";

  static description = `
    Create a pull request using GitHub CLI.
    Supports automatic browser preview with customizable browser selection.
  `;

  static examples: Command.Example[] = [
    {
      description: "Create PR interactively",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Create PR with title and body",
      command:
        '<%= config.bin %> <%= command.id %> --title "Feature X" --body "Implements feature X"',
    },
    {
      description: "Create PR and open in browser",
      command: "<%= config.bin %> <%= command.id %> --web",
    },
    {
      description: "Create PR and preview in Safari",
      command: "<%= config.bin %> <%= command.id %> --web --browser safari",
    },
    {
      description: "Create draft PR",
      command:
        '<%= config.bin %> <%= command.id %> --draft --title "WIP: Feature X"',
    },
    {
      description: "Create PR with reviewers and labels",
      command:
        "<%= config.bin %> <%= command.id %> --reviewer user1 --reviewer user2 --label bug --label urgent",
    },
  ];

  static flags: Interfaces.FlagInput = {
    title: Flags.string({
      char: "t",
      description: "PR title",
    }),
    body: Flags.string({
      char: "b",
      description: "PR body/description",
    }),
    base: Flags.string({
      description: "Base branch (default: repository default branch)",
    }),
    head: Flags.string({
      description: "Head branch (default: current branch)",
    }),
    draft: Flags.boolean({
      char: "d",
      description: "Create as draft PR",
      default: false,
    }),
    web: Flags.boolean({
      char: "w",
      description: "Open PR in browser after creation",
      default: false,
    }),
    browser: Flags.string({
      description: "Browser to use when --web is enabled",
      options: [...SUPPORTED_BROWSERS],
      default: "chrome",
    }),
    assignee: Flags.string({
      char: "a",
      description: "Assign user(s) (can be used multiple times)",
      multiple: true,
    }),
    reviewer: Flags.string({
      char: "r",
      description: "Request reviewer(s) (can be used multiple times)",
      multiple: true,
    }),
    label: Flags.string({
      char: "l",
      description: "Add label(s) (can be used multiple times)",
      multiple: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Prc);

    const dispatcher = new GitDispatcher();
    const request: GitCreatePrRequest = {
      title: flags.title,
      body: flags.body,
      base: flags.base,
      head: flags.head,
      draft: flags.draft,
      web: flags.web,
      browser: flags.browser,
      assignee: flags.assignee,
      reviewer: flags.reviewer,
      label: flags.label,
    };

    try {
      const result = await dispatcher.execute({
        command: "prc",
        cwd: process.cwd(),
        data: request,
      });

      this.log(`✓ ${result.message}`);

      if (result.details?.draft) {
        this.log("  Type: Draft PR");
      }
      if (result.details?.base) {
        this.log(`  Base: ${result.details.base}`);
      }
      if (result.details?.head) {
        this.log(`  Head: ${result.details.head}`);
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
