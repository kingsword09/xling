/**
 * Proxy server implementation
 * Provides OpenAI-compatible API proxy with load balancing and key rotation
 */

/* eslint-disable no-console */

import { watch, type FSWatcher } from "node:fs";
import type { ProviderConfig, XlingConfig } from "@/domain/xling/config.ts";
import { getProviderApiKeys } from "@/domain/xling/config.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";
import { resolveHome } from "@/services/settings/fsStore.ts";
import { classifyError } from "./errorClassifier.ts";
import { ProxyLoadBalancer } from "./loadBalancer.ts";
import {
  anthropicToOpenAIRequest,
  openAIToAnthropicResponse,
  createStreamTransformer,
  isAnthropicRequest,
  isResponsesAPIRequest,
  responsesAPIToOpenAIRequest,
  openAIToResponsesAPIResponse,
  createResponsesAPIStreamTransformer,
} from "./transformer.ts";
import type {
  ProxyRequestContext,
  ProxyProviderConfig,
  ProxyServerContext,
  ProxyServerOptions,
} from "./types.ts";

export const DEFAULT_PROXY_PORT = 4320;

/**
 * Create a unique request ID
 */
function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toLogString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object Object]";
    }
  }

  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return value.name || "[function]";

  return "";
}

/**
 * Start the proxy server
 */
export async function startProxyServer(
  options: ProxyServerOptions = {},
): Promise<ProxyServerContext> {
  const adapter = new XlingAdapter();
  const configPath = adapter.resolvePath("user");
  let currentConfig = adapter.readConfig(configPath) as XlingConfig;

  // Use unified providers from config root
  if (!currentConfig.providers?.length) {
    throw new Error(
      "No providers configured in ~/.claude/xling.json. Add a 'providers' array.",
    );
  }

  const getConfig = () => currentConfig;

  const initialProxyConfig = currentConfig.proxy ?? {};
  const host = options.host ?? initialProxyConfig.host ?? "127.0.0.1";
  const port = options.port ?? initialProxyConfig.port ?? DEFAULT_PROXY_PORT;
  const accessKey = options.accessKey ?? initialProxyConfig.accessKey;

  const loadBalancer = new ProxyLoadBalancer(
    initialProxyConfig.loadBalance ?? "failover",
    initialProxyConfig.keyRotation?.cooldownMs ?? 60000,
  );

  const server = Bun.serve({
    hostname: host,
    port,
    async fetch(req: Request) {
      const url = new URL(req.url);
      const path = url.pathname;

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(),
        });
      }

      // Health check
      if (path === "/health" || path === "/") {
        const cfg = getConfig();
        return Response.json(
          {
            status: "ok",
            providers: cfg.providers.map((p) => p.name),
            loadBalance: cfg.proxy?.loadBalance ?? "failover",
          },
          { headers: corsHeaders() },
        );
      }

      // Stats endpoint
      if (path === "/stats") {
        return Response.json(
          {
            stats: loadBalancer.getStats(),
          },
          { headers: corsHeaders() },
        );
      }

      // Models endpoint - return available models from config
      if (path === "/v1/models" || path === "/models") {
        const models = buildModelsResponse(getConfig().providers);
        return Response.json(models, { headers: corsHeaders() });
      }

      // Access key validation
      if (accessKey) {
        const authHeader = req.headers.get("authorization");
        const providedKey = authHeader?.replace(/^Bearer\s+/i, "");

        if (providedKey !== accessKey) {
          if (options.logger) {
            console.log(
              `[auth] Access key validation failed for path: ${path}`,
            );
            console.log(`[auth] Expected: ${accessKey.slice(0, 4)}...`);
            console.log(
              `[auth] Received: ${providedKey ? providedKey.slice(0, 4) + "..." : "(none)"}`,
            );
          }
          return Response.json(
            { error: { message: "Invalid access key", type: "auth_error" } },
            { status: 401, headers: corsHeaders() },
          );
        }
      }

      // Proxy API requests
      if (
        path.startsWith("/v1/") ||
        path.startsWith("/claude/") ||
        path.startsWith("/openai/") ||
        path === "/responses" ||
        path === "/messages" ||
        path === "/chat/completions"
      ) {
        if (options.logger) {
          console.log(`[proxy] Handling request: ${req.method} ${path}`);
        }
        const cfg = getConfig();
        return handleProxyRequest(
          req,
          path,
          {
            providers: cfg.providers,
            modelMapping: cfg.proxy?.modelMapping,
            defaultModel: cfg.defaultModel,
            passthroughResponsesAPI: cfg.proxy?.passthroughResponsesAPI,
            keyRotation: cfg.proxy?.keyRotation,
          },
          loadBalancer,
          options.logger ?? true,
        );
      }

      if (options.logger) {
        console.log(`[proxy] 404 Not Found: ${req.method} ${path}`);
      }
      return Response.json(
        { error: { message: "Not found", type: "not_found" } },
        { status: 404, headers: corsHeaders() },
      );
    },
  });

  // Watch config file for changes
  const resolvedConfigPath = resolveHome(configPath);
  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(resolvedConfigPath, (eventType) => {
      if (eventType === "change") {
        try {
          const newConfig = adapter.readConfig(configPath) as XlingConfig;
          if (newConfig.providers?.length) {
            currentConfig = newConfig;
            if (options.logger) {
              console.log("[proxy] Config reloaded");
            }
          }
        } catch (e) {
          if (options.logger) {
            console.error("[proxy] Failed to reload config:", e);
          }
        }
      }
    });
  } catch (e) {
    if (options.logger) {
      console.warn("[proxy] Failed to watch config file:", e);
    }
  }

  const baseUrl = `http://${host}:${port}`;
  const providers = currentConfig.providers.map((p) => p.name);
  const models = currentConfig.providers.flatMap((p) =>
    p.models.map((m) => `${p.name},${m}`),
  );

  return {
    baseUrl,
    providers,
    models,
    server,
    shutdown: async () => {
      watcher?.close();
      await server.stop();
    },
  };
}

/**
 * Handle proxy request with load balancing and retry
 */
interface ProxyRequestConfig {
  providers: ProviderConfig[];
  modelMapping?: Record<string, string>;
  defaultModel?: string;
  passthroughResponsesAPI?: string[];
  keyRotation?: {
    enabled?: boolean;
    onError?: boolean;
    cooldownMs?: number;
  };
}

async function handleProxyRequest(
  req: Request,
  path: string,
  config: ProxyRequestConfig,
  loadBalancer: ProxyLoadBalancer,
  logger: boolean,
): Promise<Response> {
  const context: ProxyRequestContext = {
    requestId: createRequestId(),
    startTime: Date.now(),
    retryCount: 0,
  };

  // Normalize path - remove duplicate /v1 prefix and tool-specific prefixes
  let normalizedPath = path;

  // Remove tool-specific prefixes
  if (path.startsWith("/claude/")) {
    normalizedPath = path.replace("/claude", "");
  } else if (path.startsWith("/openai/")) {
    normalizedPath = path.replace("/openai", "");
  }

  // Fix duplicate /v1/v1 -> /v1 (when client already adds /v1)
  if (normalizedPath.startsWith("/v1/v1/")) {
    normalizedPath = normalizedPath.replace("/v1/v1/", "/v1/");
  }

  // Parse request body
  let body: unknown;
  const contentType = req.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: { message: "Invalid JSON body", type: "invalid_request" } },
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  // Detect request format
  const needsAnthropicConversion = isAnthropicRequest(body);
  const needsResponsesAPIConversion = isResponsesAPIRequest(body);
  let processedBody = body;
  let isStreaming = false;
  let responseFormat: "anthropic" | "responses" | "openai" = "openai";

  // Extract and map model from request
  const originalModel = extractModel(body);
  const mappedModel = mapModel(
    originalModel,
    config.modelMapping,
    config.defaultModel,
    config.providers,
  );

  // Convert Anthropic request to OpenAI format if needed
  if (needsAnthropicConversion && body && typeof body === "object") {
    const anthropicBody = body as Record<string, unknown>;
    anthropicBody.model = mappedModel || originalModel;
    isStreaming = anthropicBody.stream === true;
    responseFormat = "anthropic";

    processedBody = anthropicToOpenAIRequest(anthropicBody as any);

    // Also convert the path from Anthropic to OpenAI endpoint
    if (normalizedPath === "/v1/messages" || normalizedPath === "/messages") {
      normalizedPath = "/v1/chat/completions";
    }

    if (logger) {
      console.log(
        `[${context.requestId}] Converting Anthropic -> OpenAI format (path: ${normalizedPath})`,
      );
    }
  } else if (needsResponsesAPIConversion && body && typeof body === "object") {
    const responsesBody = body as Record<string, unknown>;
    responsesBody.model = mappedModel || originalModel;
    isStreaming = responsesBody.stream === true;

    // Check if this model should passthrough Responses API without conversion
    const passthroughModels = config.passthroughResponsesAPI ?? [];
    const shouldPassthrough = passthroughModels.some((pattern: string) => {
      if (pattern.endsWith("*")) {
        return String(responsesBody.model).startsWith(pattern.slice(0, -1));
      }
      return responsesBody.model === pattern;
    });

    if (shouldPassthrough) {
      // Passthrough: keep Responses API format, don't convert
      responseFormat = "openai"; // Don't convert response either
      processedBody = responsesBody;

      if (logger) {
        console.log(
          `[${context.requestId}] Responses API passthrough (native support): model=${toLogString(responsesBody.model)}`,
        );
      }
    } else {
      // Convert Responses API request to OpenAI Chat Completions format
      responseFormat = "responses";

      if (logger) {
        const modelLabel = toLogString(responsesBody.model);
        console.log(
          `[${context.requestId}] Responses API request: stream=${isStreaming}, model=${modelLabel}`,
        );
        // Log tools if present
        if (responsesBody.tools) {
          const tools = responsesBody.tools as unknown[];
          console.log(`[${context.requestId}] Tools count: ${tools.length}`);
          tools.slice(0, 5).forEach((t, i) => {
            const tool = t as Record<string, unknown>;
            const toolType = toLogString(tool.type);
            const toolName = toLogString(
              (tool as any).function?.name ?? (tool as any).name ?? "N/A",
            );
            console.log(
              `[${context.requestId}] Tool[${i}]: type=${toolType}, name=${toolName}, keys=${Object.keys(tool).join(",")}`,
            );
          });
        } else {
          console.log(`[${context.requestId}] No tools in request`);
        }
      }

      processedBody = responsesAPIToOpenAIRequest(responsesBody as any);

      // Convert path from Responses API to Chat Completions
      if (
        normalizedPath === "/v1/responses" ||
        normalizedPath === "/responses"
      ) {
        normalizedPath = "/v1/chat/completions";
      }

      if (logger) {
        console.log(
          `[${context.requestId}] Converting Responses API -> OpenAI format (path: ${normalizedPath})`,
        );
        // Log converted tools
        const convertedTools = (processedBody as any)?.tools;
        if (convertedTools) {
          console.log(
            `[${context.requestId}] Converted tools count: ${convertedTools.length}`,
          );
        } else {
          console.log(`[${context.requestId}] No tools after conversion`);
        }
      }
    }
  } else if (
    body &&
    typeof body === "object" &&
    mappedModel &&
    mappedModel !== originalModel
  ) {
    // Just update model for non-Anthropic requests
    (body as Record<string, unknown>).model = mappedModel;
    processedBody = body;
    isStreaming = (body as Record<string, unknown>).stream === true;
  }

  // Use mapped model for provider selection
  const requestedModel = mappedModel;

  // Try providers with retry
  const maxRetries =
    config.keyRotation?.enabled !== false ? config.providers.length * 2 : 1;
  let lastError: Response | null = null;

  while (context.retryCount < maxRetries) {
    // Select provider
    const provider = selectProviderForModel(
      config.providers,
      loadBalancer,
      requestedModel,
    );

    if (!provider) {
      return Response.json(
        {
          error: {
            message: "No available providers",
            type: "service_unavailable",
          },
        },
        { status: 503, headers: corsHeaders() },
      );
    }

    context.provider = provider.name;

    // Get all API keys for this provider
    const providerApiKeys = getProviderApiKeys(provider);

    // Select API key
    const state = loadBalancer.getProviderState(provider.name);
    const apiKey = state
      ? loadBalancer.selectKey({ ...provider, apiKeys: providerApiKeys }, state)
      : providerApiKeys[0];

    if (!apiKey) {
      context.retryCount++;
      continue;
    }

    const keyIndex = providerApiKeys.indexOf(apiKey);
    context.keyIndex = keyIndex;

    if (logger) {
      if (mappedModel && mappedModel !== originalModel) {
        console.log(
          `[${context.requestId}] Model mapped: ${originalModel ?? "unknown"} -> ${mappedModel} (provider: ${provider.name})`,
        );
      }

      console.log(
        `[${context.requestId}] -> ${provider.name} (key ${keyIndex + 1}/${providerApiKeys.length})`,
      );
    }

    try {
      const response = await forwardRequest(
        req,
        provider,
        apiKey,
        normalizedPath,
        processedBody,
      );

      if (response.ok) {
        loadBalancer.reportSuccess(provider.name, keyIndex);

        if (logger) {
          const duration = Date.now() - context.startTime;
          console.log(
            `[${context.requestId}] <- ${response.status} (${duration}ms)`,
          );
        }

        // Convert response back to original format if needed
        if (responseFormat === "anthropic") {
          return await convertAnthropicResponse(
            response,
            originalModel || "unknown",
            isStreaming,
            logger,
            context.requestId,
          );
        }

        if (responseFormat === "responses") {
          return await convertResponsesAPIResponse(
            response,
            originalModel || "unknown",
            isStreaming,
            logger,
            context.requestId,
          );
        }

        return addCorsHeaders(response);
      }

      // Handle error response
      const errorBody = await response
        .clone()
        .json()
        .catch(() => null);
      const error = classifyError(response.status, errorBody);

      loadBalancer.reportError(provider.name, keyIndex, error);

      if (logger) {
        console.log(
          `[${context.requestId}] Error: ${error.type} - ${error.message}`,
        );
      }

      // If retryable and key rotation enabled, try next
      if (error.retryable && config.keyRotation?.onError !== false) {
        context.retryCount++;
        lastError = response;
        continue;
      }

      return addCorsHeaders(response);
    } catch (err) {
      const error = classifyError(0, undefined, err as Error);
      loadBalancer.reportError(provider.name, keyIndex, error);

      if (logger) {
        console.log(`[${context.requestId}] Network error: ${error.message}`);
      }

      if (error.retryable) {
        context.retryCount++;
        continue;
      }

      return Response.json(
        { error: { message: error.message, type: error.type } },
        { status: 502, headers: corsHeaders() },
      );
    }
  }

  // All retries exhausted
  if (lastError) {
    return addCorsHeaders(lastError);
  }

  return Response.json(
    {
      error: {
        message: "All providers failed after retries",
        type: "service_unavailable",
      },
    },
    { status: 503, headers: corsHeaders() },
  );
}

/**
 * Forward request to upstream provider
 */
async function forwardRequest(
  originalReq: Request,
  provider: ProxyProviderConfig,
  apiKey: string,
  path: string,
  body: unknown,
): Promise<Response> {
  // Build URL, avoiding duplicate /v1 prefix
  // If baseUrl ends with /v1 and path starts with /v1, remove the duplicate
  let baseUrl = provider.baseUrl.replace(/\/+$/, ""); // Remove trailing slashes
  let finalPath = path;

  if (baseUrl.endsWith("/v1") && path.startsWith("/v1/")) {
    finalPath = path.slice(3); // Remove leading /v1
  }

  const url = `${baseUrl}${finalPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Add custom headers from provider config
  if (provider.headers) {
    Object.assign(headers, provider.headers);
  }

  // Forward specific headers from original request
  const forwardHeaders = ["accept", "accept-encoding", "x-request-id"];
  for (const header of forwardHeaders) {
    const value = originalReq.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  }

  const fetchOptions: RequestInit = {
    method: originalReq.method,
    headers,
  };

  if (body && originalReq.method !== "GET" && originalReq.method !== "HEAD") {
    fetchOptions.body = JSON.stringify(body);
  }

  // Add timeout if configured
  if (provider.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  return fetch(url, fetchOptions);
}

/**
 * Extract model from request body
 */
function extractModel(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.model === "string") return obj.model;
  return undefined;
}

/**
 * Check whether a provider model is compatible with the requested model.
 * Supports both directions so versioned aliases still match (e.g. foo-2025
 * matches foo and foo matches foo-2025).
 */
function providerSupportsModel(
  provider: ProviderConfig,
  model: string,
): boolean {
  return provider.models.some(
    (providerModel) =>
      providerModel === model ||
      model.startsWith(providerModel) ||
      providerModel.startsWith(model),
  );
}

/**
 * Map model name using modelMapping config
 * Supports exact match, prefix match (claude-* -> gpt-4o), and wildcard (*)
 */
function mapModel(
  model: string | undefined,
  mapping?: Record<string, string>,
  defaultModel?: string,
  providers?: ProviderConfig[],
): string | undefined {
  if (!model) return defaultModel;

  // Short-circuit when no mapping is configured
  if (!mapping || Object.keys(mapping).length === 0) {
    return model;
  }

  // Resolve mapping (exact -> prefix -> wildcard) regardless of provider support
  if (mapping[model]) {
    return mapping[model];
  }

  for (const [pattern, target] of Object.entries(mapping)) {
    if (pattern === "*") continue;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (model.startsWith(prefix)) {
        return target;
      }
    }
  }

  // If no mapping matched, keep the original when supported; otherwise fallback
  const supported = providers?.some((provider) =>
    providerSupportsModel(provider, model),
  );
  if (supported) {
    return model;
  }

  if (mapping["*"]) {
    return mapping["*"];
  }

  return defaultModel ?? model;
}

/**
 * Convert OpenAI response to Anthropic format
 */
async function convertAnthropicResponse(
  response: Response,
  originalModel: string,
  isStreaming: boolean,
  logger: boolean,
  requestId: string,
): Promise<Response> {
  if (isStreaming) {
    // Transform streaming response
    if (logger) {
      console.log(
        `[${requestId}] Converting streaming response OpenAI -> Anthropic`,
      );
    }

    const transformer = createStreamTransformer(originalModel);
    const transformedStream = response.body?.pipeThrough(transformer);

    return new Response(transformedStream, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Transform non-streaming response
  try {
    const responseText = await response.text();
    let openAIResponse: unknown;

    try {
      openAIResponse = JSON.parse(responseText);
    } catch {
      // If not JSON, wrap in a simple response
      if (logger) {
        console.log(`[${requestId}] Response is not JSON, wrapping as text`);
      }
      openAIResponse = { content: responseText };
    }

    if (logger) {
      console.log(
        `[${requestId}] Response type: ${typeof openAIResponse}, keys: ${Object.keys(openAIResponse as object).join(", ")}`,
      );
    }

    const anthropicResponse = openAIToAnthropicResponse(
      openAIResponse,
      originalModel,
    );

    if (logger) {
      console.log(`[${requestId}] Converted response OpenAI -> Anthropic`);
    }

    return Response.json(anthropicResponse, {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    // If conversion fails, return original response
    console.error(`[${requestId}] Response conversion failed:`, err);
    // Return a valid Anthropic error response
    return Response.json(
      {
        type: "error",
        error: {
          type: "api_error",
          message: `Response conversion failed: ${(err as Error).message}`,
        },
      },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * Convert OpenAI response to Responses API format
 */
async function convertResponsesAPIResponse(
  response: Response,
  originalModel: string,
  isStreaming: boolean,
  logger: boolean,
  requestId: string,
): Promise<Response> {
  if (isStreaming) {
    // Transform streaming response
    if (logger) {
      console.log(
        `[${requestId}] Converting streaming response OpenAI -> Responses API`,
      );
    }

    const transformer = createResponsesAPIStreamTransformer(originalModel);
    const transformedStream = response.body?.pipeThrough(transformer);

    return new Response(transformedStream, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Transform non-streaming response
  try {
    const responseText = await response.text();
    let openAIResponse: unknown;

    try {
      openAIResponse = JSON.parse(responseText);
    } catch {
      // If not JSON, wrap in a simple response
      if (logger) {
        console.log(`[${requestId}] Response is not JSON, wrapping as text`);
      }
      openAIResponse = { content: responseText };
    }

    if (logger) {
      console.log(
        `[${requestId}] Response type: ${typeof openAIResponse}, keys: ${Object.keys(openAIResponse as object).join(", ")}`,
      );
    }

    const responsesAPIResponse = openAIToResponsesAPIResponse(
      openAIResponse,
      originalModel,
    );

    if (logger) {
      console.log(`[${requestId}] Converted response OpenAI -> Responses API`);
    }

    return Response.json(responsesAPIResponse, {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    // If conversion fails, return error response
    console.error(`[${requestId}] Response conversion failed:`, err);
    return Response.json(
      {
        id: `resp_${Date.now()}`,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model: originalModel,
        output: [],
        status: "failed",
        error: {
          code: "api_error",
          message: `Response conversion failed: ${(err as Error).message}`,
        },
      },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * Select provider for the requested model
 */
function selectProviderForModel(
  providers: ProviderConfig[],
  loadBalancer: ProxyLoadBalancer,
  model?: string,
): ProviderConfig | null {
  // Normalize providers to have apiKeys array
  const normalizedProviders = providers.map((p) => ({
    ...p,
    apiKeys: getProviderApiKeys(p),
  }));

  // If model specified with provider prefix (e.g., "openai,gpt-4")
  if (model?.includes(",")) {
    const [providerName] = model.split(",");
    const provider = normalizedProviders.find((p) => p.name === providerName);
    if (provider) return provider;
  }

  // If model specified, filter providers that support it
  if (model) {
    const supportingProviders = normalizedProviders.filter((p) =>
      providerSupportsModel(p, model),
    );
    if (supportingProviders.length > 0) {
      return loadBalancer.selectProvider(supportingProviders);
    }
  }

  // Default: use load balancer to select from all providers
  return loadBalancer.selectProvider(normalizedProviders);
}

/**
 * CORS headers
 */
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Build OpenAI-compatible models list response
 */
function buildModelsResponse(providers: ProviderConfig[]): {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
} {
  const now = Math.floor(Date.now() / 1000);
  const models: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }> = [];

  // Collect unique models from all providers
  const seenModels = new Set<string>();

  for (const provider of providers) {
    for (const model of provider.models) {
      // Add model with provider prefix for explicit routing
      const prefixedId = `${provider.name},${model}`;
      if (!seenModels.has(prefixedId)) {
        seenModels.add(prefixedId);
        models.push({
          id: prefixedId,
          object: "model",
          created: now,
          owned_by: provider.name,
        });
      }

      // Also add the raw model name (first provider wins)
      if (!seenModels.has(model)) {
        seenModels.add(model);
        models.push({
          id: model,
          object: "model",
          created: now,
          owned_by: provider.name,
        });
      }
    }
  }

  return {
    object: "list",
    data: models,
  };
}

// Expose mapping helpers for testing
export { mapModel, selectProviderForModel, providerSupportsModel };
