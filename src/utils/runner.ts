/**
 * Process launch helpers
 * Stays focused on spawning child processes (SRP)
 */

import { spawn } from "node:child_process";
import type { LaunchCommandSpec } from "@/domain/types.ts";

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  args?: string[];
}

export interface SpawnResult {
  pid: number;
  command: string;
}

/**
 * Launch a child process
 * @param spec Launch command specification
 * @param options Additional spawn options
 * @returns Process ID and the full command string
 */
export async function spawnProcess(
  spec: LaunchCommandSpec,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  // 1. Merge arguments
  const args = [...spec.baseArgs];

  // Include yolo flags when requested
  if (spec.yoloArgs) {
    args.push(...spec.yoloArgs);
  }

  // Add passthrough arguments from the CLI
  if (options?.args) {
    args.push(...options.args);
  }

  // 2. Compose environment variables
  const env = {
    ...process.env,
    ...spec.envVars,
    ...options?.env,
  };

  // 3. Spawn the child process
  const child = spawn(spec.executable, args, {
    cwd: options?.cwd ?? process.cwd(),
    env,
    stdio: "inherit", // reuse parent stdio to keep UX consistent
    detached: false,
  });

  // Build a full command string for logging
  const command = `${spec.executable} ${args.join(" ")}`;

  // Wait for the process to spawn or fail
  return new Promise((resolve, reject) => {
    child.on("error", (error) => {
      reject(new Error(`Failed to spawn process: ${error.message}`));
    });

    // Resolve as soon as the process successfully spawns
    child.on("spawn", () => {
      resolve({
        pid: child.pid!,
        command,
      });
    });

    // Treat immediate non-zero exits (e.g., missing binary) as errors
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

/**
 * Check whether an executable exists on the PATH
 * @param name Executable name to look up
 */
export async function checkExecutable(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "where" : "which";
    const child = spawn(command, [name], {
      stdio: "ignore",
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * Retrieve the version string from an executable
 * @param executable Program name
 * @param versionArgs Arguments passed to print the version (defaults to --version)
 */
export async function getExecutableVersion(
  executable: string,
  versionArgs: string[] = ["--version"],
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";

    const child = spawn(executable, versionArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to get version: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error("Failed to get version"));
      }
    });
  });
}

export interface RunCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  silent?: boolean;
  throwOnError?: boolean;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/**
 * Run a command and capture its output
 * Lightweight wrapper for git commands that don't need full LaunchCommandSpec
 * @param command Executable to run
 * @param args Command arguments
 * @param options Run options
 */
export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const {
    cwd = process.cwd(),
    env = {},
    silent = false,
    throwOnError = true,
  } = options;

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const mergedEnv = {
      ...process.env,
      ...env,
    };

    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: silent ? ["ignore", "pipe", "pipe"] : ["inherit", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (!silent) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      if (!silent) {
        process.stderr.write(data);
      }
    });

    child.on("error", (error) => {
      const result = {
        stdout: stdout.trim(),
        stderr: error.message,
        exitCode: 1,
        success: false,
      };

      if (throwOnError) {
        reject(result);
      } else {
        resolve(result);
      }
    });

    child.on("exit", (code) => {
      const exitCode = code ?? 1;
      const result = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        success: exitCode === 0,
      };

      if (throwOnError && !result.success) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
}
