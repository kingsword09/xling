/**
 * Human Participant Driver
 * Handles human input via TTY or editor
 */

import * as readline from "node:readline";
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseParticipantDriver } from "./base.js";
import type {
  Participant,
  DiscussionContext,
} from "../../../domain/discuss/types.js";
import {
  parseControlCommand,
  isControlCommand,
  getHelpText,
} from "../control/commandParser.js";
import type { ControlCommand } from "../../../domain/discuss/types.js";
import { displayHumanInputPrompt } from "../display/participantDisplay.js";

/**
 * Human Participant Driver
 * Collects input from human user via TTY or external editor
 */
export class HumanParticipantDriver extends BaseParticipantDriver {
  constructor(participant: Participant) {
    super(participant);

    if (participant.type !== "human") {
      throw new Error(
        `HumanParticipantDriver can only handle human participants, got ${participant.type}`
      );
    }

    if (!participant.config.human) {
      throw new Error(
        `Human participant ${participant.name} missing human config`
      );
    }
  }

  /**
   * Execute a turn for this human participant
   * Returns either content or a control command
   */
  async execute(
    context: DiscussionContext,
    prompt: string
  ): Promise<string> {
    try {
      const humanConfig = this.participant.config.human!;

      // Display the prompt with context
      console.log(prompt);
      console.log("");

      // Display input instructions
      const instructions = displayHumanInputPrompt(
        this.participant,
        context.currentTurnIndex + 1,
        context.config.orchestration.maxTurns
      );
      console.log(instructions);

      // Collect input based on mode
      if (humanConfig.inputMode === "editor") {
        return await this.collectEditorInput(context);
      } else {
        return await this.collectTtyInput(context);
      }
    } catch (error) {
      throw this.handleError(error, "Failed to collect human input");
    }
  }

  /**
   * Validate that this participant can execute
   */
  async validate(): Promise<boolean> {
    const humanConfig = this.participant.config.human;
    if (!humanConfig) {
      return false;
    }

    // For TTY mode, check if stdin is a TTY
    if (humanConfig.inputMode === "tty") {
      if (!process.stdin.isTTY) {
        console.warn(
          `${this.getParticipantInfo()} requires TTY but stdin is not a TTY`
        );
        return false;
      }
    }

    // For editor mode, check if EDITOR is set
    if (humanConfig.inputMode === "editor") {
      const editor = process.env.EDITOR || process.env.VISUAL;
      if (!editor) {
        console.warn(
          `${this.getParticipantInfo()} requires EDITOR environment variable`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Collect input from TTY (terminal)
   */
  private async collectTtyInput(
    context: DiscussionContext
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      const lines: string[] = [];
      let isFirstLine = true;

      rl.on("line", (line) => {
        // Check for EOF marker
        if (line.trim() === "EOF") {
          rl.close();
          return;
        }

        // Check for control commands on first line
        if (isFirstLine && isControlCommand(line)) {
          rl.close();
          resolve(line); // Return the command as-is
          return;
        }

        isFirstLine = false;
        lines.push(line);
      });

      rl.on("close", () => {
        const content = lines.join("\n").trim();
        if (content) {
          resolve(content);
        } else {
          reject(new Error("No input provided"));
        }
      });

      rl.on("SIGINT", () => {
        rl.close();
        reject(new Error("Input cancelled by user"));
      });
    });
  }

  /**
   * Collect input from external editor
   */
  private async collectEditorInput(
    context: DiscussionContext
  ): Promise<string> {
    const editor = process.env.EDITOR || process.env.VISUAL || "vim";

    // Create temp file with context
    const tmpFile = join(
      tmpdir(),
      `xling-discuss-${Date.now()}-${this.participant.number}.md`
    );

    const templateContent = this.createEditorTemplate(context);
    writeFileSync(tmpFile, templateContent, "utf-8");

    return new Promise((resolve, reject) => {
      const child = spawn(editor, [tmpFile], {
        stdio: "inherit",
        shell: false,
      });

      child.on("error", (error) => {
        unlinkSync(tmpFile);
        reject(new Error(`Failed to open editor: ${error.message}`));
      });

      child.on("exit", (code) => {
        if (code !== 0) {
          unlinkSync(tmpFile);
          reject(new Error(`Editor exited with code ${code}`));
          return;
        }

        try {
          const content = readFileSync(tmpFile, "utf-8");
          unlinkSync(tmpFile);

          // Extract user's response (after the template)
          const response = this.extractResponseFromEditorContent(
            content,
            templateContent
          );

          if (response.trim()) {
            resolve(response);
          } else {
            reject(new Error("No input provided in editor"));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Create template content for editor mode
   */
  private createEditorTemplate(context: DiscussionContext): string {
    const lines: string[] = [];

    lines.push("# Discussion Response");
    lines.push("");
    lines.push(
      `Participant: #${this.participant.number} ${this.participant.name}`
    );
    lines.push(`Turn: ${context.currentTurnIndex + 1} / ${context.config.orchestration.maxTurns}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Show recent turns for context
    if (context.turns.length > 0) {
      lines.push("## Recent Discussion");
      lines.push("");

      const recentTurns = context.turns.slice(-3); // Last 3 turns
      for (const turn of recentTurns) {
        const participant = context.participants.find(
          (p) => p.id === turn.participantId
        );
        if (participant) {
          lines.push(`### #${participant.number} ${participant.name}`);
          lines.push(turn.content);
          lines.push("");
        }
      }

      lines.push("---");
      lines.push("");
    }

    lines.push("## Your Response");
    lines.push("");
    lines.push("Write your response below this line:");
    lines.push("");
    lines.push("<!-- START YOUR RESPONSE HERE -->");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Extract response from editor content
   */
  private extractResponseFromEditorContent(
    content: string,
    template: string
  ): string {
    // Find the marker
    const marker = "<!-- START YOUR RESPONSE HERE -->";
    const markerIndex = content.indexOf(marker);

    if (markerIndex === -1) {
      // No marker found, return everything after template
      return content.replace(template, "").trim();
    }

    // Return everything after the marker
    return content.substring(markerIndex + marker.length).trim();
  }

  /**
   * Check if input is a control command
   */
  isControlCommand(input: string): boolean {
    return isControlCommand(input);
  }

  /**
   * Parse control command from input
   */
  parseControlCommand(input: string): ControlCommand | null {
    return parseControlCommand(input);
  }

  /**
   * Get help text for commands
   */
  getHelpText(language: "en" | "zh" = "en"): string {
    return getHelpText(language);
  }
}
