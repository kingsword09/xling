/**
 * Prompt builder utilities
 * Handles building prompts from various sources (args, flags, files, stdin)
 */

import * as fs from "node:fs";

export interface PromptSources {
  positionalArg?: string;
  flagPrompt?: string;
  files?: string[];
  stdin?: boolean;
  warn?: (msg: string) => void;
}

/**
 * Build prompt from multiple sources
 */
export async function buildPrompt(sources: PromptSources): Promise<string> {
  const parts: string[] = [];

  if (sources.positionalArg) {
    parts.push(sources.positionalArg);
  }

  if (sources.flagPrompt) {
    parts.push(sources.flagPrompt);
  }

  if (sources.files && sources.files.length > 0) {
    for (const file of sources.files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        parts.push(`\n--- File: ${file} ---\n${content}`);
      } catch (error) {
        sources.warn?.(
          `Failed to read file ${file}: ${(error as Error).message}`,
        );
      }
    }
  }

  if (sources.stdin) {
    const stdinContent = await readStdin();
    if (stdinContent) {
      parts.push(stdinContent);
    }
  }

  return parts.join("\n").trim();
}

/**
 * Read from stdin
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = [];

    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk: string | Buffer) => {
      chunks.push(chunk.toString());
    });

    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });

    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}
