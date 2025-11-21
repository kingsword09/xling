# Xling Documentation

Use `xling <command> --help` for flag details and inline examples. The pages
below expand on each workflow.

## Launchers & Prompts

- [`x` – quick launcher](./x.md): Start Claude Code, Codex, or Gemini with resume/yolo controls and passthrough args.
- [`p` – prompt router](./p.md): Send prompts through configured providers or delegate directly to codex/claude/gemini CLIs.
- [`discuss` – roundtable](./discuss.md): Run a multi-model debate via CLI or Web UI.
- `llms` – start a local llms gateway from `~/.claude/xling.json` so Claude Code, Codex, or Gemini can reuse your providers.

## Shortcuts

- [`sx` – shortcut execute](./sx.md): Run predefined aliases stored in `~/.claude/xling.json`.

## Settings

- [`settings:list|get|set|switch|inspect`](./settings.md): Inspect, edit, and switch Claude, Codex, Gemini, or xling configs across scopes.

## Git Workflows

- [`git:prc`](./git-prc.md) - create pull requests
- [`git:prr`](./git-prr.md) - checkout pull requests with gh/git fallback
- [`git:prv`](./git-prv.md) - open pull requests in a browser
- [`git:wta`](./git-wta.md) - add worktrees
- [`git:wtl`](./git-wtl.md) - list worktrees
- [`git:wtp`](./git-wtp.md) - prune stale worktrees
- [`git:wtr`](./git-wtr.md) - remove worktrees
- [`git:wts`](./git-wts.md) - switch to a worktree (path or subshell)
- `git:worktree` - combined list/add/remove/prune entry point (same flags as the dedicated subcommands above)

## Utility

- `version`: print the installed xling version (also available via `xling --version`).
