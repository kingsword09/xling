# `x` Command (Quick Launcher)

Launch Claude Code or Codex with a single command. Yolo mode (skip approval and
permissions prompts) is enabled by default. Additional arguments placed after
`--` are forwarded directly to the underlying CLI.

## Usage

```bash
xling x [FLAGS] [-- ...args forwarded to tool]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-t, --tool <claude|codex>` | Target tool (defaults to `claude`). |
| `--no-yolo` | Disable yolo mode. When omitted, the command passes Claude's `--dangerously-skip-permissions` or Codex's `--dangerously-bypass-approvals-and-sandbox`. |
| `-c, --continue` | Resume the most recent session (`claude -c` / `codex resume --last`). Mutually exclusive with `--resume`. |
| `-r, --resume` | Show the session picker (`claude -r` / `codex resume`). Mutually exclusive with `--continue`. |
| `-C, --cwd <dir>` | Run the tool from a different working directory. |

## Examples

```bash
xling x                      # Launch Claude Code with yolo mode
xling x --no-yolo            # Launch Claude without yolo mode
xling x -t codex             # Launch Codex instead
xling x -c                   # Continue the most recent Claude session
xling x -t codex -r          # Pick a Codex session from the interactive list
xling x -- chat "Hello"      # Forward arguments to Claude
xling x -t codex -C ~/repo   # Start Codex in a different directory
```

## Tips

- Use `-c`/`-r` to control resume behavior instead of memorizing the underlying
  tool flags.
- Combine `-C` with `--tool codex` when you need to drop into a separate repo
  without leaving your main terminal session.
- Remember to place `--` before any arguments you want to pass through to the
  AI CLI.
