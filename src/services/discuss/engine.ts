import { EventEmitter } from "events";
import { ModelRouter } from "@/services/prompt/router.ts";
import type { PromptRequest } from "@/services/prompt/types.ts";

export interface Participant {
  id: string;
  name: string;
  model?: string; // Undefined for human
  type: "ai" | "human";
  errorCount: number;
  color?: string; // For UI
}

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  senderId: string; // ID of the participant
  timestamp: number;
  mentions?: string[]; // IDs of mentioned participants
}

export interface DiscussionConfig {
  topic: string;
  strategy: "random" | "round-robin";
  timeoutMs: number;
  maxErrors: number;
  thinkingTimeMs: number; // Delay before AI speaks
}

export type DiscussionStatus = "idle" | "discussing" | "paused" | "thinking" | "speaking";
export type DiscussionMode = "auto" | "manual";

export class DiscussionEngine extends EventEmitter {
  #router: ModelRouter;
  #participants: Map<string, Participant> = new Map();
  #history: ChatMessage[] = [];
  #status: DiscussionStatus = "idle";
  #mode: DiscussionMode = "auto";
  #config: DiscussionConfig;
  
  #currentSpeakerId: string | null = null;
  #lastSpeakerId: string | null = null;
  #currentMessage: ChatMessage | null = null;
  #abortController: AbortController | null = null;
  #autoTimer: NodeJS.Timeout | null = null;

  constructor(router: ModelRouter, config: Partial<DiscussionConfig> & { topic: string }) {
    super();
    this.#router = router;
    this.#config = {
      strategy: "random",
      timeoutMs: 30000,
      maxErrors: 3,
      thinkingTimeMs: 1000,
      ...config,
    };
  }

  // --- Management ---

  addParticipant(participant: Omit<Participant, "errorCount">): void {
    if (this.#participants.has(participant.id)) {
      throw new Error(`Participant id "${participant.id}" already exists.`);
    }

    if (
      participant.model &&
      Array.from(this.#participants.values()).some((p) => p.model === participant.model)
    ) {
      throw new Error(`Model "${participant.model}" is already participating.`);
    }

    const stored: Participant = {
      ...participant,
      errorCount: 0,
    };

    this.#participants.set(participant.id, stored);
    this.emit("participants-updated", Array.from(this.#participants.values()));
    this.#addSystemMessage(`${stored.name} joined the discussion.`);

    if (this.#status === "discussing" && this.#mode === "auto" && !this.#currentSpeakerId) {
      this.#scheduleNextTurn();
    }
  }

  removeParticipant(id: string): void {
    const removed = this.#participants.get(id);
    if (!removed) return;

    const removingActiveSpeaker = this.#currentSpeakerId === id;
    this.#participants.delete(id);
    if (this.#lastSpeakerId === id) {
      this.#lastSpeakerId = null;
    }
    this.emit("participants-updated", Array.from(this.#participants.values()));
    this.#addSystemMessage(`${removed.name} left the discussion.`);

    if (removingActiveSpeaker) {
      this.#abortCurrentTurn();
    } else if (this.#status === "discussing" && this.#mode === "auto" && !this.#currentSpeakerId) {
      this.#scheduleNextTurn();
    }
  }

  get participants(): Participant[] {
    return Array.from(this.#participants.values());
  }

  get history(): ChatMessage[] {
    return [...this.#history];
  }

  get currentMessage(): ChatMessage | null {
    return this.#currentMessage ? { ...this.#currentMessage } : null;
  }

  get status(): DiscussionStatus {
    return this.#status;
  }

  get mode(): DiscussionMode {
    return this.#mode;
  }

  get topic(): string {
    return this.#config.topic;
  }

  get currentSpeakerId(): string | null {
    return this.#currentSpeakerId;
  }

  setMode(mode: DiscussionMode): void {
    this.#mode = mode;
    this.emit("mode-changed", mode);
    
    if (mode === "manual") {
      this.#clearAutoTimer();
    }
    
    if (mode === "auto" && this.#status === "discussing" && !this.#currentSpeakerId) {
      this.#scheduleNextTurn();
    }
  }

  updateConfig(config: Partial<DiscussionConfig>): void {
    this.#config = { ...this.#config, ...config };
  }

  // --- Control Flow ---

  start(): void {
    if (this.#status !== "idle") return;

    this.#status = "discussing";
    this.#lastSpeakerId = null;
    this.emit("status-changed", this.#status);

    // Add system message
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content: `Topic: ${this.#config.topic}\nParticipants: ${this.participants.map(p => `${p.name} (${p.type})`).join(", ")}`,
      senderId: "system",
      timestamp: Date.now(),
    };
    this.#addMessage(systemMsg);

    if (this.#mode === "auto") {
      this.#scheduleNextTurn();
    }
  }

  pause(): void {
    if (this.#status === "idle") return;
    this.#status = "paused";
    this.#clearAutoTimer();
    this.emit("status-changed", this.#status);
  }

  resume(): void {
    if (this.#status !== "paused") return;
    this.#status = "discussing";
    this.emit("status-changed", this.#status);
    
    if (this.#mode === "auto" && !this.#currentSpeakerId) {
      this.#scheduleNextTurn();
    }
  }

  stop(): void {
    this.#status = "idle";
    this.#clearAutoTimer();
    this.#abortCurrentTurn({ skipReschedule: true });
    this.#lastSpeakerId = null;
    this.emit("status-changed", this.#status);
  }

  interrupt(): void {
    if (!this.#currentSpeakerId) return;
    this.#abortCurrentTurn();
  }

  reset(): void {
    this.stop();
    this.#history = [];
    this.#currentMessage = null;
    this.#lastSpeakerId = null;
    this.emit("history-cleared");
    this.emit("participants-updated", Array.from(this.#participants.values())); // Re-emit to ensure UI sync
  }

  // --- Interaction ---

  async injectMessage(senderId: string, content: string): Promise<void> {
    const participant = this.#participants.get(senderId);
    if (!participant) throw new Error("Participant not found");

    // If someone is speaking, we might want to interrupt or just append
    // For now, let's just append and let the flow continue
    // Ideally, if AI is speaking, we might want to cancel it?
    // Let's keep it simple: Human message is just added.
    
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: participant.type === "human" ? "user" : "assistant",
      content,
      senderId,
      timestamp: Date.now(),
    };

    this.#addMessage(msg);

    // If we were waiting for a turn, this might change who speaks next or context
    // If in auto mode and idle, ensure loop continues
    if (this.#status === "discussing" && this.#mode === "auto" && !this.#currentSpeakerId) {
       this.#scheduleNextTurn();
    }
  }

  setNextSpeaker(participantId: string): void {
    if (this.#status !== "discussing" && this.#status !== "paused") return;

    this.#clearAutoTimer();

    if (this.#currentSpeakerId && this.#currentSpeakerId !== participantId) {
      this.#abortCurrentTurn();
    } else if (this.#currentSpeakerId === participantId) {
      return;
    }

    if (this.#status === "paused") {
      this.#status = "discussing";
      this.emit("status-changed", this.#status);
    }

    this.#executeTurn(participantId);
  }

  async generateSummary(modelId: string): Promise<string> {
    const participant = this.#participants.get(modelId);
    if (!participant || !participant.model) throw new Error("Invalid summarizer");

    const prompt = `Please summarize the discussion so far on the topic "${this.#config.topic}".
    
Discussion History:
${this.#formatHistory()}

Provide a concise summary of the key points and conclusions.`;

    const request: PromptRequest = {
      messages: [{ role: "user", content: prompt }],
      model: participant.model,
    };

    const response = await this.#router.execute(request);
    return response.content;
  }

  // --- Internal Logic ---

  #scheduleNextTurn(): void {
    this.#clearAutoTimer();
    if (this.#status !== "discussing" || this.#mode !== "auto") return;

    this.#autoTimer = setTimeout(() => {
      const nextId = this.#selectNextSpeaker();
      if (nextId) {
        this.#executeTurn(nextId);
      }
    }, this.#config.thinkingTimeMs);
  }

  #selectNextSpeaker(): string | null {
    const aiParticipants = this.participants.filter((p) => p.type === "ai");
    if (aiParticipants.length === 0) return null;

    const aiIds = aiParticipants.map((p) => p.id);
    const lastMsg = this.#history[this.#history.length - 1];
    const lastMsgAi = lastMsg && aiIds.includes(lastMsg.senderId) ? lastMsg.senderId : null;
    const referenceId = this.#lastSpeakerId ?? lastMsgAi;

    const candidates =
      aiParticipants.length > 1 && referenceId
        ? aiParticipants.filter((p) => p.id !== referenceId)
        : aiParticipants;

    if (candidates.length === 0) return aiParticipants[0].id;

    if (this.#config.strategy === "random") {
      const index = Math.floor(Math.random() * candidates.length);
      return candidates[index].id;
    } else {
      const lastIndex = referenceId ? aiIds.indexOf(referenceId) : -1;
      const nextIndex = (lastIndex + 1) % aiIds.length;
      return aiIds[nextIndex];
    }
  }

  async #executeTurn(participantId: string): Promise<void> {
    const participant = this.#participants.get(participantId);
    if (!participant || participant.type !== "ai" || !participant.model) return;

    this.#currentSpeakerId = participantId;
    this.#lastSpeakerId = participantId;
    this.#status = "speaking";
    this.emit("status-changed", this.#status);
    this.emit("turn-start", participantId);

    this.#abortController = new AbortController();
    const abortController = this.#abortController; // Capture locally to prevent race conditions
    
    const msgId = crypto.randomUUID();
    const timestamp = Date.now();
    let content = "";

    // Emit initial empty message
    const initialMsg: ChatMessage = {
      id: msgId,
      role: "assistant",
      content: "",
      senderId: participantId,
      timestamp,
    };
    this.#currentMessage = initialMsg;
    this.emit("message", initialMsg);

    try {
      const prompt = this.#constructPrompt(participant);
      
      const request: PromptRequest = {
        messages: [{ role: "user", content: prompt }],
        model: participant.model,
        stream: true,
        abortSignal: abortController.signal,
      };

      // Race between generation and timeout
      const streamPromise = this.#router.executeStream(request);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), this.#config.timeoutMs);
      });

      const result = await Promise.race([streamPromise, timeoutPromise]);

      // @ts-ignore - Promise.race types are tricky with streaming
      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break;
        content += chunk;
        if (this.#currentMessage) {
            this.#currentMessage.content = content;
        }
        this.emit("message-chunk", { id: msgId, delta: chunk, content });
      }

      if (!abortController.signal.aborted) {
        this.#addMessage({
          id: msgId,
          role: "assistant",
          content,
          senderId: participantId,
          timestamp,
        });
        participant.errorCount = 0; // Reset errors on success
      }

    } catch (error) {
      console.error(`Error in turn for ${participant.name}:`, error);
      participant.errorCount++;
      this.emit("error", { participantId, error: (error as Error).message });
      
      if (participant.errorCount > this.#config.maxErrors) {
        this.emit("participant-dropped", participantId);
        this.removeParticipant(participantId);
      }
    } finally {
      if (this.#currentSpeakerId === participantId) {
        this.#currentSpeakerId = null;
      }
      if (this.#currentMessage && this.#currentMessage.id === msgId) {
        this.#currentMessage = null;
      }
      if (this.#abortController === abortController) {
        this.#abortController = null;
      }
      
      if (!this.#currentSpeakerId && this.#status === "speaking") {
        this.#status = "discussing";
        this.emit("status-changed", this.#status);
      }

      if (this.#mode === "auto" && this.#status === "discussing" && !this.#currentSpeakerId) {
        this.#scheduleNextTurn();
      }
    }
  }

  #constructPrompt(participant: Participant): string {
    const allNames = this.participants
      .map((p) => `${p.name}${p.model ? ` (${p.model})` : ""}`)
      .join(", ");

    return `You are ${participant.name} in a group discussion.
Topic: "${this.#config.topic}"
Active participants: ${allNames}

Instructions:
1. Speak naturally as your character.
2. Keep responses concise (1-3 paragraphs).
3. If you want to refer to a specific person, use @Name (e.g., @Claude) and acknowledge any new arrivals.
4. Do not repeat yourself or others excessively.
5. Advance the conversation with new insights or questions.

Conversation History:
${this.#formatHistory()}

Respond now as ${participant.name}:`;
  }

  #formatHistory(): string {
    // Get last N messages to fit context
    // Simple slice for now, could be token-based later
    const recent = this.#history.slice(-20); 
    return recent.map(m => {
      const p = this.#participants.get(m.senderId);
      const name = p ? p.name : (m.role === "system" ? "System" : "Unknown");
      return `[${name}]: ${m.content}`;
    }).join("\n\n");
  }

  #addMessage(msg: ChatMessage): void {
    this.#history.push(msg);
    this.emit("message", msg);
  }

  #addSystemMessage(content: string): void {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content,
      senderId: "system",
      timestamp: Date.now(),
    };
    this.#addMessage(msg);
  }

  #clearAutoTimer(): void {
    if (this.#autoTimer) {
      clearTimeout(this.#autoTimer);
      this.#autoTimer = null;
    }
  }

  #abortCurrentTurn(options?: { skipReschedule?: boolean }): void {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    const hadSpeaker = Boolean(this.#currentSpeakerId);
    this.#currentSpeakerId = null;
    this.#currentMessage = null;

    if (hadSpeaker && this.#status === "speaking") {
      this.#status = "discussing";
      this.emit("status-changed", this.#status);
    }

    if (!options?.skipReschedule && this.#mode === "auto" && this.#status === "discussing") {
      this.#scheduleNextTurn();
    }
  }
}
