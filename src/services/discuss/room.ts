import { ModelRouter } from "@/services/prompt/router.ts";
import type { PromptRequest } from "@/services/prompt/types.ts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp: number;
}

export class ChatRoom {
  #messages: ChatMessage[] = [];
  #participants: string[] = [];
  #topic: string = "";
  #router: ModelRouter;
  #isDiscussing: boolean = false;
  #onMessage: (message: ChatMessage) => void;

  constructor(router: ModelRouter, onMessage: (message: ChatMessage) => void) {
    this.#router = router;
    this.#onMessage = onMessage;
  }

  start(topic: string, participants: string[]): void {
    this.#topic = topic;
    this.#participants = participants;
    this.#messages = [];
    this.#isDiscussing = true;

    // Add system message to set the context
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content: `Topic: ${topic}\nParticipants: ${participants.join(", ")}`,
      timestamp: Date.now(),
    };
    this.#addMessage(systemMsg);

    // Trigger first turn
    this.nextTurn();
  }

  stop(): void {
    this.#isDiscussing = false;
  }

  async nextTurn(): Promise<void> {
    if (!this.#isDiscussing) return;

    // Determine next speaker (Round Robin for now)
    const lastAssistantMsg = [...this.#messages]
      .reverse()
      .find((m) => m.role === "assistant");

    let nextSpeakerIndex = 0;
    if (lastAssistantMsg && lastAssistantMsg.model) {
      const lastIndex = this.#participants.indexOf(lastAssistantMsg.model);
      nextSpeakerIndex = (lastIndex + 1) % this.#participants.length;
    }

    const nextSpeaker = this.#participants[nextSpeakerIndex];

    // Construct prompt
    const historyText = this.#messages
      .map((m) => {
        if (m.role === "system") return `[System]: ${m.content}`;
        return `[${m.model || "User"}]: ${m.content}`;
      })
      .join("\n\n");

    const prompt = `You are ${nextSpeaker} in a group chat.
The topic is: "${this.#topic}".
The other participants are: ${this.#participants.filter((p) => p !== nextSpeaker).join(", ")}.

Here is the conversation history:
${historyText}

Respond to the conversation as ${nextSpeaker}. Keep your response concise and conversational. Do not prefix your response with your name.`;

    const msgId = crypto.randomUUID();
    const timestamp = Date.now();

    // Initial placeholder message
    this.#onMessage({
      id: msgId,
      role: "assistant",
      content: "",
      model: nextSpeaker,
      timestamp,
    });

    try {
      const request: PromptRequest = {
        messages: [{ role: "user", content: prompt }],
        model: nextSpeaker,
        stream: true,
      };

      const result = await this.#router.executeStream(request);

      let fullContent = "";
      for await (const chunk of result.textStream) {
        if (!this.#isDiscussing) break;
        fullContent += chunk;
        this.#onMessage({
          id: msgId,
          role: "assistant",
          content: fullContent,
          model: nextSpeaker,
          timestamp,
        });
      }

      if (this.#isDiscussing) {
        this.#addMessage({
          id: msgId,
          role: "assistant",
          content: fullContent,
          model: nextSpeaker,
          timestamp,
        });
      }
    } catch (error) {
      console.error(`Error generating response from ${nextSpeaker}:`, error);
      this.#onMessage({
        id: msgId,
        role: "system",
        content: `Error: ${(error as Error).message}`,
        timestamp: Date.now(),
      });
    }
  }

  #addMessage(message: ChatMessage) {
    this.#messages.push(message);
    this.#onMessage(message);
  }

  get messages(): ChatMessage[] {
    return this.#messages;
  }

  get isDiscussing(): boolean {
    return this.#isDiscussing;
  }
}
