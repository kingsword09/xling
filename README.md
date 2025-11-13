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

## Usage

`xling` bundles a quick launcher, configuration helpers, and git productivity
commands. Detailed usage, flag tables, and examples live in
[`docs/README.md`](./docs/README.md) and the per-command Markdown files under
`docs/`. The summary below mirrors the docs so you can skim everything in one
place.

### Command Overview

- `x`: Launch Claude Code or Codex with resume flags, yolo toggle, and passthrough args.
- `sx`: Execute command shortcuts/aliases defined in xling config.
- `settings:list|get|set|switch|inspect`: Inspect, edit, and switch Claude, Codex, or Gemini configs across scopes.
- `git:prc|prr|prv`: Create, checkout, and view GitHub pull requests with automatic gh/git fallbacks.
- `git:wta|wtl|wtp|wtr|wts`: Manage git worktrees (add/list/prune/remove/switch) with guard rails and subshell support.

### Command Documentation (inline excerpt)

#### Launching AI tools

- [`x` – quick launcher](docs/x.md): fire up Claude Code or Codex with resume/yolo controls and passthrough args.
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
