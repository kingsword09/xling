# Xling Prompt Command (`xling p`)

## Overview

The `xling p` command provides a prompt interaction experience similar to `claude -p`, with support for multi-provider configuration, intelligent model routing, and automatic fallback retry.

## Features

- **Multi-Provider Support**: Configure multiple API providers (OpenAI, Azure, custom, etc.)
- **Intelligent Routing**: Automatically select providers that support the requested model
- **Automatic Fallback**: Automatically switch to backup providers on failure
- **Priority Control**: Control provider selection order via the priority field
- **Secure Configuration**: Config file automatically set to 600 permissions to protect API keys

## Configuration

### Configuration File Location

`~/.claude/xling.json` (same directory as Claude Code configuration)

### Configuration Structure

```json
{
  "providers": [
    {
      "name": "openai-primary",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-proj-xxx",
      "models": ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
      "priority": 1,
      "timeout": 60000
    },
    {
      "name": "openai-backup",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-proj-yyy",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "priority": 2
    },
    {
      "name": "custom-provider",
      "baseUrl": "https://custom-ai.example.com/v1",
      "apiKey": "custom-key",
      "models": ["llama-3-70b", "mixtral-8x7b"],
      "priority": 10,
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  ],
  "defaultModel": "gpt-4",
  "retryPolicy": {
    "maxRetries": 2,
    "backoffMs": 1000
  }
}
```

### Configuration Fields

#### Provider Configuration

- `name`: Provider name (unique identifier)
- `baseUrl`: API base URL
- `apiKey`: API key
- `models`: List of models supported by this provider
- `priority`: Priority (lower number = higher priority, defaults to lowest)
- `timeout`: Request timeout in milliseconds (optional)
- `headers`: Custom request headers (optional)

#### Global Configuration

- `defaultModel`: Default model to use (optional)
- `retryPolicy`: Retry policy
  - `maxRetries`: Maximum number of retries
  - `backoffMs`: Backoff delay in milliseconds (exponential growth)

## Usage

### Basic Usage

```bash
# Simple prompt
xling p "Explain quantum computing"

# Specify model
xling p --model gpt-4-turbo "Write a poem about AI"

# Use system prompt
xling p --system "You are a helpful coding assistant" "How to use async/await?"
```

### Read from Files

```bash
# Read file as context
xling p -f README.md "Summarize this document"

# Read multiple files
xling p -f src/main.ts -f src/utils.ts "Review this code"
```

### Read from stdin

```bash
# Git diff review
git diff | xling p --stdin "Review this diff and suggest improvements"

# Code review
cat myfile.py | xling p --stdin "Find potential bugs in this code"
```

### Output Format

```bash
# JSON output
xling p --json "What is 2+2?"

# Disable streaming output
xling p --no-stream "Generate a long story"
```

### Advanced Options

```bash
# Temperature control
xling p --temperature 0.7 "Creative writing task"

# Maximum tokens
xling p --max-tokens 500 "Brief summary please"

# Combined usage
xling p \
  --model gpt-4 \
  --system "You are a code reviewer" \
  --temperature 0.3 \
  -f src/app.ts \
  "Review this code for security issues"
```

## How It Works

### Intelligent Routing

1. User specifies a model (or uses defaultModel)
2. System finds all providers that support the model
3. Providers are sorted by priority
4. Request is sent using the first provider

### Automatic Fallback

If a request fails:

1. Check if the error is retryable:
   - ✅ Network errors (ECONNREFUSED, ETIMEDOUT)
   - ✅ 5xx server errors
   - ✅ 429 rate limit
   - ❌ 4xx client errors (not retryable)

2. If retryable and other providers are available:
   - Apply exponential backoff delay
   - Switch to the next provider
   - Retry the request

3. If all providers fail:
   - Throw `AllProvidersFailedError`
   - Display all error details

### Example Scenario

Assuming 3 providers are configured to support `gpt-4`:

```
openai-primary (priority: 1)
openai-backup (priority: 2)
azure-openai (priority: 3)
```

Executing `xling p --model gpt-4 "Hello"`:

1. Try `openai-primary`
2. If it fails (network error), wait 1 second
3. Try `openai-backup`
4. If it fails, wait 2 seconds
5. Try `azure-openai`
6. If all fail, report all errors

## Managing Configuration

### Via settings Command

```bash
# View configuration
xling settings:list --tool xling --scope user

# Check configuration details
xling settings:inspect --tool xling --scope user
```

### Manual Editing

```bash
# Open in editor
vim ~/.claude/xling.json

# Or use your preferred editor
code ~/.claude/xling.json
```

## FAQ

### Q: How do I add a new provider?

Edit `~/.claude/xling.json` and add to the `providers` array:

```json
{
  "name": "my-provider",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "your-key",
  "models": ["model-name"],
  "priority": 5
}
```

### Q: How do I set a default model?

Add at the top level of the config file:

```json
{
  "defaultModel": "gpt-4",
  "providers": [...]
}
```

### Q: Why am I getting "Model not supported"?

Check:
1. Model name is spelled correctly
2. At least one provider's `models` list includes the model
3. Run `xling settings:list --tool xling` to see available models

### Q: How do I debug request failures?

Check the log output, which includes:
- Providers attempted
- Failure reasons
- Whether retries were performed

### Q: Are API keys secure?

The config file is automatically set to 600 permissions (owner read/write only). However, it's still recommended to:
- Not commit the config file to version control
- Rotate API keys regularly
- Use dedicated keys rather than main account keys

## Technical Details

### Technology Stack

- **AI SDK**: `@ai-sdk/openai-compatible` + `ai`
- **Configuration Management**: Extends existing settings system
- **CLI Framework**: Oclif

### Architecture

```
xling p command
    ↓
ModelRouter (routing + retry)
    ↓
ProviderRegistry (model index)
    ↓
PromptClient (AI SDK wrapper)
    ↓
OpenAI Compatible API
```

## Contributing

Contributions are welcome! If you find issues or have suggestions for improvements, please submit an Issue or Pull Request.
