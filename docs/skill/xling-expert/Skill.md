---
name: Xling CLI Expert
description: Expert knowledge about xling CLI tool for managing AI tools (Claude Code, Codex, Gemini) and executing AI prompts with multi-provider support. Use when user asks about xling commands, configuration, or workflows.
version: 1.0.0
---

# Xling CLI Expert

This skill provides comprehensive knowledge about the xling CLI tool for managing AI CLI tools and executing AI prompts.

## When to Use This Skill

Use this skill when the user:
- Asks about xling commands (`x`, `p`, `sx`, `settings:*`)
- Needs help configuring AI providers
- Wants to create command shortcuts
- Asks about multi-provider setup and fallback
- Needs troubleshooting help with xling
- Wants to integrate xling with git workflows

## Core Commands

### Quick Launcher: `xling x`

Launch Claude Code or Codex with yolo mode enabled by default.

**Syntax:**
```bash
xling x [FLAGS] [-- ...args]
```

**Key Flags:**
- `-t, --tool <claude|codex>` - Target tool (default: claude)
- `--no-yolo` - Disable yolo mode
- `-c, --continue` - Resume most recent session
- `-r, --resume` - Show session picker
- `-C, --cwd <dir>` - Run from different directory

**Examples:**
```bash
xling x                      # Launch Claude with yolo
xling x -t codex             # Launch Codex
xling x -c                   # Continue last session
xling x -- chat "Hello"      # Forward args to Claude
```

---

### Prompt Command: `xling p`

Execute AI prompts with multi-provider support, intelligent routing, and automatic fallback.

**Key Features:**
- Multi-provider support (OpenAI, Azure, custom)
- Intelligent model routing
- Automatic fallback on failure
- Priority-based provider selection

**Syntax:**
```bash
xling p [FLAGS] <prompt>
```

**Key Flags:**
- `-m, --model <model>` - Model to use
- `-s, --system <text>` - System prompt
- `-f, --file <path>` - Read context from file
- `--stdin` - Read from stdin
- `-t, --temperature <0.0-2.0>` - Temperature
- `--max-tokens <n>` - Max tokens
- `--json` - JSON output
- `-i, --interactive` - Interactive chat mode

**Examples:**
```bash
# Basic usage
xling p "Explain quantum computing"

# With model
xling p --model gpt-4-turbo "Write a poem"

# From file
xling p -f README.md "Summarize this"

# From stdin (great for pipelines)
git diff | xling p --stdin "Review this diff"

# Interactive mode
xling p -i "Let's chat"
```

**Configuration (`~/.claude/xling.json`):**
```json
{
  "prompt": {
    "providers": [
      {
        "name": "openai-primary",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-proj-xxx",
        "models": ["gpt-4", "gpt-4-turbo"],
        "priority": 1,
        "timeout": 60000
      }
    ],
    "defaultModel": "gpt-4",
    "retryPolicy": {
      "maxRetries": 2,
      "backoffMs": 1000
    }
  }
}
```

**How It Works:**
1. User specifies model (or uses defaultModel)
2. System finds providers supporting that model
3. Providers sorted by priority (lower = higher)
4. Tries first provider
5. On failure, checks if retriable (network errors, 5xx, 429)
6. If retriable, applies exponential backoff and tries next provider
7. If all fail, shows all errors

---

### Shortcuts: `xling sx`

Execute predefined command shortcuts with three types: command, shell, and pipeline.

**Syntax:**
```bash
xling sx <name> [...args]
xling sx --list
```

**Shortcut Types:**

**1. Command Type** (Xling commands):
```json
{
  "lc": {
    "command": "x",
    "args": ["-t", "claude", "-c"],
    "description": "Launch Claude and continue"
  }
}
```

**2. Shell Type** (Shell commands):
```json
{
  "gdp": {
    "shell": "git diff | xling p --stdin 'Summarize changes'",
    "description": "Git diff with AI summary"
  }
}
```

**3. Pipeline Type** (Command pipelines):
```json
{
  "gcm": {
    "pipeline": [
      { "command": "git", "args": ["diff", "--cached"] },
      { "command": "xling", "args": ["p", "--stdin", "Generate commit"] }
    ],
    "description": "Generate commit message"
  }
}
```

**Examples:**
```bash
# List shortcuts
xling sx --list

# Execute shortcut
xling sx lc

# With additional args
xling sx lc --no-yolo
```

---

### Settings Management: `xling settings:*`

Unified interface for managing configurations across Claude Code, Codex, and Gemini CLI.

**Commands:**

**`settings:list`** - List configurations
```bash
xling settings:list --tool <claude|codex|gemini> --scope <user|project|local>
```

**`settings:get`** - Display full config
```bash
xling settings:get --tool claude --scope user
```

**`settings:set`** - Open config in IDE
```bash
xling settings:set --tool claude --name hxi --ide code
```

**`settings:switch`** - Switch profile/variant
```bash
xling settings:switch <profile> --tool codex
```

**`settings:inspect`** - Show file info
```bash
xling settings:inspect --tool claude --scope user
```

**Configuration Scopes:**
- **Claude Code:** `user`, `project`, `local`
- **Codex:** `user`
- **Gemini:** `user`, `project`, `system`

---

## Configuration Structure

### Main Config: `~/.claude/xling.json`

```json
{
  "prompt": {
    "providers": [
      {
        "name": "provider-name",
        "baseUrl": "https://api.example.com/v1",
        "apiKey": "your-key",
        "models": ["model1", "model2"],
        "priority": 1,
        "timeout": 60000,
        "headers": {
          "X-Custom": "value"
        }
      }
    ],
    "defaultModel": "model-name",
    "retryPolicy": {
      "maxRetries": 2,
      "backoffMs": 1000
    }
  },
  "shortcuts": {
    "shortcut-name": {
      "command": "xling-command",
      "args": ["arg1", "arg2"],
      "description": "Description"
    }
  }
}
```

**Provider Fields:**
- `name` - Unique identifier
- `baseUrl` - API base URL
- `apiKey` - API key
- `models` - Supported models array
- `priority` - Lower = higher priority (optional)
- `timeout` - Request timeout in ms (optional)
- `headers` - Custom headers (optional)

---

## Common Workflows

### 1. Setup New Provider
```bash
# Edit config
vim ~/.claude/xling.json

# Add provider to prompt.providers array
# Test it
xling p --model your-model "test prompt"
```

### 2. Create Git Integration Shortcut
```bash
# Add to shortcuts in config:
{
  "gcm": {
    "pipeline": [
      { "command": "git", "args": ["diff", "--cached"] },
      { "command": "xling", "args": ["p", "--stdin", "Generate commit message"] }
    ],
    "description": "Generate commit message"
  }
}

# Use it
git add .
xling sx gcm
```

### 3. AI Code Review
```bash
# Review current changes
git diff | xling p --stdin "Review this code"

# Review specific file
xling p -f src/app.ts "Find bugs and suggest improvements"

# Interactive review
xling p -i -f src/app.ts "Let's review together"
```

---

## Troubleshooting

### "Model not supported" Error
**Check:**
1. Model name spelling
2. At least one provider has model in `models` array
3. Run `xling settings:list --tool xling` to see available models

### "All providers failed" Error
**Check:**
1. API keys are valid
2. Network connectivity
3. Provider URLs are correct
4. Check error details for each provider

### Config Parse Error
**Check:**
1. JSON syntax is valid
2. Config follows new format with `prompt` namespace
3. Old format is auto-migrated but may have issues

### Shortcut Not Found
**Check:**
1. Shortcut name is correct
2. Run `xling sx --list` to see available shortcuts
3. Config file has `shortcuts` section

---

## Best Practices

1. **Use shortcuts for common tasks** - Create shortcuts for frequently used commands
2. **Set up multiple providers** - Configure backup providers for reliability
3. **Use priority wisely** - Lower priority = higher preference
4. **Secure your config** - File automatically gets 600 permissions
5. **Use stdin for pipelines** - Great for git workflows
6. **Interactive mode for exploration** - Use `-i` for conversations
7. **Organize shortcuts** - Use prefixes (l=launch, g=git, s=settings)

---

## Important Notes

1. **Config format changed**: Old format had `providers` at top level, new format has `prompt.providers` (auto-migrated)
2. **Yolo mode default**: `xling x` enables yolo by default, use `--no-yolo` to disable
3. **Shortcuts are powerful**: Can execute commands, shell scripts, or pipelines
4. **Provider priority**: Lower number = higher priority
5. **Retriable errors**: Network errors and 5xx are retried, 4xx are not

---

## Example Configurations

### Multi-Provider Setup
```json
{
  "prompt": {
    "providers": [
      {
        "name": "openai-primary",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-proj-xxx",
        "models": ["gpt-4", "gpt-4-turbo"],
        "priority": 1
      },
      {
        "name": "openai-backup",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-proj-yyy",
        "models": ["gpt-4", "gpt-3.5-turbo"],
        "priority": 2
      }
    ],
    "defaultModel": "gpt-4"
  }
}
```

### Useful Shortcuts
```json
{
  "shortcuts": {
    "lc": {
      "command": "x",
      "args": ["-t", "claude", "-c"],
      "description": "Launch Claude and continue"
    },
    "gdp": {
      "shell": "git diff | xling p --stdin 'Summarize changes'",
      "description": "Git diff with AI summary"
    },
    "gcm": {
      "pipeline": [
        { "command": "git", "args": ["diff", "--cached"] },
        { "command": "xling", "args": ["p", "--stdin", "Generate commit"] }
      ],
      "description": "Generate commit message"
    }
  }
}
```
