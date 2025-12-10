# xling

Unified CLI for launching AI tooling, routing prompts, and managing settings across Claude Code, Codex, and Gemini CLI.

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

- **Unified Interface**: Launch AI CLIs, route prompts, and manage settings with one tool
- **Prompt Router**: `xling p` fan-outs requests across providers with fallback and streaming support
- **Model Council**: `xling council` cross-judges answers across models and synthesizes a winner
- **Multi-Model Roundtable**: `xling discuss` runs multi-agent debates via CLI or Web UI
- **OpenAI-Compatible Proxy**: `xling proxy` exposes a load-balanced, key-rotated API gateway
- **React 19 Web UI**: `discuss --ui` / `council --ui` serve a Vite-built React 19 + Tailwind 4 interface on port 3000
- **Quick Launcher**: Just type `xling x` to start Claude Code instantly with yolo mode
- **Command Shortcuts**: Define custom aliases for frequently used commands with `sx`
- **Multiple Scopes**: Support for user, project, local, and system-level configurations
- **Profile/Variant Switching**: Swap Codex profiles or Claude settings variants safely
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

- `x`: Launch Claude Code, Codex, or Gemini CLI with resume flags, yolo toggle, and passthrough args.
- `p`: Route prompts across configured providers or delegate to codex/claude/gemini CLIs with yolo defaults.
- `discuss`: Run a multi-model roundtable via CLI or Web UI with topic, model, and strategy controls.
- `council`: Ask multiple models the same question, have them cross-judge, and return the winning or synthesized answer.
- `proxy`: Start an OpenAI-compatible proxy with load balancing, API key rotation, and optional access key protection.
- `sx`: Execute command shortcuts/aliases defined in xling config.
- `settings:list|get|set|switch|inspect|sync|auth`: Inspect, edit, switch, sync, and manage Codex auth profiles across scopes.
- `git:prc|prr|prv`: Create, checkout, and view GitHub pull requests with automatic gh/git fallbacks.
- `git:wta|wtl|wtp|wtr|wts`: Manage git worktrees (add/list/prune/remove/switch) with guard rails and subshell support.
- `version`: Print the installed xling version.

### Web UI (React 19)

- `discuss --ui` and `council --ui` serve a React 19 + React DOM 19 interface built with Vite 7 and Tailwind CSS 4 from `dist/ui` (port 3000 by default).
- Build the bundle with `bun run build` (runs `build:ui`) or `bun run build:ui` after frontend changes so the CLI can find `dist/ui`.
- For live UI development, run `bunx vite dev --config vite.config.ts --host --port 3000` from the repo root; keep the port aligned with the discuss server default.

### Command Documentation (inline excerpt)

#### Launching AI tools

- [`x` – quick launcher](docs/x.md): fire up Claude Code, Codex, or Gemini with resume/yolo controls and passthrough args.
- [`sx` – shortcut execute](docs/sx.md): run predefined command shortcuts with optional passthrough args.

#### Prompting & discussion

- [`p` – prompt router](docs/p.md): send prompts through configured providers with streaming, stdin/file input, or direct CLI delegation.
- [`discuss` – multi-model roundtable](docs/discuss.md): spin up a CLI or Web UI debate across multiple models with turn-taking strategies.
- [`council` – model jury](docs/council.md): collect answers, cross-judge anonymously, and synthesize the best response.

#### Proxy gateway

- [`proxy` – OpenAI-compatible gateway](docs/proxy.md): run a local API with load balancing, API key rotation, optional access key, and a DevTools-style UI via `--ui`.

#### Settings management

- [`settings:list`](docs/settings.md#settingslist): summarize which config files exist per tool/scope (JSON or table view).
- [`settings:get`](docs/settings.md#settingsget): print the raw config (or a specific Claude variant) for auditing and backups.
- [`settings:set`](docs/settings.md#settingsset): open the target config in your editor of choice; handles variant creation.
- [`settings:switch`](docs/settings.md#settingsswitch): flip active profiles (Codex) or Claude variants with safety checks.
- [`settings:inspect`](docs/settings.md#settingsinspect): deep-dive into parsed settings with validation output.
- [`settings:sync`](docs/settings.md#settingssync): sync Codex and Claude `config.toml` files with diff/backup support.
- [`settings:auth`](docs/settings.md#settingsauth): save, delete, restore, or list Codex auth profiles.

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

#### Utilities

- `version`: print the installed xling version (also available via `xling --version`).


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

### Xling Prompt Router

- **Scopes**: user
- **Config Files**:
  - User: `~/.claude/xling.json`
- **Features**: Provider registry and defaults for `xling p` and `xling discuss`
