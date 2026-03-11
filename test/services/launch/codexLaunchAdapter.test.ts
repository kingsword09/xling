import { describe, expect, test } from "vitest";

import { CodexLaunchAdapter } from "@/services/launch/adapters/codex.ts";

describe("CodexLaunchAdapter", () => {
  test("uses --yolo for Codex yolo launches", () => {
    const adapter = new CodexLaunchAdapter();

    const spec = adapter.buildCommandSpec({ yolo: true });

    expect(spec.executable).toBe("codex");
    expect(spec.baseArgs).toEqual([]);
    expect(spec.yoloArgs).toEqual(["--yolo"]);
  });

  test("builds resume and config overrides without changing yolo flag", () => {
    const adapter = new CodexLaunchAdapter();

    const spec = adapter.buildCommandSpec({
      yolo: true,
      continue: true,
      settings: "model=o3;shell_environment_policy.inherit=all",
    });

    expect(spec.baseArgs).toEqual([
      "-c",
      "model=o3",
      "-c",
      "shell_environment_policy.inherit=all",
      "resume",
      "--last",
    ]);
    expect(spec.yoloArgs).toEqual(["--yolo"]);
  });
});
