/**
 * Web UI mode for discuss command
 */

import { createDiscussServer } from "@/services/discuss/server.ts";
import * as open from "open";

/**
 * Launch Web UI for discussions
 */
export async function runUIMode(log: (msg: string) => void): Promise<never> {
  log("Starting Web UI...");
  const port = 3000;
  const server = await createDiscussServer(port);

  const address = server.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;
  const url = `http://localhost:${actualPort}`;

  log(`Server running at ${url}`);

  // @ts-ignore open types
  await open.default(url);

  log("Press Ctrl+C to stop");

  return new Promise(() => {});
}
