# Settings Command Documentation

## Overview

The `settings` command provides a unified interface for managing configuration settings across multiple AI CLI tools: Claude Code, Codex, and Gemini CLI.

## Commands

### settings:list

List all configuration settings for a specified tool and scope.

**Usage:**
```bash
xling settings:list [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json`: Output in JSON format

**Examples:**
```bash
# List Claude Code user settings
xling settings:list --tool claude --scope user

# List Codex settings in JSON format
xling settings:list --tool codex --json

# List Gemini project settings
xling settings:list -t gemini -s project
```

---

### settings:get

Retrieve the value of a specific configuration key.

**Usage:**
```bash
xling settings:get <key> [OPTIONS]
```

**Arguments:**
- `key`: Setting key to retrieve (supports nested keys with dot notation)

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json`: Output in JSON format

**Examples:**
```bash
# Get theme setting
xling settings:get theme --tool claude

# Get nested setting
xling settings:get editor.fontSize --tool claude

# Get model setting from Codex
xling settings:get model --tool codex --json
```

---

### settings:set

Set the value of a configuration key.

**Usage:**
```bash
xling settings:set <key> <value> [OPTIONS]
```

**Arguments:**
- `key`: Setting key to set (supports nested keys with dot notation)
- `value`: Setting value (automatically parsed as JSON if possible)

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--dry-run`: Preview changes without applying them
- `--json`: Output in JSON format

**Value Parsing:**
- Strings: `"hello"` or `hello`
- Numbers: `42` or `3.14`
- Booleans: `true` or `false`
- Arrays: `["a","b","c"]`
- Objects: `{"key":"value"}`

**Examples:**
```bash
# Set theme to dark
xling settings:set theme dark --tool claude

# Set nested setting
xling settings:set editor.fontSize 16 --tool claude

# Set boolean value
xling settings:set enabled true --tool gemini

# Preview changes without applying
xling settings:set theme light --tool claude --dry-run

# Set complex value
xling settings:set colors '{"primary":"#000","secondary":"#fff"}' --tool claude
```

---

### settings:unset

Remove a configuration key.

**Usage:**
```bash
xling settings:unset <key> [OPTIONS]
```

**Arguments:**
- `key`: Setting key to remove (supports nested keys with dot notation)

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--dry-run`: Preview changes without applying them
- `--json`: Output in JSON format

**Examples:**
```bash
# Remove theme setting
xling settings:unset theme --tool claude

# Remove nested setting
xling settings:unset editor.fontSize --tool claude

# Preview removal
xling settings:unset theme --tool claude --dry-run
```

---

### settings:switch

Switch to a different configuration profile (Codex only).

**Usage:**
```bash
xling settings:switch <profile> [OPTIONS]
```

**Arguments:**
- `profile`: Profile name to switch to

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: codex]
- `--json`: Output in JSON format

**Examples:**
```bash
# Switch to OSS profile
xling settings:switch oss --tool codex

# Switch to production profile
xling settings:switch production --tool codex
```

**Note:** This command is only supported by Codex. Profiles must be defined in `~/.codex/config.toml` under the `[profiles.<name>]` section.

---

### settings:inspect

Display information about the configuration file.

**Usage:**
```bash
xling settings:inspect [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json`: Output in JSON format

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

# Inspect Codex config in JSON format
xling settings:inspect --tool codex --json
```

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

---

## Nested Keys

All commands support nested keys using dot notation:

```bash
# Set nested value
xling settings:set theme.dark.background "#000000" --tool claude

# Get nested value
xling settings:get theme.dark.background --tool claude

# Remove nested value
xling settings:unset theme.dark.background --tool claude
```

---

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
# List settings in JSON
xling settings:list --tool claude --json

# Get setting in JSON
xling settings:get theme --tool claude --json

# Set setting with JSON output
xling settings:set theme dark --tool claude --json
```

---

## Dry Run Mode

Preview changes before applying them:

```bash
# Preview setting change
xling settings:set theme dark --tool claude --dry-run

# Preview removal
xling settings:unset theme --tool claude --dry-run
```

The output will show:
- Current value
- New value
- Diff preview

---

## Error Handling

Common errors and solutions:

### Config file not found
```
Error: Config file not found: ~/.claude/settings.json
```
**Solution:** The configuration file doesn't exist. Use `settings:set` to create it.

### Config key not found
```
Error: Config key not found: theme
```
**Solution:** The specified key doesn't exist in the configuration.

### Invalid scope
```
Error: Invalid scope: system
```
**Solution:** The specified scope is not supported by the tool. Check supported scopes for each tool.

### Unsupported tool
```
Error: Unsupported tool: unknown
```
**Solution:** Use one of the supported tools: claude, codex, or gemini.

---

## Best Practices

1. **Use dry-run first**: Always preview changes with `--dry-run` before applying them
2. **Backup important configs**: Configuration files are automatically backed up with `.bak` extension
3. **Use JSON output for scripting**: The `--json` flag provides consistent, parseable output
4. **Scope appropriately**: Use `user` for personal settings, `project` for team settings
5. **Nested keys**: Use dot notation for organizing related settings

---

## Examples

### Complete Workflow

```bash
# 1. Inspect current configuration
xling settings:inspect --tool claude --scope user

# 2. List all settings
xling settings:list --tool claude --scope user

# 3. Get a specific setting
xling settings:get theme --tool claude

# 4. Preview a change
xling settings:set theme dark --tool claude --dry-run

# 5. Apply the change
xling settings:set theme dark --tool claude

# 6. Verify the change
xling settings:get theme --tool claude
```

### Managing Multiple Tools

```bash
# Set theme for all tools
xling settings:set theme dark --tool claude
xling settings:set theme dark --tool codex
xling settings:set theme dark --tool gemini

# List settings for all tools
xling settings:list --tool claude
xling settings:list --tool codex
xling settings:list --tool gemini
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
```
