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

  async #runCLI(flags: { topic?: string; models?: string }) {
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

    const room = new ChatRoom(router, (message) => {
      if (message.role === "system") {
        this.log(`\n[System]: ${message.content}`);
      } else {
        // We might want to handle streaming better in CLI, but for now just log complete messages
        // or if we want streaming, we'd need to handle cursor position.
        // For simplicity in this MVP, we'll just log the final message content if it's not empty.
        // But ChatRoom emits streaming updates too.
        // Let's just log when a message is "done" or handle stream chunks?
        // The ChatRoom emits every chunk for streaming.
        // To avoid spamming console, we should probably only log the full message at the end?
        // Or use process.stdout.write.
        
        // Actually ChatRoom emits cumulative content in streaming mode.
        // So we should clear line and rewrite?
        // For CLI simplicity, let's just print the final message.
        // But ChatRoom doesn't explicitly say "done".
        // We can check if the message ID changed or use a different event?
        // The current ChatRoom implementation calls onMessage for every chunk.
        
        // Let's just implement a simple "clear and write" for the current message ID.
      }
    });

    // We need a way to handle CLI output better for streaming.
    // Since ChatRoom is generic, we might need to adapt it.
    // For now, let's just let it run and maybe it will be a bit messy or we can improve ChatRoom later.
    // Actually, let's improve ChatRoom to emit "start", "chunk", "end" events?
    // Or just handle it here.
    
    let lastMessageId = "";
    
    // Re-instantiate room with a smarter callback
    const cliRoom = new ChatRoom(router, (message) => {
      if (message.role === "system") return; // Handled separately or just ignore for stream
      
      if (message.id !== lastMessageId) {
        process.stdout.write(`\n\n[${message.model}]: `);
        lastMessageId = message.id;
      }
      
      // This is tricky because message.content is cumulative.
      // We need to print only the new part.
      // Or use readline.cursorTo to rewrite the line.
      // Let's just print the whole thing for now, it will be spammy.
      // Better: track length printed so far.
    });
    
    // Wait, I can't re-instantiate easily because I need to pass the callback to constructor.
    // Let's just use a map to track printed length.
    const printedLengths = new Map<string, number>();
    
    const smartRoom = new ChatRoom(router, (message) => {
       if (message.role === "system") {
         // System messages are usually one-off
         if (!printedLengths.has(message.id)) {
            console.log(`\n[System]: ${message.content}`);
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
