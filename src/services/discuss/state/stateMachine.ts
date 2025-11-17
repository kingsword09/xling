/**
 * Discussion State Machine
 * Implements state transitions with validation to fix the architecture issues
 */

import type { DiscussionStatus } from "@/domain/discuss/types.js";

export interface StateTransition {
  from: DiscussionStatus;
  to: DiscussionStatus;
}

export class DiscussionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<DiscussionStatus, DiscussionStatus[]> = {
    active: ['paused', 'completed', 'aborted'],
    paused: ['active', 'aborted'],
    completed: ['aborted'],
    aborted: [],
  };

  private currentState: DiscussionStatus = 'active';

  /**
   * Get current state
   */
  get state(): DiscussionStatus {
    return this.currentState;
  }

  /**
   * Transition to a new state with validation
   */
  transition(newState: DiscussionStatus): boolean {
    // Check if transition is valid
    const validTargets = DiscussionStateMachine.VALID_TRANSITIONS[this.currentState];

    if (!validTargets.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this.currentState} -> ${newState}. ` +
        `Valid transitions from ${this.currentState}: ${validTargets.join(', ')}`
      );
    }

    // Update state
    const oldState = this.currentState;
    this.currentState = newState;

    console.log(`State transition: ${oldState} -> ${newState}`);
    return true;
  }

  /**
   * Check if a state transition is valid
   */
  canTransitionTo(newState: DiscussionStatus): boolean {
    const validTargets = DiscussionStateMachine.VALID_TRANSITIONS[this.currentState];
    return validTargets.includes(newState);
  }

  /**
   * Check if the discussion is in an active state
   */
  isActive(): boolean {
    return this.currentState === 'active';
  }

  /**
   * Check if the discussion is in a terminal state
   */
  isTerminal(): boolean {
    return this.currentState === 'completed' || this.currentState === 'aborted';
  }

  /**
   * Check if a turn can be executed in current state
   */
  canExecuteTurn(): boolean {
    return this.currentState === 'active';
  }

  /**
   * Reset the state machine
   */
  reset(): void {
    this.currentState = 'active';
  }

  /**
   * Get all valid transitions from current state
   */
  getValidTransitions(): DiscussionStatus[] {
    return [...DiscussionStateMachine.VALID_TRANSITIONS[this.currentState]];
  }
}
