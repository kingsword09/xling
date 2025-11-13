/**
 * Shortcut runner service
 * Handles loading, listing, and executing command shortcuts
 */

import { spawn } from "child_process";
import type { Config } from "@oclif/core";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";
import type { ShortcutConfig } from "@/domain/xling/config.ts";
import {
  ShortcutNotFoundError,
  CircularShortcutError,
  type ShortcutListEntry,
} from "./types.ts";

/**
 * Service for managing and executing command shortcuts
 */
export class ShortcutRunner {
  private adapter: XlingAdapter;

  constructor(private config: Config) {
    this.adapter = new XlingAdapter();
  }

  /**
   * Load all shortcuts from configuration
   */
  async load(): Promise<Record<string, ShortcutConfig>> {
    return this.adapter.getShortcuts("user");
  }

  /**
   * Get formatted list of shortcuts for display
   */
  async list(): Promise<ShortcutListEntry[]> {
    const shortcuts = await this.load();
    return Object.entries(shortcuts).map(([name, config]) => {
      let type: "command" | "shell" | "pipeline";
      let display: string;

      if (config.command) {
        type = "command";
        display = config.command;
      } else if (config.shell) {
        type = "shell";
        display =
          config.shell.length > 50
            ? config.shell.substring(0, 47) + "..."
            : config.shell;
      } else if (config.pipeline) {
        type = "pipeline";
        display = config.pipeline.map((step) => step.command).join(" | ");
      } else {
        type = "command";
        display = "unknown";
      }

      return {
        name,
        type,
        command: display,
        args: config.args || [],
        description: config.description,
      };
    });
  }

  /**
   * Execute a shortcut by name
   * @param name - Shortcut name
   * @param passthroughArgs - Additional arguments to append
   */
  async run(name: string, passthroughArgs: string[]): Promise<void> {
    const shortcuts = await this.load();
    const shortcut = shortcuts[name];

    if (!shortcut) {
      throw new ShortcutNotFoundError(name, Object.keys(shortcuts));
    }

    // Validate shortcut before execution
    this.validateShortcut(name, shortcut);

    // Execute based on shortcut type
    if (shortcut.command) {
      await this.runCommand(shortcut, passthroughArgs);
    } else if (shortcut.shell) {
      await this.runShell(shortcut.shell);
    } else if (shortcut.pipeline) {
      await this.runPipeline(shortcut.pipeline);
    }
  }

  /**
   * Execute a command shortcut
   */
  private async runCommand(
    shortcut: ShortcutConfig,
    passthroughArgs: string[],
  ): Promise<void> {
    const finalArgs = [...(shortcut.args || []), ...passthroughArgs];
    await this.config.runCommand(shortcut.command!, finalArgs);
  }

  /**
   * Execute a shell shortcut
   */
  private async runShell(shellCommand: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(shellCommand, {
        shell: true,
        stdio: "inherit",
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to execute shell command: ${error.message}`));
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Shell command exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Execute a pipeline shortcut
   */
  private async runPipeline(
    pipeline: Array<{ command: string; args?: string[] }>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const processes: ReturnType<typeof spawn>[] = [];

      // Spawn all processes in the pipeline
      for (let i = 0; i < pipeline.length; i++) {
        const step = pipeline[i];
        const isFirst = i === 0;
        const isLast = i === pipeline.length - 1;

        const child = spawn(step.command, step.args || [], {
          stdio: [
            isFirst ? "inherit" : "pipe", // stdin
            isLast ? "inherit" : "pipe", // stdout
            "inherit", // stderr
          ],
        });

        // Pipe output from previous process to this one
        if (!isFirst && processes[i - 1]) {
          processes[i - 1].stdout?.pipe(child.stdin!);
        }

        processes.push(child);

        child.on("error", (error) => {
          reject(
            new Error(
              `Failed to execute pipeline step "${step.command}": ${error.message}`,
            ),
          );
        });
      }

      // Wait for the last process to complete
      const lastProcess = processes[processes.length - 1];
      lastProcess.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Pipeline exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Validate shortcut configuration
   * @throws {CircularShortcutError} if shortcut creates circular reference
   */
  private validateShortcut(name: string, shortcut: ShortcutConfig): void {
    // Prevent circular reference (shortcut calling "sx" command)
    if (shortcut.command === "sx") {
      throw new CircularShortcutError(name);
    }

    // For pipeline shortcuts, check if any step calls "sx"
    if (shortcut.pipeline) {
      for (const step of shortcut.pipeline) {
        if (step.command === "xling" && step.args?.includes("sx")) {
          throw new CircularShortcutError(name);
        }
      }
    }

    // For shell shortcuts, check if it contains "xling sx"
    if (shortcut.shell && shortcut.shell.includes("xling sx")) {
      throw new CircularShortcutError(name);
    }
  }
}
