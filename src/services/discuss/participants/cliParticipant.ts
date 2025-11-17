/**
 * CLI Participant Driver
 * Executes CLI tools like codex and claude
 */

import { spawn } from "node:child_process";
import { BaseParticipantDriver } from "./base.js";
import type {
  Participant,
  DiscussionContext,
} from "../../../domain/discuss/types.js";

/**
 * CLI Participant Driver
 * Executes turns by calling external CLI tools (codex, claude)
 */
export class CliParticipantDriver extends BaseParticipantDriver {
  constructor(participant: Participant) {
    super(participant);

    if (participant.type !== "cli") {
      throw new Error(
        `CliParticipantDriver can only handle CLI participants, got ${participant.type}`
      );
    }

    if (!participant.config.cli) {
      throw new Error(
        `CLI participant ${participant.name} missing cli config`
      );
    }
  }

  /**
   * Execute a turn for this CLI participant
   */
  async execute(
    context: DiscussionContext,
    prompt: string
  ): Promise<string> {
    try {
      const cliConfig = this.participant.config.cli!;
      const tool = cliConfig.tool;

      // Build conversation context
      const conversationContext = this.buildConversationContext(context);
      const fullPrompt = conversationContext
        ? `${conversationContext}\n\n${prompt}`
        : prompt;

      // Execute the CLI tool
      const startTime = Date.now();
      const output = await this.executeCli(tool, fullPrompt, cliConfig);
      const duration = Date.now() - startTime;

      console.debug(
        `${this.getParticipantInfo()} completed turn in ${duration}ms`
      );

      return output;
    } catch (error) {
      throw this.handleError(error, "Failed to execute CLI tool");
    }
  }

  /**
   * Validate that this participant can execute
   */
  async validate(): Promise<boolean> {
    const cliConfig = this.participant.config.cli;
    if (!cliConfig) {
      return false;
    }

    // Check if the CLI tool is available
    try {
      const available = await this.isToolAvailable(cliConfig.tool);
      if (!available) {
        console.warn(
          `${this.getParticipantInfo()} CLI tool '${cliConfig.tool}' not found`
        );
      }
      return available;
    } catch (error) {
      console.error(
        `${this.getParticipantInfo()} validation failed:`,
        error
      );
      return false;
    }
  }

  /**
   * Execute a CLI tool with the given prompt
   */
  private async executeCli(
    tool: "codex" | "claude",
    prompt: string,
    config: NonNullable<Participant["config"]["cli"]>
  ): Promise<string> {
    const args = this.buildCliArgs(tool, prompt, config);

    return this.executeWithTimeout(async () => {
      return new Promise<string>((resolve, reject) => {
        let stdout = "";
        let stderr = "";

        const child = spawn(tool, args, {
          cwd: config.workingDir || process.cwd(),
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
        });

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("error", (error) => {
          reject(
            new Error(`Failed to spawn ${tool}: ${error.message}`)
          );
        });

        child.on("close", (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `${tool} exited with code ${code}\nStderr: ${stderr}`
              )
            );
          } else {
            resolve(stdout.trim() || stderr.trim());
          }
        });

        // Write prompt to stdin if the tool supports it
        if (child.stdin) {
          child.stdin.write(prompt);
          child.stdin.end();
        }
      });
    }, config.timeout || this.timeout);
  }

  /**
   * Build CLI arguments based on tool type
   */
  private buildCliArgs(
    tool: "codex" | "claude",
    prompt: string,
    config: NonNullable<Participant["config"]["cli"]>
  ): string[] {
    const baseArgs = config.args || [];

    // Tool-specific argument patterns
    if (tool === "codex") {
      // codex exec --full-auto "prompt"
      return [
        "exec",
        "--skip-git-repo-check",
        "--full-auto",
        ...baseArgs,
        prompt,
      ];
    } else if (tool === "claude") {
      // claude chat "prompt" or claude -p "prompt"
      return ["chat", ...baseArgs, prompt];
    }

    return [...baseArgs, prompt];
  }

  /**
   * Check if a CLI tool is available
   */
  private async isToolAvailable(tool: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(tool, ["--version"], {
        stdio: "ignore",
        shell: false,
      });

      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  }

  /**
   * Build conversation history context for CLI
   */
  private buildConversationContext(context: DiscussionContext): string {
    if (context.turns.length === 0) {
      return "";
    }

    const lines: string[] = [];
    lines.push("=== Previous Discussion ===\n");

    for (const turn of context.turns) {
      const participant = context.participants.find(
        (p) => p.id === turn.participantId
      );

      if (participant) {
        lines.push(`[#${participant.number} ${participant.name}]:`);
        lines.push(turn.content);
        lines.push("");
      }
    }

    lines.push("=== End of Previous Discussion ===\n");
    lines.push("Please provide your analysis based on the discussion above.");

    return lines.join("\n");
  }

  /**
   * Get tool information for display
   */
  getToolInfo(): string {
    return this.participant.config.cli?.tool || "unknown";
  }
}
