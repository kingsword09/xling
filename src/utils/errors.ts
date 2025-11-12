/**
 * Custom error types
 */

/**
 * Base error class
 */
export class XlingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlingError";
  }
}

/**
 * Error thrown when a tool is not supported
 */
export class UnsupportedToolError extends XlingError {
  constructor(tool: string) {
    super(`Unsupported tool: ${tool}`);
    this.name = "UnsupportedToolError";
  }
}

/**
 * Error thrown for invalid scopes
 */
export class InvalidScopeError extends XlingError {
  constructor(scope: string) {
    super(`Invalid scope: ${scope}`);
    this.name = "InvalidScopeError";
  }
}

/**
 * Error thrown when a config file is missing
 */
export class ConfigFileNotFoundError extends XlingError {
  constructor(path: string) {
    super(`Config file not found: ${path}`);
    this.name = "ConfigFileNotFoundError";
  }
}

/**
 * Error thrown when parsing a config file fails
 */
export class ConfigParseError extends XlingError {
  constructor(path: string, reason: string) {
    super(`Failed to parse config file ${path}: ${reason}`);
    this.name = "ConfigParseError";
  }
}

/**
 * Error thrown when a Codex profile cannot be found
 */
export class ProfileNotFoundError extends XlingError {
  constructor(profile: string) {
    super(`Profile not found: ${profile}`);
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Error thrown when a requested settings variant is missing
 */
export class SettingsVariantNotFoundError extends XlingError {
  constructor(variant: string) {
    super(`Settings variant not found: ${variant}`);
    this.name = "SettingsVariantNotFoundError";
  }
}

/**
 * Error thrown when a file cannot be written safely
 */
export class FileWriteError extends XlingError {
  constructor(path: string, reason: string) {
    super(`Failed to write file ${path}: ${reason}`);
    this.name = "FileWriteError";
  }
}

/**
 * Error thrown when the configured editor cannot be launched
 */
export class EditorLaunchError extends XlingError {
  constructor(editor: string, reason: string) {
    super(`Failed to launch editor ${editor}: ${reason}`);
    this.name = "EditorLaunchError";
  }
}

/**
 * Error thrown when an executable is not found in PATH
 */
export class ExecutableNotFoundError extends XlingError {
  constructor(executable: string, hint?: string) {
    super(
      `Executable '${executable}' not found in PATH.${hint ? ` ${hint}` : ""}`,
    );
    this.name = "ExecutableNotFoundError";
  }
}

/**
 * Error thrown when not in a git repository
 */
export class GitRepositoryError extends XlingError {
  constructor(cwd: string) {
    super(`Not a git repository (or any parent): ${cwd}`);
    this.name = "GitRepositoryError";
  }
}

/**
 * Error thrown when a git command fails
 */
export class GitCommandError extends XlingError {
  constructor(command: string, stderr: string) {
    super(`Git command failed: ${command}\n${stderr}`);
    this.name = "GitCommandError";
  }
}
