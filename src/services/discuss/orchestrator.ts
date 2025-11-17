/**
 * Discussion Orchestrator
 * Coordinates multi-participant discussions with turn management
 */

import type {
  DiscussionConfig,
  DiscussionContext,
  DiscussionStatus,
  Participant,
  Turn,
  ParticipantDriver,
  ControlCommand,
} from "../../domain/discuss/types.js";
import { ApiParticipantDriver } from "./participants/apiParticipant.js";
import { CliParticipantDriver } from "./participants/cliParticipant.js";
import { HumanParticipantDriver } from "./participants/humanParticipant.js";
import type { ModelRouter } from "../prompt/router.js";
import {
  displayTurnHeader,
  displayTurnFooter,
  displaySpecialTurnHeader,
  assignParticipantNumbers,
} from "./display/participantDisplay.js";
import { parseControlCommand } from "./control/commandParser.js";

/**
 * Discussion Orchestrator
 * Manages the flow of a multi-participant discussion
 */
export class DiscussionOrchestrator {
  private router: ModelRouter;
  private drivers: Map<string, ParticipantDriver>;
  private context!: DiscussionContext;

  constructor(router: ModelRouter) {
    this.router = router;
    this.drivers = new Map();
  }

  /**
   * Start a new discussion
   */
  async start(
    config: DiscussionConfig,
    initialPrompt: string
  ): Promise<DiscussionContext> {
    // Assign participant numbers
    const participants = assignParticipantNumbers(config.participants);

    // Initialize context
    this.context = {
      config: { ...config, participants },
      turns: [],
      currentTurnIndex: 0,
      status: "active",
      startTime: new Date(),
      participants,
    };

    // Create and validate drivers
    await this.initializeDrivers();

    console.log(`\nDiscussion started: ${config.topic}`);
    console.log(`Participants: ${participants.length}`);
    console.log("");

    return this.context;
  }

  /**
   * Execute the next turn
   */
  async executeTurn(prompt?: string): Promise<Turn> {
    if (this.context.status !== "active") {
      throw new Error(
        `Cannot execute turn: discussion is ${this.context.status}`
      );
    }

    // Determine next participant
    const participant = this.getNextParticipant();
    if (!participant) {
      throw new Error("No participant available for next turn");
    }

    // Get driver
    const driver = this.drivers.get(participant.id);
    if (!driver) {
      throw new Error(`No driver found for participant ${participant.id}`);
    }

    // Build prompt
    const turnPrompt = prompt || this.buildTurnPrompt(participant);

    // Display turn header
    console.log(
      displayTurnHeader(
        {
          index: this.context.currentTurnIndex,
          participantId: participant.id,
          participantName: participant.name,
          content: "",
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        this.context.config.orchestration.maxTurns,
        participant
      )
    );

    try {
      // Execute turn
      const startTime = Date.now();
      const content = await driver.execute(this.context, turnPrompt);
      const duration = Date.now() - startTime;

      // Check if it's a control command from human
      if (participant.type === "human" && this.isControlCommand(content)) {
        return this.handleControlCommand(content, participant);
      }

      // Create turn record
      const turn: Turn = {
        index: this.context.currentTurnIndex,
        participantId: participant.id,
        participantName: participant.name,
        content,
        timestamp: new Date().toISOString(),
        metadata: {
          duration,
          language: this.context.config.language,
        },
      };

      // Add to context
      this.context.turns.push(turn);
      this.context.currentTurnIndex++;

      // Display content and footer
      console.log("");
      console.log(content);
      console.log("");
      console.log(displayTurnFooter(turn));
      console.log("");

      return turn;
    } catch (error) {
      console.error(
        `Error in turn for ${participant.name}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Check if discussion should terminate
   */
  shouldTerminate(): boolean {
    const config = this.context.config.orchestration;

    // Check max turns
    if (this.context.currentTurnIndex >= config.maxTurns) {
      return true;
    }

    // Check termination condition (regex pattern)
    if (config.terminationCondition && this.context.turns.length > 0) {
      const lastTurn = this.context.turns[this.context.turns.length - 1];
      const regex = new RegExp(config.terminationCondition, "i");
      if (regex.test(lastTurn.content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Complete the discussion
   */
  complete(): void {
    this.context.status = "completed";
    console.log("\n✓ Discussion completed");
    console.log(`Total turns: ${this.context.turns.length}`);
    console.log(
      `Duration: ${Math.round((Date.now() - this.context.startTime.getTime()) / 1000)}s`
    );
  }

  /**
   * Abort the discussion
   */
  abort(): void {
    this.context.status = "aborted";
    console.log("\n✗ Discussion aborted");
  }

  /**
   * Pause the discussion
   */
  pause(): void {
    this.context.status = "paused";
    this.context.pausedAt = new Date();
    console.log("\n⏸ Discussion paused");
  }

  /**
   * Resume the discussion
   */
  resume(): void {
    this.context.status = "active";
    this.context.pausedAt = undefined;
    console.log("\n▶ Discussion resumed");
  }

  /**
   * Get current context
   */
  getContext(): DiscussionContext {
    return this.context;
  }

  /**
   * Initialize participant drivers
   */
  private async initializeDrivers(): Promise<void> {
    for (const participant of this.context.participants) {
      const driver = this.createDriver(participant);

      // Validate driver
      const isValid = await driver.validate();
      if (!isValid && participant.required) {
        throw new Error(
          `Required participant ${participant.name} failed validation`
        );
      }

      this.drivers.set(participant.id, driver);
    }
  }

  /**
   * Create appropriate driver for participant
   */
  private createDriver(participant: Participant): ParticipantDriver {
    switch (participant.type) {
      case "api":
        return new ApiParticipantDriver(participant, this.router);
      case "cli":
        return new CliParticipantDriver(participant);
      case "human":
        return new HumanParticipantDriver(participant);
      default:
        throw new Error(`Unknown participant type: ${participant.type}`);
    }
  }

  /**
   * Get next participant based on turn order
   */
  private getNextParticipant(): Participant | null {
    const { turnOrder } = this.context.config.orchestration;
    const participants = this.context.participants;

    switch (turnOrder) {
      case "sequential":
        // Each participant speaks once in order
        if (this.context.currentTurnIndex < participants.length) {
          return participants[this.context.currentTurnIndex];
        }
        return null;

      case "round-robin":
        // Cycle through participants
        const index = this.context.currentTurnIndex % participants.length;
        return participants[index];

      case "dynamic":
        // TODO: Implement AI-driven turn selection
        // For now, fallback to round-robin
        return participants[
          this.context.currentTurnIndex % participants.length
        ];

      default:
        throw new Error(`Unknown turn order: ${turnOrder}`);
    }
  }

  /**
   * Build prompt for current turn
   */
  private buildTurnPrompt(participant: Participant): string {
    // Use scenario's initial prompt for first turn
    if (this.context.currentTurnIndex === 0) {
      const initialPrompt = this.context.config.metadata?.initialPrompt;
      return (
        initialPrompt ||
        `Please provide your analysis as the ${participant.role}.`
      );
    }

    // For subsequent turns, provide context
    return `Based on the discussion so far, provide your perspective as the ${participant.role}.`;
  }

  /**
   * Check if content is a control command
   */
  private isControlCommand(content: string): boolean {
    return parseControlCommand(content) !== null;
  }

  /**
   * Handle control command from human participant
   */
  private handleControlCommand(
    content: string,
    participant: Participant
  ): Turn {
    const command = parseControlCommand(content);
    if (!command) {
      throw new Error("Invalid control command");
    }

    console.log(`\n[Control Command] ${content}`);

    // Create a special turn for the command
    const turn: Turn = {
      index: this.context.currentTurnIndex,
      participantId: participant.id,
      participantName: participant.name,
      content: `[COMMAND: ${command.type}]`,
      timestamp: new Date().toISOString(),
      metadata: {
        controlCommand: command,
      },
    };

    this.context.turns.push(turn);
    this.context.currentTurnIndex++;

    // Process command
    this.processControlCommand(command);

    return turn;
  }

  /**
   * Process a control command
   */
  private processControlCommand(command: ControlCommand): void {
    switch (command.type) {
      case "pause":
        this.pause();
        break;

      case "resume":
        this.resume();
        break;

      case "next":
        // Next participant will be handled by getNextParticipant
        // This is just recorded for now
        console.log(
          `Next speaker will be #${command.targetNumbers?.[0]}`
        );
        break;

      case "pass":
        console.log("Turn skipped");
        break;

      case "help":
        console.log("\n=== Control Commands ===");
        console.log("next #N - Set next speaker");
        console.log("ask #N message - Ask specific participant");
        console.log("pass - Skip turn");
        console.log("pause - Pause discussion");
        console.log("list - Show participants");
        console.log("history - Show recent turns");
        break;

      default:
        console.log(`Command '${command.type}' not yet implemented`);
    }
  }
}
