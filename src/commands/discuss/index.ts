import { Command, Flags, Interfaces } from "@oclif/core";
import { createDiscussServer } from "@/services/discuss/server.ts";
import { ChatRoom } from "@/services/discuss/room.ts";
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

    this.log(`\nStarting discussion on "${topic}" with: ${selectedModels.join(", ")}\n`);

    const printedLengths = new Map<string, number>();
    
    const smartRoom = new ChatRoom(router, (message) => {
       if (message.role === "system") {
         if (!printedLengths.has(message.id)) {
            this.log(`\n[System]: ${message.content}`);
            printedLengths.set(message.id, message.content.length);
         }
         return;
       }

       if (!printedLengths.has(message.id)) {
         process.stdout.write(`\n\n[${message.model}]: `);
         printedLengths.set(message.id, 0);
       }

       const printed = printedLengths.get(message.id) || 0;
       const newContent = message.content.substring(printed);
       process.stdout.write(newContent);
       printedLengths.set(message.id, message.content.length);
    });

    smartRoom.start(topic, selectedModels);

    // Keep running until user stops
    this.log("\nPress Enter to trigger next turn, or Ctrl+C to exit.");
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on("line", () => {
      smartRoom.nextTurn();
    });
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
