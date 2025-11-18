# xling

Unified CLI for managing AI tool settings across Claude Code, Codex, and Gemini CLI.

## What's in a Name? The Story of `xling`

The name `xling` was carefully chosen to represent the project's philosophy, blending modern tech symbolism with a rich, dual-meaning core.

### The `x` Factor

The prefix `x` is a nod to its primary functions in the world of software development. It stands for:

*   **eXecute**: `xling` is built to run tasks with speed and precision.
*   **eXtensible**: The tool is designed from the ground up to be adaptable, with a plugin-friendly architecture that grows with your needs.

### The Soul of the Command: `ling`

At the heart of the name is `ling`, a concept with two harmonious faces rooted in Chinese pinyin:

1.  **令 (lìng)**: This means "command" or "order." It represents the tool's heritage as a command-line interface—unwavering, precise, and powerful.
2.  **灵 (líng)**: This translates to "intelligence," "spirit," or "agility." It embodies the AI engine that gives `xling` its smarts, allowing it to understand natural language, anticipate intent, and perform complex tasks with a touch of magic.

Together, `xling` is more than just a tool; it's an intelligent partner that amplifies your ability to command your digital world.

## Features

- **Unified Interface**: Manage settings for multiple AI CLI tools with a single command
- **Quick Launcher**: Just type `xling x` to start Claude Code instantly with yolo mode
- **Codex SDK Integration**: Programmatic AI automation with `codex:run` for CI/CD and scripts
- **Real-time Streaming**: Monitor long-running Codex tasks with `codex:stream` for live progress
- **Thread Management**: Continue multi-turn conversations with `codex:threads` for persistent context
- **Command Shortcuts**: Define custom aliases for frequently used commands with `sx`
- **Multiple Scopes**: Support for user, project, local, and system-level configurations
- **Profile Switching**: Switch between different configuration profiles (Codex)
- **Dry Run Mode**: Preview changes before applying them
- **JSON Output**: Machine-readable output for scripting
- **Type Safe**: Built with TypeScript for reliability

## Installation

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Link globally (optional)
npm link
```

### Platform Requirements

**Windows Users:**
- PowerShell 7+ is required for shell shortcuts (`sx` command with shell type)
- Install from: https://github.com/PowerShell/PowerShell/releases

**All Platforms:**
- Node.js >= 20.19.0
- Git (for git-related commands)

## Usage

`xling` bundles a quick launcher, configuration helpers, and git productivity
commands. Detailed usage, flag tables, and examples live in
[`docs/README.md`](./docs/README.md) and the per-command Markdown files under
`docs/`. The summary below mirrors the docs so you can skim everything in one
place.

### Command Overview

- `x`: Launch Claude Code or Codex with resume flags, yolo toggle, and passthrough args.
- `codex:run`: Execute non-interactive Codex tasks programmatically (SDK-powered automation).
- `codex:stream`: Execute Codex tasks with real-time streaming output and progress monitoring.
- `codex:threads`: Manage Codex conversation threads (list/view/resume/delete) for multi-turn conversations.
- `sx`: Execute command shortcuts/aliases defined in xling config.
- `settings:list|get|set|switch|inspect`: Inspect, edit, and switch Claude, Codex, or Gemini configs across scopes.
- `git:prc|prr|prv`: Create, checkout, and view GitHub pull requests with automatic gh/git fallbacks.
- `git:wta|wtl|wtp|wtr|wts`: Manage git worktrees (add/list/prune/remove/switch) with guard rails and subshell support.

### Command Documentation (inline excerpt)

#### Launching AI tools

- [`x` – quick launcher](docs/x.md): fire up Claude Code or Codex with resume/yolo controls and passthrough args.
- [`codex:run` – SDK automation](docs/codex-sdk.md): execute non-interactive Codex tasks programmatically for CI/CD and scripts.
- [`codex:stream` – real-time streaming](docs/codex-sdk.md): execute Codex tasks with live progress monitoring and event streaming.
- [`codex:threads` – thread management](docs/codex-sdk.md): manage persistent conversation threads for multi-turn dialogues.
- [`sx` – shortcut execute](docs/sx.md): run predefined command shortcuts with optional passthrough args.

#### Settings management

- [`settings:list`](docs/settings.md#settingslist): summarize which config files exist per tool/scope (JSON or table view).
- [`settings:get`](docs/settings.md#settingsget): print the raw config (or a specific Claude variant) for auditing and backups.
- [`settings:set`](docs/settings.md#settingsset): open the target config in your editor of choice; handles variant creation.
- [`settings:switch`](docs/settings.md#settingsswitch): flip active profiles (Codex) or Claude variants with safety checks.
- [`settings:inspect`](docs/settings.md#settingsinspect): deep-dive into parsed settings with validation output.

#### Git worktree helpers

- [`git:wta` – add worktree](docs/git-wta.md): create detached or branch-bound worktrees with auto paths and guards.
- [`git:wtl` – list worktrees](docs/git-wtl.md): display human-readable worktree inventory (branch + path).
- [`git:wtp` – prune worktrees](docs/git-wtp.md): clean stale git metadata left behind after manual deletions.
- [`git:wtr` – remove worktree](docs/git-wtr.md): remove a worktree safely by branch, dir, or absolute path.
- [`git:wts` – switch to worktree](docs/git-wts.md): jump into an existing worktree or just print its path for scripting.

#### Pull request helpers

- [`git:prc` – create PR](docs/git-prc.md): wrap `gh pr create` with reviewers, labels, draft, and browser launch options.
- [`git:prr` – checkout PR](docs/git-prr.md): fetch/checkout PRs with a smart `gh`/git fallback and custom branch names.
- [`git:prv` – view PR](docs/git-prv.md): open a PR in your preferred browser directly from the terminal.


## Supported Tools

### Claude Code

- **Scopes**: user, project, local
- **Config Files**:
  - User: `~/.claude/settings.json`
  - Project: `.claude/settings.json`
  - Local: `.claude/settings.local.json`

### Codex

- **Scopes**: user
- **Config Files**:
  - User: `~/.codex/config.toml`
- **Features**: Profile switching

### Gemini CLI

- **Scopes**: user, project, system
- **Config Files**:
  - User: `~/.gemini/settings.json`
  - Project: `.gemini/settings.json`
  - System: Platform-dependent
