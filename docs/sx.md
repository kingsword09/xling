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

Execute arbitrary shell commands with full shell syntax support.

**Simple Shell Command (Cross-platform)**:

```json
{
  "gdp": {
    "shell": "git diff | xling p --stdin 'Summarize these changes'",
    "description": "Git diff with AI summary"
  }
}
```

**Platform-Specific Shell Command**:

```json
{
  "gcm": {
    "shell": {
      "win32": "git add -N . && git diff HEAD | xling p --stdin 'Generate commit message'",
      "darwin": "git diff HEAD; git ls-files -o --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\"; done | xling p --stdin 'Generate commit message'",
      "linux": "git diff HEAD; git ls-files -o --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\"; done | xling p --stdin 'Generate commit message'",
      "default": "git diff HEAD | xling p --stdin 'Generate commit message'"
    },
    "description": "Generate commit message (platform-specific)"
  }
}
```

Properties:
- **`shell`** (required): Shell command string OR platform-specific object
  - **String**: Single command for all platforms
  - **Object**: Platform-specific commands with fallback
    - `win32`: Windows-specific command (optional)
    - `darwin`: macOS-specific command (optional)
    - `linux`: Linux-specific command (optional)
    - `default`: Fallback command for all platforms (required)
- **`description`** (optional): Human-readable description

**Use cases**:
- Commands with pipes (`|`)
- Commands with redirects (`>`, `<`)
- Complex shell expressions
- Integration with external tools
- Platform-specific syntax (e.g., `/dev/null` vs `NUL`)

**Platform Support**:
- **Windows**: Uses PowerShell 7 (`pwsh`). Requires PowerShell 7+ to be installed.
- **macOS/Linux**: Uses the default system shell (`/bin/sh` or `$SHELL`)
- **Platform Resolution**: Automatically selects the appropriate command based on `process.platform`

#### 3. Pipeline Type (Command Pipelines)

Execute a series of commands with piped output.

**Simple Pipeline (Cross-platform)**:

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

**Platform-Specific Pipeline (Entire Pipeline)**:

```json
{
  "analyze": {
    "pipeline": {
      "win32": [
        { "command": "powershell", "args": ["-Command", "Get-ChildItem -Recurse *.ts | Measure-Object -Line"] },
        { "command": "xling", "args": ["p", "--stdin", "Analyze TypeScript files"] }
      ],
      "darwin": [
        { "command": "find", "args": [".", "-name", "*.ts", "-exec", "wc", "-l", "{}", "+"] },
        { "command": "xling", "args": ["p", "--stdin", "Analyze TypeScript files"] }
      ],
      "linux": [
        { "command": "find", "args": [".", "-name", "*.ts", "-exec", "wc", "-l", "{}", "+"] },
        { "command": "xling", "args": ["p", "--stdin", "Analyze TypeScript files"] }
      ],
      "default": [
        { "command": "git", "args": ["ls-files", "*.ts"] },
        { "command": "xling", "args": ["p", "--stdin", "List TypeScript files"] }
      ]
    },
    "description": "Analyze TypeScript files (platform-specific)"
  }
}
```

**Platform-Specific Pipeline Steps (Recommended - Less Repetition)**:

```json
{
  "gcm": {
    "pipeline": [
      {
        "command": {
          "win32": "pwsh",
          "default": "sh"
        },
        "args": {
          "win32": ["-NoProfile", "-Command", "$diff = git diff HEAD; $untracked = git ls-files --others --exclude-standard | ForEach-Object { git diff --no-index NUL $_ 2>$null }; \"$diff`n$untracked\""],
          "default": ["-c", "git diff HEAD; git ls-files --others --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\" 2>/dev/null || true; done"]
        }
      },
      {
        "command": "xling",
        "args": ["p", "--stdin", "分析代码变更并生成提交信息建议，分为中英文版本"]
      }
    ],
    "description": "Generate commit message for all changes"
  }
}
```

Properties:
- **`pipeline`** (required): Array of command steps OR platform-specific object
  - **Array**: Pipeline for all platforms
    - Each step has:
      - `command` (required): String OR platform-specific object
      - `args` (optional): Array OR platform-specific object
  - **Object**: Platform-specific entire pipelines with fallback
    - `win32`: Windows-specific pipeline (optional)
    - `darwin`: macOS-specific pipeline (optional)
    - `linux`: Linux-specific pipeline (optional)
    - `default`: Fallback pipeline for all platforms (required)
- **`description`** (optional): Human-readable description

**Three Ways to Configure Platform-Specific Pipelines**:

1. **Entire Pipeline**: Different pipeline for each platform (most flexible, most repetition)
2. **Per-Step**: Platform-specific command/args within each step (recommended, less repetition)
3. **Mixed**: Combine both approaches as needed

**Use cases**:
- Structured command pipelines
- Better error handling than shell pipes
- Platform-specific command sequences
- Cross-platform compatibility with fallback

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

**Simple Cross-Platform Shortcuts**:

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

**Platform-Specific Shortcuts**:

```json
{
  "shortcuts": {
    "gcm": {
      "shell": {
        "win32": "git add -N . && git diff HEAD | xling p --stdin 'Analyze changes and generate commit message'",
        "darwin": "git diff HEAD; git ls-files -o --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\" 2>/dev/null || true; done | xling p --stdin 'Analyze changes and generate commit message'",
        "linux": "git diff HEAD; git ls-files -o --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\" 2>/dev/null || true; done | xling p --stdin 'Analyze changes and generate commit message'",
        "default": "git diff HEAD | xling p --stdin 'Analyze changes and generate commit message'"
      },
      "description": "Generate commit message for all changes including untracked files"
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

## Platform Requirements

**Windows Users:**
- PowerShell 7+ is required for shell-type shortcuts
- Install from: https://github.com/PowerShell/PowerShell/releases
- Command and pipeline types work without PowerShell 7

**All Platforms:**
- Shell commands use platform-specific shells (PowerShell 7 on Windows, default shell on Unix)
- Pipeline commands are cross-platform compatible

## Security Notes

- Shell-type shortcuts execute commands with full shell access
- Command and pipeline types only execute specified commands
- All shortcuts run with the same permissions as your user account
- Shortcuts are stored locally in `~/.claude/xling.json` (not shared)
- The config file has restricted permissions (600 on Unix, ACL on Windows)

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
