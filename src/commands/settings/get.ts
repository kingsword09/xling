/**
 * settings:get command
 * Retrieve the selected configuration file
 */

import fs from "node:fs";
import path from "node:path";
import { Args, Command, Flags, Interfaces } from "@oclif/core";
import { SettingsDispatcher } from "@/services/settings/dispatcher.ts";
import { formatJson } from "@/utils/format.ts";
import * as fsStore from "@/services/settings/fsStore.ts";
import { ClaudeAdapter } from "@/services/settings/adapters/claude.ts";
import type { ToolId, Scope, InspectResult } from "@/domain/types.ts";

export default class SettingsGet extends Command {
  static summary = "View the full configuration file";

  static description = `
    Print the entire configuration file for the selected tool/scope.
    Use --json for structured output or --no-json for plain text.
  `;

  static examples: Command.Example[] = [
    "<%= config.bin %> <%= command.id %> --tool claude --scope user",
    "<%= config.bin %> <%= command.id %> --tool codex --no-json",
  ];

  static args: Interfaces.ArgInput = {
    name: Args.string({
      description: "Claude variant name (optional). Example: settings:get hxi",
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
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsGet);

    try {
      const tool = flags.tool as ToolId;
      const scope = flags.scope as Scope;
      const data =
        tool === "claude" && args.name
          ? await this.#inspectClaudeVariant(scope, args.name)
          : await this.#inspectViaDispatcher(tool, scope);

      if (flags.json) {
        this.log(formatJson({ success: true, data }));
        return;
      }

      if (!data.exists) {
        this.warn(`Config file not found: ${data.path}`);
        return;
      }

      if (data.content) {
        this.log(data.content);
      } else {
        this.log("File is empty.");
      }
    } catch (error) {
      this.error((error as Error).message, { exit: 1 });
    }
  }

  async #inspectViaDispatcher(tool: ToolId, scope: Scope) {
    const dispatcher = new SettingsDispatcher();
    const result = await dispatcher.execute({
      tool,
      scope,
      action: "inspect",
    });
    return result.data as InspectResult;
  }

  async #inspectClaudeVariant(
    scope: Scope,
    name: string,
  ): Promise<InspectResult> {
    const adapter = new ClaudeAdapter();
    if (!adapter.validateScope(scope)) {
      throw new Error(`Invalid scope for Claude: ${scope}`);
    }

    const normalized = name.trim();
    if (!normalized || normalized === "default") {
      return this.#inspectViaDispatcher("claude", scope);
    }

    const basePath = adapter.resolvePath(scope);
    const resolvedBase = fsStore.resolveHome(basePath);
    const directory = path.dirname(resolvedBase);
    const variantPath =
      this.#findVariantPath(directory, normalized) ??
      path.join(directory, `settings.${normalized}.json`);

    if (!fs.existsSync(variantPath)) {
      return {
        path: variantPath,
        exists: false,
      };
    }

    const stats = fs.statSync(variantPath);
    return {
      path: variantPath,
      exists: true,
      content: fs.readFileSync(variantPath, "utf-8"),
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  #findVariantPath(directory: string, name: string): string | null {
    const candidates = [`settings.${name}.json`, `settings-${name}.json`];

    for (const candidate of candidates) {
      const fullPath = path.join(directory, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }
}
