/**
 * Model Router with automatic fallback and retry logic
 */

import type {
  XlingConfig,
  ProviderConfig,
  RetryPolicy,
} from "@/domain/xling/config.ts";
import { ProviderRegistry } from "./providerRegistry.ts";
import { PromptClient } from "./client.ts";
import type { PromptRequest, PromptResponse } from "./types.ts";
import type { StreamTextResult } from "ai";
import { ModelNotSupportedError, AllProvidersFailedError } from "./types.ts";
import { spawn } from "node:child_process";
import * as path from "node:path";

/**
 * Logger interface for structured logging
 */
interface Logger {
  debug(message: string, ...args: ReadonlyArray<unknown>): void;
  info(message: string, ...args: ReadonlyArray<unknown>): void;
  warn(message: string, ...args: ReadonlyArray<unknown>): void;
  error(message: string, ...args: ReadonlyArray<unknown>): void;
}

/**
 * Error with optional HTTP status code
 */
interface ErrorWithStatus extends Error {
  status?: number;
}

/**
 * Simple console logger
 */
const defaultLogger: Logger = {
  debug: (msg, ...args) => console.debug(`[Router] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[Router] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[Router] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[Router] ${msg}`, ...args),
};

/**
 * Model Router with intelligent provider selection and fallback
 */
export class ModelRouter {
  #registry: ProviderRegistry;
  #clients: Map<string, PromptClient | CliPromptClient>;
  #retryPolicy: RetryPolicy;
  #logger: Logger;

  constructor(config: XlingConfig, logger?: Logger) {
    this.#registry = new ProviderRegistry(config);
    this.#clients = new Map();
    this.#retryPolicy = config.prompt.retryPolicy || {
      maxRetries: 2,
      backoffMs: 1000,
    };
    this.#logger = logger || defaultLogger;
  }

  /**
   * Get or create a client for a provider
   */
  #getOrCreateClient(provider: ProviderConfig): PromptClient | CliPromptClient {
    if (!this.#clients.has(provider.name)) {
      if (provider.baseUrl.startsWith("cli:")) {
        const tool = provider.baseUrl.replace("cli:", "");
        this.#clients.set(provider.name, new CliPromptClient(tool));
      } else {
        this.#clients.set(provider.name, new PromptClient(provider));
      }
    }
    return this.#clients.get(provider.name)!;
  }

  /**
   * Execute a prompt request with automatic provider selection and fallback
   */
  async execute(request: PromptRequest): Promise<PromptResponse> {
    // Determine which model to use
    const modelId = request.model || this.#registry.getDefaultModel();

    if (!modelId) {
      throw new Error(
        "No model specified and no default model configured. " +
          "Please specify a model with --model or configure a default model.",
      );
    }

    // Get providers that support this model
    const providers = this.#registry.getProvidersForModel(modelId);

    if (providers.length === 0) {
      throw new ModelNotSupportedError(modelId, this.#registry.getAllModels());
    }

    this.#logger.info(
      `Using model: ${modelId} (${providers.length} provider(s) available)`,
    );

    // Try with fallback
    return await this.#tryWithFallback(modelId, request, providers);
  }

  /**
   * Try executing the request with automatic fallback to other providers
   */
  async #tryWithFallback(
    modelId: string,
    request: PromptRequest,
    providers: ProviderConfig[],
  ): Promise<PromptResponse> {
    const errors: Array<{ provider: string; error: Error }> = [];

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const isLastProvider = i === providers.length - 1;

      try {
        this.#logger.debug(
          `Trying provider: ${provider.name} (priority: ${provider.priority || "default"})`,
        );

        const client = this.#getOrCreateClient(provider);

        // Set model in request
        const requestWithModel = { ...request, model: modelId };

        // Execute with timeout
        const result = await this.#executeWithTimeout(
          () => client.generate(requestWithModel),
          provider.timeout || 60000,
        );

        this.#logger.info(`✓ Successfully used provider: ${provider.name}`);
        return result;
      } catch (error) {
        const err = error as Error;
        this.#logger.warn(`✗ Provider ${provider.name} failed: ${err.message}`);

        errors.push({ provider: provider.name, error: err });

        // Check if we should retry with the next provider
        const shouldRetry = this.#isRetriableError(err) && !isLastProvider;

        if (!shouldRetry) {
          // If it's not retriable or it's the last provider, stop here
          if (isLastProvider && errors.length > 1) {
            throw new AllProvidersFailedError(modelId, errors);
          }
          throw err;
        }

        // Apply exponential backoff before trying next provider
        if (!isLastProvider) {
          await this.#backoff(i);
        }
      }
    }

    // This shouldn't be reached, but just in case
    throw new AllProvidersFailedError(modelId, errors);
  }

  /**
   * Check if an error is retriable
   *
   * Retriable errors:
   * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
   * - 5xx server errors
   * - 429 rate limit (optional, can be configured)
   *
   * Non-retriable errors:
   * - 400 Bad Request
   * - 401 Unauthorized
   * - 403 Forbidden
   * - 404 Not Found
   */
  #isRetriableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("enotfound") ||
      message.includes("network") ||
      message.includes("fetch failed")
    ) {
      return true;
    }

    // Check for HTTP status codes in error
    // AI SDK typically includes status in error message or as property
    const errorWithStatus = error as ErrorWithStatus;
    if (typeof errorWithStatus.status === "number") {
      const status = errorWithStatus.status;

      // 5xx errors are retriable
      if (status >= 500 && status < 600) {
        return true;
      }

      // 429 rate limit (optional - can be made configurable)
      if (status === 429) {
        return true;
      }

      // 4xx client errors are not retriable
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // Check status in message (e.g., "HTTP 503")
    const statusMatch = message.match(/\b(5\d{2}|429)\b/);
    if (statusMatch) {
      return true;
    }

    // Default to not retriable for unknown errors
    return false;
  }

  /**
   * Apply exponential backoff delay
   */
  async #backoff(attempt: number): Promise<void> {
    const delay = Math.min(
      this.#retryPolicy.backoffMs * Math.pow(2, attempt),
      30000, // Cap at 30 seconds
    );

    this.#logger.debug(`Backing off for ${delay}ms before next attempt`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Execute a function with timeout
   */
  async #executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute a prompt request with streaming support
   * Simplified version without retry logic for interactive mode
   */
  async executeStream(
    request: PromptRequest,
  ): Promise<StreamTextResult<Record<string, never>, never>> {
    // Determine which model to use
    const modelId = request.model || this.#registry.getDefaultModel();

    if (!modelId) {
      throw new Error(
        "No model specified and no default model configured. " +
          "Please specify a model with --model or configure a default model.",
      );
    }

    // Get providers that support this model
    const providers = this.#registry.getProvidersForModel(modelId);

    if (providers.length === 0) {
      throw new ModelNotSupportedError(modelId, this.#registry.getAllModels());
    }

    // Use first provider (no fallback for streaming to keep it simple)
    const provider = providers[0];
    const client = this.#getOrCreateClient(provider);

    this.#logger.debug(
      `Streaming with model: ${modelId} via provider: ${provider.name}`,
    );

    // Set model in request to ensure it's passed to the client
    const requestWithModel = { ...request, model: modelId };

    return await client.stream(requestWithModel);
  }

  /**
   * Get registry instance
   */
  getRegistry(): ProviderRegistry {
    return this.#registry;
  }

  /**
   * Clear client cache (useful for testing)
   */
  clearClients(): void {
    this.#clients.clear();
  }

  /**
   * Reload provider registry from disk and reset clients
   */
  async reloadConfig(): Promise<void> {
    await this.#registry.reload();
    this.clearClients();
  }
}

/**
 * Factory method to create router from config file
 */
export async function createRouter(logger?: Logger): Promise<ModelRouter> {
  const { XlingAdapter } =
    await import("@/services/settings/adapters/xling.ts");
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));
  return new ModelRouter(config, logger);
}

class CliPromptClient {
  #tool: string;

  constructor(tool: string) {
    this.#tool = tool;
  }

  async generate(request: PromptRequest): Promise<PromptResponse> {
    const prompt = formatRequest(request);
    const output = await runCli(this.#tool, prompt, request.abortSignal);
    return {
      content: output,
      model: request.model || this.#tool,
      provider: `cli:${this.#tool}`,
    } as PromptResponse;
  }

  async stream(
    request: PromptRequest,
  ): Promise<StreamTextResult<Record<string, never>, never>> {
    const prompt = formatRequest(request);
    const textStream = runCliStream(this.#tool, prompt, request.abortSignal);

    return {
      textStream,
    } as unknown as StreamTextResult<Record<string, never>, never>;
  }
}

function formatRequest(request: PromptRequest): string {
  if (request.messages && request.messages.length > 0) {
    return request.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  }
  return [request.system, request.prompt].filter(Boolean).join("\n\n");
}

function runCli(
  tool: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";
    const child = spawnCli(tool, signal);

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(cleanCliOutput(output));
      } else {
        reject(
          new Error(errorOutput || `cli:${tool} exited with code ${code}`),
        );
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function* runCliStream(
  tool: string,
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const child = spawnCli(tool, signal);
  let buffer = "";

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
  });

  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", () => resolve());
  });

  child.stdin.write(prompt);
  child.stdin.end();

  await done;

  const cleaned = cleanCliOutput(buffer);
  if (cleaned.length > 0) {
    yield cleaned;
  }
}

function spawnCli(tool: string, signal?: AbortSignal) {
  const cliPath = path.resolve(process.cwd(), "dist/run.js");
  const child = spawn(cliPath, ["p", "--tool", tool], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  if (signal) {
    if (signal.aborted) {
      child.kill();
    } else {
      signal.addEventListener("abort", () => child.kill("SIGTERM"), {
        once: true,
      });
    }
  }

  return child;
}

function cleanCliOutput(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim().length > 0 &&
        !line.startsWith("[backend:") &&
        !line.startsWith("yolo on"),
    )
    .join("\n")
    .trim();
}
