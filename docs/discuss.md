# `discuss` – Multi-Model Roundtable

Run a roundtable between multiple AI models. The command can operate fully in
the terminal or launch a lightweight Web UI. Models come from the xling prompt
router configuration (`~/.claude/xling.json`), so any provider supported by
`xling p` can join the discussion.

## Usage

```bash
xling discuss [FLAGS]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `--ui` | Launch the Web UI (opens the browser on localhost:3000 by default). |
| `-t, --topic <text>` | Topic to discuss. If omitted, you are prompted. |
| `-m, --models <list>` | Comma-separated list of models to participate (`gpt-4o,claude-3.5-sonnet`). |
| `-s, --strategy <random|round-robin>` | Turn-taking strategy (default: `random`). |
| `--timeout <seconds>` | Timeout per turn in seconds (default: `30`). |

## Examples

```bash
# Interactive CLI mode (choose topic/models interactively)
xling discuss

# Provide topic and participating models explicitly
xling discuss --topic "Rust vs Go" --models "gpt-4o,claude-3.5-sonnet"

# Round-robin turns with a shorter timeout
xling discuss --strategy round-robin --timeout 10

# Launch the Web UI
xling discuss --ui
```

## CLI Controls

- `[Space]`: Pause/resume
- `[m]`: Toggle auto/manual mode
- `[n]`: Advance to the next turn (manual mode)
- `[i]`: Interrupt and speak as the user
- `[s]`: Summarize with a chosen model, then stop
- `[q]`: Quit

## Model Sources

`discuss` uses the same provider registry as `xling p`. Configure providers and
models in `~/.claude/xling.json`:

```bash
# Inspect configured providers
xling settings:list --tool xling --scope user

# Edit provider/model settings
xling settings:set --tool xling --scope user
```
