import { Command, Flags, Interfaces } from "@oclif/core";
import { createDiscussServer } from "@/services/discuss/server.ts";
import { DiscussionEngine } from "@/services/discuss/engine.ts";
import { createRouter } from "@/services/prompt/router.ts";
import * as open from "open";
import * as readline from "readline";

export default class DiscussCommand extends Command {
  static description = "Start a discussion between multiple AI models";

  static flags: Interfaces.FlagInput = {
    ui: Flags.boolean({
      description: "Launch Web UI",
      default: false,
    }),
    topic: Flags.string({
      char: "t",
      description: "Topic to discuss",
    }),
    models: Flags.string({
      char: "m",
      description: "Comma-separated list of models to participate",
    }),
    strategy: Flags.string({
      char: "s",
      description: "Turn-taking strategy (random, round-robin)",
      options: ["random", "round-robin"],
      default: "random",
    }),
    timeout: Flags.integer({
      description: "Timeout per turn in seconds",
      default: 30,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DiscussCommand);

    if (flags.ui) {
      await this.#runUI();
    } else {
      await this.#runCLI(flags);
    }
  }

  async #runUI() {
    this.log("Starting Web UI...");
    const port = 3000;
    const server = await createDiscussServer(port);
    
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    const url = `http://localhost:${actualPort}`;
    this.log(`Server running at ${url}`);
    
    // Open browser
    // @ts-ignore
    await open.default(url);
    
    this.log("Press Ctrl+C to stop");
    
    // Keep process alive
    return new Promise(() => {});
  }

  async #runCLI(flags: Interfaces.InferredFlags<typeof DiscussCommand.flags>) {
    const router = await createRouter();
    const availableModels = router.getRegistry().getAllModels();

    let topic = flags.topic;
    let selectedModels = flags.models ? flags.models.split(",") : [];

    // Interactive selection if not provided
    if (!topic) {
      topic = await this.#prompt("Enter topic: ");
    }

    if (selectedModels.length === 0) {
      this.log("Available models:");
      availableModels.forEach((m, i) => this.log(`${i + 1}. ${m}`));
      const indices = await this.#prompt("Select models (comma-separated indices, e.g. 1,2): ");
      selectedModels = indices.split(",").map(i => availableModels[parseInt(i.trim()) - 1]).filter(Boolean);
    }

    if (selectedModels.length < 2) {
      this.error("At least 2 models are required for a discussion.");
    }

    // Initialize Engine
    const engine = new DiscussionEngine(router, {
      topic,
      strategy: flags.strategy as "random" | "round-robin",
      timeoutMs: flags.timeout * 1000,
    });

    // Add participants
    selectedModels.forEach((model: string, i: number) => {
      engine.addParticipant({
        id: `model-${i}`,
        name: model, // Use model name as display name for now
        model: model,
        type: "ai",
      });
    });

    // Add User as participant (for manual injection)
    engine.addParticipant({
      id: "user",
      name: "User",
      type: "human",
    });

    this.log(`\nStarting discussion on "${topic}" with: ${selectedModels.join(", ")}\n`);
    this.log("Controls:");
    this.log("  [Space] Pause/Resume");
    this.log("  [m]     Toggle Auto/Manual Mode");
    this.log("  [n]     Next Turn (Manual Mode)");
    this.log("  [i]     Interrupt / Speak");
    this.log("  [s]     Summarize & Stop");
    this.log("  [q]     Quit");
    this.log("\n--------------------------------------------------\n");

    // Setup Event Listeners
    engine.on("turn-start", (participantId) => {
      const p = engine.participants.find(p => p.id === participantId);
      process.stdout.write(`\n\n[${p?.name}]: `);
    });

    engine.on("message-chunk", ({ delta }) => {
      process.stdout.write(delta);
    });

    engine.on("error", ({ participantId, error }) => {
      const p = engine.participants.find(p => p.id === participantId);
      console.error(`\n[Error] ${p?.name}: ${error.message}`);
    });

    engine.on("participant-dropped", (participantId) => {
      const p = engine.participants.find(p => p.id === participantId);
      console.error(`\n[System] ${p?.name} has left the chat (too many errors).`);
    });

    // Start
    engine.start();

    // Handle Keyboard Input
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on("keypress", async (str, key) => {
      if (key.ctrl && key.name === "c") {
        process.exit();
      }
      
      if (key.name === "q") {
        engine.stop();
        process.exit();
      }

      // Ignore keys if we are in input mode (handled by prompt)
      // But since we are in raw mode, we need to handle input manually if we want a prompt
      // This is tricky with raw mode + readline. 
      // Strategy: Pause raw mode, use readline, then resume raw mode.

      if (key.name === "space") {
        if (engine.status === "paused") engine.resume();
        else engine.pause();
        this.log(`\n[System] Discussion ${engine.status}`);
      }

      if (key.name === "m") {
        const newMode = engine.mode === "auto" ? "manual" : "auto";
        engine.setMode(newMode);
        this.log(`\n[System] Mode switched to ${newMode.toUpperCase()}`);
      }

      if (key.name === "n") {
        if (engine.mode === "manual") {
          // Pick next speaker
          // For simplicity in CLI, just pick random or round robin next
          // Ideally we'd show a menu, but let's just trigger next
          // We can expose a method to just "trigger next" in engine or use setNextSpeaker with logic here
          // Let's just force a turn if idle
          if (engine.status === "discussing" || engine.status === "paused") {
             // We need to know who is next. 
             // Let's add a helper in engine or just pick one here.
             const aiParticipants = engine.participants.filter(p => p.type === "ai");
             const random = aiParticipants[Math.floor(Math.random() * aiParticipants.length)];
             engine.setNextSpeaker(random.id);
          }
        } else {
          this.log("\n[System] Switch to Manual mode [m] to use Next [n]");
        }
      }

      if (key.name === "i") {
        // Interrupt
        engine.pause();
        process.stdin.setRawMode(false);
        process.stdout.write("\n[User]: ");
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question("", (answer) => {
          rl.close();
          if (answer.trim()) {
            engine.injectMessage("user", answer);
          }
          process.stdin.setRawMode(true);
          engine.resume();
        });
      }

      if (key.name === "s") {
        engine.pause();
        process.stdin.setRawMode(false);
        
        const aiParticipants = engine.participants.filter(p => p.type === "ai");
        this.log("\nSelect summarizer:");
        aiParticipants.forEach((p, i) => this.log(`${i + 1}. ${p.name}`));
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question("Choice: ", async (answer) => {
          rl.close();
          const idx = parseInt(answer) - 1;
          const summarizer = aiParticipants[idx];
          
          if (summarizer) {
            this.log(`\nGenerating summary with ${summarizer.name}...\n`);
            try {
              const summary = await engine.generateSummary(summarizer.id);
              this.log("\n=== SUMMARY ===\n");
              this.log(summary);
              this.log("\n===============\n");
            } catch (e) {
              this.log(`Error: ${(e as Error).message}`);
            }
          }
          
          process.exit();
        });
      }
    });
    
    // Keep process alive
    return new Promise(() => {});
  }

  async #prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
