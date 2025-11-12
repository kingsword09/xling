/**
 * PR create service
 * Creates a pull request with optional browser preview
 */

import type {
  GitCreatePrRequest,
  GitCommandResult,
  SupportedBrowser,
} from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { ExecutableNotFoundError } from "@/utils/errors.ts";
import { detectGhCli } from "./utils.ts";

/**
 * Browser launch command mapping for different platforms
 */
const BROWSER_COMMANDS: Record<
  SupportedBrowser,
  Partial<Record<NodeJS.Platform, string>>
> = {
  chrome: {
    darwin: "Google Chrome",
    linux: "google-chrome",
    win32: "chrome",
  },
  safari: {
    darwin: "Safari",
  },
  firefox: {
    darwin: "Firefox",
    linux: "firefox",
    win32: "firefox",
  },
  arc: {
    darwin: "Arc",
    win32: "Arc",
  },
  edge: {
    darwin: "Microsoft Edge",
    linux: "microsoft-edge",
    win32: "msedge",
  },
  dia: {
    darwin: "Dia",
    linux: "dia",
    win32: "dia",
  },
};

/**
 * Get browser launch command for current platform
 * @param browser Browser identifier
 * @returns Launch command or null if not available
 */
function getBrowserCommand(browser: SupportedBrowser): string | null {
  const platform = process.platform;
  const command = BROWSER_COMMANDS[browser]?.[platform];

  if (!command) {
    return null;
  }

  if (platform === "darwin") {
    return `open -a "${command}"`;
  }

  return command;
}

/**
 * Create a pull request
 * @param request Create PR request
 * @param cwd Working directory
 * @returns Command result
 */
export async function createPr(
  request: GitCreatePrRequest,
  cwd?: string,
): Promise<GitCommandResult> {
  const {
    title,
    body,
    base,
    head,
    draft = false,
    web = false,
    browser = "chrome",
    assignee = [],
    reviewer = [],
    label = [],
  } = request;

  // Check if gh CLI is available
  const hasGh = await detectGhCli();
  if (!hasGh) {
    throw new ExecutableNotFoundError(
      "gh",
      "Install GitHub CLI: https://cli.github.com/",
    );
  }

  // Build gh pr create command arguments
  const args = ["pr", "create"];

  // Add title if provided
  if (title) {
    args.push("--title", title);
  }

  // Add body if provided
  if (body) {
    args.push("--body", body);
  }

  // Add base branch if provided
  if (base) {
    args.push("--base", base);
  }

  // Add head branch if provided
  if (head) {
    args.push("--head", head);
  }

  // Add draft flag if requested
  if (draft) {
    args.push("--draft");
  }

  // Add assignees
  for (const person of assignee) {
    args.push("--assignee", person);
  }

  // Add reviewers
  for (const person of reviewer) {
    args.push("--reviewer", person);
  }

  // Add labels
  for (const lbl of label) {
    args.push("--label", lbl);
  }

  // Prepare environment variables for browser
  let env: Record<string, string> | undefined;

  if (web) {
    args.push("--web");

    // Get browser command if specified
    const browserCmd = getBrowserCommand(browser as SupportedBrowser);

    if (!browserCmd) {
      throw new Error(
        `Browser "${browser}" is not available on ${process.platform}. ` +
          `Supported browsers: chrome, safari (macOS only), firefox, arc, edge, dia`,
      );
    }

    env = { GH_BROWSER: browserCmd };
  }

  // Execute gh pr create
  const result = await runCommand("gh", args, {
    cwd,
    env,
    throwOnError: false,
  });

  if (!result.success) {
    throw new Error(`Failed to create PR: ${result.stderr}`);
  }

  const message = web
    ? `Created PR and opened in ${browser}`
    : "Created PR successfully";

  return {
    success: true,
    message,
    details: {
      title,
      base,
      head,
      draft,
      web,
      browser: web ? browser : undefined,
      platform: process.platform,
    },
  };
}
