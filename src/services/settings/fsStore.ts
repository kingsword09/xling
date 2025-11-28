/**
 * File-system helpers for settings
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as toml from "smol-toml";
import {
  ConfigFileNotFoundError,
  ConfigParseError,
  FileWriteError,
} from "@/utils/errors.ts";
import type { ConfigObject, ConfigValue } from "@/domain/types.ts";

export interface FileInfo {
  size: number;
  lastModified: Date;
}

/**
 * Expand ~ to the current user's home directory
 */
export function resolveHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Ensure the directory exists
 */
export function ensureDir(dirPath: string): void {
  const resolvedPath = resolveHome(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }
}

/**
 * Read a JSON file
 */
export function readJSON(filepath: string): ConfigObject {
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
 * Write a JSON file
 */
export function writeJSON(
  filepath: string,
  data: ConfigObject,
  backup = true,
): void {
  const resolvedPath = resolveHome(filepath);

  // Ensure the destination directory exists
  ensureDir(path.dirname(resolvedPath));

  // Backup the existing file if needed
  if (backup && fs.existsSync(resolvedPath)) {
    const backupPath = `${resolvedPath}.bak`;
    fs.copyFileSync(resolvedPath, backupPath);
  }

  try {
    // Atomic write: temporary file then rename
    const tempPath = `${resolvedPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    throw new FileWriteError(resolvedPath, (error as Error).message);
  }
}

/**
 * Read a TOML file
 */
export function readTOML(filepath: string): ConfigObject {
  const resolvedPath = resolveHome(filepath);

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigFileNotFoundError(resolvedPath);
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    return toml.parse(content) as ConfigObject;
  } catch (error) {
    throw new ConfigParseError(resolvedPath, (error as Error).message);
  }
}

/**
 * Write a TOML file
 */
export function writeTOML(
  filepath: string,
  data: ConfigObject,
  backup = true,
): void {
  const resolvedPath = resolveHome(filepath);

  // Ensure the destination directory exists
  ensureDir(path.dirname(resolvedPath));

  // Backup the existing file if needed
  if (backup && fs.existsSync(resolvedPath)) {
    const backupPath = `${resolvedPath}.bak`;
    fs.copyFileSync(resolvedPath, backupPath);
  }

  try {
    // Atomic write
    const tempPath = `${resolvedPath}.tmp`;
    fs.writeFileSync(tempPath, toml.stringify(data), "utf-8");
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    throw new FileWriteError(resolvedPath, (error as Error).message);
  }
}

/**
 * Deep merge two plain objects
 */
const isPlainConfigObject = (value: ConfigValue): value is ConfigObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

export function deepMerge(
  target: ConfigObject,
  source: ConfigObject,
): ConfigObject {
  const result: ConfigObject = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        isPlainConfigObject(sourceValue) &&
        isPlainConfigObject(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Check whether the file exists
 */
export function fileExists(filepath: string): boolean {
  const resolvedPath = resolveHome(filepath);
  return fs.existsSync(resolvedPath);
}

/**
 * Read raw file contents (utf-8)
 */
export function readFile(filepath: string): string {
  const resolvedPath = resolveHome(filepath);
  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigFileNotFoundError(resolvedPath);
  }
  return fs.readFileSync(resolvedPath, "utf-8");
}

/**
 * Retrieve file metadata
 */
export function getFileInfo(filepath: string): FileInfo | null {
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

/**
 * Check whether a directory exists
 */
export function dirExists(dirPath: string): boolean {
  const resolvedPath = resolveHome(dirPath);
  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory();
}

/**
 * List files in a directory
 */
export function listFiles(dirPath: string): string[] {
  const resolvedPath = resolveHome(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }
  return fs.readdirSync(resolvedPath);
}

/**
 * Copy a file (atomic operation)
 */
export function copyFile(src: string, dest: string): void {
  const resolvedSrc = resolveHome(src);
  const resolvedDest = resolveHome(dest);

  if (!fs.existsSync(resolvedSrc)) {
    throw new ConfigFileNotFoundError(resolvedSrc);
  }

  ensureDir(path.dirname(resolvedDest));

  try {
    // Atomic write: copy to temp file then rename
    const tempPath = `${resolvedDest}.tmp`;
    fs.copyFileSync(resolvedSrc, tempPath);
    fs.renameSync(tempPath, resolvedDest);
  } catch (error) {
    throw new FileWriteError(resolvedDest, (error as Error).message);
  }
}

/**
 * Move/rename a file
 */
export function moveFile(src: string, dest: string): void {
  const resolvedSrc = resolveHome(src);
  const resolvedDest = resolveHome(dest);

  if (!fs.existsSync(resolvedSrc)) {
    throw new ConfigFileNotFoundError(resolvedSrc);
  }

  ensureDir(path.dirname(resolvedDest));

  try {
    fs.renameSync(resolvedSrc, resolvedDest);
  } catch (error) {
    throw new FileWriteError(resolvedDest, (error as Error).message);
  }
}

/**
 * Delete a file
 */
export function deleteFile(filepath: string): void {
  const resolvedPath = resolveHome(filepath);
  if (fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
  }
}
