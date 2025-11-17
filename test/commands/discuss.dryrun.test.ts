import { describe, expect, it } from "vitest";
import Discuss from "@/commands/discuss/index.js";
import { DiscussionOrchestrator } from "@/services/discuss/orchestrator.js";
import type { ModelRouter } from "@/services/prompt/router.js";

class MockRouter {
  async execute() {
    return { content: "mocked", model: "mock", provider: "mock" };
  }
}

describe("Discuss command dry-run", () => {
  it("builds a mock config when dry-run is enabled", async () => {
    const cmd = new Discuss([], {} as any);
    Object.assign(cmd, {
      flags: {
        scenario: "code-review",
        language: "en",
        participants: undefined,
        "turn-order": "round-robin",
        "max-turns": 2,
        "dry-run": true,
        continue: false,
        resume: false,
      },
      args: { topic: "Test topic" },
    });

    const config = await (cmd as any).buildDiscussionConfig(true);
    expect(config.participants).toHaveLength(1);
    expect(config.participants[0].name).toBe("Mock Expert");
    expect(config.participants[0].type).toBe("api");
    expect(config.language).toBe("en");
  });

  it("executes a turn with mock router in dry-run", async () => {
    const cmd = new Discuss([], {} as any);
    Object.assign(cmd, {
      flags: {
        scenario: "code-review",
        language: "en",
        participants: undefined,
        "turn-order": "round-robin",
        "max-turns": 1,
        "dry-run": true,
        continue: false,
        resume: false,
      },
      args: { topic: "Test dry run" },
    });

    const config = await (cmd as any).buildDiscussionConfig(true);
    const orchestrator = new DiscussionOrchestrator(
      new MockRouter() as unknown as ModelRouter
    );

    await orchestrator.start(config, "Seed prompt");
    const turn = await orchestrator.executeTurn();
    expect(turn.content).toContain("mocked");
  });
});
