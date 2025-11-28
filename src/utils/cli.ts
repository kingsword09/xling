/**
 * Shared CLI utilities
 * Provides common functions for readline, TTY, and argument handling
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as tty from "node:tty";

/**
 * Extract passthrough arguments after a marker (default: "--")
 */
export function extractPassthroughArgs(
  argv: string[],
  marker = "--",
): string[] {
  const idx = argv.indexOf(marker);
  return idx >= 0 ? argv.slice(idx + 1) : [];
}

/**
 * Create a readline interface with standard defaults
 */
export function createReadlineInterface(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): readline.Interface {
  return readline.createInterface({ input, output });
}

/**
 * Prompt user for input and return the trimmed answer
 */
export async function promptUser(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * TTY streams for direct terminal I/O (useful when stdin is piped)
 */
export interface TtyStreams {
  fd: number;
  read: tty.ReadStream;
  write: tty.WriteStream;
  cleanup: () => void;
}

/**
 * Open /dev/tty for direct terminal I/O
 */
export function openTtyStreams(): TtyStreams {
  const fd = fs.openSync("/dev/tty", "r+");
  const read = new tty.ReadStream(fd);
  const write = new tty.WriteStream(fd);
  return {
    fd,
    read,
    write,
    cleanup: () => {
      read.destroy();
      write.destroy();
      fs.closeSync(fd);
    },
  };
}
