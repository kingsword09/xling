/**
 * Backend router for CLI tool execution
 * Handles direct execution via codex/claude/gemini CLIs
 */

import { spawnProcess, checkExecutable } from "@/utils/runner.ts";
import type { LaunchCommandSpec } from "@/domain/types.ts";

export type CliBackend = "codex" | "claude" | "gemini";

export interface BackendOptions {
  yolo: boolean;
  model?: string;
}

/**
 * Check if a CLI backend is available
 */
export async function checkBackendAvailable(
  backend: CliBackend,
): Promise<boolean> {
  const executable = getExecutable(backend);
  return checkExecutable(executable);
}

/**
 * Get executable name for backend
 */
export function getExecutable(backend: CliBackend): string {
  return backend === "codex"
    ? "codex"
    : backend === "gemini"
      ? "gemini"
      : "claude";
}

/**
 * Build command spec for backend
 */
export function buildCommandSpec(
  backend: CliBackend,
  prompt: string,
  options: BackendOptions,
): LaunchCommandSpec {
  const executable = getExecutable(backend);
  const baseArgs: string[] =
    backend === "codex" ? ["exec", prompt] : ["-p", prompt];

  if (backend === "gemini" && options.model) {
    baseArgs.unshift("-m", options.model);
  }

  return {
    executable,
    baseArgs,
    yoloArgs: getYoloArgs(backend, options.yolo),
  };
}

/**
 * Get yolo args for backend
 */
function getYoloArgs(backend: CliBackend, yolo: boolean): string[] | undefined {
  if (!yolo) return undefined;

  switch (backend) {
    case "codex":
      return ["--dangerously-bypass-approvals-and-sandbox"];
    case "gemini":
      return ["-y"];
    case "claude":
      return ["--dangerously-skip-permissions"];
  }
}

/**
 * Execute prompt via CLI backend
 */
export async function executeViaCli(
  backend: CliBackend,
  prompt: string,
  options: BackendOptions,
): Promise<void> {
  const spec = buildCommandSpec(backend, prompt, options);
  await spawnProcess(spec);
}
