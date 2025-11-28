/**
 * sx command - Shortcut eXecute
 * Execute predefined command shortcuts configured in ~/.claude/xling.json
 */

import { Command, Flags, Args, Interfaces } from "@oclif/core";
import { ShortcutRunner } from "@/services/shortcuts/runner.ts";
import {
  ShortcutNotFoundError,
  CircularShortcutError,
} from "@/services/shortcuts/types.ts";
import { extractPassthroughArgs } from "@/utils/cli.ts";
import Table from "cli-table3";

export default class Sx extends Command {
  static summary = "Shortcut eXecute - run predefined command shortcuts";

  static description = `
    Execute predefined command shortcuts configured in ~/.claude/xling.json.

    Shortcuts allow you to create custom aliases for frequently used xling commands
    with pre-configured arguments. This makes it easy to run complex commands without
    having to remember long argument lists.

    Use --list to see all available shortcuts.

    Pass additional arguments after the shortcut name to append them to the
    configured arguments.

    Configuration example in ~/.claude/xling.json:
    {
      "shortcuts": {
        "lc": {
          "command": "x",
          "args": ["-t", "claude", "-c"],
          "description": "Launch Claude and continue"
        },
        "gs": {
          "command": "settings:list",
          "args": ["--tool", "codex"],
          "description": "List Codex settings"
        }
      }
    }

    Examples:
      $ xling sx lc                    # Run shortcut "lc"
      $ xling sx --list                # List all shortcuts
      $ xling sx lc -- --no-yolo       # Run "lc" with extra args
  `;

  static examples: Command.Example[] = [
    {
      description: "List all available shortcuts",
      command: "<%= config.bin %> <%= command.id %> --list",
    },
    {
      description: "Execute a shortcut",
      command: "<%= config.bin %> <%= command.id %> lc",
    },
    {
      description: "Execute shortcut with additional arguments",
      command: "<%= config.bin %> <%= command.id %> lc -- --no-yolo",
    },
  ];

  static flags: Interfaces.FlagInput = {
    list: Flags.boolean({
      char: "l",
      description: "List all available shortcuts",
      default: false,
    }),
  };

  static args: Interfaces.ArgInput = {
    name: Args.string({
      description: "Shortcut name to execute",
      required: false,
    }),
  };

  static strict = false; // Allow passthrough args

  async run(): Promise<void> {
    const { args, argv, flags } = await this.parse(Sx);

    try {
      const runner = new ShortcutRunner(this.config);

      // Handle --list flag
      if (flags.list) {
        const shortcuts = await runner.list();

        if (shortcuts.length === 0) {
          this.log("No shortcuts configured.");
          this.log(
            "\nAdd shortcuts to ~/.claude/xling.json:\n" +
              '{\n  "shortcuts": {\n    "lc": {\n' +
              '      "command": "x",\n' +
              '      "args": ["-t", "claude", "-c"],\n' +
              '      "description": "Launch Claude and continue"\n' +
              "    }\n  }\n}",
          );
          return;
        }

        // Format as table
        const table = new Table({
          head: ["Name", "Type", "Command", "Description"],
          colWidths: [12, 10, 40, 30],
          wordWrap: true,
        });

        for (const shortcut of shortcuts) {
          table.push([
            shortcut.name,
            shortcut.type,
            shortcut.command,
            shortcut.description || "-",
          ]);
        }

        this.log(table.toString());
        return;
      }

      // Require shortcut name if not listing
      if (!args.name) {
        this.error(
          "Shortcut name required. Use --list to see available shortcuts.",
          { exit: 1 },
        );
      }

      // Extract passthrough args (everything after the shortcut name)
      const passthroughArgs = extractPassthroughArgs(
        argv as string[],
        args.name,
      );

      // Execute shortcut
      await runner.run(args.name, passthroughArgs as string[]);
    } catch (error) {
      if (
        error instanceof ShortcutNotFoundError ||
        error instanceof CircularShortcutError
      ) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }
  }
}
