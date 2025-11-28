import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  syncClaudeTomlToCodex,
  syncCodexTomlToClaude,
} from "@/services/settings/sync.ts";
import { ConfigFileNotFoundError } from "@/utils/errors.ts";

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-"));
  const source = path.join(dir, "claude", "config.toml");
  const target = path.join(dir, "codex", "config.toml");
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, source, target, cleanup };
}

function write(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("syncClaudeTomlToCodex", () => {
  test("copies source to target when target is missing", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      write(source, 'model = "claude"\n');

      const result = syncClaudeTomlToCodex({
        sourcePath: source,
        targetPath: target,
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(target)).toBe(true);
      expect(fs.readFileSync(target, "utf-8")).toBe('model = "claude"\n');
      expect(result.data?.backupPath).toBeUndefined();
      expect(result.data?.changed).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("creates backup when overwriting different target", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      write(source, 'model = "claude-new"\n');
      write(target, 'model = "old"\n');

      const result = syncClaudeTomlToCodex({
        sourcePath: source,
        targetPath: target,
        backup: true,
      });

      const backupPath = `${target}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, "utf-8")).toBe('model = "old"\n');
      expect(fs.readFileSync(target, "utf-8")).toBe('model = "claude-new"\n');
      expect(result.data?.backupPath).toBe(backupPath);
      expect(result.data?.changed).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("skips write when already in sync", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      write(source, 'model = "same"\n');
      write(target, 'model = "same"\n');

      const result = syncClaudeTomlToCodex({
        sourcePath: source,
        targetPath: target,
      });

      expect(result.success).toBe(true);
      expect(result.data?.changed).toBe(false);
      expect(fs.existsSync(`${target}.bak`)).toBe(false);
    } finally {
      cleanup();
    }
  });

  test("dry-run reports changes without writing", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      write(source, 'model = "draft"\n');

      const result = syncClaudeTomlToCodex({
        sourcePath: source,
        targetPath: target,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dryRun).toBe(true);
      expect(fs.existsSync(target)).toBe(false);
      expect(fs.existsSync(`${target}.bak`)).toBe(false);
    } finally {
      cleanup();
    }
  });

  test("throws when source config is missing", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      expect(() =>
        syncClaudeTomlToCodex({ sourcePath: source, targetPath: target }),
      ).toThrow(ConfigFileNotFoundError);
    } finally {
      cleanup();
    }
  });

  test("uses TOML text diff", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      write(source, 'model = "claude"\nmodel_provider = "openai"\n');
      write(target, 'model = "old"\n');

      const result = syncClaudeTomlToCodex({
        sourcePath: source,
        targetPath: target,
        dryRun: true,
      });

      expect(result.diff).toContain('model = "claude"');
      expect(result.diff).toContain("--- codex");
      expect(result.diff).toContain("+++ claude");
    } finally {
      cleanup();
    }
  });
});

describe("syncCodexTomlToClaude", () => {
  test("copies codex to claude and labels diff", () => {
    const { source, target, cleanup } = createTempPaths();
    try {
      // here source represents codex, target represents claude in reverse mode
      write(source, 'model = "codex"\n');
      write(target, 'model = "old"\n');

      const result = syncCodexTomlToClaude({
        sourcePath: source,
        targetPath: target,
        dryRun: true,
      });

      expect(result.diff).toContain("--- claude");
      expect(result.diff).toContain("+++ codex");
      expect(result.data?.source).toBe(source);
      expect(result.data?.target).toBe(target);
    } finally {
      cleanup();
    }
  });
});
