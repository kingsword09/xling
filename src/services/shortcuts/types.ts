/**
 * Shortcut service types and errors
 */

import type { ShortcutConfig } from "@/domain/xling/config.ts";

/**
 * Context for executing a shortcut
 */
export interface ShortcutExecutionContext {
  name: string;
  shortcut: ShortcutConfig;
  passthroughArgs: string[];
}

/**
 * Formatted shortcut entry for display
 */
export interface ShortcutListEntry {
  name: string;
  type: "command" | "shell" | "pipeline";
  command: string;
  args: string[];
  description?: string;
}

/**
 * Error thrown when a shortcut is not found
 */
export class ShortcutNotFoundError extends Error {
  constructor(name: string, available: string[]) {
    const availableList = available.length > 0 ? available.join(", ") : "none";
    super(
      `Shortcut "${name}" not found.\n\n` +
        `Available shortcuts: ${availableList}\n\n` +
        `Use "xling sx --list" to see all shortcuts.`,
    );
    this.name = "ShortcutNotFoundError";
  }
}

/**
 * Error thrown when a circular reference is detected
 */
export class CircularShortcutError extends Error {
  constructor(name: string) {
    super(
      `Circular reference detected: shortcut "${name}" cannot call "sx" command.\n\n` +
        `This would create an infinite loop.`,
    );
    this.name = "CircularShortcutError";
  }
}
