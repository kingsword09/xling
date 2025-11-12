/**
 * PR view service
 * Opens PR in web browser with configurable browser
 */

import type { GitViewRequest, GitCommandResult, SupportedBrowser } from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { ExecutableNotFoundError } from "@/utils/errors.ts";
import { detectGhCli } from "./utils.ts";

/**
 * Browser launch command mapping for different platforms
 */
const BROWSER_COMMANDS: Record<SupportedBrowser, Record<NodeJS.Platform, string>> = {
  chrome: {
    darwin: 'Google Chrome',
    linux: 'google-chrome',
    win32: 'chrome',
  },
  safari: {
    darwin: 'Safari',
    linux: '', // Safari not available on Linux
    win32: '', // Safari not available on Windows
  },
  firefox: {
    darwin: 'Firefox',
    linux: 'firefox',
    win32: 'firefox',
  },
  arc: {
    darwin: 'Arc',
    linux: '', // Arc not widely available on Linux
    win32: 'Arc',
  },
  edge: {
    darwin: 'Microsoft Edge',
    linux: 'microsoft-edge',
    win32: 'msedge',
  },
  dia: {
    darwin: 'Dia',
    linux: 'dia',
    win32: 'dia',
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

  // For macOS, wrap in "open -a" command
  if (platform === 'darwin') {
    return `open -a "${command}"`;
  }

  return command;
}

/**
 * Open PR in web browser
 * @param request View request with PR ID and browser preference
 * @param cwd Working directory
 * @returns Command result
 */
export async function viewPr(
  request: GitViewRequest,
  cwd?: string
): Promise<GitCommandResult> {
  const { id, browser = 'chrome', openFlags = [] } = request;

  // Check if gh CLI is available
  const hasGh = await detectGhCli();
  if (!hasGh) {
    throw new ExecutableNotFoundError(
      'gh',
      'Install GitHub CLI: https://cli.github.com/'
    );
  }

  // Get browser launch command
  const browserCmd = getBrowserCommand(browser as SupportedBrowser);

  if (!browserCmd) {
    throw new Error(
      `Browser "${browser}" is not available on ${process.platform}. ` +
      `Supported browsers: chrome, safari (macOS only), firefox, arc, edge, dia`
    );
  }

  const env = { GH_BROWSER: browserCmd };

  const result = await runCommand(
    'gh',
    ['pr', 'view', id, '--web', ...openFlags],
    { cwd, env, throwOnError: false }
  );

  if (!result.success) {
    throw new Error(`Failed to open PR #${id}: ${result.stderr}`);
  }

  return {
    success: true,
    message: `Opened PR #${id} in ${browser}`,
    details: { id, browser, platform: process.platform },
  };
}
