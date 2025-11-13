/**
 * OpenAI Compatible Client Wrapper
 * Wraps @ai-sdk/openai-compatible for each provider
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, type StreamTextResult } from "ai";
import type { LanguageModelV2Usage } from "@ai-sdk/provider";
import type { ProviderConfig } from "@/domain/xling/config.ts";
import type { PromptRequest, PromptResponse } from "./types.ts";

/**
 * Client for a single provider using AI SDK
 */
export class PromptClient {
  private provider: ReturnType<typeof createOpenAICompatible>;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.provider = createOpenAICompatible({
      name: config.name,
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      headers: config.headers,
    });
  }

  /**
   * Convert AI SDK v2 usage to our internal format
   */
  private convertUsage(
    usage: LanguageModelV2Usage | undefined,
  ):
    | { promptTokens: number; completionTokens: number; totalTokens: number }
    | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    };
  }

  /**
   * Generate text (non-streaming)
   */
  async generate(request: PromptRequest): Promise<PromptResponse> {
    const baseParams = {
      model: this.provider(request.model || ""),
      temperature: request.temperature,
      maxRetries: request.maxTokens,
      abortSignal: request.abortSignal,
    };

    // Support both single-turn (prompt) and multi-turn (messages) modes
    const params =
      request.messages && request.messages.length > 0
        ? { ...baseParams, messages: request.messages }
        : {
            ...baseParams,
            prompt: request.prompt || "",
            system: request.system,
          };

    const result = await generateText(params);

    return {
      content: result.text,
      model: request.model || "",
      provider: this.config.name,
      usage: this.convertUsage(result.usage),
      finishReason: result.finishReason,
    };
  }

  /**
   * Stream text
   */
  async stream(
    request: PromptRequest,
  ): Promise<StreamTextResult<Record<string, never>, never>> {
    const baseParams = {
      model: this.provider(request.model || ""),
      temperature: request.temperature,
      maxRetries: request.maxTokens,
      abortSignal: request.abortSignal,
    };

    // Support both single-turn (prompt) and multi-turn (messages) modes
    const params =
      request.messages && request.messages.length > 0
        ? { ...baseParams, messages: request.messages }
        : {
            ...baseParams,
            prompt: request.prompt || "",
            system: request.system,
          };

    return await streamText(params);
  }

  getProviderName(): string {
    return this.config.name;
  }
}
