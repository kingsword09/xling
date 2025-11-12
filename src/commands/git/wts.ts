/**
 * git:wts command
 * Switch to a git worktree (outputs path for cd)
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { GitDispatcher } from "@/services/git/dispatcher.ts";
import type { GitWorktreeRequest } from "@/domain/git.ts";
import { spawn } from "node:child_process";

export default class Wts extends Command {
  static summary = "Switch to a git worktree (opens subshell by default)";

  static description = `
    Find a matching worktree, then start a subshell rooted there.
    Defaults to the main branch if no branch/directory is provided.
    Use --path-only for scripting (outputs the path for cd $(...)).
  `;

  static examples: Command.Example[] = [
    {
      description: "Switch to main worktree",
      command: "cd $(<%= config.bin %> <%= command.id %>)",
    },
    {
      description: "Switch to specific worktree by branch name",
      command: "cd $(<%= config.bin %> <%= command.id %> -b feature/login)",
    },
    {
      description: "Switch by directory name",
      command: "cd $(<%= config.bin %> <%= command.id %> -b xling-feature)",
    },
  ];

  static flags: Interfaces.FlagInput = {
    branch: Flags.string({
      char: "b",
      description: "Branch or worktree directory name (defaults to main)",
    }),
    "path-only": Flags.boolean({
      description: "Only print the worktree path (useful for cd $(...))",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Wts);

    const dispatcher = new GitDispatcher();
    const request: GitWorktreeRequest = {
      action: "switch",
      branch: flags.branch,
    };

    try {
      const result = await dispatcher.execute({
        command: "worktree",
        cwd: process.cwd(),
        data: request,
      });

      // Only output the path for cd $()
      const detailsPath = result.details?.path;
      const targetPath =
        typeof detailsPath === "string" ? detailsPath : result.message;

      if (flags["path-only"]) {
        this.log(targetPath);
        return;
      }

      this.log(
        `Switching to worktree at ${targetPath}. Exit the shell to return.`,
      );
      await this.openShell(targetPath);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  private resolveShell(): { command: string; args: string[] } {
    if (process.platform === "win32") {
      const command = process.env.COMSPEC || "cmd.exe";
      return { command, args: [] };
    }
    const command = process.env.SHELL || "bash";
    return { command, args: [] };
  }

  private async openShell(cwd: string): Promise<void> {
    const { command, args } = this.resolveShell();

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        stdio: "inherit",
      });

      child.on("error", (error) => {
        reject(
          new Error(`Failed to launch shell "${command}": ${error.message}`),
        );
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Shell exited with code ${code}`));
        }
      });
    });
  }
}
