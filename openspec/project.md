# Project Context

## Purpose
Unified CLI for launching AI coding tools (Claude Code, Codex, Gemini CLI), routing prompts across providers, and managing cross-tool settings. Combines quick launcher (`x`), prompt router (`p`), multi-model council/discussion (`council`, `discuss`), OpenAI-compatible proxy (`proxy`), and git productivity helpers under one tool.

## Tech Stack
- **Runtime**: Bun >= 1.3.2
- **Language**: TypeScript (strict mode)
- **Build**: tsdown (rolldown-powered bundler)
- **CLI Framework**: oclif (subcommands, flags, auto-generated help)
- **Frontend**: React 19 + React DOM 19, Vite 7, Tailwind CSS 4
- **Testing**: Vitest
- **Linting**: oxlint (Rust-based)
- **Formatting**: oxfmt (Prettier-compatible)
- **Validation**: Zod
- **Config Parsing**: smol-toml (TOML), native JSON

## Project Conventions

### Code Style
- **Formatting**: oxfmt enforces double quotes, explicit semicolons; ignores `dist/` and `node_modules/`
- **Linting**: oxlint with type-aware checks (`bun lint --type-aware`)
- **Naming**: kebab-case for files/directories, PascalCase for classes/types, camelCase for functions/variables
- **Exports**: Prefer named exports; expose types for every public API
- **Comments**: Only where logic isn't self-evident; avoid redundant docstrings

### Architecture Patterns
- **Adapter Pattern**: Isolates external tools; `BaseAdapter` provides shared logic, tool-specific adapters (Claude, Codex, Gemini) implement interfaces
- **Dispatcher Pattern**: `SettingsDispatcher` and `LaunchDispatcher` depend on adapter interfaces (DIP), register adapters dynamically (OCP)
- **Command Layer**: oclif filesystem routing (`src/commands/<group>/<cmd>.ts` → `xling <group>:<cmd>`)
- **Layered Structure**: commands → dispatchers → adapters → domain types
- **Error Hierarchy**: All errors extend `XlingError` base class with specific subclasses
- **SOLID Principles**: SRP (one purpose per adapter/command), OCP (new tools via registration), LSP (interchangeable adapters), ISP (separate Settings/Launch interfaces), DIP (depend on abstractions)

### Testing Strategy
- **Framework**: Vitest via `bun test`
- **Coverage**: `bun test:coverage`; ship coverage with each new feature
- **Test Location**: `test/` directory mirrors `src/` structure
- **Scope**: Unit tests for adapters, validators, utilities; integration tests for command flows
- **Requirement**: Document temporary coverage gaps in PRs if necessary

### Git Workflow
- **Main Branch**: `main` (protected)
- **Feature Branches**: Create from `main`, merge via PR
- **Commit Style**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **PR Workflow**: Use `xling git:prc` to create PRs; `xling git:prr` to checkout
- **Worktrees**: Use `xling git:wta/wtl/wtr/wts` for parallel development
- **Pre-commit**: Run `bun lint` and `bun format:check` before committing

## Domain Context
For additional context on AI tools, APIs, or domain-specific knowledge, refer to:
- https://context7.com/
- https://codewiki.google/
- Google Search

## Important Constraints
- **Node.js**: >= 20.19.0 required
- **Bun**: >= 1.3.2 required as runtime and package manager
- **Windows**: PowerShell 7+ required for shell shortcuts (`sx` command)
- **Atomic Writes**: Config writes use temp file + rename to prevent corruption
- **Backup**: Settings files are backed up with `.bak` suffix before modification
- **No Key-Level Overrides**: Settings commands operate on full config; key-level overrides (e.g., `developerShortcuts`) are intentionally unsupported

## External Dependencies
- **Claude Code CLI**: Anthropic's AI coding assistant (`claude` command)
- **Codex CLI**: OpenAI's coding assistant (`codex` command)
- **Gemini CLI**: Google's AI assistant (`gemini` command)
- **GitHub CLI**: `gh` for PR operations (fallback to git if unavailable)
- **Git**: Required for worktree and version control commands
- **OpenAI-Compatible APIs**: Proxy routes to any OpenAI-compatible endpoint via `@ai-sdk/openai-compatible`
