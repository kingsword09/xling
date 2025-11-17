/**
 * API Participant Driver
 * Uses ModelRouter to call AI models (OpenAI, Anthropic, etc.)
 */

import { BaseParticipantDriver } from "./base.js";
import type { ModelRouter } from "../../prompt/router.js";
import type {
  Participant,
  DiscussionContext,
  Turn,
} from "../../../domain/discuss/types.js";
import type { PromptRequest } from "../../prompt/types.js";
import { injectLanguageInstruction } from "../language/injector.js";

/**
 * API Participant Driver
 * Executes turns by calling AI models through ModelRouter
 */
export class ApiParticipantDriver extends BaseParticipantDriver {
  private router: ModelRouter;
  private lastTokens?: number;

  constructor(participant: Participant, router: ModelRouter) {
    super(participant);

    if (participant.type !== "api") {
      throw new Error(
        `ApiParticipantDriver can only handle API participants, got ${participant.type}`
      );
    }

    if (!participant.config.api) {
      throw new Error(
        `API participant ${participant.name} missing api config`
      );
    }

    this.router = router;
  }

  /**
   * Execute a turn for this API participant
   */
  async execute(
    context: DiscussionContext,
    prompt: string
  ): Promise<string> {
    try {
      const request = this.buildPromptRequest(context, prompt);

      const startTime = Date.now();
      const response = await this.executeWithTimeout(
        () => this.router.execute(request),
        this.timeout
      );
      const duration = Date.now() - startTime;
      this.lastTokens = response.usage?.totalTokens;

      console.debug(
        `${this.getParticipantInfo()} completed turn in ${duration}ms (${response.usage?.totalTokens || 0} tokens)`
      );

      return response.content;
    } catch (error) {
      throw this.handleError(error, "Failed to execute turn");
    }
  }

  /**
   * Validate that this participant can execute
   */
  async validate(): Promise<boolean> {
    const apiConfig = this.participant.config.api;
    if (!apiConfig) {
      return false;
    }

    // Check if model is configured
    if (!apiConfig.model) {
      console.warn(
        `${this.getParticipantInfo()} missing model configuration`
      );
      return false;
    }

    // Optionally: could check if model is available in ModelRouter
    // For now, we'll trust that the router will handle model validation
    return true;
  }

  /**
   * Build a PromptRequest from discussion context
   */
  private buildPromptRequest(
    context: DiscussionContext,
    prompt: string
  ): PromptRequest {
    const apiConfig = this.participant.config.api!;

    // Build system prompt with language instruction
    let systemPrompt = this.participant.config.systemPrompt || "";
    if (context.config.language) {
      systemPrompt = injectLanguageInstruction(
        systemPrompt,
        context.config.language
      );
    }

    // Build conversation history
    const conversationContext = this.buildConversationContext(context);

    // Combine context and current prompt
    const fullPrompt = conversationContext
      ? `${conversationContext}\n\n${prompt}`
      : prompt;

    return {
      prompt: fullPrompt,
      system: systemPrompt,
      model: apiConfig.model,
      temperature: apiConfig.temperature,
      maxTokens: apiConfig.maxTokens,
    };
  }

  /**
   * Build conversation history context
   * Returns a formatted string of previous turns
   */
  private buildConversationContext(context: DiscussionContext): string {
    if (context.turns.length === 0) {
      return "";
    }

    const lines: string[] = [];
    lines.push("=== Previous Discussion ===\n");

    // Include all previous turns for context
    for (const turn of context.turns) {
      const participant = context.participants.find(
        (p) => p.id === turn.participantId
      );

      if (participant) {
        lines.push(
          `[#${participant.number} ${participant.name}]:`
        );
        lines.push(turn.content);
        lines.push(""); // Empty line between turns
      }
    }

    lines.push("=== End of Previous Discussion ===\n");

    return lines.join("\n");
  }

  /**
   * Get model information for display
   */
  getModelInfo(): string {
    return this.participant.config.api?.model || "unknown";
  }

  getTokenUsage(): number | undefined {
    return this.lastTokens;
  }
}
