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
- `--json`: Output structured JSON（默认关闭）
- `--table`: Render a table instead of the summary view

**Examples:**
```bash
# List Claude Code user settings
xling settings:list --tool claude --scope user

# List Codex settings as table
xling settings:list --tool codex --table

# List Gemini project settings
xling settings:list -t gemini -s project
```

**Claude Variant Discovery:** When `--tool claude`, this command lists every
`settings*.json` file (e.g., `settings.hxi.json`) alongside the active
`settings.json`, making it easier to inspect which variants are available before
switching.

默认输出为 YAML 风格的简洁列表，便于快速确认有哪些配置文件；需要更多细节时再
加 `--table` 或 `--json`。

---

### settings:get

Display the full configuration file for the selected tool/scope.

**Usage:**
```bash
xling settings:get [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Show Claude user settings (JSON)
xling settings:get --tool claude --scope user

# Plain text output for Codex
xling settings:get --tool codex --no-json
```

---

### settings:set

Open Claude settings files in your IDE.

**Usage:**
```bash
xling settings:set [OPTIONS]
```

**Options:**
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: claude]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--name <variant>`: Claude variant to edit (default: `default`, i.e., `settings.json`)
- `--ide <cmd>`: Editor command/alias (default: `code` → VS Code)
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Create/edit settings.hxi.json in VS Code
xling settings:set --tool claude --scope user --name hxi

# Open default settings in Cursor
xling settings:set --tool claude --scope project --name default --ide cursor --no-json
```

`settings:set` 不再支持局部写入；若需修改键值，请直接在打开的文件中编辑后保存。

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
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Remove model setting
xling settings:unset defaultModel --tool claude

# Remove nested setting
xling settings:unset developerShortcuts.runCommand --tool claude

# Preview removal
xling settings:unset developerShortcuts.runCommand --tool claude --dry-run
```

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
- `-t, --tool <tool>`: AI CLI tool to manage (claude|codex|gemini) [default: codex]
- `-s, --scope <scope>`: Configuration scope (user|project|local|system) [default: user]
- `--json/--no-json`: JSON output is default; use `--no-json` for plain text

**Examples:**
```bash
# Switch to OSS profile (Codex)
xling settings:switch oss --tool codex

# Activate settings.hxi.json (Claude user scope)
xling settings:switch hxi --tool claude --scope user
```

**Notes:**
- Codex profiles must be defined in `~/.codex/config.toml` under the
  `[profiles.<name>]` section.
- Claude switching copies the requested `settings.<variant>.json` (or
  `settings-<variant>.json`) over the active `settings.json` for the selected
  scope.

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

## JSON Output

大多数命令（除 `settings:list`）默认输出 JSON；`settings:list` 默认为 YAML 风格摘要。
使用 `--no-json` 获取文本输出，或在 list 上添加 `--table` 查看详细表格。

```bash
# Default JSON output
xling settings:list --tool claude

# Disable JSON
xling settings:get --tool claude --no-json

# Table output for quick inspection
xling settings:list --tool claude --scope user --table
```

---

## Dry Run Mode（删除配置时依然适用）

`settings:unset` 仍然提供 `--dry-run`，方便在删除键之前查看 diff：

```bash
xling settings:unset developerShortcuts.runCommand --tool claude --dry-run
```

输出包括当前值与删除后的 diff，便于确认影响范围。

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
Error: Config key not found: developerShortcuts.runCommand
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
3. **Use JSON output for scripting**: JSON 是默认格式；仅在需要文本时加 `--no-json`
4. **Scope appropriately**: 使用 `user` 表示个人配置，`project` 表示仓库配置
5. **IDE 编辑优先**: 通过 `settings:set --name ...` 打开文件整体修改，避免零散写入

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

# 5. Remove a deprecated key with dry-run preview
xling settings:unset developerShortcuts.runCommand --tool claude --dry-run

# 6. Confirm removal
xling settings:unset developerShortcuts.runCommand --tool claude
```

### Managing Multiple Tools

```bash
# Open user-level configs for each tool
xling settings:get --tool claude --scope user
xling settings:get --tool codex --scope user
xling settings:get --tool gemini --scope user

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
```
