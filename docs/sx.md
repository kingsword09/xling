# `sx` Command (Shortcut eXecute)

Execute predefined command shortcuts configured in `~/.claude/xling.json`. Shortcuts allow you to create custom aliases for frequently used xling commands with pre-configured arguments.

## Usage

```bash
xling sx <name> [...args]
xling sx --list
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-l, --list` | List all available shortcuts with their commands and descriptions. |

## Configuration

Shortcuts are defined in `~/.claude/xling.json` under the `shortcuts` key:

```json
{
  "shortcuts": {
    "lc": {
      "command": "x",
      "args": ["-t", "claude", "-c"],
      "description": "Launch Claude and continue last conversation"
    },
    "lx": {
      "command": "x",
      "args": ["-t", "codex"],
      "description": "Launch Codex"
    },
    "gs": {
      "command": "settings:list",
      "args": ["--tool", "claude"],
      "description": "List Claude settings"
    },
    "gsx": {
      "command": "settings:list",
      "args": ["--tool", "codex"],
      "description": "List Codex settings"
    }
  }
}
```

### Shortcut Types

Shortcuts support three execution types:

#### 1. Command Type (Xling Commands)

Execute xling commands with pre-configured arguments:

```json
{
  "lc": {
    "command": "x",
    "args": ["-t", "claude", "-c"],
    "description": "Launch Claude and continue"
  }
}
```

Properties:
- **`command`** (required): The xling command to execute
- **`args`** (optional): Array of arguments to pass to the command
- **`description`** (optional): Human-readable description

#### 2. Shell Type (Shell Commands)

Execute arbitrary shell commands with full shell syntax support:

```json
{
  "gdp": {
    "shell": "git diff | xling p --stdin 'Summarize these changes'",
    "description": "Git diff with AI summary"
  }
}
```

Properties:
- **`shell`** (required): Shell command string to execute
- **`description`** (optional): Human-readable description

**Use cases**:
- Commands with pipes (`|`)
- Commands with redirects (`>`, `<`)
- Complex shell expressions
- Integration with external tools

#### 3. Pipeline Type (Command Pipelines)

Execute a series of commands with piped output:

```json
{
  "pipe": {
    "pipeline": [
      { "command": "git", "args": ["log", "--oneline", "-10"] },
      { "command": "xling", "args": ["p", "--stdin", "Summarize commits"] }
    ],
    "description": "Recent commits with AI summary"
  }
}
```

Properties:
- **`pipeline`** (required): Array of command steps
  - Each step has `command` (required) and `args` (optional)
- **`description`** (optional): Human-readable description

**Use cases**:
- Structured command pipelines
- Better error handling than shell pipes
- Cross-platform compatibility

## Examples

### List all shortcuts

```bash
xling sx --list
```

Output:
```
┌────────────┬────────────────────┬──────────────────────────────┬────────────────────────────────────────┐
│ Name       │ Command            │ Args                         │ Description                            │
├────────────┼────────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ lc         │ x                  │ -t claude -c                 │ Launch Claude and continue             │
├────────────┼────────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ lx         │ x                  │ -t codex                     │ Launch Codex                           │
├────────────┼────────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ gs         │ settings:list      │ --tool claude                │ List Claude settings                   │
└────────────┴────────────────────┴──────────────────────────────┴────────────────────────────────────────┘
```

### Execute a shortcut

```bash
# Execute the "lc" shortcut (launches Claude and continues)
xling sx lc

# Execute the "gs" shortcut (lists Claude settings)
xling sx gs
```

### Execute shortcut with additional arguments

Additional arguments passed after the shortcut name are appended to the configured args:

```bash
# Run "lc" shortcut with --no-yolo flag
xling sx lc --no-yolo

# This is equivalent to:
xling x -t claude -c --no-yolo
```

## Common Use Cases

### Quick Launch Shortcuts (Command Type)

```json
{
  "shortcuts": {
    "c": {
      "command": "x",
      "args": ["-t", "claude"],
      "description": "Quick launch Claude"
    },
    "cc": {
      "command": "x",
      "args": ["-t", "claude", "-c"],
      "description": "Continue Claude conversation"
    },
    "cx": {
      "command": "x",
      "args": ["-t", "codex"],
      "description": "Quick launch Codex"
    }
  }
}
```

### Settings Management Shortcuts (Command Type)

```json
{
  "shortcuts": {
    "sc": {
      "command": "settings:list",
      "args": ["--tool", "claude"],
      "description": "Show Claude settings"
    },
    "sx": {
      "command": "settings:list",
      "args": ["--tool", "codex"],
      "description": "Show Codex settings"
    },
    "sxl": {
      "command": "settings:list",
      "args": ["--tool", "xling"],
      "description": "Show Xling settings"
    }
  }
}
```

### Git Integration Shortcuts (Shell Type)

```json
{
  "shortcuts": {
    "gdp": {
      "shell": "git diff | xling p --stdin 'Summarize these changes'",
      "description": "Git diff with AI summary"
    },
    "gsp": {
      "shell": "git status --short | xling p --stdin 'Explain these changes'",
      "description": "Git status with AI explanation"
    },
    "glp": {
      "shell": "git log --oneline -20 | xling p --stdin 'Summarize recent commits'",
      "description": "Recent commits with AI summary"
    }
  }
}
```

### Pipeline Shortcuts (Pipeline Type)

```json
{
  "shortcuts": {
    "commits": {
      "pipeline": [
        { "command": "git", "args": ["log", "--oneline", "-10"] },
        { "command": "xling", "args": ["p", "--stdin", "Summarize commits"] }
      ],
      "description": "Recent commits with AI summary"
    },
    "analyze": {
      "pipeline": [
        { "command": "git", "args": ["diff", "--stat"] },
        { "command": "xling", "args": ["p", "--stdin", "Analyze code changes"] }
      ],
      "description": "Analyze code changes with AI"
    }
  }
}
```

## Tips

- **Use short, memorable names**: 2-4 character shortcuts work best (e.g., "lc", "gs", "cc")
- **Add descriptions**: Helps you remember what each shortcut does when using `--list`
- **Group by function**: Use prefixes like "l" for launch, "g" for get/list, "s" for settings
- **Test shortcuts**: Run `xling sx --list` to verify your configuration is valid
- **Combine with passthrough args**: Shortcuts can be customized on-the-fly with additional arguments

## Security Notes

- Shortcuts only execute xling commands, not arbitrary shell commands
- They run with the same permissions as your user account
- Shortcuts are stored locally in `~/.claude/xling.json` (not shared)
- The config file should have `600` permissions (owner read/write only)

## Error Handling

### Shortcut not found

```bash
$ xling sx missing
Error: Shortcut "missing" not found.

Available shortcuts: lc, lx, gs, gsx

Use "xling sx --list" to see all shortcuts.
```

### Circular reference protection

Shortcuts cannot call the `sx` command itself to prevent infinite loops:

```json
{
  "shortcuts": {
    "bad": {
      "command": "sx",
      "args": ["lc"]
    }
  }
}
```

```bash
$ xling sx bad
Error: Circular reference detected: shortcut "bad" cannot call "sx" command.

This would create an infinite loop.
```

### No shortcuts configured

```bash
$ xling sx --list
No shortcuts configured.

Add shortcuts to ~/.claude/xling.json:
{
  "shortcuts": {
    "lc": {
      "command": "x",
      "args": ["-t", "claude", "-c"],
      "description": "Launch Claude and continue"
    }
  }
}
```

## Related Commands

- [`x`](./x.md) - Quick launcher for AI CLI tools
- [`p`](./p.md) - Prompt AI tools with input
- [`settings:list`](./settings.md) - List configuration settings

## See Also

- [Configuration Guide](../README.md#configuration)
- [Command Reference](../README.md#commands)
