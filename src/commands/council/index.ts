import { Command, Flags, Interfaces } from "@oclif/core";
import { runCouncil } from "@/services/council/runner.ts";
import { createRouter } from "@/services/prompt/router.ts";
import { createDiscussServer } from "@/services/discuss/server.ts";
import * as readline from "node:readline";
import * as open from "open";

export default class CouncilCommand extends Command {
  static summary =
    "Ask multiple models the same question, have them judge peers, and pick the winner.";

  static description =
    "Run a council: collect answers, cross-judge anonymously, and synthesize the best response.";

  static examples: Command.Example[] = [
    {
      description: "CLI mode with explicit models",
      command:
        '<%= config.bin %> <%= command.id %> --question "How to cache HTTP responses?" --models "gpt-4o,claude-3.5-sonnet"',
    },
    {
      description: "Provide separate judge set and final model",
      command:
        '<%= config.bin %> <%= command.id %> --question "PostgreSQL tuning" --models "gpt-4o,claude-3.5-sonnet" --judges "gemini-2.0-pro-exp,claude-3.5-sonnet" --final-model "gpt-4o"',
    },
    {
      description: "Launch the Web UI",
      command: "<%= config.bin %> <%= command.id %> --ui",
    },
  ];

  static flags: Interfaces.FlagInput = {
    ui: Flags.boolean({
      description: "Launch Web UI for council mode",
      default: false,
    }),
    question: Flags.string({
      char: "q",
      description: "Question to ask every model",
    }),
    models: Flags.string({
      char: "m",
      description: "Comma-separated list of models to answer",
    }),
    judges: Flags.string({
      char: "j",
      description: "Comma-separated list of judge models (defaults to models)",
    }),
    "final-model": Flags.string({
      description:
        "Model used to write the final synthesis (defaults to first judge)",
    }),
    json: Flags.boolean({
      description: "Print full JSON result",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CouncilCommand);

    if (flags.ui) {
      await this.#runUI();
      return;
    }

    const question = flags.question ?? (await this.#prompt("Question: "));
    const models = parseList(flags.models);
    if (models.length < 2) {
      this.error("Provide at least two models via --models");
    }

    const judges = parseList(flags.judges);
    const finalModel = flags["final-model"];

    const router = await createRouter();
    const result = await runCouncil(router, {
      question,
      models,
      judgeModels: judges.length > 0 ? judges : undefined,
      finalModel,
    });

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2));
      return;
    }

    this.#printSummary(result);
  }

  async #runUI() {
    this.log("Starting Web UI...");
    const port = 3000;
    const server = await createDiscussServer(port);
    const address = server.address();
    const actualPort =
      typeof address === "object" && address ? address.port : port;
    const url = `http://localhost:${actualPort}`;
    this.log(`Server running at ${url}`);
    // @ts-ignore open types
    await open.default(url);
    this.log("Press Ctrl+C to stop");
    return new Promise(() => {});
  }

  #printSummary(result: Awaited<ReturnType<typeof runCouncil>>) {
    this.log(`\nQuestion: ${result.question}`);
    this.log("\nStage 1: Candidate responses");
    result.stage1.forEach((c) => {
      this.log(`- ${c.label} (${c.model})`);
      this.log(indent(c.content));
    });

    if (result.aggregates.length > 0) {
      this.log("\nLeaderboard:");
      result.aggregates.forEach((a, idx) => {
        this.log(
          `${idx + 1}. ${a.label} (${a.model}) — avg ${a.average} from ${a.votes} votes`,
        );
      });
    }

    if (result.final) {
      this.log(
        `\nFinal (${result.final.model}):\n${indent(result.final.content)}`,
      );
    }
  }

  async #prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}

function parseList(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
