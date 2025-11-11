/**
 * 适配器接口定义
 */

import type { ToolId, Scope, SettingsResult, InspectResult } from './types.ts';

/**
 * Settings 适配器接口
 * 所有工具适配器必须实现此接口（LSP 原则）
 */
export interface SettingsAdapter {
  /**
   * 工具标识符
   */
  readonly toolId: ToolId;

  /**
   * 列出指定 scope 的所有配置
   */
  list(scope: Scope): Promise<Record<string, unknown>>;

  /**
   * 获取指定 key 的配置值
   */
  get(scope: Scope, key: string): Promise<unknown>;

  /**
   * 设置配置值
   */
  set(
    scope: Scope,
    key: string,
    value: unknown,
    dryRun?: boolean,
  ): Promise<SettingsResult>;

  /**
   * 删除配置项
   */
  unset(scope: Scope, key: string, dryRun?: boolean): Promise<SettingsResult>;

  /**
   * 切换 profile（可选，仅 Codex 支持）
   */
  switchProfile?(profile: string): Promise<SettingsResult>;

  /**
   * 检查配置文件状态
   */
  inspect?(scope: Scope): Promise<InspectResult>;

  /**
   * 解析配置文件路径
   */
  resolvePath(scope: Scope): string;

  /**
   * 验证 scope 是否有效
   */
  validateScope(scope: Scope): boolean;
}
