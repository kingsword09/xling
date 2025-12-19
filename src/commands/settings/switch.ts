/**
 * settings:switch command
 * Switch profiles for Codex, variants for Claude, or default model for Xling
 */

import { Args, Command, Flags, Interfaces } from "@oclif/core";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { ClaudeAdapter } from "@/services/settings/adapters/claude.ts";
import { CodexAdapter } from "@/services/settings/adapters/codex.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";
import { formatJson } from "@/utils/format.ts";
import type {
  ToolId,
  Scope,
  SettingsResult,
  SettingsListData,
  SettingsFileEntry,
} from "@/domain/types.ts";

type SwitchCommandFlags = Interfaces.InferredFlags<
  (typeof SettingsSwitch)["flags"]
>;
export default class SettingsSwitch extends Command {
  static summary = "Switch between profiles or settings variants";

  static description = `
    Switch to a different profile configuration for Codex,
    activate a specific settings.<variant>.json for Claude,
    or switch the default model for Xling prompt router.

    For Codex, you can switch between:
    - Auth profiles (saved login credentials)
    - Model providers (API endpoints)
    - Named profiles (from config.toml)

    For Xling, you can switch between any model from configured providers.
    Run without arguments for interactive selection.
  `;

  static examples: Command.Example[] = [
    {
      description: "Switch Codex to an auth profile (saved login)",
      command: "<%= config.bin %> <%= command.id %> personal --tool codex",
    },
    {
      description: "Switch Codex to a provider",
      command: "<%= config.bin %> <%= command.id %> my-provider --tool codex",
    },
    {
      description: "Interactive selection for Codex",
      command: "<%= config.bin %> <%= command.id %> --tool codex",
    },
    {
      description: "Activate a Claude variant (user scope)",
      command:
        "<%= config.bin %> <%= command.id %> hxi --tool claude --scope user",
    },
    {
      description: "Force-apply Claude variant and emit JSON for scripts",
      command:
        "<%= config.bin %> <%= command.id %> hxi --tool claude --scope user --force --json",
    },
    {
      description: "Keep a backup while switching Claude settings",
      command:
        "<%= config.bin %> <%= command.id %> stable --tool claude --backup",
    },
    {
      description: "Interactive model selection for Xling",
      command: "<%= config.bin %> <%= command.id %> --tool xling",
    },
    {
      description: "Switch Xling default model directly",
      command:
        "<%= config.bin %> <%= command.id %> claude-sonnet-4-20250514 --tool xling",
    },
  ];

  static args: Interfaces.ArgInput = {
    profile: Args.string({
      description: "Profile name to switch to",
      required: false,
    }),
  };

  static flags: Interfaces.FlagInput = {
    tool: Flags.string({
      char: "t",
      description: "AI CLI tool to manage",
      options: ["claude", "codex", "gemini", "xling"],
      default: "claude",
    }),
    scope: Flags.string({
      char: "s",
      description: "Configuration scope",
      options: ["user", "project", "local", "system"],
      default: "user",
    }),
    json: Flags.boolean({
      description: "Output JSON instead of interactive text",
      default: false,
    }),
    force: Flags.boolean({
      description: "Skip confirmation prompts (Claude only)",
      default: false,
    }),
    backup: Flags.boolean({
      description: "Create a .bak backup when switching (Claude only)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsSwitch);
    const dispatcher = new SettingsDispatcher();

    let profile = args.profile;

    if (!profile) {
      if (flags.json) {
        this.error("Profile is required when using --json output.", {
          exit: 1,
        });
      }

      profile = await this.#promptProfile(dispatcher, flags);
    }

    try {
      const result =
        flags.tool === "claude"
          ? await this.#handleClaudeSwitch(dispatcher, profile, flags)
          : await dispatcher.execute({
              tool: flags.tool as ToolId,
              scope: flags.scope as Scope,
              action: "switch-profile",
              profile,
            });

      if (!result) {
        return;
      }

      this.#printResult(result, profile, flags);
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  async #handleClaudeSwitch(
    dispatcher: SettingsDispatcher,
    profile: string,
    flags: SwitchCommandFlags,
  ): Promise<SettingsResult | null> {
    if (flags.json && !flags.force) {
      this.error("--json requires --force when switching Claude settings.", {
        exit: 1,
      });
    }

    const preview = await dispatcher.execute({
      tool: "claude",
      scope: flags.scope as Scope,
      action: "switch-profile",
      profile,
      switchOptions: { preview: true },
    });

    if (preview.diff) {
      this.log("Proposed changes:\n" + preview.diff);
    } else {
      this.log(
        "No differences detected. Current settings already match the selected variant.",
      );
      return preview;
    }

    let backup = Boolean(flags.backup);
    if (!flags.force && !backup) {
      const action = await this.#promptClaudeAction();
      if (action === "cancel") {
        this.log("Switch cancelled.");
        return null;
      }
      backup = action === "backup";
    }

    const result = await dispatcher.execute({
      tool: "claude",
      scope: flags.scope as Scope,
      action: "switch-profile",
      profile,
      switchOptions: { backup },
    });
    result.diff = preview.diff;
    return result;
  }

  async #promptProfile(
    dispatcher: SettingsDispatcher,
    flags: SwitchCommandFlags,
  ): Promise<string> {
    const tool = flags.tool as ToolId;
    const scope = flags.scope as Scope;

    let choices: string[] = [];

    if (tool === "claude") {
      choices = await this.#listClaudeVariants(dispatcher, scope);
    } else if (tool === "codex") {
      choices = await this.#listCodexProfiles(scope);
    } else if (tool === "xling") {
      choices = await this.#listXlingModels(scope);
    } else {
      this.error(`Interactive selection is not supported for tool: ${tool}`, {
        exit: 1,
      });
    }

    if (!choices.length) {
      this.error("No available profiles found for the selected tool.", {
        exit: 1,
      });
    }

    this.log("Select a profile to switch to:");
    choices.forEach((name, index) => {
      this.log(`  ${index + 1}) ${name}`);
    });

    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const answer = (await rl.question("Enter number or name: "))
          .trim()
          .toLowerCase();

        const index = Number.parseInt(answer, 10);
        if (Number.isInteger(index) && index >= 1 && index <= choices.length) {
          return this.#extractName(tool, choices[index - 1]);
        }

        // Try exact match with display name
        const exactMatch = choices.find(
          (name) => name.toLowerCase() === answer,
        );
        if (exactMatch) {
          return this.#extractName(tool, exactMatch);
        }

        // Try matching just the extracted name (without prefix/suffix)
        const nameMatch = choices.find((choice) => {
          const extracted = this.#extractName(tool, choice);
          return extracted.toLowerCase() === answer;
        });
        if (nameMatch) {
          return this.#extractName(tool, nameMatch);
        }

        this.log("Invalid selection. Please try again.");
      }
    } finally {
      rl.close();
    }
  }

  async #listClaudeVariants(
    dispatcher: SettingsDispatcher,
    scope: Scope,
  ): Promise<string[]> {
    const listResult = await dispatcher.execute({
      tool: "claude",
      scope,
      action: "list",
    });

    if (!this.#isFilesListData(listResult.data)) {
      return [];
    }

    // Find current variant by comparing content
    const adapter = new ClaudeAdapter();
    const currentVariant = adapter.getCurrentVariant(scope);

    // Show non-active variants with (current) marker if content matches
    return listResult.data.files
      .filter((file: SettingsFileEntry) => !file.active && file.variant)
      .map((file: SettingsFileEntry) =>
        file.variant === currentVariant
          ? `${file.variant} (current)`
          : file.variant,
      );
  }

  async #listCodexProfiles(scope: Scope): Promise<string[]> {
    const adapter = new CodexAdapter();
    const { providers, authProfiles } = adapter.getAllSwitchableProfiles(scope);

    // Get current active profile/provider info
    const listData = await adapter.list(scope);
    const entries = listData.type === "entries" ? listData.entries : {};
    const currentAuthProfile = entries.current_auth_profile as string | null;
    const currentProvider = entries.current_provider as string | null;
    const currentProfile = entries.current_profile as string | null;

    const choices: string[] = [];

    // Auth profiles first (with prefix for clarity)
    if (authProfiles.length > 0) {
      for (const name of authProfiles) {
        const isCurrent = name === currentAuthProfile;
        choices.push(`[auth] ${name}${isCurrent ? " (current)" : ""}`);
      }
    }

    // Then providers/profiles
    if (providers.length > 0) {
      for (const name of providers) {
        const isCurrent = name === currentProvider || name === currentProfile;
        choices.push(`[provider] ${name}${isCurrent ? " (current)" : ""}`);
      }
    }

    return choices;
  }

  /**
   * List all available models from xling providers
   */
  async #listXlingModels(scope: Scope): Promise<string[]> {
    const adapter = new XlingAdapter();
    const models = adapter.getAllModels(scope);

    if (models.length === 0) {
      this.error(
        "No models found. Please configure providers in ~/.claude/xling.json first.\n" +
          "Run: xling settings:set --tool xling",
        { exit: 1 },
      );
    }

    const currentDefault = adapter.getDefaultModel(scope);

    return models.map((m) =>
      m.model === currentDefault ? `${m.label} (current)` : m.label,
    );
  }

  /**
   * Remove (current) suffix from display name
   */
  #stripCurrentSuffix(displayName: string): string {
    return displayName.replace(/ \(current\)$/, "");
  }

  /**
   * Extract the actual name from tool-specific display format
   */
  #extractName(tool: ToolId, displayName: string): string {
    const cleaned = this.#stripCurrentSuffix(displayName);

    switch (tool) {
      case "claude":
        return cleaned;
      case "codex": {
        const codexMatch = cleaned.match(/^\[(auth|provider)\]\s+(.+)$/);
        return codexMatch ? codexMatch[2] : cleaned;
      }
      case "xling": {
        const xlingMatch = cleaned.match(/^\[.+?\]\s+(.+)$/);
        return xlingMatch ? xlingMatch[1] : cleaned;
      }
      default:
        return cleaned;
    }
  }

  async #promptClaudeAction(): Promise<"overwrite" | "backup" | "cancel"> {
    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const answer = (
          await rl.question("Choose action ([o]verwrite/[b]ackup/[c]ancel): ")
        )
          .trim()
          .toLowerCase();
        if (["overwrite", "backup", "cancel"].includes(answer)) {
          return answer as "overwrite" | "backup" | "cancel";
        }
        if (["o", "b", "c"].includes(answer)) {
          return {
            o: "overwrite",
            b: "backup",
            c: "cancel",
          }[answer] as "overwrite" | "backup" | "cancel";
        }
      }
    } finally {
      rl.close();
    }
  }

  #isFilesListData(
    data: SettingsResult["data"],
  ): data is Extract<SettingsListData, { type: "files" }> {
    return Boolean(
      data &&
      typeof data === "object" &&
      "type" in data &&
      (data as { type?: unknown }).type === "files" &&
      "files" in data &&
      Array.isArray((data as { files?: unknown }).files),
    );
  }

  #printResult(
    result: SettingsResult,
    profile: string,
    flags: SwitchCommandFlags,
  ): void {
    if (flags.json) {
      this.log(formatJson(result));
      return;
    }

    if (result.preview) {
      this.log("Preview only. No changes applied.");
      if (result.diff) {
        this.log(result.diff);
      }
      return;
    }

    this.log(result.message ?? `Switched to profile: ${profile}`);
    if (result.filePath) {
      this.log(`  File: ${result.filePath}`);
    }
    if (result.diff) {
      this.log("Applied diff:\n" + result.diff);
    }
  }
}
