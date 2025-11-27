/**
 * API format transformer
 * Converts between Anthropic and OpenAI API formats
 */

// ============================================================================
// Type Definitions
// ============================================================================

// Anthropic Types
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  metadata?: Record<string, unknown>;
  tools?: AnthropicTool[];
  tool_choice?: { type: string; name?: string } | string;
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// OpenAI Types
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  n?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
}

interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Streaming Types
interface OpenAIStreamToolCall {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: OpenAIStreamToolCall[];
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
}

// ============================================================================
// Request Transformation: Anthropic -> OpenAI
// ============================================================================

/**
 * Convert Anthropic request to OpenAI format
 */
export function anthropicToOpenAIRequest(anthropicReq: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Add system message if present
  if (anthropicReq.system) {
    messages.push({
      role: "system",
      content: anthropicReq.system,
    });
  }

  // Convert messages
  for (const msg of anthropicReq.messages) {
    const converted = convertAnthropicMessage(msg);
    if (Array.isArray(converted)) {
      messages.push(...converted);
    } else if (converted) {
      messages.push(converted);
    }
  }

  const openAIReq: OpenAIRequest = {
    model: anthropicReq.model,
    messages,
    stream: anthropicReq.stream,
  };

  if (anthropicReq.max_tokens) {
    openAIReq.max_tokens = anthropicReq.max_tokens;
  }

  if (anthropicReq.temperature !== undefined) {
    openAIReq.temperature = anthropicReq.temperature;
  }

  if (anthropicReq.top_p !== undefined) {
    openAIReq.top_p = anthropicReq.top_p;
  }

  if (anthropicReq.stop_sequences) {
    openAIReq.stop = anthropicReq.stop_sequences;
  }

  // Convert tools
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    openAIReq.tools = convertAnthropicTools(anthropicReq.tools);
  }

  // Convert tool_choice
  if (anthropicReq.tool_choice) {
    openAIReq.tool_choice = convertToolChoice(anthropicReq.tool_choice);
  }

  return openAIReq;
}

/**
 * Convert Anthropic tools to OpenAI format
 */
function convertAnthropicTools(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: cleanJsonSchema(tool.input_schema),
    },
  }));
}

/**
 * Clean JSON schema for OpenAI compatibility
 * Remove unsupported fields
 */
function cleanJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...schema };

  // Remove unsupported fields
  delete cleaned.$schema;
  delete cleaned.title;
  delete cleaned.examples;

  // Recursively clean nested properties
  if (cleaned.properties && typeof cleaned.properties === "object") {
    const props = cleaned.properties as Record<string, Record<string, unknown>>;
    for (const key of Object.keys(props)) {
      if (props[key] && typeof props[key] === "object") {
        props[key] = cleanJsonSchema(props[key]);
        // Remove format for string types (not well supported)
        if (props[key].type === "string") {
          delete props[key].format;
        }
      }
    }
  }

  return cleaned;
}

/**
 * Convert Anthropic tool_choice to OpenAI format
 */
function convertToolChoice(
  choice: { type: string; name?: string } | string,
): OpenAIRequest["tool_choice"] {
  if (typeof choice === "string") {
    if (choice === "auto") return "auto";
    if (choice === "none") return "none";
    if (choice === "any" || choice === "required") return "required";
    return "auto";
  }

  if (choice.type === "auto") return "auto";
  if (choice.type === "none") return "none";
  if (choice.type === "any") return "required";
  if (choice.type === "tool" && choice.name) {
    return { type: "function", function: { name: choice.name } };
  }

  return "auto";
}

function convertAnthropicMessage(msg: AnthropicMessage): OpenAIMessage | OpenAIMessage[] | null {
  if (typeof msg.content === "string") {
    return {
      role: msg.role,
      content: msg.content,
    };
  }

  // Handle content blocks
  const textParts: string[] = [];
  const imageParts: OpenAIContentPart[] = [];
  const toolUses: AnthropicContentBlock[] = [];
  const toolResults: AnthropicContentBlock[] = [];

  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "image" && block.source) {
      imageParts.push({
        type: "image_url",
        image_url: {
          url: `data:${block.source.media_type};base64,${block.source.data}`,
        },
      });
    } else if (block.type === "tool_use") {
      toolUses.push(block);
    } else if (block.type === "tool_result") {
      toolResults.push(block);
    }
  }

  // Handle tool_result messages (user role with tool results)
  if (toolResults.length > 0) {
    return toolResults.map((result) => ({
      role: "tool" as const,
      tool_call_id: result.tool_use_id || "",
      content: typeof result.content === "string" ? result.content : JSON.stringify(result.content),
    }));
  }

  // Handle assistant messages with tool_use
  if (msg.role === "assistant" && toolUses.length > 0) {
    const toolCalls: OpenAIToolCall[] = toolUses.map((tool) => ({
      id: tool.id || `call_${Date.now()}`,
      type: "function" as const,
      function: {
        name: tool.name || "",
        arguments: JSON.stringify(tool.input || {}),
      },
    }));

    return {
      role: "assistant",
      content: textParts.length > 0 ? textParts.join("\n") : null,
      tool_calls: toolCalls,
    };
  }

  // If only text, return simple string content
  if (imageParts.length === 0) {
    return {
      role: msg.role,
      content: textParts.join("\n"),
    };
  }

  // If has images, return content parts
  const contentParts: OpenAIContentPart[] = [];
  if (textParts.length > 0) {
    contentParts.push({ type: "text", text: textParts.join("\n") });
  }
  contentParts.push(...imageParts);

  return {
    role: msg.role,
    content: contentParts,
  };
}

// ============================================================================
// Response Transformation: OpenAI -> Anthropic
// ============================================================================

/**
 * Convert OpenAI response to Anthropic format
 */
export function openAIToAnthropicResponse(
  openAIRes: unknown,
  originalModel: string,
): AnthropicResponse {
  // Handle various response formats
  const res = openAIRes as Record<string, unknown>;

  // If already in Anthropic format, return as-is
  if (res.type === "message" && res.content) {
    return res as unknown as AnthropicResponse;
  }

  // Handle OpenAI format
  const choices = res.choices as OpenAIChoice[] | undefined;
  const choice = choices?.[0];
  const content: AnthropicContentBlock[] = [];

  // Try to extract text content from various formats
  if (choice?.message?.content) {
    content.push({
      type: "text",
      text: choice.message.content,
    });
  } else if (typeof res.content === "string") {
    // Some APIs return content directly
    content.push({
      type: "text",
      text: res.content,
    });
  } else if (res.text) {
    // Legacy format
    content.push({
      type: "text",
      text: String(res.text),
    });
  } else if (res.message) {
    // Another common format
    const msg = res.message as Record<string, unknown>;
    if (msg.content) {
      content.push({
        type: "text",
        text: String(msg.content),
      });
    }
  }

  // Convert tool_calls to tool_use blocks
  if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
    for (const toolCall of choice.message.tool_calls) {
      let input: unknown = {};
      try {
        input = JSON.parse(toolCall.function.arguments);
      } catch {
        input = { raw: toolCall.function.arguments };
      }

      content.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input,
      });
    }
  }

  // If still no content, add empty text block
  if (content.length === 0) {
    content.push({
      type: "text",
      text: "",
    });
  }

  // Map finish_reason to stop_reason
  let stopReason: AnthropicResponse["stop_reason"] = "end_turn";
  if (choice?.finish_reason) {
    switch (choice.finish_reason) {
      case "stop":
        stopReason = "end_turn";
        break;
      case "length":
        stopReason = "max_tokens";
        break;
      case "tool_calls":
        stopReason = "tool_use";
        break;
      default:
        stopReason = "end_turn";
    }
  }

  // Extract usage info
  const usage = res.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

  return {
    id: (res.id as string) || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content,
    model: originalModel,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  };
}

// ============================================================================
// Streaming Transformation
// ============================================================================

// Tool call accumulator for streaming
interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Transform OpenAI SSE stream to Anthropic SSE stream
 */
export function createStreamTransformer(originalModel: string): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const messageId = `msg_${Date.now()}`;
  let inputTokens = 0;
  let outputTokens = 0;
  let sentStart = false;
  let sentTextBlockStart = false;
  let currentBlockIndex = 0;
  const toolCallAccumulators: Map<number, ToolCallAccumulator> = new Map();
  let hasTextContent = false;

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();

        if (data === "[DONE]") {
          // Emit any accumulated tool calls before finishing
          emitAccumulatedToolCalls(controller, encoder, toolCallAccumulators, currentBlockIndex);

          // Send message_stop event
          const stopEvent = { type: "message_stop" };
          controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`));
          continue;
        }

        try {
          const streamChunk = JSON.parse(data) as OpenAIStreamChunk;

          // Send message_start on first chunk
          if (!sentStart) {
            sentStart = true;
            const startEvent = {
              type: "message_start",
              message: {
                id: messageId,
                type: "message",
                role: "assistant",
                content: [],
                model: originalModel,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: inputTokens, output_tokens: outputTokens },
              },
            };
            controller.enqueue(encoder.encode(`event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`));
          }

          const delta = streamChunk.choices[0]?.delta;

          // Handle text content
          if (delta?.content) {
            hasTextContent = true;

            // Send text block start if not sent
            if (!sentTextBlockStart) {
              sentTextBlockStart = true;
              const blockStartEvent = {
                type: "content_block_start",
                index: currentBlockIndex,
                content_block: { type: "text", text: "" },
              };
              controller.enqueue(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`));
            }

            outputTokens += Math.ceil(delta.content.length / 4);

            const deltaEvent = {
              type: "content_block_delta",
              index: currentBlockIndex,
              delta: { type: "text_delta", text: delta.content },
            };
            controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`));
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            // Close text block if we had one
            if (sentTextBlockStart && hasTextContent) {
              const blockStopEvent = { type: "content_block_stop", index: currentBlockIndex };
              controller.enqueue(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`));
              currentBlockIndex++;
              sentTextBlockStart = false;
            }

            for (const toolCall of delta.tool_calls) {
              const tcIndex = toolCall.index ?? 0;

              if (!toolCallAccumulators.has(tcIndex)) {
                toolCallAccumulators.set(tcIndex, { id: "", name: "", arguments: "" });
              }

              const acc = toolCallAccumulators.get(tcIndex)!;

              if (toolCall.id) acc.id = toolCall.id;
              if (toolCall.function?.name) acc.name = toolCall.function.name;
              if (toolCall.function?.arguments) acc.arguments += toolCall.function.arguments;
            }
          }

          // Check for finish
          if (streamChunk.choices[0]?.finish_reason) {
            const finishReason = streamChunk.choices[0].finish_reason;

            // Close text block if open
            if (sentTextBlockStart) {
              const blockStopEvent = { type: "content_block_stop", index: currentBlockIndex };
              controller.enqueue(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`));
              currentBlockIndex++;
            }

            // Emit accumulated tool calls
            if (finishReason === "tool_calls" || toolCallAccumulators.size > 0) {
              emitAccumulatedToolCalls(controller, encoder, toolCallAccumulators, currentBlockIndex);
            }

            // Send message_delta with stop_reason
            let stopReason: string = "end_turn";
            if (finishReason === "length") {
              stopReason = "max_tokens";
            } else if (finishReason === "tool_calls") {
              stopReason = "tool_use";
            }

            const messageDeltaEvent = {
              type: "message_delta",
              delta: { stop_reason: stopReason, stop_sequence: null },
              usage: { output_tokens: outputTokens },
            };
            controller.enqueue(encoder.encode(`event: message_delta\ndata: ${JSON.stringify(messageDeltaEvent)}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
      }
    },

    flush() {
      // Process any remaining buffer - handled in [DONE]
    },
  });
}

/**
 * Emit accumulated tool calls as Anthropic tool_use blocks
 */
function emitAccumulatedToolCalls(
  controller: TransformStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  accumulators: Map<number, ToolCallAccumulator>,
  startIndex: number,
): void {
  let index = startIndex;

  for (const [, acc] of accumulators) {
    if (!acc.id || !acc.name) continue;

    let input: unknown = {};
    try {
      input = JSON.parse(acc.arguments || "{}");
    } catch {
      input = { raw: acc.arguments };
    }

    // Send content_block_start for tool_use
    const blockStartEvent = {
      type: "content_block_start",
      index,
      content_block: {
        type: "tool_use",
        id: acc.id,
        name: acc.name,
        input: {},
      },
    };
    controller.enqueue(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`));

    // Send content_block_delta with input
    const deltaEvent = {
      type: "content_block_delta",
      index,
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify(input),
      },
    };
    controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`));

    // Send content_block_stop
    const blockStopEvent = { type: "content_block_stop", index };
    controller.enqueue(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`));

    index++;
  }

  accumulators.clear();
}

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Check if request is in Anthropic format
 */
export function isAnthropicRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;

  // Anthropic requests typically have these characteristics:
  // - messages array with role: "user" | "assistant"
  // - may have "system" as top-level field
  // - max_tokens is required in Anthropic
  // - no "n" parameter (OpenAI specific)

  if (obj.system !== undefined) return true;
  if (obj.stop_sequences !== undefined) return true;
  if (obj.top_k !== undefined) return true;

  return false;
}

/**
 * Check if response is in OpenAI format
 */
export function isOpenAIResponse(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;

  return obj.object === "chat.completion" || obj.object === "chat.completion.chunk";
}

// ============================================================================
// OpenAI Responses API Support (/v1/responses)
// ============================================================================

/**
 * OpenAI Responses API request format
 */
interface ResponsesAPIRequest {
  model: string;
  input: string | ResponsesAPIInputItem[];
  instructions?: string;
  tools?: ResponsesAPITool[];
  temperature?: number;
  max_output_tokens?: number;
  stream?: boolean;
  previous_response_id?: string;
  reasoning?: {
    effort?: "low" | "medium" | "high";
  };
}

interface ResponsesAPIInputItem {
  type?: "message" | "item_reference" | "function_call" | "function_call_output";
  role?: "user" | "assistant" | "system" | "developer";
  content?: string | ResponsesAPIContentPart[];
  id?: string;
  // For function_call type
  call_id?: string;
  name?: string;
  arguments?: string;
  // For function_call_output type
  output?: string;
}

interface ResponsesAPIContentPart {
  type: "input_text" | "input_image" | "input_file";
  text?: string;
  image_url?: string;
  file_id?: string;
}

interface ResponsesAPITool {
  type: "function" | "web_search" | "file_search" | "computer_use";
  // Nested format (OpenAI standard)
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  // Flat format (Codex style)
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * OpenAI Responses API response format
 */
interface ResponsesAPIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: ResponsesAPIOutputItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  status: "completed" | "failed" | "in_progress" | "incomplete";
  error?: {
    code: string;
    message: string;
  };
}

interface ResponsesAPIOutputItem {
  type: "message";
  role: "assistant";
  content: ResponsesAPIOutputContent[];
}

interface ResponsesAPIOutputContent {
  type: "output_text" | "input_text";
  text: string;
}

/**
 * Check if request is in OpenAI Responses API format
 */
export function isResponsesAPIRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;

  // Responses API uses "input" instead of "messages"
  // and may have "instructions" instead of system message
  return obj.input !== undefined || obj.instructions !== undefined || obj.previous_response_id !== undefined;
}

/**
 * Convert OpenAI Responses API request to OpenAI Chat Completions format
 */
export function responsesAPIToOpenAIRequest(req: ResponsesAPIRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Add instructions as system message
  if (req.instructions) {
    messages.push({
      role: "system",
      content: req.instructions,
    });
  }

  // Convert input to messages
  if (typeof req.input === "string") {
    // Simple string input -> single user message
    messages.push({
      role: "user",
      content: req.input,
    });
  } else if (Array.isArray(req.input)) {
    // Track pending tool calls to merge with next message
    let pendingToolCalls: OpenAIToolCall[] = [];

    // Array of input items
    for (const item of req.input) {
      if (item.type === "item_reference") {
        // Skip item references (used for previous_response_id)
        continue;
      }

      // Handle function_call items (assistant's tool calls)
      if (item.type === "function_call") {
        pendingToolCalls.push({
          id: item.call_id || `call_${Date.now()}`,
          type: "function",
          function: {
            name: item.name || "",
            arguments: item.arguments || "{}",
          },
        });
        continue;
      }

      // Handle function_call_output items (tool results)
      if (item.type === "function_call_output") {
        // If we have pending tool calls, emit assistant message first
        if (pendingToolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: pendingToolCalls,
          });
          pendingToolCalls = [];
        }

        messages.push({
          role: "tool",
          tool_call_id: item.call_id || "",
          content: item.output || "",
        });
        continue;
      }

      // If we have pending tool calls and this is a message, emit assistant message first
      if (pendingToolCalls.length > 0 && item.type === "message") {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: pendingToolCalls,
        });
        pendingToolCalls = [];
      }

      const role = item.role === "developer" ? "system" : (item.role || "user");

      if (typeof item.content === "string") {
        messages.push({
          role: role as "system" | "user" | "assistant",
          content: item.content,
        });
      } else if (Array.isArray(item.content)) {
        // Handle content parts
        const contentParts: OpenAIContentPart[] = [];
        for (const part of item.content) {
          if (part.type === "input_text" && part.text) {
            contentParts.push({ type: "text", text: part.text });
          } else if (part.type === "input_image" && part.image_url) {
            contentParts.push({
              type: "image_url",
              image_url: { url: part.image_url },
            });
          }
        }
        if (contentParts.length > 0) {
          messages.push({
            role: role as "system" | "user" | "assistant",
            content: contentParts,
          });
        }
      }
    }

    // Emit any remaining pending tool calls
    if (pendingToolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: pendingToolCalls,
      });
    }
  }

  const openAIReq: OpenAIRequest = {
    model: req.model,
    messages,
    stream: req.stream,
  };

  if (req.temperature !== undefined) {
    openAIReq.temperature = req.temperature;
  }

  if (req.max_output_tokens !== undefined) {
    openAIReq.max_tokens = req.max_output_tokens;
  }

  // Convert tools - handle both nested and flat formats
  if (req.tools && req.tools.length > 0) {
    const convertedTools: OpenAITool[] = [];

    for (const tool of req.tools) {
      // Skip non-function tools (web_search, file_search, computer_use)
      if (tool.type !== "function") continue;

      // Handle nested format: { type: "function", function: { name, description, parameters } }
      if (tool.function) {
        convertedTools.push({
          type: "function",
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters || {},
          },
        });
      }
      // Handle flat format: { type: "function", name, description, parameters }
      else if (tool.name) {
        convertedTools.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || {},
          },
        });
      }
    }

    if (convertedTools.length > 0) {
      openAIReq.tools = convertedTools;
    }
  }

  return openAIReq;
}

/**
 * Responses API output item (can be message or function_call)
 */
type ResponsesOutputItem = ResponsesAPIOutputItem | ResponsesFunctionCallItem;

interface ResponsesFunctionCallItem {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Convert OpenAI Chat Completions response to Responses API format
 */
export function openAIToResponsesAPIResponse(
  openAIRes: unknown,
  originalModel: string,
): ResponsesAPIResponse {
  const res = openAIRes as Record<string, unknown>;
  const choices = res.choices as OpenAIChoice[] | undefined;
  const choice = choices?.[0];

  const output: ResponsesOutputItem[] = [];

  // Handle tool calls (function calls)
  if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
    for (const toolCall of choice.message.tool_calls) {
      output.push({
        type: "function_call",
        call_id: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
    }
  }

  // Handle text content
  if (choice?.message?.content) {
    const outputContent: ResponsesAPIOutputContent[] = [{
      type: "output_text",
      text: choice.message.content,
    }];

    output.push({
      type: "message",
      role: "assistant",
      content: outputContent,
    });
  }

  // If no output, add empty message
  if (output.length === 0) {
    output.push({
      type: "message",
      role: "assistant",
      content: [],
    });
  }

  // Extract usage info
  const usage = res.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  return {
    id: (res.id as string) || `resp_${Date.now()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: originalModel,
    output: output as ResponsesAPIOutputItem[],
    usage: usage ? {
      input_tokens: usage.prompt_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
    } : undefined,
    status: "completed",
  };
}

/**
 * Tool call accumulator for streaming
 */
interface StreamToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Create stream transformer for Responses API format
 * Converts OpenAI SSE stream to Responses API SSE stream
 */
export function createResponsesAPIStreamTransformer(originalModel: string): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const responseId = `resp_${Date.now()}`;
  let sentCreated = false;
  let sentMessageItem = false;
  let textBuffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCallAccumulators: Map<number, StreamToolCallAccumulator> = new Map();
  let outputIndex = 0;

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();

        if (data === "[DONE]") {
          // Build final output array
          const finalOutput: unknown[] = [];

          // Add tool calls first
          for (const [, acc] of toolCallAccumulators) {
            if (acc.id && acc.name) {
              finalOutput.push({
                type: "function_call",
                call_id: acc.id,
                name: acc.name,
                arguments: acc.arguments,
              });
            }
          }

          // Add message if there's text content
          if (textBuffer) {
            finalOutput.push({
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: textBuffer }],
            });
          }

          // Send response.completed event
          const completedEvent = {
            type: "response.completed",
            response: {
              id: responseId,
              object: "response",
              created_at: Math.floor(Date.now() / 1000),
              model: originalModel,
              output: finalOutput,
              usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
              },
              status: "completed",
            },
          };
          controller.enqueue(encoder.encode(`event: response.completed\ndata: ${JSON.stringify(completedEvent)}\n\n`));
          continue;
        }

        try {
          const streamChunk = JSON.parse(data) as OpenAIStreamChunk;

          // Send response.created on first chunk
          if (!sentCreated) {
            sentCreated = true;
            const createdEvent = {
              type: "response.created",
              response: {
                id: responseId,
                object: "response",
                created_at: Math.floor(Date.now() / 1000),
                model: originalModel,
                output: [],
                status: "in_progress",
              },
            };
            controller.enqueue(encoder.encode(`event: response.created\ndata: ${JSON.stringify(createdEvent)}\n\n`));
          }

          const delta = streamChunk.choices[0]?.delta;

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const tcIndex = toolCall.index ?? 0;

              if (!toolCallAccumulators.has(tcIndex)) {
                toolCallAccumulators.set(tcIndex, { id: "", name: "", arguments: "" });

                // Send response.output_item.added for function_call
                const itemAddedEvent = {
                  type: "response.output_item.added",
                  output_index: outputIndex,
                  item: {
                    type: "function_call",
                    call_id: toolCall.id || "",
                    name: toolCall.function?.name || "",
                    arguments: "",
                  },
                };
                controller.enqueue(encoder.encode(`event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`));
                outputIndex++;
              }

              const acc = toolCallAccumulators.get(tcIndex)!;
              if (toolCall.id) acc.id = toolCall.id;
              if (toolCall.function?.name) acc.name = toolCall.function.name;
              if (toolCall.function?.arguments) {
                acc.arguments += toolCall.function.arguments;

                // Send response.function_call_arguments.delta
                const argsDeltaEvent = {
                  type: "response.function_call_arguments.delta",
                  output_index: tcIndex,
                  delta: toolCall.function.arguments,
                };
                controller.enqueue(encoder.encode(`event: response.function_call_arguments.delta\ndata: ${JSON.stringify(argsDeltaEvent)}\n\n`));
              }
            }
          }

          // Handle text content
          if (delta?.content) {
            // Send message item added if not sent yet
            if (!sentMessageItem) {
              sentMessageItem = true;
              const itemAddedEvent = {
                type: "response.output_item.added",
                output_index: outputIndex,
                item: {
                  type: "message",
                  role: "assistant",
                  content: [],
                },
              };
              controller.enqueue(encoder.encode(`event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`));

              // Send response.content_part.added
              const contentAddedEvent = {
                type: "response.content_part.added",
                output_index: outputIndex,
                content_index: 0,
                part: { type: "output_text", text: "" },
              };
              controller.enqueue(encoder.encode(`event: response.content_part.added\ndata: ${JSON.stringify(contentAddedEvent)}\n\n`));
            }

            textBuffer += delta.content;
            outputTokens += Math.ceil(delta.content.length / 4);

            const textDeltaEvent = {
              type: "response.output_text.delta",
              output_index: outputIndex,
              content_index: 0,
              delta: delta.content,
            };
            controller.enqueue(encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify(textDeltaEvent)}\n\n`));
          }

          // Check for finish
          if (streamChunk.choices[0]?.finish_reason) {

            // Send done events for tool calls
            for (const [tcIndex, acc] of toolCallAccumulators) {
              const itemDoneEvent = {
                type: "response.output_item.done",
                output_index: tcIndex,
                item: {
                  type: "function_call",
                  call_id: acc.id,
                  name: acc.name,
                  arguments: acc.arguments,
                },
              };
              controller.enqueue(encoder.encode(`event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`));
            }

            // Send done events for message if there's text
            if (textBuffer && sentMessageItem) {
              const textDoneEvent = {
                type: "response.output_text.done",
                output_index: outputIndex,
                content_index: 0,
                text: textBuffer,
              };
              controller.enqueue(encoder.encode(`event: response.output_text.done\ndata: ${JSON.stringify(textDoneEvent)}\n\n`));

              const contentDoneEvent = {
                type: "response.content_part.done",
                output_index: outputIndex,
                content_index: 0,
                part: { type: "output_text", text: textBuffer },
              };
              controller.enqueue(encoder.encode(`event: response.content_part.done\ndata: ${JSON.stringify(contentDoneEvent)}\n\n`));

              const itemDoneEvent = {
                type: "response.output_item.done",
                output_index: outputIndex,
                item: {
                  type: "message",
                  role: "assistant",
                  content: [{ type: "output_text", text: textBuffer }],
                },
              };
              controller.enqueue(encoder.encode(`event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`));
            }

            // Send response.completed immediately after finish_reason
            // Don't wait for [DONE] as some providers may not send it or delay it
            const finalOutput: unknown[] = [];

            // Add tool calls first
            for (const [, acc] of toolCallAccumulators) {
              if (acc.id && acc.name) {
                finalOutput.push({
                  type: "function_call",
                  call_id: acc.id,
                  name: acc.name,
                  arguments: acc.arguments,
                });
              }
            }

            // Add message if there's text content
            if (textBuffer) {
              finalOutput.push({
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: textBuffer }],
              });
            }

            const completedEvent = {
              type: "response.completed",
              response: {
                id: responseId,
                object: "response",
                created_at: Math.floor(Date.now() / 1000),
                model: originalModel,
                output: finalOutput,
                usage: {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  total_tokens: inputTokens + outputTokens,
                },
                status: "completed",
              },
            };
            controller.enqueue(encoder.encode(`event: response.completed\ndata: ${JSON.stringify(completedEvent)}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
      }
    },

    flush() {
      // Process any remaining buffer - handled in finish_reason now
    },
  });
}
