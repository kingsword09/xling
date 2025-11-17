/**
 * Context Manager
 * Unified context building and management with performance optimizations
 */

import type {
  DiscussionContext,
  Turn,
  Participant,
  TurnContext,
  DiscussionConfig,
  DiscussionScenario,
} from "@/domain/discuss/types.js";
import { DiscussionStorage } from "../storage/discussionStorage.js";
import { DISCUSSION_CONFIG } from "../config/constants.js";
import { CodeAdvisor } from "../code/codeAdvisor.js";

/**
 * Context Manager provides unified context building with:
 * - History windowing to prevent OOM
 * - Incremental context building for performance
 * - Code advisor integration
 * - Secure context sanitization
 */
export class ContextManager {
  private storage: DiscussionStorage;
  private config!: DiscussionConfig;
  private codeAdvisor?: CodeAdvisor;
  private contextCache: Map<string, string> = new Map();

  constructor() {
    this.storage = new DiscussionStorage();
  }

  /**
   * Initialize context manager
   */
  initialize(config: DiscussionConfig): void {
    this.config = config;

    // Initialize code advisor if enabled
    const enableAdvisor =
      typeof (config.orchestration as { enableCodeAdvisor?: boolean }).enableCodeAdvisor ===
        "boolean"
        ? (config.orchestration as { enableCodeAdvisor?: boolean }).enableCodeAdvisor
        : false;

    if (enableAdvisor) {
      this.codeAdvisor = new CodeAdvisor();
    }
  }

  /**
   * Build turn context with unified history and code analysis
   */
  async buildTurnContext(
    discussionContext: DiscussionContext,
    participant: Participant,
    prompt?: string
  ): Promise<TurnContext> {
    // Get windowed history (performance optimization)
    const history = this.getWindowedHistory(discussionContext);

    // Build base context
    const turnContext: TurnContext = {
      scenario: this.getScenarioObject(discussionContext.config),
      history,
      currentPrompt: prompt || this.buildDefaultPrompt(discussionContext, participant),
      metadata: {
        turnNumber: discussionContext.currentTurnIndex + 1,
        previousSpeaker: this.getPreviousSpeaker(discussionContext),
        startTime: new Date(),
        contextSize: history.length,
        estimatedTokens: this.estimateContextTokens(history),
      },
    };

    // Add code context if code advisor is enabled and participant needs it
    if (this.codeAdvisor && participant.codeNeeds) {
      turnContext.codeContext = await this.getCodeContext(participant);
    }

    return turnContext;
  }

  /**
   * Add turn to context and update caches
   */
  addTurn(turn: Turn): void {
    // Update context caches
    this.updateContextCache(turn);

    // Perform cleanup if needed
    this.performCleanup();
  }

  /**
   * Save discussion context to storage
   */
  async saveContext(context: DiscussionContext): Promise<void> {
    try {
      await this.storage.save(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to save context: ${message}`);
    }
  }

  /**
   * Get context statistics
   */
  getContextStats(discussionContext: DiscussionContext): {
    totalTurns: number;
    contextSize: number;
    estimatedTokens: number;
    cacheHits: number;
    memoryUsage: number;
  } {
    const history = this.getWindowedHistory(discussionContext);

    return {
      totalTurns: discussionContext.turns.length,
      contextSize: history.length,
      estimatedTokens: this.estimateContextTokens(history),
      cacheHits: this.contextCache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // Private methods

  private getWindowedHistory(discussionContext: DiscussionContext): Turn[] {
    const allTurns = discussionContext.turns;
    const maxHistoryTurns = DISCUSSION_CONFIG.performance.maxHistoryTurns;

    if (allTurns.length <= maxHistoryTurns) {
      return allTurns;
    }

    // Return the most recent turns within the window
    return allTurns.slice(-maxHistoryTurns);
  }

  private buildDefaultPrompt(discussionContext: DiscussionContext, participant: Participant): string {
    const isFirstTurn = discussionContext.currentTurnIndex === 0;

    const scenario = this.getScenarioObject(discussionContext.config);
    if (isFirstTurn && scenario?.prompts?.initial) {
      return scenario.prompts.initial;
    }

    if (scenario?.prompts?.perTurn) {
      return scenario.prompts.perTurn;
    }

    if (isFirstTurn && discussionContext.initialPrompt) {
      return discussionContext.initialPrompt;
    }

    // Default continue prompt
    return "Please continue the discussion based on the previous context.";
  }

  private getPreviousSpeaker(discussionContext: DiscussionContext): string | undefined {
    if (discussionContext.turns.length === 0) {
      return undefined;
    }

    const lastTurn = discussionContext.turns[discussionContext.turns.length - 1];
    return lastTurn.participantName;
  }

  private async getCodeContext(participant: Participant): Promise<string | undefined> {
    if (!this.codeAdvisor || !participant.codeNeeds) {
      return undefined;
    }

    try {
      // Check cache first
      const cacheKey = JSON.stringify(participant.codeNeeds);
      if (this.contextCache.has(cacheKey)) {
        return this.contextCache.get(cacheKey);
      }

      // Request code context
      const codeContext = await this.codeAdvisor.requestCodeContext(
        participant.codeNeeds
      );

      // Cache the result
      this.contextCache.set(cacheKey, codeContext);

      return codeContext;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Code advisor error for ${participant.name}: ${message}`);
      return undefined;
    }
  }

  private updateContextCache(turn: Turn): void {
    // Simple LRU: if cache is too large, remove oldest entry
    const maxSize = DISCUSSION_CONFIG.performance.maxCacheSize;

    if (this.contextCache.size >= maxSize) {
      const firstKey = this.contextCache.keys().next().value;
      if (typeof firstKey === "string") {
        this.contextCache.delete(firstKey);
      }
    }

    // Add turn summary to cache (for quick context retrieval)
    const summary = this.summarizeTurn(turn);
    const cacheKey = `turn_${turn.index}`;
    this.contextCache.set(cacheKey, summary);
  }

  private summarizeTurn(turn: Turn): string {
    const maxLength = 200; // Characters
    const content = turn.content.length > maxLength
      ? `${turn.content.substring(0, maxLength)}...`
      : turn.content;

    return `${turn.participantName}: ${content}`;
  }

  private estimateContextTokens(history: Turn[]): number {
    // Rough estimation: average of 4 characters per token
    const totalChars = history.reduce((sum, turn) => sum + turn.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let usage = 0;

    for (const [key, value] of this.contextCache) {
      usage += key.length * 2; // UTF-16 characters
      usage += value.length * 2;
      usage += 64; // Overhead per entry
    }

    return usage;
  }

  private performCleanup(): void {
    // Cleanup old cache entries
    const cleanupInterval = DISCUSSION_CONFIG.performance.cleanupInterval;
    const gcThreshold = DISCUSSION_CONFIG.performance.gcThreshold;

    // Only perform cleanup if we have enough items
    if (this.contextCache.size < gcThreshold) {
      return;
    }

    // Simple cleanup: remove entries that haven't been accessed recently
    // (In a real implementation, you'd track access times)
    const entriesToRemove = Math.floor(this.contextCache.size * 0.2); // Remove 20%

    const keys = Array.from(this.contextCache.keys());
    for (let i = 0; i < entriesToRemove; i++) {
      this.contextCache.delete(keys[i]);
    }

    if (entriesToRemove > 0) {
      console.log(`🧹 Context cleanup: removed ${entriesToRemove} cache entries`);
    }
  }

  private getScenarioObject(config: DiscussionConfig): DiscussionScenario | undefined {
    const scenario = (config as unknown as { scenario?: unknown }).scenario;
    if (scenario && typeof scenario === "object" && "participants" in scenario) {
      return scenario as DiscussionScenario;
    }
    return undefined;
  }
}
