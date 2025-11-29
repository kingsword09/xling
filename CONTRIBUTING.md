# Contributing to xling

Thank you for your interest in contributing to xling!

## Development Setup

### Prerequisites

- Bun >= 1.3.2
- Node.js >= 20.19.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/anthropics/xling.git
cd xling

# Install dependencies
bun install

# Build
bun run build

# Verify installation
./bin/run.js --help
```

## Development Workflow

### Code Style

We use oxlint and oxfmt for code quality:

```bash
bun run lint          # Run linter
bun run lint:fix      # Auto-fix lint issues
bun run format        # Format code
bun run format:check  # Check formatting
bun run typecheck     # Type checking
```

### Testing

```bash
bun test              # Run all tests
bun test:watch        # Watch mode
bun test:coverage     # With coverage report
```

### Building

```bash
bun run build         # Full build (CLI + UI)
bun run dev           # Watch mode for CLI
bun run build:ui      # UI only
```

## Architecture Principles

We follow these core principles:

### KISS (Keep It Simple, Stupid)

- Prefer simple, readable solutions over clever ones
- Avoid premature optimization
- Use straightforward control flow

### YAGNI (You Aren't Gonna Need It)

- Only implement features that are currently needed
- Avoid speculative generality
- Don't add configuration options "just in case"

### DRY (Don't Repeat Yourself)

- Extract common patterns into shared utilities (`src/utils/`)
- Use the adapter pattern for tool-specific logic
- Centralize validation in `src/domain/validators.ts`

### SOLID

- **S**ingle Responsibility: One class/function, one purpose
- **O**pen/Closed: Extend via adapters, not modification
- **L**iskov Substitution: Adapters are interchangeable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions (adapters)

## Project Structure

```
src/
├── commands/       # CLI commands (oclif)
├── services/       # Business logic
│   ├── settings/   # Settings management
│   │   └── adapters/  # Tool-specific adapters
│   ├── launch/     # Tool launching
│   ├── proxy/      # API gateway
│   └── ...
├── domain/         # Types, interfaces, validators
├── utils/          # Shared utilities
└── ui/             # React Web UI
```

## Adding a New Command

1. Create file under `src/commands/<group>/`
2. Extend `Command` from `@oclif/core`
3. Define `static flags` and `static args`
4. Implement `run()` method
5. Add documentation in `docs/`

Example:

```typescript
import { Command, Flags } from "@oclif/core";

export default class MyCommand extends Command {
  static summary = "Short description";
  static description = "Detailed description";

  static flags = {
    name: Flags.string({ char: "n", description: "Name" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MyCommand);
    this.log(`Hello, ${flags.name}!`);
  }
}
```

## Adding a New AI Tool Adapter

1. Create adapter in `src/services/settings/adapters/`
2. Extend `BaseAdapter`
3. Implement required methods
4. Register in `SettingsDispatcher`
5. Update `ToolId` type in `src/domain/types.ts`

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Follow commit message conventions (see below)
3. Ensure all tests pass: `bun test`
4. Ensure linting passes: `bun run lint`
5. Update documentation if needed
6. Request review

## Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(proxy): add load balancing support
fix(settings): handle missing config file gracefully
docs: update README with new commands
refactor(adapters): extract common validation logic
```

## Questions?

Feel free to open an issue for questions or discussions.
