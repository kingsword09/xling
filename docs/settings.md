# Settings Command Documentation

## Overview

The `settings` command provides a unified interface for managing configuration settings across multiple AI CLI tools: Claude Code, Codex, Gemini CLI, and the xling prompt router.

## Commands

### settings:list

List all configuration settings for a specified tool and scope.

**Usage:**
```bash
xling settings:list [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini|xling) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json`: Output structured JSON (disabled by default)
- `--table`: Render a table instead of the summary view

**Examples:**
```bash
# List Claude Code user settings (summary)
xling settings:list --tool claude --scope user

# List Codex settings as a table
xling settings:list --tool codex --table

# Show Gemini project settings as JSON
xling settings:list -t gemini -s project --json

# Inspect xling prompt router config location
xling settings:list --tool xling --scope user
```

**Claude Variant Discovery:** When `--tool claude`, this command lists every
`settings*.json` file (e.g., `settings.hxi.json`) alongside the active
`settings.json`, making it easier to inspect which variants are available before
switching.

**Codex Provider View:** When `--tool codex`, the command narrows output to the
`model_providers` table inside `~/.codex/config.toml`, so you can review provider
aliases, base URLs, wire API types, and env key bindings without scrolling through
the rest of the file.

The default view is a concise YAML-style summary so you can see which config files exist at a glance. Use `--table` or `--json` when you need more detail.

---

### settings:get

Display the full configuration file for the selected tool/scope.

**Usage:**
```bash
xling settings:get [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini|xling) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json`: Output structured JSON instead of the raw file contents

**Examples:**
```bash
# Show Claude user settings (plain text)
xling settings:get --tool claude --scope user

# Inspect a Claude variant (e.g., settings.hxi.json)
xling settings:get hxi --tool claude --scope user

# Dump Codex config as JSON
xling settings:get --tool codex --json

# View xling prompt router config (or default template)
xling settings:get --tool xling --scope user
```

When a positional argument is provided, it only applies to `--tool claude`. The command looks for `settings.<name>.json` or `settings-<name>.json` and loads the matching variant.

---

### settings:set

Open settings files in your IDE or add Codex model providers.

**Usage:**
```bash
xling settings:set [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini|xling) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--name <variant>`: Claude variant to edit (default: `default`, i.e., `settings.json`)
- `--ide <cmd>`: Editor command/alias (default: `code` -> VS Code)
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Create/edit settings.hxi.json in VS Code
xling settings:set --tool claude --scope user --name hxi

# Open default settings in Cursor
xling settings:set --tool claude --scope project --name default --ide cursor --no-json

# Add a Codex provider interactively
xling settings:set --tool codex --scope user

# Edit xling prompt router config
xling settings:set --tool xling --scope user --ide cursor
```

`settings:set` no longer writes individual keys for Claude/Xling/Gemini; Codex 现在提供小型交互式助手，写入新的 `[model_providers.<name>]`，包含 `name`、`base_url`、`wire_api="responses"`，以及必填的 `experimental_bearer_token`。

> Note: `settings:*` commands rely only on flags such as `--tool`, `--scope`, `--name`, and `--ide`; key-level overrides like `developerShortcuts.runCommand` are intentionally unsupported.

---

### settings:switch

Switch to a different configuration profile (Codex) or activate a
`settings.<variant>.json` file for Claude.

**Usage:**
```bash
xling settings:switch <profile> [OPTIONS]
```

**Arguments:**
- `profile`: Profile name to switch to

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini|xling) [default: codex]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Switch to OSS profile (Codex)
xling settings:switch oss --tool codex

# Activate settings.hxi.json (Claude user scope)
xling settings:switch hxi --tool claude --scope user

# Swap Codex to the production profile
xling settings:switch production --tool codex

# Apply without prompts and emit JSON
xling settings:switch hxi --tool claude --scope user --force --json

# Keep a backup while switching Claude settings
xling settings:switch stable --tool claude --scope user --backup
```

**Notes:**
- Codex profiles must be defined in `~/.codex/config.toml` under the
  `[profiles.<name>]` section.
- Claude switching copies the requested `settings.<variant>.json` (or
  `settings-<variant>.json`) over the active `settings.json` for the selected
  scope.
- Claude switching prints a unified diff and prompts for `overwrite / backup / cancel`. Use `--force` for non-interactive runs and add `--backup` to keep a `.bak`.

---

### settings:inspect

Display information about the configuration file.

**Usage:**
```bash
xling settings:inspect [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini|xling) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Output:**
- File path
- Existence status
- File size (if exists)
- Last modified date (if exists)
- File contents (if exists)

**Examples:**
```bash
# Inspect Claude Code user settings
xling settings:inspect --tool claude --scope user

# Inspect Codex config with human-readable output
xling settings:inspect --tool codex --no-json

# Check Gemini system config location
xling settings:inspect --tool gemini --scope system --no-json

# Confirm xling prompt router config exists
xling settings:inspect --tool xling
```

---

### settings:sync

Sync `config.toml` between Claude Code and Codex. Default direction is
Claude -> Codex; pass `--reverse` for Codex -> Claude.

**Usage:**
```bash
xling settings:sync [OPTIONS]
```

**Options:**
- `--source <path>`: Source `config.toml` (defaults to Claude unless `--reverse`)
- `--target <path>`: Target `config.toml` (defaults to Codex unless `--reverse`)
- `--backup/--no-backup`: Create a `.bak` of the target before overwriting (default: `--no-backup`)
- `--force`: Apply without prompts (overwrites unless `--backup` is set)
- `--dry-run`: Show diff only, no writes
- `--json`: Emit structured JSON output
- `--reverse`: Copy Codex -> Claude instead of Claude -> Codex

**Examples:**
```bash
# Preview diff only (no writes)
xling settings:sync --dry-run

# Sync after reviewing prompt (choose overwrite/backup/cancel)
xling settings:sync

# Use explicit paths and skip backup
xling settings:sync --source ~/.claude/config.toml --target ~/.codex/config.toml --no-backup

# Reverse sync (Codex -> Claude)
xling settings:sync --reverse
```

The command prints a unified diff first. When not running with `--force` or `--dry-run`, you'll be prompted to overwrite, backup+overwrite, or cancel. If the files are already identical, it exits without changes.

---

## Configuration Scopes

### Claude Code

- **user**: `~/.claude/settings.json` - Global user settings
- **project**: `.claude/settings.json` - Project-specific settings
- **local**: `.claude/settings.local.json` - Local overrides (gitignored)

### Codex

- **user**: `~/.codex/config.toml` - Global user settings

### Gemini CLI

- **user**: `~/.gemini/settings.json` - Global user settings
- **project**: `.gemini/settings.json` - Project-specific settings
- **system**: Platform-dependent system-wide settings
  - macOS: `/Library/Application Support/Gemini/settings.json`
  - Linux: `/etc/gemini/settings.json`
  - Windows: `C:\ProgramData\Gemini\settings.json`

### Xling Prompt Router

- **user**: `~/.claude/xling.json` - Provider, model, and retry policy configuration (user scope only)

---

## JSON Output

Output defaults vary by command:
- `settings:list`: YAML-style summary by default (`--json` or `--table` for structure)
- `settings:set` and `settings:inspect`: JSON by default (`--no-json` for human-readable)
- `settings:get` and `settings:switch`: Human-readable by default (`--json` for scripts)

```bash
# Summary output (default)
xling settings:list --tool claude

# Emit JSON for scripting
xling settings:get --tool codex --json
xling settings:inspect --tool claude --scope user

# Human-readable edit flow
xling settings:set --tool claude --scope user --no-json

# Table output for quick inspection
xling settings:list --tool claude --scope user --table
```

## Error Handling

Common errors and solutions:

### Config file not found
```
Error: Config file not found: ~/.claude/settings.json
```
**Solution:** The configuration file doesn't exist. Use `settings:set` to create it.

### Invalid scope
```
Error: Invalid scope: system
```
**Solution:** The specified scope is not supported by the tool. Check supported scopes for each tool.

### Unsupported tool
```
Error: Unsupported tool: unknown
```
**Solution:** Use one of the supported tools: claude, codex, gemini, or xling.

---

## Best Practices

1. **Flag everything**: Pass `--tool`, `--scope`, and `--name` explicitly instead of relying on defaults.
2. **Backup important configs**: Configuration files are automatically backed up with `.bak` extension
3. **Use JSON output for scripting**: Add `--json` when scripting and use `--no-json` on commands like `settings:set`/`settings:inspect` when you want human-readable output.
4. **Scope appropriately**: Use `user` for personal/global settings and `project` for repository-scoped overrides.
5. **Prefer IDE edits**: Use `settings:set --name ...` to open the target file and edit holistically instead of writing piecemeal changes.

---

## Examples

### Complete Workflow

```bash
# 1. Inspect current configuration
xling settings:inspect --tool claude --scope user

# 2. List available variants (YAML summary)
xling settings:list --tool claude --scope user

# 3. Open a variant in VS Code
xling settings:set --tool claude --scope user --name hxi

# 4. After editing, view the raw file
xling settings:get --tool claude --scope user --no-json

# 5. Switch the active variant when ready
xling settings:switch hxi --tool claude --scope user

# 6. Inspect the file again after editing
xling settings:inspect --tool claude --scope user
```

### Managing Multiple Tools

```bash
# Open user-level configs for each tool
xling settings:get --tool claude --scope user
xling settings:get --tool codex --scope user
xling settings:get --tool gemini --scope user
xling settings:get --tool xling --scope user

# Edit Claude project overrides
xling settings:set --tool claude --scope project --name default
```

### Working with Profiles (Codex)

```bash
# List current settings
xling settings:list --tool codex

# Switch to OSS profile
xling settings:switch oss --tool codex

# Verify profile switch
xling settings:get current_profile --tool codex

# Switch back to production
xling settings:switch production --tool codex

# Save current auth to a named profile, then restore it later
xling settings:auth --save personal --tool codex
xling settings:auth --restore personal --tool codex
```
