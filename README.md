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

## Usage

### Quick Start - The `x` Command

The fastest way to start your AI tools! Just type `xling x` to launch Claude Code with yolo mode.

**Claude Code is launched by default** - the ultimate convenience!

```bash
# Fastest way - Start Claude Code instantly
xling x

# Continue last conversation/session
xling x -c

# Resume from conversation/session list
xling x -r

# Pass arguments to Claude
xling x -- chat "Hello, how are you?"

# Start without yolo mode
xling x --no-yolo

# Start Codex instead
xling x --tool codex
# or use the short flag
xling x -t codex

# Continue last Codex session
xling x -t codex -c

# Start Codex in a specific directory
xling x -t codex -C /path/to/project
```

**Resume Options:**
- `-c` or `--continue`: Continue the last conversation/session
  - Claude Code: `claude -c`
  - Codex: `codex resume --last`
- `-r` or `--resume`: Show a list to choose from
  - Claude Code: `claude -r`
  - Codex: `codex resume`

**Yolo mode flags:**
- Claude Code: `--dangerously-skip-permissions`
- Codex: `--dangerously-bypass-approvals-and-sandbox`

### Git Workflow Commands

Manage PRs and worktrees with intelligent fallback strategies.

```bash
# Checkout PR (uses gh CLI if available, falls back to git)
xling git:prr 123

# Checkout PR to a specific branch
xling git:prr 456 --branch my-feature

# Force git fallback (skip gh CLI)
xling git:prr 789 --no-gh --remote upstream

# Create PR
xling git:prc

# Create PR with title and body
xling git:prc --title "Add feature X" --body "Implements feature X"

# Create PR and preview in browser
xling git:prc --web

# Create PR and preview in specific browser
xling git:prc --web --browser safari

# Create draft PR
xling git:prc --draft --title "WIP: Feature Y"

# Create PR with reviewers and labels
xling git:prc --reviewer user1 --reviewer user2 --label bug

# View PR in browser
xling git:prv 123

# View PR in specific browser
xling git:prv 456 --browser safari
xling git:prv 789 --browser firefox
xling git:prv 999 --browser arc

# List worktrees
xling git:wtl

# Add new worktree (defaults to main branch)
xling git:wta
xling git:wta -b feature/login
xling git:wta -b feature/login -p ../custom-path

# Switch to worktree (opens subshell)
xling git:wts                     # Switch to main
xling git:wts -b feature/login    # Switch to specific branch

# Print path only (useful for cd $(...))
cd $(xling git:wts --path-only -b feature/login)

# Remove worktree
xling git:wtr -b main                 # By branch name
xling git:wtr -b xling-feature        # By directory name
xling git:wtr -p ../repo-feature      # By path

# Prune stale worktrees
xling git:wtp
```

**PR Checkout Strategies:**
- **gh strategy**: Uses `gh pr checkout <id>` (preferred, requires GitHub CLI)
- **git fallback**: Uses `git fetch origin pull/<id>/head:<branch>` + `git switch <branch>`
- Automatic detection: gh CLI availability is checked automatically
- Manual override: Use `--no-gh` to force git strategy

**PR Creation Features:**
- Interactive mode: Run without flags for guided PR creation
- Direct mode: Specify title, body, and other options via flags
- Draft PRs: Use `--draft` flag for work-in-progress PRs
- Reviewers & Labels: Add multiple reviewers and labels
- Browser preview: Use `--web` to open PR in browser after creation
- Custom browser: Combine `--web --browser <name>` for specific browser

**Worktree Features:**
- **Focused commands**: Separate commands for each action (`wtl`, `wta`, `wts`, `wtr`, `wtp`)
- **Smart switching**: `wts` drops you into a subshell inside the worktree (use `--path-only` for scripts)
- **Auto-path generation**: Auto-generates path as `../repo-name-branch-name` when adding
- **Smart naming**: Branch names with `/` are converted to `-` (e.g., `feature/login` → `xling-feature-login`)
- **Intelligent matching**: Remove/switch by branch name, directory name, or full path
- **Default branch**: Defaults to `main` branch for `wta` and `wts`
- **Branch occupation check**: Prevents creating worktree for branch already in use

**Browser Support:**
- macOS: chrome, safari, firefox, arc, edge, dia
- Linux: chrome, firefox, edge, dia (via `google-chrome`, `firefox`, `microsoft-edge`, `dia`)
- Windows: chrome, firefox, arc, edge, dia
- Default: chrome
- Note: Safari only available on macOS; Arc has limited Linux support

### List Settings

```bash
# List all settings for Claude Code (user scope)
xling settings:list --tool claude --scope user

# List Codex settings in table format
xling settings:list --tool codex --table
```

> Claude-specific: `settings:list --tool claude` now enumerates every
> `settings*.json` file (for example `settings.hxi.json`) in the selected scope
> so you can quickly discover switchable variants.
>
> Codex-specific: `settings:list --tool codex` surfaces only the `model_providers`
> block from `~/.codex/config.toml`, helping you audit provider names, base URLs,
> and env key bindings at a glance.

`settings:list` prints a concise YAML-style summary by default. Add `--table` or `--json` for structured output. Other commands default to JSON and can switch to plain text with `--no-json`.

### Get Settings File

```bash
# Show Claude user settings (plain text default)
xling settings:get --tool claude --scope user

# Inspect a Claude variant (settings.hxi.json)
xling settings:get hxi --tool claude --scope user

# Show Codex config (plain text)
xling settings:get --tool codex
```

### Edit Settings (Claude)

```bash
# Create/edit settings.hxi.json in VS Code (default)
xling settings:set --tool claude --scope user --name hxi

# Open default settings in Cursor
xling settings:set --tool claude --scope project --name default --ide cursor --no-json
```

`settings:set` now focuses on whole-file editing: pass `--name` (defaults to `default`) to create or open `settings.<name>.json`, and use `--ide` to pick the editor command (defaults to VS Code's `code`).

> Note: Every `settings:*` command relies solely on flags such as `--tool`, `--scope`, and `--name`; key-level overrides like `developerShortcuts.runCommand` are no longer supported.

### Switch Profiles or Claude Variants

```bash
# Switch to a different profile
xling settings:switch oss --tool codex

# Activate settings.hxi.json for Claude user scope
xling settings:switch hxi --tool claude --scope user

# Apply without prompt (Claude)
xling settings:switch hxi --tool claude --scope user --force

# Force and keep a .bak backup
xling settings:switch hxi --tool claude --scope user --force --backup
```

Claude switches now show an interactive diff preview: the command prints a unified diff and then prompts for `overwrite / backup / cancel`. Use `--force` for non-interactive runs, optionally paired with `--backup` to keep a `.bak`. Codex continues to switch profiles immediately.

### Inspect Configuration

```bash
# View configuration file information
xling settings:inspect --tool claude --scope user
```

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

## Architecture

The project follows SOLID principles:

- **Single Responsibility**: Each adapter handles one tool
- **Open/Closed**: Easy to add new tools without modifying existing code
- **Liskov Substitution**: All adapters implement the same interface
- **Interface Segregation**: Clean, focused interfaces
- **Dependency Inversion**: Commands depend on abstractions, not implementations

### Directory Structure

```
xling/
|- bin/                     # CLI entry point (compiled)
|  |- run.js
|- src/
|  |- commands/             # oclif commands
|  |  |- git/               # Git workflow commands
|  |  |- settings/          # Settings management commands
|  |  |- x/                 # Quick launcher
|  |- domain/               # Types and interfaces
|  |- services/             # Business logic
|  |  |- git/               # Git services (pr, worktree, view)
|  |  |- settings/
|  |     |- adapters/       # Tool adapters
|  |     |- fsStore.ts      # File system operations
|  |     |- dispatcher.ts
|  |- utils/                # Utilities
|- test/                    # Tests and fixtures
```

## Development

```bash
# Install dependencies
bun install

# Build (using tsdown)
bun run build

# Watch mode (tsdown --watch)
bun run dev

# Code quality
bun run lint           # Lint with oxlint
bun run lint:fix       # Auto-fix lint issues
bun run format         # Format with oxfmt
bun run format:check   # Check formatting
bun run typecheck      # Type check with tsc

# Run tests
bun test
bun test:watch
bun test:coverage
```

### Toolchain

**Build System**

This project uses [tsdown](https://tsdown.vercel.app/) for fast TypeScript compilation and bundling:

- **Fast builds**: Powered by rolldown (Rust-based bundler)
- **ESM output**: Generates `.js` files for modern Node.js
- **Type definitions**: Automatically generates `.d.ts` files
- **Source maps**: Includes source maps for debugging
- **Tree shaking**: Optimized bundle size

**Code Quality**

- **Linting**: [oxlint](https://oxc.rs/) - Rust-based linter, 50-100x faster than ESLint
- **Formatting**: [oxfmt](https://oxc.rs/) - Fast formatter compatible with Prettier config
- **Type Checking**: TypeScript compiler for strict type safety

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Apache-2.0

## Author

Kingsword <kingsword09@gmail.com>
