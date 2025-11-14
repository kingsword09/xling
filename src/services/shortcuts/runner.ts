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
        // Resolve platform-specific shell command for display
        const shellCommand = this.resolveShellCommand(config.shell);
        display =
          shellCommand.length > 50
            ? shellCommand.substring(0, 47) + "..."
            : shellCommand;
      } else if (config.pipeline) {
        type = "pipeline";
        // Resolve platform-specific pipeline for display
        const pipeline = this.resolvePipeline(config.pipeline);
        display = pipeline.map((step) => step.command).join(" | ");
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
   * Supports both string and platform-specific shell commands
   */
  private async runShell(
    shellCommand:
      | string
      | {
          win32?: string;
          darwin?: string;
          linux?: string;
          default: string;
        },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const shellConfig = this.getShellConfig();
      const resolvedCommand = this.resolveShellCommand(shellCommand);

      const child = spawn(resolvedCommand, {
        shell: shellConfig,
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
   * Resolve platform-specific shell command
   * Returns the appropriate command for the current platform
   */
  private resolveShellCommand(
    shellCommand:
      | string
      | {
          win32?: string;
          darwin?: string;
          linux?: string;
          default: string;
        },
  ): string {
    // If it's a simple string, return as-is
    if (typeof shellCommand === "string") {
      return shellCommand;
    }

    // Platform-specific resolution
    const platform = process.platform;
    if (platform === "win32" && shellCommand.win32) {
      return shellCommand.win32;
    }
    if (platform === "darwin" && shellCommand.darwin) {
      return shellCommand.darwin;
    }
    if (platform === "linux" && shellCommand.linux) {
      return shellCommand.linux;
    }

    // Fallback to default
    return shellCommand.default;
  }

  /**
   * Get platform-specific shell configuration
   * Windows: Use PowerShell 7 (pwsh)
   * Unix: Use default shell
   */
  private getShellConfig(): string | boolean {
    if (process.platform === "win32") {
      return "pwsh"; // PowerShell 7
    }
    return true; // Use default shell on Unix
  }

  /**
   * Execute a pipeline shortcut
   * Supports both array and platform-specific pipelines
   */
  private async runPipeline(
    pipeline:
      | Array<{ command: string; args?: string[] }>
      | {
          win32?: Array<{ command: string; args?: string[] }>;
          darwin?: Array<{ command: string; args?: string[] }>;
          linux?: Array<{ command: string; args?: string[] }>;
          default: Array<{ command: string; args?: string[] }>;
        },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const resolvedPipeline = this.resolvePipeline(pipeline);
      const processes: ReturnType<typeof spawn>[] = [];

      // Spawn all processes in the pipeline
      for (let i = 0; i < resolvedPipeline.length; i++) {
        const step = resolvedPipeline[i];
        const isFirst = i === 0;
        const isLast = i === resolvedPipeline.length - 1;

        // On Windows, we need to use shell: true for npm-installed commands
        // to properly resolve .cmd files
        const command = step.command;
        const args = step.args || [];

        // Determine if we need shell on Windows
        const isShellCommand =
          command === "pwsh" ||
          command === "powershell" ||
          command === "cmd" ||
          command.includes("\\") ||
          command.includes("/");

        const needsShell = process.platform === "win32" && !isShellCommand;

        const child = spawn(command, args, {
          stdio: [
            isFirst ? "inherit" : "pipe", // stdin
            isLast ? "inherit" : "pipe", // stdout
            "inherit", // stderr
          ],
          shell: needsShell,
          cwd: process.cwd(), // Preserve current working directory
          env: process.env, // Preserve environment variables
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
   * Resolve platform-specific pipeline
   * Returns the appropriate pipeline for the current platform
   * Also resolves platform-specific command/args within each step
   */
  private resolvePipeline(
    pipeline:
      | Array<{
          command: string | { win32?: string; darwin?: string; linux?: string; default: string };
          args?: string[] | { win32?: string[]; darwin?: string[]; linux?: string[]; default: string[] };
        }>
      | {
          win32?: Array<{ command: string; args?: string[] }>;
          darwin?: Array<{ command: string; args?: string[] }>;
          linux?: Array<{ command: string; args?: string[] }>;
          default: Array<{ command: string; args?: string[] }>;
        },
  ): Array<{ command: string; args?: string[] }> {
    let resolvedPipeline: Array<{
      command: string | { win32?: string; darwin?: string; linux?: string; default: string };
      args?: string[] | { win32?: string[]; darwin?: string[]; linux?: string[]; default: string[] };
    }>;

    // First, resolve pipeline-level platform specificity
    if (Array.isArray(pipeline)) {
      resolvedPipeline = pipeline;
    } else {
      // Platform-specific pipeline resolution
      const platform = process.platform;
      if (platform === "win32" && pipeline.win32) {
        resolvedPipeline = pipeline.win32;
      } else if (platform === "darwin" && pipeline.darwin) {
        resolvedPipeline = pipeline.darwin;
      } else if (platform === "linux" && pipeline.linux) {
        resolvedPipeline = pipeline.linux;
      } else {
        resolvedPipeline = pipeline.default;
      }
    }

    // Then, resolve step-level platform specificity
    return resolvedPipeline.map((step) => ({
      command: this.resolvePlatformValue(step.command),
      args: step.args ? this.resolvePlatformValue(step.args) : undefined,
    }));
  }

  /**
   * Resolve platform-specific value (command or args)
   * Returns the appropriate value for the current platform
   */
  private resolvePlatformValue<T>(
    value: T | { win32?: T; darwin?: T; linux?: T; default: T },
  ): T {
    // If it's a simple value, return as-is
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value as T;
    }

    const platformValue = value as { win32?: T; darwin?: T; linux?: T; default: T };
    const platform = process.platform;

    if (platform === "win32" && platformValue.win32 !== undefined) {
      return platformValue.win32;
    }
    if (platform === "darwin" && platformValue.darwin !== undefined) {
      return platformValue.darwin;
    }
    if (platform === "linux" && platformValue.linux !== undefined) {
      return platformValue.linux;
    }

    return platformValue.default;
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
      const resolvedPipeline = this.resolvePipeline(shortcut.pipeline);
      for (const step of resolvedPipeline) {
        if (step.command === "xling" && step.args?.includes("sx")) {
          throw new CircularShortcutError(name);
        }
      }
    }

    // For shell shortcuts, check if it contains "xling sx"
    if (shortcut.shell) {
      const shellCommand = this.resolveShellCommand(shortcut.shell);
      if (shellCommand.includes("xling sx")) {
        throw new CircularShortcutError(name);
      }
    }
  }
}
