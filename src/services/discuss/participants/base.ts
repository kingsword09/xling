/**
 * Base participant driver interface and abstract class
 */

import type {
  Participant,
  DiscussionContext,
  ParticipantDriver,
} from "../../../domain/discuss/types.js";

/**
 * Abstract base class for all participant drivers
 * Provides common functionality and error handling
 */
export abstract class BaseParticipantDriver implements ParticipantDriver {
  protected participant: Participant;
  protected timeout: number; // milliseconds

  constructor(participant: Participant, timeout: number = 120000) {
    this.participant = participant;
    this.timeout = timeout;
  }

  /**
   * Execute a turn for this participant
   * Must be implemented by subclasses
   */
  abstract execute(
    context: DiscussionContext,
    prompt: string
  ): Promise<string>;

  /**
   * Validate that this participant can execute
   * Must be implemented by subclasses
   */
  abstract validate(): Promise<boolean>;

  /**
   * Optional cleanup when discussion ends
   */
  async cleanup(): Promise<void> {
    // Default: no cleanup needed
  }

  /**
   * Execute with timeout wrapper
   */
  protected async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number = this.timeout
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeoutPromise<T>(timeoutMs),
    ]);
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Participant #${this.participant.number} (${this.participant.name}) timed out after ${ms}ms`
          )
        );
      }, ms);
    });
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      error.message = `[${this.participant.name}] ${context}: ${error.message}`;
      return error;
    }
    return new Error(
      `[${this.participant.name}] ${context}: ${String(error)}`
    );
  }

  /**
   * Get participant info for logging
   */
  protected getParticipantInfo(): string {
    return `#${this.participant.number} ${this.participant.name} (${this.participant.type})`;
  }
}

/**
 * Participant driver factory
 * Creates the appropriate driver based on participant type
 */
export interface ParticipantDriverFactory {
  createDriver(participant: Participant): ParticipantDriver;
}
