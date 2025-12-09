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

const toSafeText = (value: unknown): string => {
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
};

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
  tool_choice?:
    | "none"
    | "auto"
    | "required"
    | { type: "function"; function: { name: string } };
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
      // Reasoning/thinking content (used by o1, deepseek, etc.)
      reasoning_content?: string;
      thinking?: {
        content?: string;
        signature?: string;
      };
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
export function anthropicToOpenAIRequest(
  anthropicReq: AnthropicRequest,
): OpenAIRequest {
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
function cleanJsonSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
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

function convertAnthropicMessage(
  msg: AnthropicMessage,
): OpenAIMessage | OpenAIMessage[] | null {
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
      content:
        typeof result.content === "string"
          ? result.content
          : JSON.stringify(result.content),
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
      text: toSafeText(res.text),
    });
  } else if (res.message) {
    // Another common format
    const msg = res.message as Record<string, unknown>;
    if (msg.content) {
      content.push({
        type: "text",
        text: toSafeText(msg.content),
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
  const usage = res.usage as
    | { prompt_tokens?: number; completion_tokens?: number }
    | undefined;

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
  emitted: boolean; // Track if this tool call has been emitted
}

/**
 * Parse tool call tags from text and extract tool calls
 * Supports multiple formats:
 * 1. <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 * 2. <function_calls><invoke name="..."><parameter name="...">...</parameter></invoke></function_calls>
 */
function parseToolCallTags(text: string): {
  toolCalls: Array<{ name: string; arguments: unknown; id: string }>;
  remainingText: string;
} {
  const toolCalls: Array<{ name: string; arguments: unknown; id: string }> = [];
  let cleanText = text;

  // Format 1: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;
  while ((match = toolCallRegex.exec(text)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      toolCalls.push({
        name: json.name,
        arguments: json.arguments || {},
        id: `toolu_${Date.now()}_${toolCalls.length}`,
      });
    } catch {
      // Ignore parse errors
    }
  }
  cleanText = cleanText.replace(toolCallRegex, "");

  // Format 2: <function_calls>...<invoke name="...">...</invoke>...</function_calls>
  const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/g;
  while ((match = functionCallsRegex.exec(text)) !== null) {
    const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    let invokeMatch;
    while ((invokeMatch = invokeRegex.exec(match[1])) !== null) {
      const name = invokeMatch[1];
      const paramsContent = invokeMatch[2];
      const args: Record<string, unknown> = {};
      const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        const paramName = paramMatch[1];
        let paramValue: unknown = paramMatch[2].trim();
        // Try to parse as JSON
        try {
          paramValue = JSON.parse(paramValue as string);
        } catch {
          /* keep as string */
        }
        args[paramName] = paramValue;
      }
      toolCalls.push({
        name,
        arguments: args,
        id: `toolu_${Date.now()}_${toolCalls.length}`,
      });
    }
  }
  cleanText = cleanText.replace(functionCallsRegex, "");

  // Format 3: Unclosed <function_calls>...<invoke name="...">...</invoke>... (streaming partial)
  // This handles cases where the closing tag hasn't arrived yet
  if (
    cleanText.includes("<function_calls>") &&
    !cleanText.includes("</function_calls>")
  ) {
    const partialRegex = /<function_calls>([\s\S]*)/;
    const partialMatch = partialRegex.exec(cleanText);
    if (partialMatch) {
      const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
      let invokeMatch;
      while ((invokeMatch = invokeRegex.exec(partialMatch[1])) !== null) {
        const name = invokeMatch[1];
        const paramsContent = invokeMatch[2];
        const args: Record<string, unknown> = {};
        const paramRegex =
          /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
          const paramName = paramMatch[1];
          let paramValue: unknown = paramMatch[2].trim();
          try {
            paramValue = JSON.parse(paramValue as string);
          } catch {
            /* keep as string */
          }
          args[paramName] = paramValue;
        }
        toolCalls.push({
          name,
          arguments: args,
          id: `toolu_${Date.now()}_${toolCalls.length}`,
        });
      }
      // Remove the partial function_calls block from clean text
      cleanText = cleanText.replace(/<function_calls>[\s\S]*/, "");
    }
  }

  return { toolCalls, remainingText: cleanText.trim() };
}

/**
 * Transform OpenAI SSE stream to Anthropic SSE stream
 */
export function createStreamTransformer(
  originalModel: string,
): TransformStream<Uint8Array, Uint8Array> {
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
  let messageDeltaSent = false; // Track if message_delta has been sent
  let messageStopSent = false; // Track if message_stop has been sent
  let contentBlocksStopped = false; // Track if content blocks have been stopped
  let accumulatedText = ""; // Accumulate text to detect <tool_call> tags
  let pendingTextBuffer = ""; // Buffer for text that might be part of a tool call tag

  // Helper function to filter tool call tags from text and return safe text to emit
  const filterToolCallTags = (
    text: string,
  ): { safeText: string; pendingText: string } => {
    // Check for potential start of tool call tags
    const tagStarts = ["<tool_call>", "<function_calls>"];
    const tagEnds = ["</tool_call>", "</function_calls>"];

    let safeText = "";
    let remaining = text;

    while (remaining.length > 0) {
      // Check if we're inside a tag
      let foundTagStart = -1;
      let tagType = -1;
      for (let i = 0; i < tagStarts.length; i++) {
        const idx = remaining.indexOf(tagStarts[i]);
        if (idx !== -1 && (foundTagStart === -1 || idx < foundTagStart)) {
          foundTagStart = idx;
          tagType = i;
        }
      }

      if (foundTagStart === -1) {
        // No tag start found, check for partial tag starts
        for (const tagStart of tagStarts) {
          for (let len = 1; len < tagStart.length; len++) {
            const partial = tagStart.substring(0, len);
            if (remaining.endsWith(partial)) {
              // Potential partial tag at end, keep it pending
              safeText += remaining.substring(0, remaining.length - len);
              return { safeText, pendingText: partial };
            }
          }
        }
        // No partial tag, all text is safe
        safeText += remaining;
        return { safeText, pendingText: "" };
      }

      // Found a tag start, emit text before it
      safeText += remaining.substring(0, foundTagStart);
      remaining = remaining.substring(foundTagStart);

      // Look for the corresponding end tag
      const endTag = tagEnds[tagType];
      const endIdx = remaining.indexOf(endTag);

      if (endIdx === -1) {
        // End tag not found yet, keep everything from tag start as pending
        return { safeText, pendingText: remaining };
      }

      // Found complete tag, skip it entirely
      remaining = remaining.substring(endIdx + endTag.length);
    }

    return { safeText, pendingText: "" };
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();

        if (data === "[DONE]") {
          // Parse <tool_call> tags from accumulated text
          const { toolCalls: parsedToolCalls } =
            parseToolCallTags(accumulatedText);

          // Close text block if open
          if (sentTextBlockStart) {
            const blockStopEvent = {
              type: "content_block_stop",
              index: currentBlockIndex,
            };
            controller.enqueue(
              encoder.encode(
                `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`,
              ),
            );
            currentBlockIndex++;
            sentTextBlockStart = false;
          }

          // Emit parsed tool calls from text as tool_use blocks
          for (const tc of parsedToolCalls) {
            // Send content_block_start with full input
            const blockStartEvent = {
              type: "content_block_start",
              index: currentBlockIndex,
              content_block: {
                type: "tool_use",
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              },
            };
            controller.enqueue(
              encoder.encode(
                `event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`,
              ),
            );

            // Send content_block_stop
            const blockStopEvent = {
              type: "content_block_stop",
              index: currentBlockIndex,
            };
            controller.enqueue(
              encoder.encode(
                `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`,
              ),
            );
            currentBlockIndex++;
          }

          // Emit any accumulated tool calls that haven't been emitted yet
          if (!contentBlocksStopped) {
            emitAccumulatedToolCalls(
              controller,
              encoder,
              toolCallAccumulators,
              currentBlockIndex,
            );
            contentBlocksStopped = true;
          }

          // Send message_delta with stop_reason
          if (!messageDeltaSent) {
            const stopReason =
              parsedToolCalls.length > 0 || toolCallAccumulators.size > 0
                ? "tool_use"
                : "end_turn";
            const messageDeltaEvent = {
              type: "message_delta",
              delta: { stop_reason: stopReason, stop_sequence: null },
              usage: { output_tokens: outputTokens },
            };
            controller.enqueue(
              encoder.encode(
                `event: message_delta\ndata: ${JSON.stringify(messageDeltaEvent)}\n\n`,
              ),
            );
            messageDeltaSent = true;
          }

          // Send message_stop event
          if (!messageStopSent) {
            const stopEvent = { type: "message_stop" };
            controller.enqueue(
              encoder.encode(
                `event: message_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`,
              ),
            );
            messageStopSent = true;
          }
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
                usage: {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                },
              },
            };
            controller.enqueue(
              encoder.encode(
                `event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`,
              ),
            );
          }

          const delta = streamChunk.choices[0]?.delta;

          // Handle text content
          if (delta?.content) {
            hasTextContent = true;
            accumulatedText += delta.content;

            // Filter tool call tags from the text before emitting
            const combinedText = pendingTextBuffer + delta.content;
            const { safeText, pendingText } = filterToolCallTags(combinedText);
            pendingTextBuffer = pendingText;

            // Only emit if there's safe text to send
            if (safeText.length > 0) {
              // Send text block start if not sent
              if (!sentTextBlockStart) {
                sentTextBlockStart = true;
                const blockStartEvent = {
                  type: "content_block_start",
                  index: currentBlockIndex,
                  content_block: { type: "text", text: "" },
                };
                controller.enqueue(
                  encoder.encode(
                    `event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`,
                  ),
                );
              }

              outputTokens += Math.ceil(safeText.length / 4);

              const deltaEvent = {
                type: "content_block_delta",
                index: currentBlockIndex,
                delta: { type: "text_delta", text: safeText },
              };
              controller.enqueue(
                encoder.encode(
                  `event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`,
                ),
              );
            }
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            // Close text block if we had one
            if (sentTextBlockStart && hasTextContent) {
              const blockStopEvent = {
                type: "content_block_stop",
                index: currentBlockIndex,
              };
              controller.enqueue(
                encoder.encode(
                  `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`,
                ),
              );
              currentBlockIndex++;
              sentTextBlockStart = false;
            }

            for (const toolCall of delta.tool_calls) {
              const tcIndex = toolCall.index ?? 0;

              if (!toolCallAccumulators.has(tcIndex)) {
                toolCallAccumulators.set(tcIndex, {
                  id: "",
                  name: "",
                  arguments: "",
                  emitted: false,
                });
              }

              const acc = toolCallAccumulators.get(tcIndex)!;

              if (toolCall.id) acc.id = toolCall.id;
              if (toolCall.function?.name) acc.name = toolCall.function.name;
              if (toolCall.function?.arguments)
                acc.arguments += toolCall.function.arguments;
            }
          }

          // Check for finish
          if (streamChunk.choices[0]?.finish_reason) {
            const finishReason = streamChunk.choices[0].finish_reason;

            // Close text block if open
            if (sentTextBlockStart) {
              const blockStopEvent = {
                type: "content_block_stop",
                index: currentBlockIndex,
              };
              controller.enqueue(
                encoder.encode(
                  `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`,
                ),
              );
              currentBlockIndex++;
              sentTextBlockStart = false;
            }

            // Emit accumulated tool calls (only if not already done)
            if (!contentBlocksStopped) {
              if (
                finishReason === "tool_calls" ||
                toolCallAccumulators.size > 0
              ) {
                emitAccumulatedToolCalls(
                  controller,
                  encoder,
                  toolCallAccumulators,
                  currentBlockIndex,
                );
              }
              contentBlocksStopped = true;
            }

            // Send message_delta with stop_reason (only if not already sent)
            if (!messageDeltaSent) {
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
              controller.enqueue(
                encoder.encode(
                  `event: message_delta\ndata: ${JSON.stringify(messageDeltaEvent)}\n\n`,
                ),
              );
              messageDeltaSent = true;
            }

            // Send message_stop immediately after finish_reason
            if (!messageStopSent) {
              const stopEvent = { type: "message_stop" };
              controller.enqueue(
                encoder.encode(
                  `event: message_stop\ndata: ${JSON.stringify(stopEvent)}\n\n`,
                ),
              );
              messageStopSent = true;
            }
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
    // Skip if already emitted or missing required fields
    if (acc.emitted || !acc.id || !acc.name) continue;

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
    controller.enqueue(
      encoder.encode(
        `event: content_block_start\ndata: ${JSON.stringify(blockStartEvent)}\n\n`,
      ),
    );

    // Send content_block_delta with input
    const deltaEvent = {
      type: "content_block_delta",
      index,
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify(input),
      },
    };
    controller.enqueue(
      encoder.encode(
        `event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`,
      ),
    );

    // Send content_block_stop
    const blockStopEvent = { type: "content_block_stop", index };
    controller.enqueue(
      encoder.encode(
        `event: content_block_stop\ndata: ${JSON.stringify(blockStopEvent)}\n\n`,
      ),
    );

    // Mark as emitted
    acc.emitted = true;
    index++;
  }
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

  return (
    obj.object === "chat.completion" || obj.object === "chat.completion.chunk"
  );
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
  type?:
    | "message"
    | "item_reference"
    | "function_call"
    | "function_call_output";
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
  id?: string;
  type: "message";
  status?: "completed" | "in_progress";
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
  return (
    obj.input !== undefined ||
    obj.instructions !== undefined ||
    obj.previous_response_id !== undefined
  );
}

/**
 * Convert OpenAI Responses API request to OpenAI Chat Completions format
 */
export function responsesAPIToOpenAIRequest(
  req: ResponsesAPIRequest,
): OpenAIRequest {
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

      const role = item.role === "developer" ? "system" : item.role || "user";

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
  id?: string;
  type: "function_call";
  status?: "completed" | "in_progress";
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
        id: `fc_${toolCall.id}`,
        type: "function_call",
        status: "completed",
        call_id: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments || "{}",
      });
    }
  }

  // Handle text content
  if (choice?.message?.content) {
    const outputContent: ResponsesAPIOutputContent[] = [
      {
        type: "output_text",
        text: choice.message.content,
      },
    ];

    output.push({
      id: `msg_${(res.id as string) || `resp_${Date.now()}`}_0`,
      type: "message",
      status: "completed",
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
  const usage = res.usage as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | undefined;

  return {
    id: (res.id as string) || `resp_${Date.now()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: originalModel,
    output: output as ResponsesAPIOutputItem[],
    usage: usage
      ? {
          input_tokens: usage.prompt_tokens ?? 0,
          output_tokens: usage.completion_tokens ?? 0,
          total_tokens: usage.total_tokens ?? 0,
        }
      : undefined,
    status: "completed",
  };
}

/**
 * Format function call name to a human-readable status text
 * e.g., "search_files" -> "Searching files"
 *       "read_file" -> "Reading file"
 *       "execute_command" -> "Executing command"
 */
function formatFunctionCallStatus(functionName: string): string {
  // Common function name patterns and their friendly descriptions
  const patterns: [RegExp, string][] = [
    [/^(search|find|grep|glob)[-_]?(files?|code|content)?$/i, "Searching"],
    [/^(read|get|fetch|load)[-_]?(file|content|data)?$/i, "Reading"],
    [/^(write|save|create|update)[-_]?(file|content|data)?$/i, "Writing"],
    [
      /^(execute|run|exec|shell)[-_]?(command|cmd|bash)?$/i,
      "Executing command",
    ],
    [/^(list|ls)[-_]?(files?|dir|directory)?$/i, "Listing"],
    [/^(edit|modify|patch)[-_]?(file)?$/i, "Editing"],
    [/^(delete|remove|rm)[-_]?(file)?$/i, "Deleting"],
    [/^(move|mv|rename)[-_]?(file)?$/i, "Moving"],
    [/^(copy|cp)[-_]?(file)?$/i, "Copying"],
    [/^(mkdir|create[-_]?dir)$/i, "Creating directory"],
    [/^(git)[-_]?(.+)?$/i, "Running git"],
    [/^(npm|yarn|pnpm|bun)[-_]?(.+)?$/i, "Running package manager"],
    [/^(test|check|verify|validate)[-_]?(.+)?$/i, "Testing"],
    [/^(build|compile)[-_]?(.+)?$/i, "Building"],
    [/^(install|setup)[-_]?(.+)?$/i, "Installing"],
    [/^(analyze|inspect)[-_]?(.+)?$/i, "Analyzing"],
  ];

  for (const [pattern, description] of patterns) {
    if (pattern.test(functionName)) {
      return description;
    }
  }

  // Default: convert snake_case/camelCase to readable format
  // e.g., "doSomething" -> "Doing something", "do_something" -> "Doing something"
  const words = functionName
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ");

  if (words.length > 0) {
    // Convert first word to -ing form if it's a verb
    const firstWord = words[0];
    const ingForm = toIngForm(firstWord);
    words[0] = ingForm.charAt(0).toUpperCase() + ingForm.slice(1);
    return words.join(" ");
  }

  return `Calling ${functionName}`;
}

/**
 * Convert a verb to its -ing form
 */
function toIngForm(verb: string): string {
  if (verb.endsWith("e") && !verb.endsWith("ee")) {
    return verb.slice(0, -1) + "ing";
  }
  if (verb.endsWith("ie")) {
    return verb.slice(0, -2) + "ying";
  }
  if (
    /^[a-z]+[aeiou][bcdfghjklmnpqrstvwxyz]$/i.test(verb) &&
    verb.length <= 4
  ) {
    return verb + verb.slice(-1) + "ing";
  }
  return verb + "ing";
}

/**
 * Tool call accumulator for streaming
 */
interface StreamToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
  outputIndex: number; // Track the output index for this tool call
  sentAdded: boolean; // Track if we've sent the output_item.added event
  sentDone: boolean; // Track if we've sent the output_item.done event
}

/**
 * Create stream transformer for Responses API format
 * Converts OpenAI SSE stream to Responses API SSE stream
 */
export function createResponsesAPIStreamTransformer(
  originalModel: string,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const responseId = `resp_${Date.now()}`;
  let sentCreated = false;
  let sentMessageItem = false;
  let textBuffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCallAccumulators: Map<number, StreamToolCallAccumulator> =
    new Map();
  let outputIndex = 0;
  let sentCompleted = false; // Track if response.completed was already sent
  let pendingTextBuffer = ""; // Buffer for text that might be part of a tool call tag

  // Helper function to filter tool call tags from text and return safe text to emit
  const filterToolCallTags = (
    text: string,
  ): { safeText: string; pendingText: string } => {
    const tagStarts = ["<tool_call>", "<function_calls>"];
    const tagEnds = ["</tool_call>", "</function_calls>"];

    let safeText = "";
    let remaining = text;

    while (remaining.length > 0) {
      let foundTagStart = -1;
      let tagType = -1;
      for (let i = 0; i < tagStarts.length; i++) {
        const idx = remaining.indexOf(tagStarts[i]);
        if (idx !== -1 && (foundTagStart === -1 || idx < foundTagStart)) {
          foundTagStart = idx;
          tagType = i;
        }
      }

      if (foundTagStart === -1) {
        for (const tagStart of tagStarts) {
          for (let len = 1; len < tagStart.length; len++) {
            const partial = tagStart.substring(0, len);
            if (remaining.endsWith(partial)) {
              safeText += remaining.substring(0, remaining.length - len);
              return { safeText, pendingText: partial };
            }
          }
        }
        safeText += remaining;
        return { safeText, pendingText: "" };
      }

      safeText += remaining.substring(0, foundTagStart);
      remaining = remaining.substring(foundTagStart);

      const endTag = tagEnds[tagType];
      const endIdx = remaining.indexOf(endTag);

      if (endIdx === -1) {
        return { safeText, pendingText: remaining };
      }

      remaining = remaining.substring(endIdx + endTag.length);
    }

    return { safeText, pendingText: "" };
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();

        if (data === "[DONE]") {
          // Skip if response.completed was already sent on finish_reason
          if (sentCompleted) {
            continue;
          }

          // Send any pending done events for tool calls that weren't finalized
          for (const [, acc] of toolCallAccumulators) {
            if (acc.sentAdded && acc.outputIndex >= 0 && !acc.sentDone) {
              acc.sentDone = true;

              // Send response.function_call_arguments.done
              const argsDoneEvent = {
                type: "response.function_call_arguments.done",
                output_index: acc.outputIndex,
                item_id: `fc_${acc.id}`,
                arguments: acc.arguments || "{}",
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.function_call_arguments.done\ndata: ${JSON.stringify(argsDoneEvent)}\n\n`,
                ),
              );

              // Send response.output_item.done
              const itemDoneEvent = {
                type: "response.output_item.done",
                output_index: acc.outputIndex,
                item: {
                  id: `fc_${acc.id}`,
                  type: "function_call",
                  status: "completed",
                  call_id: acc.id,
                  name: acc.name,
                  arguments: acc.arguments || "{}",
                },
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`,
                ),
              );
            }
          }

          // Build final output array
          const finalOutput: unknown[] = [];

          // Add tool calls first (only those that were properly sent)
          for (const [, acc] of toolCallAccumulators) {
            if (acc.sentAdded && acc.id && acc.name) {
              finalOutput.push({
                id: `fc_${acc.id}`,
                type: "function_call",
                status: "completed",
                call_id: acc.id,
                name: acc.name,
                arguments: acc.arguments || "{}",
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
          sentCompleted = true;
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
          controller.enqueue(
            encoder.encode(
              `event: response.completed\ndata: ${JSON.stringify(completedEvent)}\n\n`,
            ),
          );
          continue;
        }

        try {
          const streamChunk = JSON.parse(data) as OpenAIStreamChunk;

          // Send response.created and response.in_progress on first chunk
          if (!sentCreated) {
            sentCreated = true;
            const createdAt = Math.floor(Date.now() / 1000);

            // response.created
            const createdEvent = {
              type: "response.created",
              response: {
                id: responseId,
                object: "response",
                created_at: createdAt,
                model: originalModel,
                output: [],
                status: "in_progress",
              },
            };
            controller.enqueue(
              encoder.encode(
                `event: response.created\ndata: ${JSON.stringify(createdEvent)}\n\n`,
              ),
            );

            // response.in_progress
            const inProgressEvent = {
              type: "response.in_progress",
              response: {
                id: responseId,
                object: "response",
                created_at: createdAt,
                status: "in_progress",
              },
            };
            controller.enqueue(
              encoder.encode(
                `event: response.in_progress\ndata: ${JSON.stringify(inProgressEvent)}\n\n`,
              ),
            );
          }

          const delta = streamChunk.choices[0]?.delta;

          // Handle reasoning/thinking content (from o1, deepseek, etc.)
          const reasoningContent =
            delta?.reasoning_content || delta?.thinking?.content;
          if (reasoningContent) {
            // Send response.reasoning_summary_text.delta event
            const reasoningDeltaEvent = {
              type: "response.reasoning_summary_text.delta",
              delta: reasoningContent,
              summary_index: 0,
            };
            controller.enqueue(
              encoder.encode(
                `event: response.reasoning_summary_text.delta\ndata: ${JSON.stringify(reasoningDeltaEvent)}\n\n`,
              ),
            );
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const tcIndex = toolCall.index ?? 0;

              if (!toolCallAccumulators.has(tcIndex)) {
                toolCallAccumulators.set(tcIndex, {
                  id: toolCall.id || "",
                  name: toolCall.function?.name || "",
                  arguments: "",
                  outputIndex: -1, // Will be set when we send output_item.added
                  sentAdded: false,
                  sentDone: false,
                });
              }

              const acc = toolCallAccumulators.get(tcIndex)!;

              if (toolCall.id) acc.id = toolCall.id;
              if (toolCall.function?.name) acc.name = toolCall.function.name;
              if (toolCall.function?.arguments) {
                acc.arguments += toolCall.function.arguments;
              }

              // Send response.output_item.added when we have the function name
              // This ensures Codex can display the correct status text
              if (!acc.sentAdded && acc.name) {
                acc.sentAdded = true;
                acc.outputIndex = outputIndex;

                // Generate a reasoning event with the function name as status
                // Codex extracts **bold text** from reasoning to show as status
                const statusText = formatFunctionCallStatus(acc.name);
                const reasoningEvent = {
                  type: "response.reasoning_summary_text.delta",
                  delta: `**${statusText}**\n`,
                  summary_index: 0,
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.reasoning_summary_text.delta\ndata: ${JSON.stringify(reasoningEvent)}\n\n`,
                  ),
                );

                const itemAddedEvent = {
                  type: "response.output_item.added",
                  output_index: outputIndex,
                  item: {
                    type: "function_call",
                    call_id: acc.id,
                    name: acc.name,
                    arguments: "",
                  },
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`,
                  ),
                );
                outputIndex++;
              }

              // Send response.function_call_arguments.delta
              if (toolCall.function?.arguments && acc.outputIndex >= 0) {
                const argsDeltaEvent = {
                  type: "response.function_call_arguments.delta",
                  output_index: acc.outputIndex,
                  delta: toolCall.function.arguments,
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.function_call_arguments.delta\ndata: ${JSON.stringify(argsDeltaEvent)}\n\n`,
                  ),
                );
              }
            }
          }

          // Handle text content
          if (delta?.content) {
            // Filter tool call tags from the text before emitting
            const combinedText = pendingTextBuffer + delta.content;
            const { safeText, pendingText } = filterToolCallTags(combinedText);
            pendingTextBuffer = pendingText;

            // Only emit if there's safe text to send
            if (safeText.length > 0) {
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
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`,
                  ),
                );

                // Send response.content_part.added
                const contentAddedEvent = {
                  type: "response.content_part.added",
                  output_index: outputIndex,
                  content_index: 0,
                  part: { type: "output_text", text: "" },
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.content_part.added\ndata: ${JSON.stringify(contentAddedEvent)}\n\n`,
                  ),
                );
              }

              textBuffer += safeText;
              outputTokens += Math.ceil(safeText.length / 4);

              const textDeltaEvent = {
                type: "response.output_text.delta",
                output_index: outputIndex,
                content_index: 0,
                delta: safeText,
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.output_text.delta\ndata: ${JSON.stringify(textDeltaEvent)}\n\n`,
                ),
              );
            }
          }

          // Check for finish
          if (streamChunk.choices[0]?.finish_reason) {
            // Send done events for tool calls (in order: arguments.done -> output_item.done)
            for (const [, acc] of toolCallAccumulators) {
              if (acc.sentAdded && acc.outputIndex >= 0 && !acc.sentDone) {
                acc.sentDone = true;

                // First send response.function_call_arguments.done
                const argsDoneEvent = {
                  type: "response.function_call_arguments.done",
                  output_index: acc.outputIndex,
                  item_id: `fc_${acc.id}`,
                  arguments: acc.arguments || "{}",
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.function_call_arguments.done\ndata: ${JSON.stringify(argsDoneEvent)}\n\n`,
                  ),
                );

                // Then send response.output_item.done
                const itemDoneEvent = {
                  type: "response.output_item.done",
                  output_index: acc.outputIndex,
                  item: {
                    id: `fc_${acc.id}`,
                    type: "function_call",
                    status: "completed",
                    call_id: acc.id,
                    name: acc.name,
                    arguments: acc.arguments || "{}",
                  },
                };
                controller.enqueue(
                  encoder.encode(
                    `event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`,
                  ),
                );
              }
            }

            // Send done events for message if there's text
            if (textBuffer && sentMessageItem) {
              const textDoneEvent = {
                type: "response.output_text.done",
                output_index: outputIndex,
                content_index: 0,
                text: textBuffer,
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.output_text.done\ndata: ${JSON.stringify(textDoneEvent)}\n\n`,
                ),
              );

              const contentDoneEvent = {
                type: "response.content_part.done",
                output_index: outputIndex,
                content_index: 0,
                part: { type: "output_text", text: textBuffer },
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.content_part.done\ndata: ${JSON.stringify(contentDoneEvent)}\n\n`,
                ),
              );

              const itemDoneEvent = {
                type: "response.output_item.done",
                output_index: outputIndex,
                item: {
                  id: `msg_${responseId}_0`,
                  type: "message",
                  status: "completed",
                  role: "assistant",
                  content: [{ type: "output_text", text: textBuffer }],
                },
              };
              controller.enqueue(
                encoder.encode(
                  `event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`,
                ),
              );
            }

            // Send response.completed immediately after finish_reason
            // Don't wait for [DONE] as some providers may not send it or delay it
            sentCompleted = true;
            const finalOutput: unknown[] = [];

            // Add tool calls first (only those that were properly sent)
            for (const [, acc] of toolCallAccumulators) {
              if (acc.sentAdded && acc.id && acc.name) {
                finalOutput.push({
                  id: `fc_${acc.id}`,
                  type: "function_call",
                  status: "completed",
                  call_id: acc.id,
                  name: acc.name,
                  arguments: acc.arguments || "{}",
                });
              }
            }

            // Add message if there's text content
            if (textBuffer) {
              finalOutput.push({
                id: `msg_${responseId}_0`,
                type: "message",
                status: "completed",
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
            controller.enqueue(
              encoder.encode(
                `event: response.completed\ndata: ${JSON.stringify(completedEvent)}\n\n`,
              ),
            );
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
