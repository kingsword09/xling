/**
 * 自定义错误类型
 */

/**
 * 基础错误类
 */
export class XlingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlingError";
  }
}

/**
 * 不支持的工具错误
 */
export class UnsupportedToolError extends XlingError {
  constructor(tool: string) {
    super(`Unsupported tool: ${tool}`);
    this.name = "UnsupportedToolError";
  }
}

/**
 * 无效的 scope 错误
 */
export class InvalidScopeError extends XlingError {
  constructor(scope: string) {
    super(`Invalid scope: ${scope}`);
    this.name = "InvalidScopeError";
  }
}

/**
 * 配置文件不存在错误
 */
export class ConfigFileNotFoundError extends XlingError {
  constructor(path: string) {
    super(`Config file not found: ${path}`);
    this.name = "ConfigFileNotFoundError";
  }
}

/**
 * 配置文件解析错误
 */
export class ConfigParseError extends XlingError {
  constructor(path: string, reason: string) {
    super(`Failed to parse config file ${path}: ${reason}`);
    this.name = "ConfigParseError";
  }
}

/**
 * Profile 不存在错误
 */
export class ProfileNotFoundError extends XlingError {
  constructor(profile: string) {
    super(`Profile not found: ${profile}`);
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Settings 变体不存在错误
 */
export class SettingsVariantNotFoundError extends XlingError {
  constructor(variant: string) {
    super(`Settings variant not found: ${variant}`);
    this.name = "SettingsVariantNotFoundError";
  }
}

/**
 * 文件写入错误
 */
export class FileWriteError extends XlingError {
  constructor(path: string, reason: string) {
    super(`Failed to write file ${path}: ${reason}`);
    this.name = "FileWriteError";
  }
}

/**
 * 编辑器启动错误
 */
export class EditorLaunchError extends XlingError {
  constructor(editor: string, reason: string) {
    super(`Failed to launch editor ${editor}: ${reason}`);
    this.name = "EditorLaunchError";
  }
}
