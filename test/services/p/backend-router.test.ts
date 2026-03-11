import { describe, expect, test } from "vitest";

import { buildCommandSpec } from "@/services/p/backend-router.ts";

describe("buildCommandSpec", () => {
  test("uses --yolo when routing prompts to Codex CLI", () => {
    const spec = buildCommandSpec("codex", "Summarize this repo", {
      yolo: true,
    });

    expect(spec.executable).toBe("codex");
    expect(spec.baseArgs).toEqual(["exec", "Summarize this repo"]);
    expect(spec.yoloArgs).toEqual(["--yolo"]);
  });

  test("omits yolo args when direct Codex routing disables them", () => {
    const spec = buildCommandSpec("codex", "Summarize this repo", {
      yolo: false,
    });

    expect(spec.yoloArgs).toBeUndefined();
  });
});
