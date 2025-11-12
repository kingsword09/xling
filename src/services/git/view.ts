/**
 * PR view service
 * Opens PR in web browser with configurable browser
 */

import type { GitViewRequest, GitCommandResult } from "@/domain/git.ts";
import { runCommand } from "@/utils/runner.ts";
import { ExecutableNotFoundError } from "@/utils/errors.ts";
import { detectGhCli } from "./utils.ts";

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
  const { id, browser = 'Safari', openFlags = [] } = request;

  // Check if gh CLI is available
  const hasGh = await detectGhCli();
  if (!hasGh) {
    throw new ExecutableNotFoundError(
      'gh',
      'Install GitHub CLI: https://cli.github.com/'
    );
  }

  // Build browser command based on platform
  const platform = process.platform;
  let browserCmd = '';

  if (browser) {
    if (platform === 'darwin') {
      browserCmd = `open -a "${browser}"`;
    } else if (platform === 'linux') {
      // On Linux, use the browser name directly (firefox, google-chrome, etc.)
      browserCmd = browser.toLowerCase();
    } else if (platform === 'win32') {
      browserCmd = `start "" "${browser}"`;
    }
  }

  const env = browserCmd ? { GH_BROWSER: browserCmd } : undefined;

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
    message: `Opened PR #${id} in ${browser || 'default browser'}`,
    details: { id, browser, platform },
  };
}
