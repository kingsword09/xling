/**
 * CLI mode for discuss command
 */

import * as readline from "node:readline";
import { DiscussionEngine } from "@/services/discuss/engine.ts";
import { promptUser, createReadlineInterface } from "@/utils/cli.ts";
import { selectModelsInteractive } from "@/services/discuss/interactive-selector.ts";
import type { createRouter } from "@/services/prompt/router.ts";

export interface CliModeOptions {
  topic?: string;
  models?: string;
  strategy: "random" | "round-robin";
  timeout: number;
}

type Router = Awaited<ReturnType<typeof createRouter>>;

/**
 * Run CLI discussion mode
 */
export async function runCliMode(
  options: CliModeOptions,
  router: Router,
  log: (msg: string) => void,
  error: (msg: string) => never,
): Promise<never> {
  const registry = router.getRegistry();
  const availableModels = registry.getAllModels();

  let topic = options.topic;
  let selectedModels = options.models
    ? options.models
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    : [];

  if (!topic) {
    topic = await promptUser("Enter topic: ");
  }

  if (selectedModels.length === 0) {
    selectedModels = await selectModelsInteractive(availableModels);
  }

  const unsupported = selectedModels.filter(
    (model) => !registry.isModelSupported(model),
  );

  if (unsupported.length > 0) {
    error(
      `Unsupported model(s): ${unsupported.join(", ")}. Available: ${availableModels.join(", ")}`,
    );
  }

  if (selectedModels.length < 2) {
    error("At least 2 models are required for a discussion.");
  }

  const engine = new DiscussionEngine(router, {
    topic,
    strategy: options.strategy,
    timeoutMs: options.timeout * 1000,
  });

  selectedModels.forEach((model: string, i: number) => {
    engine.addParticipant({
      id: `model-${i}`,
      name: model,
      model: model,
      type: "ai",
    });
  });

  engine.addParticipant({
    id: "user",
    name: "User",
    type: "human",
  });

  log(
    `\nStarting discussion on "${topic}" with: ${selectedModels.join(", ")}\n`,
  );
  log("Controls:");
  log("  [Space] Pause/Resume");
  log("  [m]     Toggle Auto/Manual Mode");
  log("  [n]     Next Turn (Manual Mode)");
  log("  [i]     Interrupt / Speak");
  log("  [s]     Summarize & Stop");
  log("  [q]     Quit");
  log("\n--------------------------------------------------\n");

  setupEventListeners(engine, log);
  engine.start();
  setupKeyboardHandlers(engine, log);

  return new Promise(() => {});
}

function setupEventListeners(
  engine: DiscussionEngine,
  _log: (msg: string) => void,
): void {
  engine.on("turn-start", (participantId) => {
    const p = engine.participants.find((p) => p.id === participantId);
    process.stdout.write(`\n\n[${p?.name}]: `);
  });

  engine.on("message-chunk", ({ delta }) => {
    process.stdout.write(delta);
  });

  engine.on("error", ({ participantId, error }) => {
    const p = engine.participants.find((p) => p.id === participantId);
    console.error(`\n[Error] ${p?.name}: ${error.message}`);
  });

  engine.on("participant-dropped", (participantId) => {
    const p = engine.participants.find((p) => p.id === participantId);
    console.error(`\n[System] ${p?.name} has left the chat (too many errors).`);
  });
}

function setupKeyboardHandlers(
  engine: DiscussionEngine,
  log: (msg: string) => void,
): void {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  const handleSigint = () => {
    engine.stop();
    process.exit();
  };
  process.on("SIGINT", handleSigint);

  process.stdin.on("keypress", (str, key) => {
    void (async () => {
      if (key.ctrl && key.name === "c") {
        process.exit();
      }

      if (key.name === "q") {
        engine.stop();
        process.exit();
      }

      if (key.name === "space") {
        if (engine.status === "paused") engine.resume();
        else engine.pause();
        log(`\n[System] Discussion ${engine.status}`);
      }

      if (key.name === "m") {
        const newMode = engine.mode === "auto" ? "manual" : "auto";
        engine.setMode(newMode);
        log(`\n[System] Mode switched to ${newMode.toUpperCase()}`);
      }

      if (key.name === "n") {
        if (engine.mode === "manual") {
          if (engine.status === "discussing" || engine.status === "paused") {
            const aiParticipants = engine.participants.filter(
              (p) => p.type === "ai",
            );
            const random =
              aiParticipants[Math.floor(Math.random() * aiParticipants.length)];
            engine.setNextSpeaker(random.id);
          }
        } else {
          log("\n[System] Switch to Manual mode [m] to use Next [n]");
        }
      }

      if (key.name === "i") {
        engine.pause();
        process.stdin.setRawMode(false);
        process.stdout.write("\n[User]: ");

        const rl = createReadlineInterface();

        rl.question("", (answer) => {
          rl.close();
          if (answer.trim()) {
            void engine.injectMessage("user", answer);
          }
          process.stdin.setRawMode(true);
          engine.resume();
        });
      }

      if (key.name === "s") {
        engine.pause();
        process.stdin.setRawMode(false);

        const aiParticipants = engine.participants.filter(
          (p) => p.type === "ai",
        );
        log("\nSelect summarizer:");
        aiParticipants.forEach((p, i) => log(`${i + 1}. ${p.name}`));

        const rl = createReadlineInterface();

        rl.question("Choice: ", (answer) => {
          void (async () => {
            rl.close();
            const idx = parseInt(answer) - 1;
            const summarizer = aiParticipants[idx];

            if (summarizer) {
              log(`\nGenerating summary with ${summarizer.name}...\n`);
              try {
                const summary = await engine.generateSummary(summarizer.id);
                log("\n=== SUMMARY ===\n");
                log(summary);
                log("\n===============\n");
              } catch (e) {
                log(`Error: ${(e as Error).message}`);
              }
            }

            process.exit();
          })();
        });
      }
    })();
  });
}
