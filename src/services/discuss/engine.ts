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
    this.#participants.set(participant.id, {
      ...participant,
      errorCount: 0,
    });
    this.emit("participants-updated", Array.from(this.#participants.values()));
  }

  removeParticipant(id: string): void {
    this.#participants.delete(id);
    if (this.#lastSpeakerId === id) {
      this.#lastSpeakerId = null;
    }
    this.emit("participants-updated", Array.from(this.#participants.values()));
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
    this.#abortCurrentTurn();
    this.#lastSpeakerId = null;
    this.emit("status-changed", this.#status);
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
    
    // If someone is already speaking, maybe queue it? 
    // For now, assume this is called when idle or to force next
    if (this.#currentSpeakerId) {
      // Already speaking
      return;
    }

    this.#clearAutoTimer();
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
    if (this.#status !== "discussing") return;

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
      this.#currentSpeakerId = null;
      this.#currentMessage = null;
      this.#abortController = null;
      
      // Always return to discussing state if we were speaking
      if (this.#status === "speaking") {
        this.#status = "discussing";
        this.emit("status-changed", this.#status);
      }

      // Ensure we schedule next turn if in auto mode, even after error
      if (this.#mode === "auto" && this.#status === "discussing") {
        this.#scheduleNextTurn();
      }
    }
  }

  #constructPrompt(participant: Participant): string {
    const otherNames = this.participants
      .filter(p => p.id !== participant.id)
      .map(p => p.name)
      .join(", ");

    return `You are ${participant.name} in a group discussion.
Topic: "${this.#config.topic}"
Participants: ${otherNames}

Instructions:
1. Speak naturally as your character.
2. Keep responses concise (1-3 paragraphs).
3. If you want to refer to a specific person, use @Name (e.g., @Claude).
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

  #clearAutoTimer(): void {
    if (this.#autoTimer) {
      clearTimeout(this.#autoTimer);
      this.#autoTimer = null;
    }
  }

  #abortCurrentTurn(): void {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }
}
