/**
 * Interactive mode for P command
 * Handles REPL-style conversation with AI models
 */

import * as fs from "node:fs";
import * as readline from "node:readline";
import * as tty from "node:tty";
import type { PromptRequest, ChatMessage } from "@/services/prompt/types.ts";
import type { createRouter } from "@/services/prompt/router.ts";

export interface InteractiveContext {
  initialPrompt: string;
  initialResponse: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

type Router = Awaited<ReturnType<typeof createRouter>>;

/**
 * Ask user if they want to continue conversation
 */
export async function askContinueConversation(
  log: (msg: string) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;

    try {
      const ttyFd = fs.openSync("/dev/tty", "r+");
      const ttyReadStream = new tty.ReadStream(ttyFd);
      const ttyWriteStream = new tty.WriteStream(ttyFd);

      const rl = readline.createInterface({
        input: ttyReadStream,
        output: ttyWriteStream,
      });

      rl.question("\nContinue conversation? (y/N): ", (answer) => {
        answered = true;
        const normalized = answer.trim().toLowerCase();
        const shouldContinue = normalized === "y" || normalized === "yes";
        if (!shouldContinue) {
          ttyWriteStream.write("\nOkay, not continuing the conversation.\n");
        }
        rl.close();
        ttyReadStream.destroy();
        ttyWriteStream.destroy();
        fs.closeSync(ttyFd);
        resolve(shouldContinue);
      });

      setTimeout(() => {
        if (!answered) {
          rl.close();
          ttyReadStream.destroy();
          ttyWriteStream.destroy();
          fs.closeSync(ttyFd);
          process.stdout.write(
            "\nNo response received. Ending conversation prompt.\n",
          );
          resolve(false);
        }
      }, 10000);
    } catch {
      log("Skipping interactive follow-up (TTY not available).");
      resolve(false);
    }
  });
}

/**
 * Enter interactive REPL mode
 */
export async function enterInteractiveMode(
  context: InteractiveContext,
  router: Router,
  log: (msg: string) => void,
  error: (msg: string) => never,
): Promise<void> {
  const messages: ChatMessage[] = [];

  if (context.system) {
    messages.push({ role: "system", content: context.system });
  }

  messages.push({ role: "user", content: context.initialPrompt });
  messages.push({ role: "assistant", content: context.initialResponse });

  log(
    "\n--- Interactive mode (type 'exit', 'quit', or press Ctrl+D to end) ---\n",
  );

  try {
    const { rl, outputStream, cleanup } = setupReadline();

    rl.prompt();

    rl.on("line", (input: string) => {
      void (async () => {
        const trimmed = input.trim();

        if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
          rl.close();
          return;
        }

        if (!trimmed) {
          rl.prompt();
          return;
        }

        messages.push({ role: "user", content: trimmed });

        try {
          const request: PromptRequest = {
            messages,
            model: context.model,
            temperature: context.temperature,
            maxTokens: context.maxTokens,
            stream: true,
          };

          const streamResult = await router.executeStream(request);
          const responseText = await displayStream(streamResult, outputStream);

          messages.push({ role: "assistant", content: responseText });
          rl.prompt();
        } catch (err) {
          outputStream.write(`\n[Error] ${(err as Error).message}\n\n`);
          rl.prompt();
        }
      })();
    });

    rl.on("close", () => {
      cleanup();
      log("\nGoodbye!");
      process.exit(0);
    });

    rl.on("SIGINT", () => {
      outputStream.write(
        "\n\nInterrupted. Type 'exit' to quit or continue chatting.\n",
      );
      rl.prompt();
    });

    const signalHandler = () => {
      cleanup();
      process.exit(0);
    };
    process.once("SIGTERM", signalHandler);
  } catch (err) {
    error(`Cannot enter interactive mode: ${(err as Error).message}`);
  }
}

interface ReadlineSetup {
  rl: readline.Interface;
  outputStream: NodeJS.WritableStream;
  cleanup: () => void;
}

function setupReadline(): ReadlineSetup {
  let ttyFd: number | null = null;
  let ttyReadStream: tty.ReadStream | null = null;
  let ttyWriteStream: tty.WriteStream | null = null;
  let wasRaw = false;
  let inputStream: NodeJS.ReadableStream;

  const cleanup = () => {
    if (inputStream && "setRawMode" in inputStream) {
      try {
        (inputStream as tty.ReadStream).setRawMode(wasRaw);
      } catch {
        // Ignore
      }
    }
    if (ttyReadStream) {
      try {
        ttyReadStream.destroy();
      } catch {
        // Ignore
      }
    }
    if (ttyWriteStream) {
      try {
        ttyWriteStream.destroy();
      } catch {
        // Ignore
      }
    }
    if (ttyFd !== null) {
      try {
        fs.closeSync(ttyFd);
      } catch {
        // Ignore
      }
    }
  };

  if (process.stdin.isTTY) {
    inputStream = process.stdin;
    wasRaw = process.stdin.isRaw || false;
    if (!wasRaw) {
      process.stdin.setRawMode(true);
    }

    return {
      rl: readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
      }),
      outputStream: process.stdout,
      cleanup,
    };
  }

  ttyFd = fs.openSync("/dev/tty", "r+");
  ttyReadStream = new tty.ReadStream(ttyFd);
  ttyWriteStream = new tty.WriteStream(ttyFd);
  inputStream = ttyReadStream;

  wasRaw = ttyReadStream.isRaw || false;
  if (!wasRaw) {
    ttyReadStream.setRawMode(true);
  }

  return {
    rl: readline.createInterface({
      input: ttyReadStream,
      output: ttyWriteStream,
      prompt: "> ",
    }),
    outputStream: ttyWriteStream,
    cleanup,
  };
}

/**
 * Display streaming output and return full text
 */
export async function displayStream(
  streamResult: Awaited<ReturnType<Router["executeStream"]>>,
  outputStream: NodeJS.WritableStream = process.stdout,
): Promise<string> {
  let fullText = "";

  outputStream.write("\n");

  for await (const chunk of streamResult.textStream) {
    outputStream.write(chunk);
    fullText += chunk;

    if ("flush" in outputStream && typeof outputStream.flush === "function") {
      outputStream.flush();
    }
  }

  outputStream.write("\n");

  return fullText;
}
