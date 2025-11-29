/**
 * Interactive model selector for discuss command
 */

import * as readline from "node:readline";

/**
 * Interactive multi-select for models
 */
export async function selectModelsInteractive(
  models: string[],
): Promise<string[]> {
  if (models.length === 0) {
    return [];
  }

  const stdin = process.stdin as NodeJS.ReadStream;
  const stdout = process.stdout as NodeJS.WriteStream;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Interactive selection requires a TTY. Use --models to provide values directly.",
    );
  }

  return new Promise((resolve, reject) => {
    const selected = new Set<number>();
    let cursor = 0;
    let renderedLines = 0;
    let warning = "";

    const originalRaw = Boolean(stdin.isRaw);

    const cleanup = (err?: Error, value?: string[]) => {
      stdin.off("keypress", onKeypress);
      if (stdin.setRawMode) {
        stdin.setRawMode(originalRaw);
      }
      stdin.pause();
      stdout.write("\x1B[?25h\n");
      if (err) {
        reject(err);
      } else {
        resolve(value as string[]);
      }
    };

    const render = () => {
      stdout.moveCursor(0, -renderedLines);
      stdout.clearScreenDown();

      const lines = [
        "Select models (space = toggle, arrows = navigate, enter = confirm, q/Ctrl+C = cancel)",
        "",
        ...models.map((model, idx) => {
          const isCurrent = idx === cursor;
          const isChecked = selected.has(idx);
          const pointer = isCurrent ? "➜" : " ";
          const checkbox = isChecked ? "[x]" : "[ ]";
          const line = `${pointer} ${checkbox} ${model}`;
          return isCurrent ? `\x1B[36m${line}\x1B[0m` : line;
        }),
        "",
        `Selected: ${
          Array.from(selected)
            .map((i) => models[i])
            .join(", ") || "none"
        }`,
      ];

      if (warning) {
        lines.push(`\x1B[33m${warning}\x1B[0m`);
      }

      stdout.write(lines.join("\n") + "\n");
      renderedLines = lines.length;
      warning = "";
    };

    const onKeypress = (_: string, key: readline.Key) => {
      if (!key) return;

      if ((key.name === "c" && key.ctrl) || key.name === "q") {
        cleanup(new Error("Selection cancelled."));
        return;
      }

      if (key.name === "up") {
        cursor = (cursor - 1 + models.length) % models.length;
        render();
        return;
      }

      if (key.name === "down") {
        cursor = (cursor + 1) % models.length;
        render();
        return;
      }

      if (key.name === "space") {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
        render();
        return;
      }

      if (key.name === "return") {
        if (selected.size < 2) {
          warning = "Select at least two models.";
          render();
          return;
        }
        cleanup(
          undefined,
          Array.from(selected).map((i) => models[i]),
        );
      }
    };

    readline.emitKeypressEvents(stdin);
    stdin.resume();
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    stdout.write("\x1B[?25l");
    render();
    stdin.on("keypress", onKeypress);
  });
}
