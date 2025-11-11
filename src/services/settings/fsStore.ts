/**
 * 文件系统存储工具
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as toml from "@iarna/toml";
import {
  ConfigFileNotFoundError,
  ConfigParseError,
  FileWriteError,
} from "../../utils/errors.ts";

/**
 * 解析 ~ 为用户主目录
 */
export function resolveHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * 确保目录存在
 */
export function ensureDir(dirPath: string): void {
  const resolvedPath = resolveHome(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }
}

/**
 * 读取 JSON 文件
 */
export function readJSON(filepath: string): Record<string, unknown> {
  const resolvedPath = resolveHome(filepath);

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigFileNotFoundError(resolvedPath);
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigParseError(resolvedPath, (error as Error).message);
  }
}

/**
 * 写入 JSON 文件
 */
export function writeJSON(
  filepath: string,
  data: Record<string, unknown>,
  backup = true,
): void {
  const resolvedPath = resolveHome(filepath);

  // 确保目录存在
  ensureDir(path.dirname(resolvedPath));

  // 备份现有文件
  if (backup && fs.existsSync(resolvedPath)) {
    const backupPath = `${resolvedPath}.bak`;
    fs.copyFileSync(resolvedPath, backupPath);
  }

  try {
    // 原子写入：先写临时文件，再重命名
    const tempPath = `${resolvedPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    throw new FileWriteError(resolvedPath, (error as Error).message);
  }
}

/**
 * 读取 TOML 文件
 */
export function readTOML(filepath: string): Record<string, unknown> {
  const resolvedPath = resolveHome(filepath);

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigFileNotFoundError(resolvedPath);
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    return toml.parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new ConfigParseError(resolvedPath, (error as Error).message);
  }
}

/**
 * 写入 TOML 文件
 */
export function writeTOML(
  filepath: string,
  data: Record<string, unknown>,
  backup = true,
): void {
  const resolvedPath = resolveHome(filepath);

  // 确保目录存在
  ensureDir(path.dirname(resolvedPath));

  // 备份现有文件
  if (backup && fs.existsSync(resolvedPath)) {
    const backupPath = `${resolvedPath}.bak`;
    fs.copyFileSync(resolvedPath, backupPath);
  }

  try {
    // 原子写入
    const tempPath = `${resolvedPath}.tmp`;
    fs.writeFileSync(tempPath, toml.stringify(data as any), "utf-8");
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    throw new FileWriteError(resolvedPath, (error as Error).message);
  }
}

/**
 * 深度合并对象
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === "object" &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        );
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * 检查文件是否存在
 */
export function fileExists(filepath: string): boolean {
  const resolvedPath = resolveHome(filepath);
  return fs.existsSync(resolvedPath);
}

/**
 * 获取文件信息
 */
export function getFileInfo(filepath: string) {
  const resolvedPath = resolveHome(filepath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  const stats = fs.statSync(resolvedPath);
  return {
    size: stats.size,
    lastModified: stats.mtime,
  };
}
