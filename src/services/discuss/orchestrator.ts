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
  CodeRequest,
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
  displayParticipantList,
} from "./display/participantDisplay.js";
import { parseControlCommand } from "./control/commandParser.js";
import { CodeAdvisor } from "./code/codeAdvisor.js";
import { createInterface } from "node:readline/promises";

/**
 * Discussion Orchestrator
 * Manages the flow of a multi-participant discussion
 */
export class DiscussionOrchestrator {
  private router: ModelRouter;
  private drivers: Map<string, ParticipantDriver>;
  private context!: DiscussionContext;
  private codeAdvisor: CodeAdvisor | null = null;
  private manualMode: boolean;
  private manualNextParticipant?: Participant;
  private manualPrompt?: string;

  constructor(router: ModelRouter, options?: { manual?: boolean }) {
    this.router = router;
    this.drivers = new Map();
    this.manualMode = options?.manual === true;
  }

  /**
   * Start a new discussion
   */
  async start(
    config: DiscussionConfig,
    initialPrompt: string
  ): Promise<DiscussionContext> {
    const trimmed = initialPrompt.trim();
    const normalizedInitialPrompt = trimmed.length > 0 ? trimmed : undefined;

    // Assign participant numbers
    const participants = assignParticipantNumbers(config.participants);

    const configWithPrompt: DiscussionConfig = {
      ...config,
      participants,
      metadata: normalizedInitialPrompt
        ? { ...config.metadata, initialPrompt: normalizedInitialPrompt }
        : config.metadata,
    };

    // Initialize context
    this.context = {
      config: configWithPrompt,
      turns: [],
      currentTurnIndex: 0,
      status: "active",
      startTime: new Date(),
      participants,
      initialPrompt: normalizedInitialPrompt,
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

    if (this.manualMode) {
      await this.promptManualTurnSelection();
    }

    // Determine next participant
    const participant =
      this.manualNextParticipant ?? this.getNextParticipant();
    this.manualNextParticipant = undefined;

    if (!participant) {
      throw new Error("No participant available for next turn");
    }

    // Get driver
    const driver = this.drivers.get(participant.id);
    if (!driver) {
      throw new Error(`No driver found for participant ${participant.id}`);
    }

    // Build prompt
    let turnPrompt = prompt || this.buildTurnPrompt(participant);

    // Fetch code context if participant needs it
    if (participant.codeNeeds) {
      const codeContext = await this.fetchCodeContext(participant);
      if (codeContext) {
        turnPrompt = `${turnPrompt}\n\n=== Code Context ===\n${codeContext}\n=== End Code Context ===`;
      }
    }

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
          tokens: (() => {
            const tokenGetter =
              (driver as { getTokenUsage?: () => number | undefined })
                .getTokenUsage;
            return typeof tokenGetter === "function"
              ? tokenGetter.call(driver)
              : undefined;
          })(),
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
    if (this.context.status !== "active") {
      return true;
    }
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
   * Manual turn selection and prompt override
   */
  private async promptManualTurnSelection(): Promise<void> {
    if (!this.manualMode) return;
    if (!process.stdin.isTTY) {
      console.warn("[Manual mode] No TTY available, skipping manual selection.");
      return;
    }

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let cancelled = false;
    rl.on("SIGINT", () => {
      cancelled = true;
      rl.close();
    });

    try {
      console.log("\n[Manual Mode] Select next participant by number (default: current order)");
      this.context.participants.forEach((p) => {
        console.log(`#${p.number} ${p.name} (${p.role})`);
      });

      const numberAnswer = await rl.question("Next speaker #: ");
      if (cancelled) throw new Error("Manual mode interrupted");
      const promptOverride = await rl.question("Custom prompt (optional): ");
      if (cancelled) throw new Error("Manual mode interrupted");

      if (numberAnswer.trim()) {
        const num = Number(numberAnswer.trim());
        if (!Number.isNaN(num)) {
          const participant = this.context.participants.find((p) => p.number === num);
          if (participant) {
            this.manualNextParticipant = participant;
          }
        }
      }

      this.manualPrompt = promptOverride.trim() || undefined;
    } catch (error) {
      if (cancelled) {
        this.abort();
        throw new Error("Manual mode interrupted by user");
      }
      throw error;
    } finally {
      rl.close();
    }
  }

  /**
   * Build prompt for current turn
   */
  private buildTurnPrompt(participant: Participant): string {
    if (this.manualPrompt) {
      const prompt = this.manualPrompt;
      this.manualPrompt = undefined;
      return prompt;
    }

    // Use scenario's initial prompt for first turn
    if (this.context.currentTurnIndex === 0) {
      const initialPrompt =
        this.context.initialPrompt ||
        this.context.config.metadata?.initialPrompt;
      return (
        initialPrompt ||
        `Please provide your analysis as the ${participant.role}.`
      );
    }

    // For subsequent turns, provide context
    return `Based on the discussion so far, provide your perspective as the ${participant.role}.`;
  }

  /**
   * Fetch code context for a participant using CodeAdvisor
   */
  private async fetchCodeContext(participant: Participant): Promise<string | null> {
    if (!participant.codeNeeds) {
      return null;
    }

    try {
      // Initialize CodeAdvisor lazily
      if (!this.codeAdvisor) {
        this.codeAdvisor = new CodeAdvisor();
      }

      const request: CodeRequest = {
        topic: participant.codeNeeds.topic,
        specificNeeds: participant.codeNeeds.specificNeeds,
        focus: participant.codeNeeds.focus,
      };

      const context = await this.codeAdvisor.requestCodeContext(request);
      return context;
    } catch (error) {
      console.warn(
        `Failed to fetch code context for ${participant.name}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Check if content is a control command
   */
  private isControlCommand(content: string): boolean {
    return parseControlCommand(content) !== null;
  }

  /**
   * Handle control command from human participant
   * Control commands do NOT consume turns
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

    // Create a special turn for the command (but don't increment turn index)
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

    // Add to turns history but DON'T increment currentTurnIndex
    // This allows the participant to try again without consuming a turn
    this.context.turns.push(turn);

    // Process command
    this.processControlCommand(command);

    // For pass/quit we advance or terminate to avoid getting stuck
    if (command.type === "pass") {
      this.context.currentTurnIndex++;
    }

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

      case "quit":
        console.log("\n[Quit] Terminating discussion...");
        this.abort();
        break;

      case "next":
        // Next participant will be handled by getNextParticipant
        // This is just recorded for now
        console.log(
          `Next speaker will be #${command.targetNumbers?.[0]}`
        );
        break;

      case "pass":
        console.log("[Pass] Turn skipped - you can speak again");
        break;

      case "help":
        console.log("\n=== Control Commands ===");
        console.log("next #N - Set next speaker");
        console.log("ask #N message - Ask specific participant");
        console.log("pass - Skip turn (doesn't consume turn)");
        console.log("pause - Pause discussion");
        console.log("quit - End discussion");
        console.log("list - Show participants");
        console.log("history - Show recent turns");
        console.log("help - Show this help");
        break;

      case "list":
        console.log(
          displayParticipantList(this.context.participants, {
            language: this.context.config.language,
            maxTurns: this.context.config.orchestration.maxTurns,
            turnOrder: this.context.config.orchestration.turnOrder,
          })
        );
        break;

      case "history": {
        const recent = this.context.turns.slice(-5);
        console.log("\n=== Recent Turns ===");
        for (const turn of recent) {
          console.log(
            `#${turn.index + 1} ${turn.participantName}: ${turn.content.slice(0, 120)}`
          );
        }
        break;
      }

      case "summary": {
        const grouped = new Map<string, string>();
        for (const turn of this.context.turns) {
          if (!grouped.has(turn.participantName)) {
            grouped.set(turn.participantName, turn.content.slice(0, 200));
          }
        }
        console.log("\n=== Quick Summary (first message per participant) ===");
        for (const [name, content] of grouped.entries()) {
          console.log(`- ${name}: ${content}`);
        }
        break;
      }

      default:
        console.log(`Command '${command.type}' not yet implemented`);
    }
  }
}
