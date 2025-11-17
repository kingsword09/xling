/**
 * Discussion Lifecycle Hooks
 * Provides extensibility for discussion events
 */

import type { DiscussionContext, Turn, Participant } from "@/domain/discuss/types.js";

/**
 * Discussion lifecycle hooks for extensibility
 */
export interface DiscussionLifecycle {
  /**
   * Called when discussion starts
   */
  onStart?(context: DiscussionContext): Promise<void>;

  /**
   * Called after each turn completes
   */
  onTurnComplete?(turn: Turn): Promise<void>;

  /**
   * Called when discussion is paused
   */
  onPause?(context: DiscussionContext): Promise<void>;

  /**
   * Called when discussion is resumed
   */
  onResume?(context: DiscussionContext): Promise<void>;

  /**
   * Called when discussion completes successfully
   */
  onComplete?(context: DiscussionContext): Promise<void>;

  /**
   * Called when an error occurs
   */
  onError?(error: Error, context: DiscussionContext): Promise<void>;

  /**
   * Called before a participant's turn
   */
  beforeTurn?(participant: Participant, turnNumber: number): Promise<void>;

  /**
   * Called after a participant's turn
   */
  afterTurn?(participant: Participant, turn: Turn): Promise<void>;

  /**
   * Called when control command is processed
   */
  onControlCommand?(command: any, context: DiscussionContext): Promise<void>;
}

/**
 * Default lifecycle implementation with logging
 */
export class DefaultDiscussionLifecycle implements DiscussionLifecycle {
  async onStart(context: DiscussionContext): Promise<void> {
    console.log(`🎬 Discussion started: ${context.config.topic}`);
    console.log(`📋 ${context.participants.length} participants ready`);
  }

  async onTurnComplete(turn: Turn): Promise<void> {
    const duration = turn.metadata?.duration || 0;
    const tokens = turn.metadata?.tokens || 0;

    console.log(`✅ Turn ${turn.index + 1} completed (${duration}ms, ${tokens} tokens)`);
  }

  async onPause(context: DiscussionContext): Promise<void> {
    console.log(`⏸️  Discussion paused: ${context.config.topic}`);
  }

  async onResume(context: DiscussionContext): Promise<void> {
    console.log(`▶️  Discussion resumed: ${context.config.topic}`);
  }

  async onComplete(context: DiscussionContext): Promise<void> {
    const duration = Date.now() - context.startTime.getTime();
    const totalTurns = context.turns.length;
    const avgTurnTime = duration / totalTurns;

    console.log(`🏁 Discussion completed successfully!`);
    console.log(`⏱️  Total duration: ${Math.round(duration / 1000)}s`);
    console.log(`🔄 Total turns: ${totalTurns}`);
    console.log(`📊 Average turn time: ${Math.round(avgTurnTime)}ms`);
  }

  async onError(error: Error, context: DiscussionContext): Promise<void> {
    console.error(`❌ Discussion error: ${error.message}`);
    if (context) {
      console.error(`   Topic: ${context.config.topic}`);
      console.error(`   Turn: ${context.currentTurnIndex}`);
    }
  }

  async beforeTurn(participant: Participant, turnNumber: number): Promise<void> {
    console.log(`🎤 Turn ${turnNumber + 1}: ${participant.name} (${participant.type})`);
  }

  async afterTurn(participant: Participant, turn: Turn): Promise<void> {
    const contentPreview = turn.content.substring(0, 100);
    const ellipsis = turn.content.length > 100 ? "..." : "";

    console.log(`📝 ${participant.name}: ${contentPreview}${ellipsis}`);
  }

  async onControlCommand(command: any, context: DiscussionContext): Promise<void> {
    console.log(`🎮 Control command: ${command.type}`);
  }
}

/**
 * Metrics collection lifecycle
 */
export class MetricsLifecycle implements DiscussionLifecycle {
  private metrics = {
    totalTurns: 0,
    totalTokens: 0,
    totalDuration: 0,
    errors: 0,
    pauses: 0,
    controlCommands: 0,
  };

  async onTurnComplete(turn: Turn): Promise<void> {
    this.metrics.totalTurns++;
    this.metrics.totalTokens += turn.metadata?.tokens || 0;
    this.metrics.totalDuration += turn.metadata?.duration || 0;
  }

  async onError(error: Error, context: DiscussionContext): Promise<void> {
    this.metrics.errors++;
  }

  async onPause(context: DiscussionContext): Promise<void> {
    this.metrics.pauses++;
  }

  async onControlCommand(command: any, context: DiscussionContext): Promise<void> {
    this.metrics.controlCommands++;
  }

  getMetrics(): {
    totalTurns: number;
    totalTokens: number;
    totalDuration: number;
    errors: number;
    pauses: number;
    controlCommands: number;
    averageTurnTime: number;
    averageTokensPerTurn: number;
  } {
    return {
      ...this.metrics,
      averageTurnTime: this.metrics.totalTurns > 0 ? this.metrics.totalDuration / this.metrics.totalTurns : 0,
      averageTokensPerTurn: this.metrics.totalTurns > 0 ? this.metrics.totalTokens / this.metrics.totalTurns : 0,
    };
  }

  reset(): void {
    this.metrics = {
      totalTurns: 0,
      totalTokens: 0,
      totalDuration: 0,
      errors: 0,
      pauses: 0,
      controlCommands: 0,
    };
  }
}

/**
 * Compose multiple lifecycle handlers
 */
export class CompositeLifecycle implements DiscussionLifecycle {
  private handlers: DiscussionLifecycle[];

  constructor(...handlers: DiscussionLifecycle[]) {
    this.handlers = handlers.filter(h => h != null);
  }

  async onStart(context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onStart?.(context)));
  }

  async onTurnComplete(turn: Turn): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onTurnComplete?.(turn)));
  }

  async onPause(context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onPause?.(context)));
  }

  async onResume(context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onResume?.(context)));
  }

  async onComplete(context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onComplete?.(context)));
  }

  async onError(error: Error, context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onError?.(error, context)));
  }

  async beforeTurn(participant: Participant, turnNumber: number): Promise<void> {
    await Promise.all(this.handlers.map(h => h.beforeTurn?.(participant, turnNumber)));
  }

  async afterTurn(participant: Participant, turn: Turn): Promise<void> {
    await Promise.all(this.handlers.map(h => h.afterTurn?.(participant, turn)));
  }

  async onControlCommand(command: any, context: DiscussionContext): Promise<void> {
    await Promise.all(this.handlers.map(h => h.onControlCommand?.(command, context)));
  }
}
