import { Args, Command, Flags, Interfaces } from "@oclif/core";
import { DiscussionOrchestrator } from "@/services/discuss/orchestrator.js";
import { ModelRouter } from "@/services/prompt/router.js";
import { XlingAdapter } from "@/services/settings/adapters/xling.js";
import { DiscussionStorage } from "@/services/discuss/storage/discussionStorage.js";
import {
  assignParticipantNumbers,
  displayParticipantList,
} from "@/services/discuss/display/participantDisplay.js";
import type {
  DiscussionConfig,
  DiscussionContext,
  Participant,
  TurnOrder,
  Language,
  ParticipantTemplate,
} from "@/domain/discuss/types.js";
import { ValidationError } from "@/services/discuss/errors/index.ts";
import { DISCUSSION_CONFIG } from "@/services/discuss/config/constants.ts";
import type {
  PromptRequest,
  PromptResponse,
} from "@/services/prompt/types.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DiscussionHistory } from "@/domain/discuss/types.js";
import { createInterface } from "node:readline/promises";

class MockModelRouter {
  async execute(request: PromptRequest): Promise<PromptResponse> {
    const prefix = request.prompt?.slice(0, 40) || "No prompt provided";
    return {
      content: `MOCK RESPONSE: ${prefix}...`,
      model: request.model || "mock-model",
      provider: "mock",
    };
  }
}

export default class Discuss extends Command {
  static summary = "Start multi-role AI discussions with code analysis";

  static description = `
    Start a multi-role AI discussion where different AI models, CLI tools, and humans
    can collaborate on complex topics. Features dynamic code advisor mode where each
    participant can request specific code context from Codex.

    Built-in scenarios:
    - code-review: Multi-perspective code review
    - architecture: System architecture design
    - brainstorm: Creative technical brainstorming
    - decision-review: Technical decision analysis
    - bug-triage: Collaborative bug analysis

    Security Features:
    - Input validation and sanitization
    - Command injection protection
    - Resource limits and timeouts
    - Secure temporary file handling

    Performance Optimizations:
    - Context windowing to prevent OOM
    - Asynchronous I/O operations
    - Intelligent caching
    - Resource lifecycle management
  `;

  static examples: Command.Example[] = [
    {
      description: "Start code review discussion",
      command: "<%= config.bin %> <%= command.id %> code-review",
    },
    {
      description: "Start custom discussion with specific participants",
      command: "<%= config.bin %> <%= command.id %> --participants 'api:gpt-4o:Architect,human:Developer,api:claude-sonnet:Reviewer'",
    },
    {
      description: "Resume previous discussion",
      command: "<%= config.bin %> <%= command.id %> --resume <discussion-id>",
    },
    {
      description: "List discussion history",
      command: "<%= config.bin %> <%= command.id %> --list",
    },
    {
      description: "Start with dynamic code advisor mode",
      command: "<%= config.bin %> <%= command.id %> --scenario code-review --code-advisor",
    },
  ];

  static flags: Interfaces.FlagInput = {
    scenario: Flags.string({
      char: 's',
      description: 'Built-in discussion scenario',
      options: ['code-review', 'architecture', 'brainstorm', 'decision-review', 'bug-triage'],
      default: 'code-review',
    }),

    participants: Flags.string({
      char: 'p',
      description: 'Custom participants (format: type:model:name,type:model:name)',
      helpValue: 'api:gpt-4o:Architect,human:Developer',
    }),

    'max-turns': Flags.integer({
      char: 'm',
      description: 'Maximum number of turns',
      default: DISCUSSION_CONFIG.maxTurns.default,
      min: 1,
      max: DISCUSSION_CONFIG.maxTurns.deep,
    }),

    'turn-order': Flags.string({
      char: 'o',
      description: 'Turn order strategy',
      options: ['sequential', 'round-robin'],
      default: 'round-robin',
    }),

    language: Flags.string({
      char: 'l',
      description: 'Discussion language',
      options: ['en', 'zh', 'es', 'ja', 'auto'],
      default: 'auto',
    }),

    'code-advisor': Flags.boolean({
      char: 'c',
      description: 'Enable dynamic code advisor mode',
      default: false,
    }),

    continue: Flags.boolean({
      char: 'c',
      description: 'Continue the most recent discussion',
      default: false,
    }),

    resume: Flags.boolean({
      char: 'r',
      description: 'Pick a discussion from history to resume',
      default: false,
    }),

    list: Flags.boolean({
      char: 'L',
      description: 'List discussion history',
      default: false,
    }),

    export: Flags.string({
      char: 'e',
      description: 'Export discussion to file (json or md)',
    }),

    timeout: Flags.integer({
      char: 't',
      description: 'Timeout per turn in seconds',
      default: Math.floor(DISCUSSION_CONFIG.timeouts.api / 1000),
      min: 30,
      max: 600,
    }),

    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose logging',
      default: false,
    }),

    'dry-run': Flags.boolean({
      description: 'Run without external providers using mock responses',
      default: false,
    }),

    manual: Flags.boolean({
      description: 'Manual turn control: select next participant and prompt before each turn',
      default: false,
    }),

    force: Flags.boolean({
      char: 'f',
      description: 'Force resume completed discussions without confirmation',
      default: false,
    }),

  };

  static args: Interfaces.ArgInput = {
    topic: Args.string({
      description: 'Discussion topic or prompt',
      required: false,
    }),
  };

  private flags!: Interfaces.InferredFlags<typeof Discuss.flags>;
  private args!: Interfaces.InferredArgs<typeof Discuss.args>;
  private orchestrator!: DiscussionOrchestrator;
  private storage!: DiscussionStorage;
  private context!: DiscussionContext;

  async run(): Promise<void> {
    const parsed = await this.parse(Discuss);
    this.flags = parsed.flags;
    this.args = parsed.args;
    const useMockRouter = this.flags["dry-run"];

    try {
      const adapter = new XlingAdapter();
      const config = adapter.readConfig(adapter.resolvePath("user"));
      const router = useMockRouter
        ? new MockModelRouter()
        : new ModelRouter(config);
      this.orchestrator = new DiscussionOrchestrator(router as unknown as ModelRouter, {
        manual: this.flags.manual,
      });
      this.storage = new DiscussionStorage();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Failed to initialize discuss command: ${message}`);
      return;
    }

    try {
      if (this.flags.list) {
        await this.listDiscussions();
        return;
      }

      if (this.flags.continue) {
        await this.resumeLatestDiscussion();
        return;
      }

      if (this.flags.resume) {
        await this.resumeWithPicker();
        return;
      }

      await this.startNewDiscussion();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Unexpected error: ${message}`);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async startNewDiscussion(): Promise<void> {
    const { topic } = this.args;

    // Build discussion configuration
    const config = await this.buildDiscussionConfig(this.flags["dry-run"]);

    // Validate configuration
    await this.validateConfig(config);

    // Start discussion
    this.log(`🚀 Starting discussion: ${topic || config.topic}`);

    try {
      const initialPrompt =
        topic || config.metadata?.initialPrompt || (this.flags["dry-run"]
          ? "This is a dry-run. Respond concisely."
          : "Begin discussion");

      this.context = await this.orchestrator.start(config, initialPrompt);

      // Display participant list (assign numbers for readability)
      const numbered = assignParticipantNumbers(config.participants);
      this.log(
        displayParticipantList(numbered, {
          language: config.language,
          maxTurns: config.orchestration.maxTurns,
          turnOrder: String(config.orchestration.turnOrder),
        })
      );

      // Run discussion loop
      await this.runDiscussionLoop();

      // Complete discussion
      await this.completeDiscussion();

    } catch (error) {
      await this.handleError(error);
    }
  }

  private async buildDiscussionConfig(
    useMockRouter: boolean
  ): Promise<DiscussionConfig> {
    const configId = `discuss_${Date.now()}`;

    const participants = useMockRouter
      ? this.flags.participants
        ? await this.parseCustomParticipants(this.flags.participants)
        : [
            {
              id: "participant-1",
              number: 1,
              name: "Mock Expert",
              role: "General Expert",
              type: "api" as const,
              config: {
                api: { model: "mock-model" },
                systemPrompt: "You are a concise expert providing brief answers.",
              },
              required: true,
            },
          ]
      : this.flags.participants
        ? await this.parseCustomParticipants(this.flags.participants)
        : await this.getScenarioParticipants(this.flags.scenario);

    return {
      id: configId,
      topic: this.args.topic || `${this.flags.scenario} discussion`,
      scenario: this.flags.scenario,
      language: this.flags.language as Language,
      participants,
      orchestration: {
        turnOrder: this.flags["turn-order"] as TurnOrder,
        maxTurns: this.flags["max-turns"],
        allowSkip: false,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        projectPath: process.cwd(),
      },
    };
  }

  private async parseCustomParticipants(participantsStr: string): Promise<Participant[]> {
    const parts = participantsStr.split(',');
    const participants: Participant[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      const [type, model, name] = part.split(':');

      if (!type || !model || !name) {
        throw new ValidationError(`Invalid participant format: ${part}. Expected: type:model:name`);
      }

      const normalizedType = type.trim();
      participants.push({
        id: `participant-${i + 1}`,
        number: i + 1,
        name: name.trim(),
        role: name.trim(),
        type: normalizedType as Participant["type"],
        config: this.buildParticipantConfig(normalizedType, model.trim()),
        required: true,
      });
    }

    return participants;
  }

  private async getScenarioParticipants(scenarioId: string): Promise<Participant[]> {
    const { getScenarioById } = await import("@/domain/discuss/scenarios.js");
    const scenario = getScenarioById(scenarioId);

    if (!scenario) {
      throw new ValidationError(`Unknown scenario: ${scenarioId}`);
    }

    return scenario.participants.map((p: ParticipantTemplate, i: number) => {
      const preferredModel =
        (p.preferredModels && p.preferredModels[0]) || "gpt-4o";

      return {
        id: `participant-${i + 1}`,
        number: i + 1,
        name: p.role,
        role: p.role,
        type: p.type,
        config:
          p.type === "api"
            ? {
                api: { model: preferredModel },
                systemPrompt: p.systemPrompt,
              }
            : p.type === "cli"
              ? {
                  cli: {
                    tool: p.config?.tool || "codex",
                    args: [],
                  },
                  systemPrompt: p.systemPrompt,
                }
              : {
                  human: { inputMode: p.config?.inputMode || "tty" },
                  systemPrompt: p.systemPrompt,
                },
        required: p.required,
      };
    });
  }

  private buildParticipantConfig(
    type: string,
    model: string
  ): Participant["config"] {
    switch (type) {
      case 'api':
        return {
          api: {
            model,
            temperature: 0.7,
            maxTokens: 2000,
          },
          systemPrompt: this.getDefaultSystemPrompt(model),
        };

      case 'human':
        return {
          human: {
            inputMode: 'tty', // Could be 'editor' too
          },
        };

      case 'cli':
        // Only support known CLI tools
        const tool: "codex" | "claude" = model === "claude" ? "claude" : "codex";
        return {
          cli: {
            tool,
            timeout: DISCUSSION_CONFIG.timeouts.cli,
            args: model === 'codex' ? ['--config', 'model_reasoning_effort=high'] : [],
          },
        };

      default:
        throw new ValidationError(`Unknown participant type: ${type}`);
    }
  }

  private getDefaultSystemPrompt(model: string): string {
    const prompts: Record<string, string> = {
      'gpt-4o': 'You are an expert software engineer participating in a technical discussion.',
      'claude-sonnet': 'You are an experienced software architect providing expert analysis.',
      'gpt-4o-mini': 'You are a knowledgeable developer contributing valuable insights.',
    };

    return prompts[model] || 'You are a knowledgeable participant in this technical discussion.';
  }

  private async validateConfig(config: DiscussionConfig): Promise<void> {
    const numbers = config.participants
      .map((p) => p.number)
      .filter((n): n is number => typeof n === "number");
    const uniqueNumbers = new Set(numbers);

    if (numbers.length !== uniqueNumbers.size) {
      throw new ValidationError("Participant numbers must be unique");
    }

    if (config.orchestration.maxTurns < config.participants.length) {
      throw new ValidationError(
        "Max turns must be at least equal to number of participants"
      );
    }
  }

  private async runDiscussionLoop(): Promise<void> {
    while (!this.orchestrator.shouldTerminate()) {
      try {
        const turn = await this.orchestrator.executeTurn();

        // Check for early termination conditions
        if (this.shouldTerminateEarly(turn.content)) {
          this.log("🎯 Discussion completed early based on content analysis");
          break;
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log(`❌ Turn failed: ${message}`);

        // Continue or abort based on error type
        if (error instanceof ValidationError) {
          throw error; // Re-throw validation errors
        }

        // Log but continue for other errors
        if (error instanceof Error && this.flags.verbose) {
          this.log(error.stack || "");
        }
      }
    }
  }

  private shouldTerminateEarly(content: string): boolean {
    // Check for termination patterns
    const terminationPatterns = DISCUSSION_CONFIG.terminationPatterns;

    return terminationPatterns.some(pattern => pattern.test(content));
  }

  private async completeDiscussion(): Promise<void> {
    this.orchestrator.complete();

    // Save discussion
    await this.storage.save(this.context);

    this.log(`✅ Discussion completed`);
    this.log(`💾 Saved as: ${this.context.config.id}`);

    // Export if requested
    if (this.flags.export) {
      await this.exportDiscussion(this.flags.export);
    }
  }

  private async listDiscussions(): Promise<void> {
    const discussions = await this.storage.list();

    if (discussions.length === 0) {
      this.log("No discussions found");
      return;
    }

    this.log("📚 Discussion History:");
    this.log("");

    for (const discussion of discussions) {
      const date = new Date(discussion.createdAt).toLocaleString();
      const turns = discussion.turns?.length || 0;

      this.log(`${discussion.id}`);
      this.log(`  Date: ${date}`);
      this.log(`  Topic: ${discussion.config.topic}`);
      this.log(`  Turns: ${turns}`);
      this.log(`  Status: ${discussion.status}`);
      this.log("");
    }
  }

  private async resumeLatestDiscussion(): Promise<void> {
    const histories = await this.storage.list();
    if (histories.length === 0) {
      throw new ValidationError("No discussions found to continue");
    }
    const latest = histories[0];
    this.log(`🔄 Continuing latest discussion: ${latest.id}`);
    await this.resumeFromHistory(latest);
  }

  private async resumeWithPicker(): Promise<void> {
    const histories = await this.storage.list();

    if (histories.length === 0) {
      throw new ValidationError("No discussions found");
    }

    const picked = await this.promptForHistory(histories);
    this.log(`🔄 Resuming discussion: ${picked.id}`);
    await this.resumeFromHistory(picked);
  }

  private async resumeFromHistory(history: DiscussionHistory): Promise<void> {
    // Show summary for completed discussions
    if (history.status === "completed") {
      this.log(`\n📋 Discussion Summary (${history.id})`);
      this.printHistorySummary(history);

      // Ask if user wants to continue anyway (unless --force is used)
      if (!this.flags.force) {
        if (process.stdin.isTTY) {
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await rl.question("\n❓ This discussion is completed. Continue anyway? (y/N): ");
          rl.close();

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            this.log("✋ Resume cancelled");
            return;
          }

          this.log("🔄 Continuing completed discussion...\n");
        } else {
          this.log("⚠️  Discussion already completed. Use --force to resume non-interactively.");
          return;
        }
      } else {
        this.log("🔄 Force resuming completed discussion...\n");
      }
    }

    const initialPrompt =
      history.config.metadata?.initialPrompt ||
      history.config.topic ||
      "Resume discussion";

    this.context = await this.orchestrator.start(history.config, initialPrompt);

    this.context.turns = history.turns;
    this.context.currentTurnIndex = history.turns.length;
    this.context.startTime = new Date(history.createdAt);
    this.context.status = "active";

    const participants = assignParticipantNumbers(this.context.participants);

    this.log(
        displayParticipantList(participants, {
          language: this.context.config.language,
          maxTurns: this.context.config.orchestration.maxTurns,
          turnOrder: String(this.context.config.orchestration.turnOrder),
        })
      );

    await this.runDiscussionLoop();
    await this.completeDiscussion();
  }

  private async exportDiscussion(filename: string): Promise<void> {
    if (!this.context) {
      throw new ValidationError("No discussion context to export");
    }

    const outputPath = resolve(process.cwd(), filename);
    const ext = filename.toLowerCase().endsWith(".md") ? "md" : "json";

    if (ext === "json") {
      const payload = {
        id: this.context.config.id,
        config: this.context.config,
        turns: this.context.turns,
        status: this.context.status,
        createdAt: this.context.startTime.toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
      this.log(`📤 Exported JSON to: ${outputPath}`);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Discussion: ${this.context.config.topic}`);
    lines.push("");
    lines.push(`- Status: ${this.context.status}`);
    lines.push(`- Turns: ${this.context.turns.length}`);
    lines.push(`- Language: ${this.context.config.language}`);
    lines.push("");
    lines.push("## Turns");
    lines.push("");

    for (const turn of this.context.turns) {
      lines.push(`### Turn ${turn.index + 1} - ${turn.participantName}`);
      lines.push("");
      lines.push(turn.content);
      lines.push("");
    }

    writeFileSync(outputPath, lines.join("\n"), "utf-8");
    this.log(`📤 Exported Markdown to: ${outputPath}`);
  }

  private printHistorySummary(history: DiscussionHistory): void {
    this.log(`Topic: ${history.config.topic}`);
    this.log(`Turns: ${history.turns.length}`);
    this.log(`Status: ${history.status}`);
  }

  private async promptForHistory(
    histories: DiscussionHistory[]
  ): Promise<DiscussionHistory> {
    if (!process.stdin.isTTY) {
      this.log("No TTY detected, picking the most recent discussion.");
      return histories[0];
    }

    this.log("Select a discussion to resume:");
    histories.slice(0, 10).forEach((h, idx) => {
      const date = new Date(h.createdAt).toLocaleString();
      this.log(
        `[${idx + 1}] ${h.id} | ${h.config.topic} | ${h.status} | ${date}`
      );
    });

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await rl.question("Enter a number (default 1): ");
    rl.close();

    const index = Number(answer) || 1;
    const selected = histories[index - 1] ?? histories[0];

    return selected;
  }

  private async handleError(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.log(`❌ Discussion error: ${message}`);

    if (this.context) {
      this.context.status = "aborted";
      await this.storage.save(this.context);
    }

    throw error instanceof Error ? error : new Error(message);
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.orchestrator) {
        this.orchestrator.abort();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`⚠️ Cleanup error: ${message}`);
    }
  }
}
