# xling Command Reference

Complete reference for all xling commands.

## Command Index

| Command | Description |
|---------|-------------|
| `x` | Quick launcher for AI CLI tools |
| `p` | Prompt router with multi-provider support |
| `discuss` | Multi-model roundtable discussions |
| `council` | Multi-model evaluation and synthesis |
| `proxy` | OpenAI-compatible API gateway |
| `sx` | Execute command shortcuts |
| `settings:list` | List configuration files |
| `settings:get` | Get configuration content |
| `settings:set` | Edit configuration files |
| `settings:switch` | Switch profiles/variants |
| `settings:inspect` | Inspect parsed settings |
| `settings:sync` | Sync Codex configuration |
| `settings:auth` | Manage auth profiles |
| `git:prc` | Create pull request |
| `git:prr` | Checkout pull request |
| `git:prv` | View pull request |
| `git:wta` | Add worktree |
| `git:wtl` | List worktrees |
| `git:wtp` | Prune worktrees |
| `git:wtr` | Remove worktree |
| `git:wts` | Switch to worktree |
| `version` | Show version |

## Quick Launcher (x)

```bash
xling x                     # Launch Claude Code (default)
xling x -t codex            # Launch Codex
xling x -t gemini           # Launch Gemini CLI
xling x -c                  # Continue last conversation
xling x -r                  # Resume from list
xling x -s <variant>        # Use settings variant
xling x --no-yolo           # Disable yolo mode
xling x -- <args>           # Pass arguments to tool
```

## Prompt Router (p)

```bash
xling p "prompt"            # Send prompt via xling router
xling p -t codex "prompt"   # Use Codex CLI directly
xling p -t claude "prompt"  # Use Claude CLI directly
xling p -m gpt-4 "prompt"   # Specify model
xling p -f file.txt "prompt" # Include file content
xling p --stdin "prompt"    # Read from stdin
xling p -i "prompt"         # Interactive mode
xling p --json "prompt"     # JSON output
```

## Settings Commands

```bash
xling settings:list --tool claude --scope user
xling settings:get --tool codex
xling settings:set --tool claude --name hxi
xling settings:switch oss --tool codex
xling settings:inspect --tool claude
xling settings:sync --tool codex
xling settings:auth save <name>
xling settings:auth list
xling settings:auth switch <name>
```

## Global Flags

All commands support:

| Flag | Description |
|------|-------------|
| `--help` | Show command help |
| `--json` | Output as JSON (where applicable) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EDITOR` | Default editor for settings:set |
| `ANTHROPIC_BASE_URL` | Override Claude API endpoint |

## Configuration Files

| Tool | Scope | Path |
|------|-------|------|
| Claude | user | `~/.claude/settings.json` |
| Claude | project | `.claude/settings.json` |
| Claude | local | `.claude/settings.local.json` |
| Codex | user | `~/.codex/config.toml` |
| Gemini | user | `~/.gemini/settings.json` |
| xling | user | `~/.claude/xling.json` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
