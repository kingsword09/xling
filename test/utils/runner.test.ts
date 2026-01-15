import { describe, expect, test } from "vitest";

import { selectWindowsWhereCandidate } from "@/utils/runner.ts";

describe("selectWindowsWhereCandidate", () => {
  test("returns null when no candidates", () => {
    expect(selectWindowsWhereCandidate([])).toBeNull();
    expect(selectWindowsWhereCandidate([" ", "\r\n", "\t"])).toBeNull();
  });

  test("prefers .exe over other shims", () => {
    const lines = [
      "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
      "C:\\Tools\\codex.exe",
    ];
    expect(selectWindowsWhereCandidate(lines)).toBe("C:\\Tools\\codex.exe");
  });

  test("prefers .cmd over extensionless shims", () => {
    const lines = [
      "C:\\Users\\me\\AppData\\Roaming\\npm\\codex",
      "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
    ];
    expect(selectWindowsWhereCandidate(lines)).toBe(
      "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
    );
  });

  test("falls back to first candidate when no known extensions match", () => {
    const lines = ["C:\\weird\\shim\\tool", "C:\\other\\tool.ps1"];
    expect(selectWindowsWhereCandidate(lines)).toBe("C:\\weird\\shim\\tool");
  });
});
