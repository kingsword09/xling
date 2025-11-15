import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, test, vi } from "vitest";

import type { Scope } from "@/domain/types.ts";
import { ClaudeAdapter } from "@/services/settings/adapters/claude.ts";
import { openInEditor } from "@/utils/editor.ts";

vi.mock("@/utils/editor.ts", () => {
  return {
    openInEditor: vi.fn(() => Promise.resolve()),
    resolveEditorCommand: (value?: string) => {
      if (!value) return "code";
      return value === "vscode" ? "code" : value;
    },
  };
});

class TestClaudeAdapter extends ClaudeAdapter {
  constructor(private readonly configPath: string) {
    super();
  }

  override resolvePath(_scope: Scope): string {
    return this.configPath;
  }

  override validateScope(_scope: Scope): boolean {
    return true;
  }
}

function createTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, cleanup };
}

describe("ClaudeAdapter", () => {
  test("list returns all settings variants", async () => {
    const { dir, cleanup } = createTempDir("claude-list-");

    try {
      const activePath = path.join(dir, "settings.json");
      const hxiPath = path.join(dir, "settings.hxi.json");
      const ossPath = path.join(dir, "settings-oss.json");

      fs.writeFileSync(
        activePath,
        JSON.stringify({ ai: { model: "claude-3.5" } }),
        "utf-8",
      );
      fs.writeFileSync(
        hxiPath,
        JSON.stringify({ ai: { model: "claude-hxi" } }),
        "utf-8",
      );
      fs.writeFileSync(
        ossPath,
        JSON.stringify({ ai: { model: "claude-oss" } }),
        "utf-8",
      );

      const adapter = new TestClaudeAdapter(activePath);
      const result = await adapter.list("user");

      if (result.type !== "files") {
        throw new Error("Expected files list data from ClaudeAdapter.list");
      }

      expect(result.type).toBe("files");
      expect(result.files).toHaveLength(3);

      const active = result.files.find((file) => file.active);
      const hxi = result.files.find((file) => file.variant === "hxi");
      const oss = result.files.find((file) => file.variant === "oss");

      expect(active?.path).toBe(activePath);
      expect(hxi?.path).toBe(hxiPath);
      expect(oss?.path).toBe(ossPath);
    } finally {
      cleanup();
    }
  });

  test("switchProfile copies selected variant to active file", async () => {
    const { dir, cleanup } = createTempDir("claude-switch-");
    try {
      const activePath = path.join(dir, "settings.json");
      const variantPath = path.join(dir, "settings.hxi.json");

      fs.writeFileSync(
        activePath,
        JSON.stringify({ workspace: { defaultModel: "claude-3.5" } }),
        "utf-8",
      );
      fs.writeFileSync(
        variantPath,
        JSON.stringify({ workspace: { defaultModel: "claude-hxi" } }),
        "utf-8",
      );

      const adapter = new TestClaudeAdapter(activePath);
      await adapter.switchProfile("user", "hxi");

      const updated = JSON.parse(fs.readFileSync(activePath, "utf-8"));
      expect(updated).toEqual({ workspace: { defaultModel: "claude-hxi" } });
    } finally {
      cleanup();
    }
  });

  test("edit creates variant file and opens editor", async () => {
    const { dir, cleanup } = createTempDir("claude-edit-");
    try {
      const activePath = path.join(dir, "settings.json");

      const adapter = new TestClaudeAdapter(activePath);
      await adapter.edit("user", { name: "hxi", ide: "vscode" });

      const variantPath = path.join(dir, "settings.hxi.json");
      expect(fs.existsSync(variantPath)).toBe(true);
      expect(openInEditor).toHaveBeenCalledWith("code", variantPath);
    } finally {
      cleanup();
    }
  });
});
