/**
 * xling version command
 * Displays the current CLI version from package.json
 */

import { Command } from "@oclif/core";

import pkg from "../../../package.json" assert { type: "json" };

export default class VersionCommand extends Command {
  static summary = "Show the current xling version";

  static description = "Displays the version from package.json.";

  static examples: Command.Example[] = ["<%= config.bin %> <%= command.id %>"];

  async run(): Promise<void> {
    this.log(pkg.version ?? "unknown");
  }
}
