## Project Conventions

- **Runtime**: Bun (>= 1.3.2). Run every development, build, and test script via `bun`.
- **Language**: Business logic lives in TypeScript. If a JavaScript helper is required, document the rationale.
- **Build System**: tsdown (powered by rolldown) compiles and bundles the CLI.
- **Linting**: oxlint provides fast, Rust-based lint checks.
- **Formatting**: oxfmt enforces the shared Prettier-compatible style.
- **Testing**: Vitest (invoked through `bun test`) covers unit and integration flows.
- **CLI Framework**: oclif powers subcommands, flag validation, and auto-generated help.

## Environment Setup

1. Install Bun (recommended: `curl -fsSL https://bun.sh/install | bash`).
2. Run `bun install` at the repo root.
3. Compile the project with `bun run build`.
4. Verify the CLI by running `./bin/run.js --help`.
5. Run `bun lint` and `bun fmt` to ensure lint/format success.
6. Run `bun test` or `bun test --watch` to confirm the test suite.

## Development Rules

- Declare new npm scripts inside `package.json` and execute them with `bun run <script>`.
- Keep TypeScript in strict mode and expose types for every public API.
- Ship Vitest coverage with each new feature (call out temporary gaps in the PR if needed).
- Follow SOLID: single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion.

## Project Layout

```
xling/
|- src/
|  |- run.ts                 # Bundled into dist/run.js
|  |- commands/              # oclif command files
|  |  |- x/index.ts          # Quick launcher
|  |  |- settings/{list,get,set,switch,inspect}.ts
|  |- domain/                # Types, interfaces, validators
|  |- services/
|  |  |- launch/             # Launch adapters + dispatcher
|  |  |- settings/           # Settings adapters, fsStore, dispatcher
|  |- utils/                 # errors, logger, format, runner
|- test/                     # Tests and fixtures
|- dist/                     # tsdown output (commands, services, run.js)
```

## Architecture Overview

### Adapter Pattern

Adapters isolate every external tool:

- **Settings adapters**: `BaseAdapter`, `ClaudeAdapter` (JSON), `CodexAdapter` (TOML with profiles), `GeminiAdapter` (JSON).
- **Launch adapters**: `BaseLaunchAdapter`, plus Claude (`--dangerously-skip-permissions`) and Codex (`--dangerously-bypass-approvals-and-sandbox`) implementations.

### Dispatchers

- **SettingsDispatcher** depends only on the `SettingsAdapter` interface (DIP) and registers adapters so new tools can be added without touching the command layer (OCP).
- **LaunchDispatcher** depends on `LaunchAdapter`, validates availability, toggles yolo mode, and forwards passthrough arguments.

### Command Layer

Filesystem routing maps files such as `src/commands/settings/list.ts` to `xling settings:list`. Commands share flag validation, help-generation, JSON output, and centralized error handling.

## Supported Tools

### Claude Code

- **Scopes**: user, project, local
- **Config files**: `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`

### Codex

- **Scope**: user
- **Config file**: `~/.codex/config.toml`
- **Special feature**: profile switching

### Gemini CLI

- **Scopes**: user, project, system
- **Config files**: `~/.gemini/settings.json`, `.gemini/settings.json`, plus platform-specific system paths

## Common Commands

```bash
# Build & dev
bun run build             # Compile via tsdown
bun run dev               # tsdown --watch

# Quality
bun run lint              # oxlint
bun run lint:fix          # oxlint auto-fix
bun run format            # oxfmt
bun run format:check      # verify formatting
bun run typecheck         # tsc --noEmit

# Tests
bun test
bun test:watch
bun test:coverage

# x command (fast launcher, default tool = Claude Code, yolo on)
./dist/run.js x
./dist/run.js x -c                      # Continue last Claude conversation
./dist/run.js x -r                      # Pick a conversation
./dist/run.js x --tool codex
./dist/run.js x -t codex -c             # Codex resume --last
./dist/run.js x -t codex -r             # Codex resume picker
./dist/run.js x --no-yolo               # Launch Claude without yolo
./dist/run.js x -- chat \"Hello\"         # Pass additional args
./dist/run.js x -t codex -C /path        # Launch Codex in a specific directory

# Settings commands
./dist/run.js settings:list --tool claude --scope user
./dist/run.js settings:list --tool codex --table
./dist/run.js settings:get --tool claude --scope user
./dist/run.js settings:get hxi --tool claude --scope user
./dist/run.js settings:get --tool codex
./dist/run.js settings:set --tool claude --scope user --name hxi
./dist/run.js settings:set --tool claude --scope project --name default --ide cursor --no-json
./dist/run.js settings:switch oss --tool codex
./dist/run.js settings:switch hxi --tool claude --scope user
./dist/run.js settings:inspect --tool claude --scope user
./dist/run.js settings:inspect --tool codex --no-json
```

> Lint and format configuration lives in `.oxlintrc.json` and `.oxfmtrc.json`. The enforced style uses double quotes, explicit semicolons, and ignores generated folders such as `dist/` and `node_modules/`.

## Extension Guide

### Add a New AI CLI Tool

1. Create an adapter under `src/services/settings/adapters/`.
2. Extend `BaseAdapter` and implement the required methods.
3. Register the adapter inside `SettingsDispatcher`.
4. Update the `ToolId` union to include the new identifier.

```ts
// src/services/settings/adapters/newtool.ts
export class NewToolAdapter extends BaseAdapter {
  readonly toolId = \"newtool\" as const;

  resolvePath(scope: Scope): string {
    // Resolve the config path for each scope
  }

  validateScope(scope: Scope): boolean {
    // Return true for supported scopes
  }
}

// src/services/settings/dispatcher.ts
constructor() {
  this.adapters = new Map<ToolId, SettingsAdapter>();
  // ...register other adapters
  this.adapters.set(\"newtool\", new NewToolAdapter());
}
```

### Add a New Command

1. Create a file under `src/commands/<group>/`.
2. Extend `Command`, implement `run`, and define `args`/`flags`.
3. oclif automatically registers the command based on its path.

## Additional Notes

- Configuration writes are atomic (temp file + rename).
- Settings commands rely on flags such as `--tool`, `--scope`, and `--name`; key-level overrides like `developerShortcuts` are intentionally unsupported.
- Files are backed up automatically with a `.bak` suffix.
- All errors extend the shared `XlingError` base class.
- Runtime validation is powered by Zod.
