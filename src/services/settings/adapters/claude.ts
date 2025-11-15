/**
 * Claude Code settings adapter
 */

import * as fs from "fs";
import * as path from "path";
import type {
  Scope,
  SettingsListData,
  SettingsFileEntry,
  SettingsResult,
  EditOptions,
  SwitchOptions,
  ConfigObject,
} from "@/domain/types.ts";
import { BaseAdapter } from "./base.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import {
  InvalidScopeError,
  SettingsVariantNotFoundError,
} from "@/utils/errors.ts";
import { CLAUDE_SETTINGS_TEMPLATE } from "@/services/settings/templates/claudeDefault.ts";
import { openInEditor, resolveEditorCommand } from "@/utils/editor.ts";
import { formatDiff } from "@/utils/format.ts";

/**
 * Resolves the following config locations:
 * - user: ~/.claude/settings.json
 * - project: <cwd>/.claude/settings.json
 * - local: <cwd>/.claude/settings.local.json
 */
export class ClaudeAdapter extends BaseAdapter {
  readonly toolId = "claude" as const;

  /**
   * List every settings.*.json file in the scope directory
   */
  override async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const activePath = fsStore.resolveHome(this.resolvePath(scope));
    const directory = path.dirname(activePath);
    const activeFilename = path.basename(activePath);

    const files: SettingsFileEntry[] = [
      this.#buildEntry(activePath, scope, true),
    ];

    if (fs.existsSync(directory)) {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name === activeFilename) continue;
        if (!this.#isSettingsFile(entry.name)) continue;

        const entryPath = path.join(directory, entry.name);
        files.push(this.#buildEntry(entryPath, scope, false));
      }
    }

    return {
      type: "files",
      files: this.#sortFiles(files),
    };
  }

  /**
   * Resolve the config path for a scope
   */
  resolvePath(scope: Scope): string {
    switch (scope) {
      case "user":
        return "~/.claude/settings.json";
      case "project":
        return ".claude/settings.json";
      case "local":
        return ".claude/settings.local.json";
      default:
        throw new Error(`Unsupported scope for Claude: ${scope}`);
    }
  }

  /**
   * Validate supported scopes
   */
  validateScope(scope: Scope): boolean {
    return ["user", "project", "local"].includes(scope);
  }

  /**
   * Replace the active settings file with the selected variant
   */
  override async switchProfile(
    scope: Scope,
    profile: string,
    options?: SwitchOptions,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const variant = profile.trim();
    if (!variant) {
      throw new Error("Variant name cannot be empty");
    }

    const targetPath = fsStore.resolveHome(this.resolvePath(scope));
    const directory = path.dirname(targetPath);
    const sourcePath = this.#findVariantPath(directory, variant, targetPath);

    if (!sourcePath) {
      throw new SettingsVariantNotFoundError(variant);
    }

    const nextConfig = this.readConfig(sourcePath);

    let currentConfig: ConfigObject = {};
    try {
      currentConfig = this.readConfig(targetPath);
    } catch {
      currentConfig = {};
    }

    const diff = formatDiff(currentConfig, nextConfig);

    if (options?.preview) {
      return {
        success: true,
        preview: true,
        filePath: targetPath,
        diff: diff ?? undefined,
        data: {
          from: sourcePath,
          to: targetPath,
          hasChanges: Boolean(diff),
        },
        message: diff
          ? "Preview generated. Review diff before applying."
          : "Current settings already match the selected variant.",
      };
    }

    if (!diff) {
      return {
        success: true,
        message: "Current settings already match the selected variant.",
        filePath: targetPath,
      };
    }

    const shouldBackup = options?.backup ?? false;
    this.writeConfig(targetPath, nextConfig, shouldBackup);

    return {
      success: true,
      message: `Switched to ${path.basename(sourcePath)}`,
      filePath: targetPath,
      data: {
        from: sourcePath,
        to: targetPath,
      },
    };
  }

  override async edit(
    scope: Scope,
    options: EditOptions,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const basePath = fsStore.resolveHome(this.resolvePath(scope));
    const directory = path.dirname(basePath);
    const variantName = options.name?.trim();
    const resolvedEditor = resolveEditorCommand(options.ide);

    fsStore.ensureDir(directory);

    let targetPath = basePath;
    let label = "default";

    if (variantName && variantName !== "" && variantName !== "default") {
      const existingPath = this.#findVariantPath(
        directory,
        variantName,
        basePath,
      );
      if (existingPath) {
        targetPath = existingPath;
      } else {
        targetPath = path.join(directory, `settings.${variantName}.json`);
        if (!fs.existsSync(targetPath)) {
          const seed = this.#buildSeedConfig(basePath);
          fsStore.writeJSON(targetPath, seed, false);
        }
      }
      label = variantName;
    } else if (!fs.existsSync(targetPath)) {
      const seed = this.#buildSeedConfig(basePath);
      fsStore.writeJSON(targetPath, seed, false);
    }

    await openInEditor(resolvedEditor, targetPath);

    return {
      success: true,
      message: `Opened ${label} settings in ${resolvedEditor}`,
      filePath: targetPath,
      data: {
        variant: label,
        ide: resolvedEditor,
      },
    };
  }

  #buildEntry(
    filePath: string,
    scope: Scope,
    active: boolean,
  ): SettingsFileEntry {
    const info = fsStore.getFileInfo(filePath);

    return {
      filename: path.basename(filePath),
      variant: this.#extractVariant(filePath),
      path: filePath,
      scope,
      active,
      exists: Boolean(info),
      size: info?.size,
      lastModified: info?.lastModified,
    };
  }

  #extractVariant(filePath: string): string {
    const filename = path.basename(filePath);
    const match = filename.match(/^settings(?:[._-](.+))?\.json$/);
    if (!match) {
      return filename.replace(/\.json$/, "");
    }
    return match[1] ?? "default";
  }

  #buildSeedConfig(basePath: string): ConfigObject {
    try {
      if (fs.existsSync(basePath)) {
        const content = fs.readFileSync(basePath, "utf-8");
        return JSON.parse(content) as ConfigObject;
      }
    } catch {
      // ignore, fallback to template
    }
    return { ...CLAUDE_SETTINGS_TEMPLATE };
  }

  #isSettingsFile(filename: string): boolean {
    return /^settings[._-].+\.json$/.test(filename);
  }

  #sortFiles(files: SettingsFileEntry[]): SettingsFileEntry[] {
    return files.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return a.variant.localeCompare(b.variant);
    });
  }

  #findVariantPath(
    directory: string,
    profile: string,
    defaultPath: string,
  ): string | null {
    const candidates: string[] = [];
    const pushCandidate = (value: string) => {
      if (!candidates.includes(value)) {
        candidates.push(value);
      }
    };

    if (profile === "default") {
      pushCandidate(defaultPath);
    }

    if (profile.endsWith(".json")) {
      pushCandidate(
        path.isAbsolute(profile) ? profile : path.join(directory, profile),
      );
    } else {
      pushCandidate(path.join(directory, `settings.${profile}.json`));
      pushCandidate(path.join(directory, `settings-${profile}.json`));
      pushCandidate(path.join(directory, `settings_${profile}.json`));
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}
