/**
 * Turn Scheduler
 * Implements working control commands and participant selection strategies
 */

import type { ControlCommand } from "@/domain/discuss/types.js";
import type {
  DiscussionContext,
  Participant,
  TurnOrderStrategy,
} from "@/domain/discuss/types.js";

/**
 * Turn Scheduler manages participant selection and control command processing
 * Fixes the issue where control commands had no actual effect
 */
export class TurnScheduler {
  private queue: Participant[] = [];
  private currentIndex: number = 0;
  private turnOrder: TurnOrderStrategy = 'round-robin';
  private originalParticipants: Participant[] = [];

  /**
   * Initialize scheduler with participants
   */
  initialize(participants: Participant[], turnOrder: TurnOrderStrategy): void {
    this.originalParticipants = [...participants];
    this.turnOrder = turnOrder;
    this.resetQueue();
  }

  /**
   * Get the next participant
   */
  getNext(context: DiscussionContext): Participant | null {
    // If queue has items from control commands, use them first
    if (this.queue.length > 0) {
      return this.queue.shift() || null;
    }

    // Otherwise use the configured strategy
    return this.getNextByStrategy(context);
  }

  /**
   * Process a control command
   */
  processCommand(command: ControlCommand, context: DiscussionContext): void {
    switch (command.type) {
      case 'next':
        this.processNextCommand(command);
        break;

      case 'ask':
        this.processAskCommand(command, context);
        break;

      case 'order':
        this.processOrderCommand(command);
        break;

      case 'pause':
        // Pause is handled at the orchestrator level
        break;

      case 'help':
        // Help is handled at the parser level
        break;

      default:
        console.warn(`Unknown command type: ${(command as any).type}`);
    }
  }

  /**
   * Reset the queue to default state
   */
  resetQueue(): void {
    this.queue = [];
    this.currentIndex = 0;
  }

  /**
   * Get current queue state for debugging
   */
  getQueueState(): { queue: Participant[], currentIndex: number, turnOrder: TurnOrderStrategy } {
    return {
      queue: [...this.queue],
      currentIndex: this.currentIndex,
      turnOrder: this.turnOrder,
    };
  }

  // Private methods

  private getNextByStrategy(context: DiscussionContext): Participant | null {
    switch (this.turnOrder) {
      case 'sequential':
        return this.getSequentialNext();
      case 'round-robin':
        return this.getRoundRobinNext();
      case 'dynamic':
        return this.getDynamicNext(context);
      default:
        throw new Error(`Unsupported turn order strategy: ${this.turnOrder}`);
    }
  }

  private getSequentialNext(): Participant | null {
    if (this.currentIndex >= this.originalParticipants.length) {
      return null;
    }

    return this.originalParticipants[this.currentIndex++];
  }

  private getRoundRobinNext(): Participant | null {
    if (this.originalParticipants.length === 0) {
      return null;
    }

    const participant = this.originalParticipants[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.originalParticipants.length;

    return participant;
  }

  private getDynamicNext(context: DiscussionContext): Participant | null {
    // Implement intelligent selection based on context
    const lastTurn = context.turns[context.turns.length - 1];

    // Rule 1: If last turn was a question, pick the most relevant expert
    if (lastTurn?.content.includes('?')) {
      return this.findExpertForQuestion(lastTurn.content);
    }

    // Rule 2: If someone hasn't spoken in 3+ turns, prioritize them
    const silentParticipant = this.findSilentParticipant(context, 3);
    if (silentParticipant) {
      return silentParticipant;
    }

    // Rule 3: Default to round-robin
    return this.getRoundRobinNext();
  }

  private findExpertForQuestion(question: string): Participant | null {
    const lowerQuestion = question.toLowerCase();

    // Architecture-related keywords
    if (this.matchesKeywords(lowerQuestion, ['architecture', 'design', 'pattern', 'structure', 'system'])) {
      return this.findParticipantByRole(['architect', 'designer', 'system']);
    }

    // Security-related keywords
    if (this.matchesKeywords(lowerQuestion, ['security', 'vulnerability', 'threat', 'attack', 'auth'])) {
      return this.findParticipantByRole(['security', 'pentester', 'security-expert']);
    }

    // Performance-related keywords
    if (this.matchesKeywords(lowerQuestion, ['performance', 'optimization', 'speed', 'memory', 'cpu'])) {
      return this.findParticipantByRole(['performance', 'optimization', 'engineer']);
    }

    // Code-related keywords
    if (this.matchesKeywords(lowerQuestion, ['code', 'implementation', 'function', 'method', 'class'])) {
      return this.findParticipantByRole(['developer', 'programmer', 'coder']);
    }

    // Default to round-robin if no specific expert found
    return null;
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private findParticipantByRole(roles: string[]): Participant | null {
    return this.originalParticipants.find(p => {
      const participantRole = p.name.toLowerCase();
      return roles.some(role => participantRole.includes(role));
    }) || null;
  }

  private findSilentParticipant(context: DiscussionContext, maxSilentTurns: number): Participant | null {
    const recentTurns = context.turns.slice(-maxSilentTurns * context.participants.length);
    const recentSpeakers = new Set(recentTurns.map(t => t.participantId));

    // Find participants who haven't spoken recently
    return this.originalParticipants.find(p => !recentSpeakers.has(p.id)) || null;
  }

  // Command processing methods

  private processNextCommand(command: ControlCommand): void {
    const target = command.targetNumbers?.[0];
    if (typeof target === "number") {
      const participant = this.originalParticipants.find((p) => p.number === target);
      if (participant) {
        this.queue.unshift(participant);
        console.log(`⏭️  Next speaker set to #${target}`);
        return;
      }
    }
    // Fallback: advance one slot
    if (this.originalParticipants.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % this.originalParticipants.length;
      console.log(`⏭️  Skipped to next participant in order`);
    }
  }

  private processAskCommand(command: ControlCommand, context: DiscussionContext): void {
    // Ask specific participant to speak next
    const targetNumber = command.targetNumbers?.[0];

    if (!targetNumber) {
      console.warn("Ask command requires participant number");
      return;
    }

    const targetParticipant = this.originalParticipants.find(p => p.number === targetNumber);

    if (!targetParticipant) {
      console.warn(`Participant #${targetNumber} not found`);
      return;
    }

    // Move this participant to front of queue
    this.queue.unshift(targetParticipant);

    console.log(`🎯 Asking participant #${targetNumber} (${targetParticipant.name}) to speak`);
  }

  private processOrderCommand(command: ControlCommand): void {
    const newOrder = command.params?.order as TurnOrderStrategy | undefined;

    if (!newOrder) {
      console.warn("Order command requires order strategy");
      return;
    }

    const validOrders: TurnOrderStrategy[] = ['sequential', 'round-robin', 'dynamic'];

    if (!validOrders.includes(newOrder)) {
      console.warn(`Invalid order strategy: ${newOrder}`);
      return;
    }

    this.turnOrder = newOrder;
    this.resetQueue();

    console.log(`🔄 Changed turn order to: ${newOrder}`);
  }
}
