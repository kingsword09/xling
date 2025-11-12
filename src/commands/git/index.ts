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

  static examples = [
    '<%= config.bin %> <%= command.id %>:pr 123',
    '<%= config.bin %> <%= command.id %>:worktree --list',
    '<%= config.bin %> <%= command.id %>:view 456 --browser Safari',
  ] as const;

  async run(): Promise<void> {
    this.log('Git workflow utilities for xling\n');
    this.log('Available subcommands:');
    this.log('  pr       - Checkout PR branch (gh CLI preferred, git fallback)');
    this.log('  worktree - Manage git worktrees (list, add, remove, prune)');
    this.log('  view     - Open PR in web browser\n');
    this.log('Use --help with any subcommand for details');
    this.log('\nExamples:');
    this.log('  xling git:pr 123');
    this.log('  xling git:worktree --list');
    this.log('  xling git:view 456 --browser Chrome');
  }
}
