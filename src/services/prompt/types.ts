/**
 * Prompt request and response types
 */

/**
 * Chat message format (OpenAI-compatible)
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Prompt request configuration
 * Supports both single-turn (prompt) and multi-turn (messages) modes
 */
export interface PromptRequest {
  // Single-turn mode
  prompt?: string;
  system?: string;

  // Multi-turn mode (mutually exclusive with prompt)
  messages?: ChatMessage[];

  // Common options
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Prompt response
 */
export interface PromptResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

/**
 * Error thrown when a model is not supported
 */
export class ModelNotSupportedError extends Error {
  constructor(model: string, availableModels: string[]) {
    super(
      `Model "${model}" is not supported by any configured provider.\nAvailable models: ${availableModels.join(", ")}`,
    );
    this.name = "ModelNotSupportedError";
  }
}

/**
 * Error thrown when all providers fail
 */
export class AllProvidersFailedError extends Error {
  public readonly errors: Array<{ provider: string; error: Error }>;

  constructor(
    model: string,
    errors: Array<{ provider: string; error: Error }>,
  ) {
    const details = errors
      .map((e) => `  - ${e.provider}: ${e.error.message}`)
      .join("\n");

    super(`All providers failed for model "${model}":\n${details}`);
    this.name = "AllProvidersFailedError";
    this.errors = errors;
  }
}
