/**
 * 适配器接口定义
 */

import type {
  ToolId,
  Scope,
  SettingsResult,
  InspectResult,
  SettingsListData,
  EditOptions,
} from "./types.ts";

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
  list(scope: Scope): Promise<SettingsListData>;

  /**
   * 切换 profile（可选，仅 Codex 支持）
   */
  switchProfile?(scope: Scope, profile: string): Promise<SettingsResult>;

  /**
   * 打开配置文件供编辑（可选）
   */
  edit?(scope: Scope, options: EditOptions): Promise<SettingsResult>;

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
