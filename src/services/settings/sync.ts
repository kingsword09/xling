/**
 * Settings sync helpers
 * Copies Claude Code TOML config into Codex config.toml
 */

import type { ConfigObject, SettingsResult } from "@/domain/types.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import { ConfigFileNotFoundError } from "@/utils/errors.ts";
import { formatTextDiff } from "@/utils/format.ts";

export const DEFAULT_CLAUDE_CODE_TOML_PATH = "~/.claude/config.toml";
export const DEFAULT_CODEX_CONFIG_PATH = "~/.codex/config.toml";

export interface SyncOptions {
  sourcePath?: string;
  targetPath?: string;
  backup?: boolean;
  dryRun?: boolean;
  currentLabel?: string;
  nextLabel?: string;
}

export interface SyncResultData {
  source: string;
  target: string;
  backupPath?: string;
  changed: boolean;
  dryRun: boolean;
  diff?: string | null;
}

/**
 * Copy Claude Code's config.toml into Codex's config.toml (user scope)
 * - Creates parent directories when missing
 * - Keeps an optional .bak before overwriting
 * - Skips work when files are already identical
 */
export function syncClaudeTomlToCodex(
  options: SyncOptions = {},
): SettingsResult<SyncResultData> {
  return syncToml({
    ...options,
    defaultSource: DEFAULT_CLAUDE_CODE_TOML_PATH,
    defaultTarget: DEFAULT_CODEX_CONFIG_PATH,
    currentLabel: options.currentLabel ?? "codex",
    nextLabel: options.nextLabel ?? "claude",
  });
}

export function syncCodexTomlToClaude(
  options: SyncOptions = {},
): SettingsResult<SyncResultData> {
  return syncToml({
    ...options,
    defaultSource: DEFAULT_CODEX_CONFIG_PATH,
    defaultTarget: DEFAULT_CLAUDE_CODE_TOML_PATH,
    currentLabel: options.currentLabel ?? "claude",
    nextLabel: options.nextLabel ?? "codex",
  });
}

type SyncTomlOptions = SyncOptions & {
  defaultSource: string;
  defaultTarget: string;
  currentLabel: string;
  nextLabel: string;
};

function syncToml(options: SyncTomlOptions): SettingsResult<SyncResultData> {
  const sourcePath = options.sourcePath ?? options.defaultSource;
  const targetPath = options.targetPath ?? options.defaultTarget;
  const backup = options.backup ?? true;
  const dryRun = options.dryRun ?? false;

  const resolvedSource = fsStore.resolveHome(sourcePath);
  const resolvedTarget = fsStore.resolveHome(targetPath);

  if (resolvedSource === resolvedTarget) {
    throw new Error("Source and target config paths are identical.");
  }

  if (!fsStore.fileExists(resolvedSource)) {
    throw new ConfigFileNotFoundError(resolvedSource);
  }

  const targetExists = fsStore.fileExists(resolvedTarget);
  const sourceContent = fsStore.readFile(resolvedSource);
  const targetContent = targetExists ? fsStore.readFile(resolvedTarget) : "";

  // Validate TOML before proceeding (throws on parse error)
  readTomlSafe(resolvedSource);
  if (targetExists) {
    readTomlSafe(resolvedTarget);
  }

  const diff = formatTextDiff(targetContent, sourceContent, {
    current: options.currentLabel,
    next: options.nextLabel,
  });
  const changed = Boolean(diff);
  const backupPath =
    backup && targetExists ? `${resolvedTarget}.bak` : undefined;

  const data: SyncResultData = {
    source: resolvedSource,
    target: resolvedTarget,
    backupPath: changed ? backupPath : undefined,
    changed,
    dryRun,
    diff,
  };

  if (dryRun) {
    return {
      success: true,
      message: changed
        ? "Changes detected. Run without --dry-run to apply."
        : "Already in sync. No changes needed.",
      filePath: resolvedTarget,
      data,
      diff: diff ?? undefined,
    };
  }

  if (!changed) {
    return {
      success: true,
      message: "Already in sync. No changes applied.",
      filePath: resolvedTarget,
      data,
    };
  }

  if (backup && targetExists) {
    data.backupPath = backupPath;
    fsStore.copyFile(resolvedTarget, backupPath!);
  }

  fsStore.copyFile(resolvedSource, resolvedTarget);

  return {
    success: true,
    message:
      backup && targetExists
        ? "Synced config.toml (backup created)."
        : "Synced config.toml.",
    filePath: resolvedTarget,
    data,
    diff: diff ?? undefined,
  };
}

function readTomlSafe(path: string): ConfigObject {
  return fsStore.readTOML(path);
}
