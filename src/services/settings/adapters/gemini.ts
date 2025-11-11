/**
 * Gemini CLI 适配器
 */

import type { Scope } from '../../../domain/types.ts';
import { BaseAdapter } from './base.ts';
import * as os from 'os';
import * as path from 'path';

/**
 * Gemini CLI 配置适配器
 *
 * 配置文件路径：
 * - user: ~/.gemini/settings.json
 * - project: <cwd>/.gemini/settings.json
 * - system: 平台相关路径
 */
export class GeminiAdapter extends BaseAdapter {
  readonly toolId = 'gemini' as const;

  /**
   * 解析配置文件路径
   */
  resolvePath(scope: Scope): string {
    switch (scope) {
      case 'user':
        return '~/.gemini/settings.json';
      case 'project':
        return '.gemini/settings.json';
      case 'system':
        return this.getSystemConfigPath();
      default:
        throw new Error(`Unsupported scope for Gemini: ${scope}`);
    }
  }

  /**
   * 验证 scope 是否有效
   */
  validateScope(scope: Scope): boolean {
    return ['user', 'project', 'system'].includes(scope);
  }

  /**
   * 获取系统级配置路径（跨平台）
   */
  private getSystemConfigPath(): string {
    const platform = os.platform();

    switch (platform) {
      case 'darwin': // macOS
        return '/Library/Application Support/Gemini/settings.json';
      case 'win32': // Windows
        return path.join(
          process.env.PROGRAMDATA || 'C:\\ProgramData',
          'Gemini',
          'settings.json',
        );
      case 'linux':
        return '/etc/gemini/settings.json';
      default:
        return '/etc/gemini/settings.json';
    }
  }
}
