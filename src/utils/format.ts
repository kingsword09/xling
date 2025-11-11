/**
 * 输出格式化工具
 */

import Table from "cli-table3";
import type { SettingsFileEntry } from "@/domain/types.ts";

/**
 * 格式化为 JSON 字符串
 */
export function formatJson(data: unknown, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * 格式化为表格
 */
export function formatTable(data: Record<string, unknown>): string {
  const table = new Table({
    head: ["Key", "Value"],
    colWidths: [30, 50],
    wordWrap: true,
  });

  for (const [key, value] of Object.entries(data)) {
    table.push([key, formatValue(value)]);
  }

  return table.toString();
}

/**
 * 格式化 settings 文件清单
 */
export function formatFilesTable(files: SettingsFileEntry[]): string {
  const table = new Table({
    head: ["Variant", "File", "Status", "Size", "Updated"],
    colWidths: [15, 40, 12, 12, 26],
    wordWrap: true,
  });

  for (const file of files) {
    table.push([
      file.variant,
      file.path,
      formatStatus(file),
      formatBytes(file.size),
      formatTimestamp(file.lastModified),
    ]);
  }

  return table.toString();
}

export function formatDiff(
  currentValue: unknown,
  nextValue: unknown,
): string | null {
  const current = JSON.stringify(currentValue ?? {}, null, 2);
  const next = JSON.stringify(nextValue ?? {}, null, 2);

  if (current === next) {
    return null;
  }

  const parts = buildDiffParts(current.split("\n"), next.split("\n"));
  const hunks = buildUnifiedHunks(parts);

  const lines: string[] = ["--- current", "+++ variant"];
  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    );
    lines.push(...hunk.lines);
  }

  return lines.map(colorizeDiffLine).join("\n");
}

/**
 * 格式化单个值
 */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatStatus(file: SettingsFileEntry): string {
  if (file.active) {
    return file.exists ? "active" : "missing";
  }
  return file.exists ? "available" : "missing";
}

function formatBytes(size?: number): string {
  if (typeof size !== "number") {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const formatted =
    value >= 10 || value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatTimestamp(date?: Date): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
};

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  return Boolean(process.stdout?.isTTY);
}

function colorizeDiffLine(line: string): string {
  if (!supportsColor()) {
    return line;
  }

  if (line.startsWith("@@")) {
    return `${ANSI.cyan}${ANSI.bold}${line}${ANSI.reset}`;
  }
  if (line.startsWith("---") || line.startsWith("+++")) {
    return `${ANSI.yellow}${line}${ANSI.reset}`;
  }
  if (line.startsWith("+")) {
    return `${ANSI.green}${line}${ANSI.reset}`;
  }
  if (line.startsWith("-")) {
    return `${ANSI.red}${line}${ANSI.reset}`;
  }
  if (line.startsWith(" ")) {
    return `${ANSI.dim}${line}${ANSI.reset}`;
  }
  return line;
}

type DiffPart = {
  type: "equal" | "insert" | "delete";
  lines: string[];
};

type Hunk = {
  oldStart: number;
  newStart: number;
  oldLines: number;
  newLines: number;
  lines: string[];
};

function buildDiffParts(oldLines: string[], newLines: string[]): DiffPart[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], value: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) {
      last.lines.push(value);
    } else {
      parts.push({ type, lines: [value] });
    }
  };

  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      push("equal", oldLines[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", oldLines[i]);
      i++;
    } else {
      push("insert", newLines[j]);
      j++;
    }
  }

  while (i < m) {
    push("delete", oldLines[i++]);
  }
  while (j < n) {
    push("insert", newLines[j++]);
  }

  return parts;
}

function buildUnifiedHunks(parts: DiffPart[]): Hunk[] {
  const context = 3;
  const hunks: Hunk[] = [];
  let oldLine = 1;
  let newLine = 1;
  let currentHunk: Hunk | null = null;
  let contextBuffer: string[] = [];

  const startHunk = () => {
    const oldStart = Math.max(oldLine - contextBuffer.length, 1);
    const newStart = Math.max(newLine - contextBuffer.length, 1);
    currentHunk = {
      oldStart,
      newStart,
      oldLines: contextBuffer.length,
      newLines: contextBuffer.length,
      lines: contextBuffer.map((line) => ` ${line}`),
    };
    contextBuffer = [];
  };

  const closeHunk = () => {
    if (currentHunk) {
      hunks.push(currentHunk);
      currentHunk = null;
    }
  };

  for (const part of parts) {
    if (part.type === "equal") {
      if (currentHunk !== null) {
        const active: Hunk = currentHunk;
        const leading = part.lines.slice(0, context);
        for (const line of leading) {
          active.lines.push(` ${line}`);
          active.oldLines++;
          active.newLines++;
        }
        oldLine += leading.length;
        newLine += leading.length;

        if (part.lines.length > context) {
          closeHunk();
          contextBuffer = part.lines.slice(part.lines.length - context);
          oldLine += part.lines.length - leading.length;
          newLine += part.lines.length - leading.length;
        } else {
          contextBuffer = [...leading].slice(-context);
        }
      } else {
        contextBuffer.push(...part.lines);
        if (contextBuffer.length > context) {
          contextBuffer.splice(0, contextBuffer.length - context);
        }
        oldLine += part.lines.length;
        newLine += part.lines.length;
      }
      continue;
    }

    if (!currentHunk) {
      startHunk();
    }

    if (!currentHunk) {
      throw new Error("Failed to initialize diff hunk");
    }

    const active: Hunk = currentHunk;
    for (const line of part.lines) {
      if (part.type === "delete") {
        active.lines.push(`-${line}`);
        active.oldLines++;
        oldLine++;
      } else {
        active.lines.push(`+${line}`);
        active.newLines++;
        newLine++;
      }
    }
  }

  closeHunk();
  return hunks;
}
