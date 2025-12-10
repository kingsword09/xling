## Project Conventions

- **Runtime**: Bun (>= 1.3.2). Run every development, build, and test script via `bun`.
- **Language**: Business logic lives in TypeScript. If a JavaScript helper is required, document the rationale.
- **Build System**: tsdown (powered by rolldown) compiles and bundles the CLI.
- **Linting**: oxlint provides fast, Rust-based lint and type checks (`--type-aware --type-check` enables full TypeScript type checking, replacing `tsc --noEmit`).
- **Formatting**: oxfmt enforces the shared Prettier-compatible style.
- **Testing**: Vitest (invoked through `bun test`) covers unit and integration flows.
- **CLI Framework**: oclif powers subcommands, flag validation, and auto-generated help.

## UI Stack

- **Frontend**: React 19 + React DOM 19; avoid legacy class components and keep hooks idiomatic to the current major.
- **Build**: Vite 7 with Tailwind CSS 4 builds `src/ui` into `dist/ui`; `bun run build` already triggers `bun run build:ui`, or run `bun run build:ui` directly when iterating on the frontend.
- **Dev Server**: `bunx vite dev --config vite.config.ts --host --port 3000` serves the React UI; keep the port in sync with `discuss --ui` (defaults to 3000).
- **Static Assets**: The discuss server serves files from `dist/ui`; rebuild after UI changes so the CLI can load the latest bundle.

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
|  |- ui/                    # React 19 Web UI (Vite root, Tailwind 4)
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

# Proxy server (OpenAI-compatible API gateway)
./dist/run.js proxy                           # Start on default port 4320
./dist/run.js proxy --port 8080               # Custom port
./dist/run.js proxy --access-key my-key       # With access protection
./dist/run.js proxy --host 0.0.0.0            # Bind to all interfaces

# Quality
bun run lint              # oxlint (includes type checking via --type-aware --type-check)
bun run lint:fix          # oxlint auto-fix
bun run format            # oxfmt
bun run format:check      # verify formatting

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

## Error Handling

All errors extend the shared `XlingError` base class in `src/utils/errors.ts`:

| Error Class | Usage |
|-------------|-------|
| `InvalidScopeError` | Invalid scope parameter |
| `InvalidPayloadError` | Missing or invalid payload fields |
| `UnsupportedActionError` | Action not supported by tool |
| `UnsupportedToolError` | Tool not registered |
| `ConfigFileNotFoundError` | Config file missing |
| `ConfigParseError` | Config file parse failure |
| `ValidationError` | General validation failure |
| `PROperationError` | PR operation failure |
| `WorktreeError` | Worktree operation failure |
| `CouncilError` | Council/discussion operation failure |

**Best Practice**: Always use custom error classes instead of generic `Error` for better error handling and debugging.

## Code Quality Principles

This codebase follows KISS, YAGNI, DRY, and SOLID principles. Here are concrete examples:

### DRY (Don't Repeat Yourself)

1. **Shared CLI Utilities** (`src/utils/cli.ts`)
   - `extractPassthroughArgs()`: Reused across x, sx commands
   - `promptUser()`: Reused across discuss, council commands
   - `createReadlineInterface()`: Centralized readline creation

2. **Adapter Pattern** (`src/services/*/adapters/`)
   - Common interface with tool-specific implementations
   - `BaseAdapter` provides shared logic (validation, path resolution)
   - New tools added without modifying existing code

3. **Centralized Validation** (`src/domain/validators.ts`)
   - Zod schemas for all input validation
   - Reusable validators: `validatePort()`, `validateHost()`, `validatePrId()`

### KISS (Keep It Simple, Stupid)

1. **Declarative Validation**
   - Use Zod schemas instead of manual validation logic
   - Simple regex patterns for format validation

2. **Flat Command Structure**
   - One file per command under `src/commands/`
   - Clear separation: commands → dispatchers → adapters

3. **Straightforward Error Handling**
   - Custom error classes with descriptive messages
   - No complex error recovery chains

### YAGNI (You Aren't Gonna Need It)

1. **No Unused Abstractions**
   - Adapters only for tools that exist (Claude, Codex, Gemini)
   - No "future-proofing" interfaces

2. **Minimal Configuration**
   - Only essential options exposed as flags
   - Sensible defaults everywhere (e.g., yolo=true, port=4320)

3. **No Speculative Features**
   - Features implemented when needed, not "just in case"

### SOLID in Practice

- **SRP**: Each adapter handles one tool; each command has one purpose
- **OCP**: Add new tools via adapter registration, not code modification
- **LSP**: All adapters implement `SettingsAdapter` interface interchangeably
- **ISP**: Separate `SettingsAdapter` and `LaunchAdapter` interfaces
- **DIP**: Dispatchers depend on adapter interfaces, not concrete classes

## Additional Notes

- Configuration writes are atomic (temp file + rename).
- Settings commands rely on flags such as `--tool`, `--scope`, and `--name`; key-level overrides like `developerShortcuts` are intentionally unsupported.
- Files are backed up automatically with a `.bak` suffix.
- All errors extend the shared `XlingError` base class.
- Runtime validation is powered by Zod.
- Use `validateAndResolvePath()` in adapters to combine scope validation and path resolution.
