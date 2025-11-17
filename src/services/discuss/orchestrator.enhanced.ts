/**
 * EnhancedDiscussionOrchestrator
 * Thin wrapper around the stable DiscussionOrchestrator to keep compatibility
 * while we finish the advanced pipeline.
 */

import type {
  DiscussionConfig,
  DiscussionContext,
  Turn,
  Participant,
} from "@/domain/discuss/types.js";
import { DiscussionOrchestrator } from "./orchestrator.js";
import type { ModelRouter } from "../prompt/router.js";

export interface DiscussionLifecycle {
  onStart?(context: DiscussionContext): Promise<void> | void;
  onTurnComplete?(turn: Turn): Promise<void> | void;
  onComplete?(context: DiscussionContext): Promise<void> | void;
  onError?(error: Error, context?: DiscussionContext): Promise<void> | void;
}

export class EnhancedDiscussionOrchestrator {
  private readonly base: DiscussionOrchestrator;
  private lifecycle: DiscussionLifecycle;

  constructor(router: ModelRouter, lifecycle: DiscussionLifecycle = {}) {
    this.base = new DiscussionOrchestrator(router);
    this.lifecycle = lifecycle;
  }

  async start(
    config: DiscussionConfig,
    initialPrompt: string
  ): Promise<DiscussionContext> {
    const context = await this.base.start(config, initialPrompt);
    await this.lifecycle.onStart?.(context);
    return context;
  }

  async executeTurn(prompt?: string): Promise<Turn> {
    const turn = await this.base.executeTurn(prompt);
    await this.lifecycle.onTurnComplete?.(turn);
    return turn;
  }

  shouldTerminate(): boolean {
    return this.base.shouldTerminate();
  }

  complete(): void {
    this.base.complete();
    void this.lifecycle.onComplete?.(this.base.getContext());
  }

  abort(): void {
    this.base.abort();
    void this.lifecycle.onError?.(new Error("Discussion aborted"), this.base.getContext());
  }

  pause(): void {
    this.base.pause();
  }

  resume(): void {
    this.base.resume();
  }

  getContext(): DiscussionContext {
    return this.base.getContext();
  }
}
