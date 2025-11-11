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

`settings:list` 默认输出 YAML 风格的简洁概览；如需表格/JSON，请加 `--table` 或
`--json`。其余命令仍以 JSON 为默认输出，可通过 `--no-json` 获取文本格式。

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

`settings:set` 现专注于整文件编辑：传 `--name`（默认 `default`）即可创建/打开
`settings.<name>.json`，并使用 `--ide` 指定编辑器（默认 VS Code 的 `code`）。

> Note: 所有 `settings:*` 命令仅依赖 `--tool`、`--scope`、`--name` 等 flag；不再提供
> `developerShortcuts.runCommand` 这类键级参数。

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

Claude switches现在默认进行交互式 diff 预览：命令会先打印彩色统一 diff，
然后提示 `overwrite / backup / cancel`。若要非交互执行，使用 `--force`，并可
通过 `--backup` 强制保留 `.bak`。Codex 保持原行为，直接切换 profile。

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
├── bin/
│   └── run.js              # CLI entry point
├── src/
│   ├── commands/           # oclif commands
│   │   └── settings/
│   ├── domain/             # Types and interfaces
│   ├── services/           # Business logic
│   │   └── settings/
│   │       ├── adapters/   # Tool adapters
│   │       ├── fsStore.ts  # File system operations
│   │       └── dispatcher.ts
│   └── utils/              # Utilities
└── test/                   # Tests and fixtures
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
