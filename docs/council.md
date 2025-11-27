# `council` – Model Jury & Synthesis

Run a three-stage council across multiple models: collect anonymized answers,
let peers judge each other on a rubric, and either pick the winner or
synthesize a final response. Works in the terminal or via the existing React
19 Web UI.

## Usage

```bash
xling council [FLAGS]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `--ui` | Launch the Web UI on port 3000 (opens your browser). |
| `-q, --question <text>` | Question posed to every model; prompts interactively if omitted. |
| `-m, --models <list>` | Comma-separated list of candidate models (at least two required). |
| `-j, --judges <list>` | Optional judge models; defaults to the candidates. |
| `--final-model <name>` | Force the model used for the final synthesis/selection. |
| `--json` | Print the full JSON payload (all stages, scores, metadata). |

## Examples

```bash
# Fast CLI run with two candidates
xling council -q "How to cache HTTP responses?" -m "gpt-4o,claude-3.5-sonnet"

# Separate judge pool and explicit final model
xling council -q "PostgreSQL tuning" \
  -m "gpt-4o,claude-3.5-sonnet" \
  -j "gemini-2.0-pro-exp,claude-3.5-sonnet" \
  --final-model gpt-4o

# Launch the Web UI
xling council --ui

# Save full details for later analysis
xling council -q "API pagination design" -m "gpt-4o,claude-3.5-sonnet" --json > council.json
```

## How It Works

- **Stage 1 — Candidates**: Each model answers anonymously (`Response A/B/...`).
- **Stage 2 — Peer judging**: Judges score every visible answer on
  `accuracy`, `completeness`, `clarity`, and `utility`, then rank them.
- **Stage 3 — Final**: If there is a clear leader (score gap ≥ 0.5 on the 1–5
  scale), the top answer is returned directly. Otherwise, the final model
  synthesizes the best ideas. Providing `--final-model` always triggers
  synthesis with that model.
- **JSON output**: Use `--json` for automation; includes stage outputs,
  aggregate scores, label ↔ model map, and rubric.

## Configuration

`council` uses the same provider registry as `xling p`/`discuss`, loaded from
`~/.claude/xling.json`:

```json
{
  "providers": [
    {
      "name": "openai-primary",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeys": ["sk-proj-xxx", "sk-proj-yyy"],
      "models": ["gpt-4o", "gpt-4.1-mini"]
    },
    {
      "name": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "sk-ant-xxx",
      "models": ["claude-3.5-sonnet", "claude-3.5-haiku"]
    }
  ],
  "defaultModel": "gpt-4o"
}
```

- Models passed to `--models`/`--judges` must exist in the registry above.
- Manage config with `xling settings:list|set|inspect --tool xling --scope user`.

## Web UI Notes

- `council --ui` reuses the same lightweight server as `discuss --ui` on port
  3000. It exposes `/api/council/run` (one-shot) and `/api/council/stream`
  (SSE) endpoints consumed by the React UI.
- Ensure the UI bundle exists at `dist/ui` (`bun run build` or `bun run
  build:ui`). For live UI work, use `bunx vite dev --config vite.config.ts
  --host --port 3000`.

## Tips

- Start with 2–4 diverse models; add a separate judge pool for more stable
  rankings.
- Keep prompts concise—candidates are instructed not to reveal their model
  names to preserve anonymity during judging.
- When scores are close, expect synthesis; when one model clearly wins, the
  raw best answer is returned.
