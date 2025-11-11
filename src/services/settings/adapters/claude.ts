/**
 * Claude Code 适配器
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  Scope,
  SettingsListData,
  SettingsFileEntry,
  SettingsResult,
  EditOptions,
} from '../../../domain/types.ts';
import { BaseAdapter } from './base.ts';
import * as fsStore from '../fsStore.ts';
import {
  InvalidScopeError,
  SettingsVariantNotFoundError,
} from '../../../utils/errors.ts';
import { CLAUDE_SETTINGS_TEMPLATE } from '../templates/claudeDefault.ts';
import { openInEditor, resolveEditorCommand } from '../../../utils/editor.ts';

/**
 * Claude Code 配置适配器
 *
 * 配置文件路径：
 * - user: ~/.claude/settings.json
 * - project: <cwd>/.claude/settings.json
 * - local: <cwd>/.claude/settings.local.json
 */
export class ClaudeAdapter extends BaseAdapter {
  readonly toolId = 'claude' as const;

  /**
   * 列出所有 settings.*.json 文件
   */
  override async list(scope: Scope): Promise<SettingsListData> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const activePath = fsStore.resolveHome(this.resolvePath(scope));
    const directory = path.dirname(activePath);
    const activeFilename = path.basename(activePath);

    const files: SettingsFileEntry[] = [
      this.buildEntry(activePath, scope, true),
    ];

    if (fs.existsSync(directory)) {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name === activeFilename) continue;
        if (!this.isSettingsFile(entry.name)) continue;

        const entryPath = path.join(directory, entry.name);
        files.push(this.buildEntry(entryPath, scope, false));
      }
    }

    return {
      type: 'files',
      files: this.sortFiles(files),
    };
  }

  /**
   * 解析配置文件路径
   */
  resolvePath(scope: Scope): string {
    switch (scope) {
      case 'user':
        return '~/.claude/settings.json';
      case 'project':
        return '.claude/settings.json';
      case 'local':
        return '.claude/settings.local.json';
      default:
        throw new Error(`Unsupported scope for Claude: ${scope}`);
    }
  }

  /**
   * 验证 scope 是否有效
   */
  validateScope(scope: Scope): boolean {
    return ['user', 'project', 'local'].includes(scope);
  }

  /**
   * 切换 settings.<variant>.json 到活动文件
   */
  override async switchProfile(
    scope: Scope,
    profile: string,
  ): Promise<SettingsResult> {
    if (!this.validateScope(scope)) {
      throw new InvalidScopeError(scope);
    }

    const variant = profile.trim();
    if (!variant) {
      throw new Error('Variant name cannot be empty');
    }

    const targetPath = fsStore.resolveHome(this.resolvePath(scope));
    const directory = path.dirname(targetPath);
    const sourcePath = this.findVariantPath(directory, variant, targetPath);

    if (!sourcePath) {
      throw new SettingsVariantNotFoundError(variant);
    }

    const config = this.readConfig(sourcePath);
    this.writeConfig(targetPath, config);

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
    let label = 'default';

    if (variantName && variantName !== '' && variantName !== 'default') {
      const existingPath = this.findVariantPath(directory, variantName, basePath);
      if (existingPath) {
        targetPath = existingPath;
      } else {
        targetPath = path.join(directory, `settings.${variantName}.json`);
        if (!fs.existsSync(targetPath)) {
          fsStore.writeJSON(targetPath, { ...CLAUDE_SETTINGS_TEMPLATE }, false);
        }
      }
      label = variantName;
    } else if (!fs.existsSync(targetPath)) {
      fsStore.writeJSON(targetPath, { ...CLAUDE_SETTINGS_TEMPLATE }, false);
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

  private buildEntry(
    filePath: string,
    scope: Scope,
    active: boolean,
  ): SettingsFileEntry {
    const info = fsStore.getFileInfo(filePath);

    return {
      filename: path.basename(filePath),
      variant: this.extractVariant(filePath),
      path: filePath,
      scope,
      active,
      exists: Boolean(info),
      size: info?.size,
      lastModified: info?.lastModified,
    };
  }

  private extractVariant(filePath: string): string {
    const filename = path.basename(filePath);
    const match = filename.match(/^settings(?:[._-](.+))?\.json$/);
    if (!match) {
      return filename.replace(/\.json$/, '');
    }
    return match[1] ?? 'default';
  }

  private isSettingsFile(filename: string): boolean {
    return /^settings[._-].+\.json$/.test(filename);
  }

  private sortFiles(files: SettingsFileEntry[]): SettingsFileEntry[] {
    return files.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return a.variant.localeCompare(b.variant);
    });
  }

  private findVariantPath(
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

    if (profile === 'default') {
      pushCandidate(defaultPath);
    }

    if (profile.endsWith('.json')) {
      pushCandidate(path.isAbsolute(profile) ? profile : path.join(directory, profile));
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
