# `x` Command (Quick Launcher)

Launch Claude Code, Codex, or Gemini CLI with a single command. Yolo mode (skip
approval/permission prompts) is enabled by default. Additional arguments placed
after `--` are forwarded directly to the underlying CLI.

## Usage

```bash
xling x [FLAGS] [-- ...args forwarded to tool]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-t, --tool <claude|codex|gemini>` | Target tool (defaults to `claude`). |
| `--no-yolo` | Disable yolo mode. When omitted, the command passes Claude's `--dangerously-skip-permissions`, Codex's `--dangerously-bypass-approvals-and-sandbox`, or Gemini's `-y`. |
| `-c, --continue` | Resume the most recent session (`claude -c` / `codex resume --last`). Mutually exclusive with `--resume`. |
| `-r, --resume` | Show the session picker (`claude -r` / `codex resume`). Mutually exclusive with `--continue`. |
| `-C, --cwd <dir>` | Run the tool from a different working directory. |
| `-s, --settings <value>` | Settings configuration (tool-specific). See [Settings Configuration](#settings-configuration) below. |

## Examples

```bash
xling x                           # Launch Claude Code with yolo mode
xling x -c                        # Continue the most recent Claude session
xling x --no-yolo                 # Launch Claude without yolo mode
xling x -t codex                  # Launch Codex instead
xling x -t codex -r               # Pick a Codex session from the interactive list
xling x -t codex -C ~/repo        # Start Codex in a different directory
xling x -t gemini                 # Launch Gemini CLI (auto-accept prompts)
xling x -t gemini -c              # Resume the latest Gemini session
xling x -s hxi                    # Launch Claude with hxi settings variant
xling x -t codex -s "model=o3"    # Launch Codex with model config override
xling x -- chat "Hello"           # Forward arguments to Claude
```

## Settings Configuration

The `--settings` / `-s` flag provides tool-specific configuration options:

### Claude Code

For Claude, the settings parameter supports multiple formats:

**Variant Name** (recommended)
```bash
xling x -s hxi                    # Use ~/.claude/settings.hxi.json
xling x -s production             # Use ~/.claude/settings.production.json
```

**Absolute Path**
```bash
xling x -s ~/.claude/settings.custom.json
xling x -s /path/to/custom/settings.json
```

**Relative Path**
```bash
xling x -s .claude/settings.local.json
xling x -s ../shared/settings.json
```

**JSON String**
```bash
xling x -s '{"model":"opus","maxTokens":8192}'
```

The launcher automatically resolves variant names to user settings paths and checks for alternate naming patterns (`settings.name.json`, `settings-name.json`).

### Codex

For Codex, the settings parameter supports configuration overrides:

**Single Configuration**
```bash
xling x -t codex -s "model=o3"
```

**Multiple Configurations** (separated by semicolon)
```bash
xling x -t codex -s "model=o3;shell_environment_policy.inherit=all"
```

**Simple Value** (treated as model name)
```bash
xling x -t codex -s o3            # Equivalent to model=o3
```

For profile switching (e.g., `oss`, `production`), use `xling settings:switch <profile> --tool codex` before launching.

### Gemini CLI

Use the `--settings` flag to pick the Gemini model (first non-empty token wins):

```bash
# Use Gemini Pro experimental
xling x -t gemini -s gemini-2.0-pro-exp

# Model string with extra tokens (only the first is used)
xling x -t gemini -s "gemini-1.5-flash;temperature=0.3"
```

## Tips

- Use `-c`/`-r` to control resume behavior instead of memorizing the underlying
  tool flags.
- Combine `-C` with `--tool codex` when you need to drop into a separate repo
  without leaving your main terminal session.
- Remember to place `--` before any arguments you want to pass through to the
  AI CLI.
- The `--settings` flag provides temporary configuration for the session. For permanent changes, use `xling settings:switch` or edit settings files directly.
