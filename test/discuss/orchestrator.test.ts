import { describe, expect, it } from "vitest";
import { DiscussionOrchestrator } from "@/services/discuss/orchestrator.js";
import type { DiscussionConfig } from "@/domain/discuss/types.js";
import type {
  PromptRequest,
  PromptResponse,
} from "@/services/prompt/types.js";
import type { ModelRouter } from "@/services/prompt/router.js";

class FakeRouter {
  public lastRequest: PromptRequest | null = null;

  async execute(request: PromptRequest): Promise<PromptResponse> {
    this.lastRequest = request;
    return {
      content: "ok",
      model: "test-model",
      provider: "fake",
    };
  }
}

const discussionConfig: DiscussionConfig = {
  id: "test-discussion",
  topic: "Seed prompt handling",
  scenario: "test-scenario",
  language: "en",
  participants: [
    {
      id: "api-1",
      name: "API Participant",
      type: "api",
      role: "Analyst",
      config: {
        api: {
          model: "test-model",
        },
        systemPrompt: "You are an analyst.",
      },
      required: true,
    },
  ],
  orchestration: {
    turnOrder: "sequential",
    maxTurns: 1,
    allowSkip: false,
  },
  metadata: {
    createdAt: new Date().toISOString(),
  },
};

describe("DiscussionOrchestrator", () => {
  it("uses the provided initial prompt for the first turn", async () => {
    const router = new FakeRouter();
    const orchestrator = new DiscussionOrchestrator(
      router as unknown as ModelRouter
    );

    const initialPrompt = "Seed the discussion with this prompt.";
    const context = await orchestrator.start(discussionConfig, initialPrompt);

    await orchestrator.executeTurn();

    expect(router.lastRequest?.prompt).toBe(initialPrompt);
    expect(context.initialPrompt).toBe(initialPrompt);
    expect(context.config.metadata.initialPrompt).toBe(initialPrompt);
  });
});
