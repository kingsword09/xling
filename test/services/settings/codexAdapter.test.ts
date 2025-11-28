import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, test } from "vitest";

import type { Scope } from "@/domain/types.ts";
import { CodexAdapter } from "@/services/settings/adapters/codex.ts";
import { readTOML } from "@/services/settings/fsStore.ts";

class TestCodexAdapter extends CodexAdapter {
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

function createTempConfig(fixtureName: string): {
  path: string;
  cleanup: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-test-"));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  const target = path.join(dir, "config.toml");

  const fixture = path.resolve(
    "test/fixtures/codex",
    fixtureName ?? "config.toml",
  );
  fs.copyFileSync(fixture, target);

  return { path: target, cleanup };
}

describe("CodexAdapter", () => {
  test("list returns model providers only", async () => {
    const { path: configPath, cleanup } = createTempConfig("config.toml");

    try {
      const adapter = new TestCodexAdapter(configPath);
      const result = await adapter.list("user");

      if (result.type !== "entries") {
        throw new Error("Expected entries list data from CodexAdapter.list");
      }

      expect(result.type).toBe("entries");
      expect(result.filePath).toBe(configPath);
      expect(result.entries).toMatchObject({
        primary: {
          name: "primary",
          base_url: "https://api.primary.example/v1",
          wire_api: "responses",
          env_key: "PRIMARY_API_KEY",
        },
        backup: {
          name: "backup",
          base_url: "https://api.backup.example/v1",
          wire_api: "responses",
          env_key: "BACKUP_API_KEY",
        },
      });
    } finally {
      cleanup();
    }
  });

  test("switchProfile merges selected profile", async () => {
    const { path: configPath, cleanup } = createTempConfig("config.toml");

    try {
      const adapter = new TestCodexAdapter(configPath);
      const initial = readTOML(configPath);
      expect(initial.model).toBe("gpt-5-codex");

      await adapter.switchProfile("user", "oss");

      const updated = readTOML(configPath);
      expect(updated.model).toBe("gpt-5");
      expect(updated.current_profile).toBe("oss");
    } finally {
      cleanup();
    }
  });

  test("edit creates a model provider entry when config is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-test-"));
    const configPath = path.join(dir, "config.toml");

    const adapter = new TestCodexAdapter(configPath);

    try {
      await adapter.edit("user", {
        provider: {
          id: "demo",
          name: "demo",
          base_url: "https://api.demo.example/v1",
          experimental_bearer_token: "secret",
        },
      });

      const updated = readTOML(configPath);
      const providers = updated.model_providers as Record<string, unknown>;
      expect(providers.demo).toMatchObject({
        name: "demo",
        base_url: "https://api.demo.example/v1",
        wire_api: "responses",
        experimental_bearer_token: "secret",
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
