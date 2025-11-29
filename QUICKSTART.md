# xling Quick Start Guide

Get up and running with xling in 5 minutes.

## Installation

```bash
# Clone the repository
git clone https://github.com/anthropics/xling.git
cd xling

# Install dependencies
bun install

# Build
bun run build

# Verify installation
./dist/run.js --version
```

## Your First Commands

### 1. Launch Claude Code (fastest way)

```bash
./dist/run.js x
```

This starts Claude Code with yolo mode enabled (skips permission prompts).

### 2. Continue a conversation

```bash
./dist/run.js x -c          # Continue last conversation
./dist/run.js x -r          # Pick from conversation list
```

### 3. Send a quick prompt

```bash
./dist/run.js p "Explain async/await in JavaScript"
```

### 4. Use different AI tools

```bash
./dist/run.js x -t codex    # Launch Codex
./dist/run.js x -t gemini   # Launch Gemini CLI
```

### 5. Manage settings

```bash
./dist/run.js settings:list --tool claude
./dist/run.js settings:get --tool codex
```

## Configuration

xling reads configuration from `~/.claude/xling.json`. Create this file to configure providers for the prompt router:

```json
{
  "prompt": {
    "providers": [
      {
        "name": "openai",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-...",
        "models": ["gpt-4", "gpt-4-turbo"]
      }
    ],
    "defaultModel": "gpt-4"
  }
}
```

## Next Steps

- Read the [full documentation](./docs/README.md)
- Configure [providers](./docs/p.md) for the prompt router
- Set up [shortcuts](./docs/sx.md) for frequent commands
- Start the [proxy server](./docs/proxy.md) for API gateway features
