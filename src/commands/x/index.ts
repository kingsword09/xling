/**
 * x command
 * Quick launcher for Claude Code, Codex, or Gemini CLI
 */

import { Command, Flags, Interfaces } from "@oclif/core";
import { LaunchDispatcher } from "@/services/launch/dispatcher.ts";
import type { ToolId } from "@/domain/types.ts";

export default class X extends Command {
  static summary = "eXecute AI CLI tools (defaults to Claude Code with yolo)";

  static description = `
    Quick launcher for Claude Code, Codex, or Gemini CLI with yolo mode enabled by default.

    Just run "xling x" to start Claude Code instantly!

    Claude Code is launched by default. Use --tool flag to launch other tools.

    Yolo mode is ENABLED by default, which skips permission prompts:
    - Claude Code: --dangerously-skip-permissions
    - Codex: --dangerously-bypass-approvals-and-sandbox
    - Gemini CLI: -y

    Resume options:
    - Use -c/--continue to continue the last conversation/session
    - Use -r/--resume to show a list of conversations/sessions to resume

    Pass additional arguments after -- to forward them to the tool.

    Examples:
      $ xling x                          # Start Claude Code (fastest way!)
      $ xling x -c                       # Continue last Claude conversation
      $ xling x -r                       # Resume a Claude conversation (list)
      $ xling x -s hxi                   # Start Claude with hxi settings variant
      $ xling x -t codex -c              # Continue last Codex session
      $ xling x -t codex -s oss          # Start Codex with oss profile
      $ xling x --tool codex             # Start Codex
      $ xling x -t gemini                # Start Gemini CLI
      $ xling x -t gemini -c             # Resume latest Gemini session
      $ xling x --no-yolo                # Start Claude without yolo
      $ xling x -- chat "Hello"          # Start Claude with arguments
      $ xling x -t codex -C /path        # Start Codex in specific directory
  `;

  static examples: Command.Example[] = [
    {
      description: "Start Claude Code instantly (default)",
      command: "<%= config.bin %> <%= command.id %>",
    },
    {
      description: "Continue last conversation",
      command: "<%= config.bin %> <%= command.id %> -c",
    },
    {
      description: "Resume a conversation from list",
      command: "<%= config.bin %> <%= command.id %> -r",
    },
    {
      description: "Start Claude with hxi settings variant",
      command: "<%= config.bin %> <%= command.id %> -s hxi",
    },
    {
      description: "Continue last Codex session",
      command: "<%= config.bin %> <%= command.id %> -t codex -c",
    },
    {
      description: "Start Codex with oss profile",
      command: "<%= config.bin %> <%= command.id %> -t codex -s oss",
    },
    {
      description: "Start Gemini CLI (auto-accept actions)",
      command: "<%= config.bin %> <%= command.id %> -t gemini",
    },
    {
      description: "Resume latest Gemini session",
      command: "<%= config.bin %> <%= command.id %> -t gemini -c",
    },
    {
      description: "Start Claude without yolo mode",
      command: "<%= config.bin %> <%= command.id %> --no-yolo",
    },
    {
      description: "Start Claude and pass arguments",
      command:
        '<%= config.bin %> <%= command.id %> -- chat "Hello, how are you?"',
    },
    {
      description: "Start Codex in specific directory",
      command:
        "<%= config.bin %> <%= command.id %> -t codex -C /path/to/project",
    },
  ];

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      description: "AI CLI tool to launch",
      char: "t",
      options: ["claude", "codex", "gemini"],
      default: "claude",
    }),
    yolo: Flags.boolean({
      description: "Enable yolo mode (skip permission prompts)",
      default: true,
      allowNo: true,
    }),
    continue: Flags.boolean({
      description: "Continue last conversation/session",
      char: "c",
      exclusive: ["resume"],
    }),
    resume: Flags.boolean({
      description: "Resume from conversation/session list",
      char: "r",
      exclusive: ["continue"],
    }),
    cwd: Flags.string({
      description: "Working directory for the launched process",
      char: "C",
    }),
    settings: Flags.string({
      description:
        "Settings configuration (Claude: variant name or file path; Codex: profile name; Gemini: model name)",
      char: "s",
    }),
  };

  // Allow extra args after -- so we can pass them through
  static strict = false;

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(X);

    // With strict=false, oclif puts all args after -- directly into argv
    const passthroughArgs = argv as string[];

    try {
      const dispatcher = new LaunchDispatcher();

      // Launch the requested tool
      const result = await dispatcher.execute({
        tool: flags.tool as ToolId,
        yolo: flags.yolo,
        continue: flags.continue,
        resume: flags.resume,
        cwd: flags.cwd,
        settings: flags.settings,
        args: passthroughArgs as string[],
      });

      if (result.success) {
        // Launch succeeded
        this.log(result.message ?? "Launched successfully");
        if (result.command && flags.yolo) {
          this.log(`\nCommand: ${result.command}`);
        }
      } else {
        // Launch failed
        this.error(result.message ?? "Launch failed", { exit: 1 });
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }
}
