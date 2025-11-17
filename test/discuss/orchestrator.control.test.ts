import { describe, expect, it } from "vitest";
import { DiscussionOrchestrator } from "@/services/discuss/orchestrator.js";
import type {
  DiscussionConfig,
  ParticipantDriver,
  ControlCommand,
} from "@/domain/discuss/types.js";
import type { ModelRouter } from "@/services/prompt/router.js";
import type { PromptRequest, PromptResponse } from "@/services/prompt/types.js";

class RecordingRouter {
  public lastRequest: PromptRequest | null = null;
  async execute(request: PromptRequest): Promise<PromptResponse> {
    this.lastRequest = request;
    return {
      content: "ok",
      model: "test-model",
      provider: "mock",
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 123,
      },
    };
  }
}

const baseConfig: DiscussionConfig = {
  id: "test",
  topic: "seed prompt",
  scenario: "code-review",
  language: "en",
  participants: [
    {
      id: "p1",
      name: "API",
      type: "api",
      role: "Analyst",
      config: {
        api: { model: "test-model" },
        systemPrompt: "You are an analyst.",
      },
      required: true,
    },
  ],
  orchestration: {
    turnOrder: "sequential",
    maxTurns: 2,
    allowSkip: false,
  },
  metadata: {
    createdAt: new Date().toISOString(),
  },
};

const humanConfig: DiscussionConfig = {
  ...baseConfig,
  participants: [
    {
      id: "human-1",
      name: "You",
      type: "human",
      role: "Human",
      config: {
        human: { inputMode: "tty" },
      },
      required: false,
    },
  ],
};

describe("DiscussionOrchestrator control and prompts", () => {
  it("keeps existing metadata initialPrompt when empty seed is provided", async () => {
    const router = new RecordingRouter();
    const orchestrator = new DiscussionOrchestrator(
      router as unknown as ModelRouter
    );

    const config = {
      ...baseConfig,
      metadata: {
        ...baseConfig.metadata,
        initialPrompt: "scenario seed",
      },
    };

    await orchestrator.start(config, "   ");
    await orchestrator.executeTurn();

    expect(router.lastRequest?.prompt).toBe("scenario seed");
  });

  it("records token usage when driver exposes token counts", async () => {
    const router = new RecordingRouter();
    const orchestrator = new DiscussionOrchestrator(
      router as unknown as ModelRouter
    );

    await orchestrator.start(baseConfig, "prompt");
    const turn = await orchestrator.executeTurn();

    expect(turn.metadata.tokens).toBe(123);
  });

  it("advances turn index on pass control command to avoid infinite loop", async () => {
    const orchestrator = new DiscussionOrchestrator({} as ModelRouter);

    await orchestrator.start(humanConfig, "prompt");
    // Replace driver with control-command driver
    const driver: ParticipantDriver = {
      async execute() {
        return "pass";
      },
      async validate() {
        return true;
      },
    };
    const participant = (orchestrator as any).context.participants[0];
    (orchestrator as any).drivers.set(participant.id, driver);

    const turn = await orchestrator.executeTurn();
    expect(turn.content).toBe("[COMMAND: pass]");
    expect((orchestrator as any).context.currentTurnIndex).toBe(1);
  });

  it("prints list/history/summary commands without throwing", async () => {
    const orchestrator = new DiscussionOrchestrator({} as ModelRouter);
    await orchestrator.start(baseConfig, "initial");

    const commandTurn = (type: string): ControlCommand => ({ type } as ControlCommand);

    (orchestrator as any).processControlCommand(commandTurn("list"));
    (orchestrator as any).processControlCommand(commandTurn("history"));
    (orchestrator as any).processControlCommand(commandTurn("summary"));
  });
});
