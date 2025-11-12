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
  SwitchOptions,
  LaunchCommandSpec,
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
  switchProfile?(
    scope: Scope,
    profile: string,
    options?: SwitchOptions,
  ): Promise<SettingsResult>;

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

/**
 * Launch 适配器接口
 * 负责构建工具启动命令（ISP 原则：与 SettingsAdapter 分离）
 */
export interface LaunchAdapter {
  /**
   * 工具标识符
   */
  readonly toolId: ToolId;

  /**
   * 可执行文件名称
   */
  readonly executable: string;

  /**
   * 构建启动命令配置
   * @param payload Launch 请求参数
   * @returns 命令规范
   */
  buildCommandSpec(payload: {
    yolo?: boolean;
    resume?: boolean;
    continue?: boolean;
  }): LaunchCommandSpec;

  /**
   * 验证工具是否可用（在 PATH 中）
   * @returns 工具是否可用
   */
  validateAvailability(): Promise<boolean>;

  /**
   * 获取工具版本信息（可选）
   * @returns 版本字符串
   */
  getVersion?(): Promise<string>;
}
