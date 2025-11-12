/**
 * git command (main entry point)
 * Provides utilities for git workflow (PR management, worktrees)
 */

import { Command } from "@oclif/core";

export default class Git extends Command {
  static summary = "Git workflow utilities";

  static description = `
    Git workflow tools for PR management and worktrees.
    Supports PR checkout with gh/git fallback, browser PR viewing, and worktree operations.
  `;

  static examples: string[] = [
    "<%= config.bin %> <%= command.id %>:prc --web",
    "<%= config.bin %> <%= command.id %>:prr 123",
    "<%= config.bin %> <%= command.id %>:worktree --list",
    "<%= config.bin %> <%= command.id %>:prv 456 --browser safari",
  ];

  async run(): Promise<void> {
    this.log("Git workflow utilities for xling\n");
    this.log("Available subcommands:");
    this.log("  prc      - Create PR with optional browser preview");
    this.log("  prr      - Checkout PR branch (PR Read/Retrieve)");
    this.log("  prv      - Open PR in web browser (PR View)");
    this.log("  worktree - Manage git worktrees (list, add, remove, prune)\n");
    this.log("Use --help with any subcommand for details");
    this.log("\nExamples:");
    this.log("  xling git:prc --web --browser chrome");
    this.log("  xling git:prr 123");
    this.log("  xling git:prv 456 --browser safari");
    this.log("  xling git:worktree --list");
  }
}
