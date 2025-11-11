/**
 * Claude Code 适配器
 */

import type { Scope } from '../../../domain/types.ts';
import { BaseAdapter } from './base.ts';

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
}
