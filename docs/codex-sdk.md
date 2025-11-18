# Codex SDK Integration

The xling Codex SDK integration enables **programmatic AI automation** using the OpenAI Codex TypeScript SDK, complementing the existing interactive CLI launcher.

## Overview

The Codex SDK commands provide:
- ✅ **`codex:run`** - Execute non-interactive tasks for scripts and CI/CD
- ✅ **`codex:stream`** - Real-time progress monitoring for long-running tasks
- ✅ **`codex:threads`** - Multi-turn conversations with persistent context
- ✅ **Programmatic control** - JSON output, structured data, automation
- ✅ **Live monitoring** - Watch AI reasoning and progress in real-time

## Installation

The Codex SDK is already included with xling. You just need:

1. **Codex CLI installed and logged in**: The SDK automatically uses your Codex CLI authentication
   ```bash
   # Check if installed
   which codex
   codex --version

   # Login if not already authenticated
   codex login
   ```

   **Note**: xling automatically reads your authentication from `~/.codex/auth.json`. No need to set environment variables!

## Quick Start

### Simple Code Review

```bash
xling codex:run "Review the current git diff for security issues"
```

### JSON Output (for scripts)

```bash
xling codex:run "Analyze code complexity" --format json > report.json
```

### From Stdin

```bash
echo "Add type definitions to user.js" | xling codex:run
```

### With Custom Model

```bash
xling codex:run "Optimize performance" --model gpt-5.1-codex
```

### Real-time Streaming

```bash
xling codex:stream "Refactor the authentication module" --verbose
```

### Thread Management

```bash
# List all conversations
xling codex:threads --list

# Resume a previous conversation
xling codex:threads --resume thread_abc123 -p "Continue with error handling"
```

## Command Reference

### `codex:run [PROMPT]` - Non-interactive Tasks

Execute a non-interactive Codex task for scripts and automation.

**Arguments:**
- `PROMPT` - The instruction to send to Codex (optional if using flags/stdin)

**Flags:**
- `-p, --prompt <value>` - Prompt to send to Codex
- `-f, --file <path>` - Read prompt from file
- `-m, --model <name>` - Model to use (default: gpt-5.1-codex)
- `-d, --working-dir <path>` - Working directory for Codex
- `--skip-git-check` - Skip Git repository check
- `--sandbox <mode>` - Sandbox mode: read-only (default), read-write, off
- `--full-auto` - Full auto mode, no approval prompts (default: true)
- `--format <type>` - Output format: plain (default) or json
- `--image <path>` - Include image file in context (repeatable)
- `--config KEY=VALUE` - Additional configuration (repeatable)

### `codex:stream [PROMPT]` - Real-time Streaming

Execute Codex tasks with live progress monitoring and event streaming.

**Arguments:**
- `PROMPT` - The instruction to send to Codex (optional if using flags/stdin)

**Flags:**
- `-p, --prompt <value>` - Prompt to send to Codex
- `-f, --file <path>` - Read prompt from file
- `-m, --model <name>` - Model to use (default: gpt-5.1-codex)
- `-d, --working-dir <path>` - Working directory for Codex
- `--skip-git-check` - Skip Git repository check
- `--sandbox <mode>` - Sandbox mode: read-only (default), read-write, off
- `--full-auto` - Full auto mode, no approval prompts (default: true)
- `--image <path>` - Include image file in context (repeatable)
- `--config KEY=VALUE` - Additional configuration (repeatable)
- `-v, --verbose` - Show verbose output including AI reasoning
- `--no-timestamps` - Hide timestamps from output
- `--no-colors` - Disable colored output

**Output Features:**
- 🤖 Thread start notification
- ▶️ Processing progress indicators
- 🧠 AI reasoning steps (with --verbose)
- 🔧 Command execution updates
- 📝 File modification tracking
- ✅ Completion summary with duration and event count

### `codex:threads` - Thread Management

Manage persistent conversation threads for multi-turn dialogues.

**Actions (mutually exclusive):**
- `-l, --list` - List all threads
- `--view <thread-id>` - View thread details and history
- `-r, --resume <thread-id>` - Resume a thread with new prompt
- `--delete <thread-id>` - Delete a thread permanently

**Resume Options:**
- `-p, --prompt <value>` - Prompt to send (required for resume)
- `-s, --stream` - Use streaming output for resume

**General Options:**
- `--format <type>` - Output format: plain (default) or json
- `-v, --verbose` - Show verbose output with event details
- `-f, --force` - Force deletion without confirmation

**Thread Features:**
- 📋 Thread listing with ID, last active time, status
- 🧵 Thread details with creation time and activity
- 📜 Conversation history (transcript access)
- 💬 Multi-turn context preservation
- 🔗 Thread resumption with full context

## Use Cases

### 1. CI/CD Integration

```yaml
# .github/workflows/ai-review.yml
- name: AI Code Review
  run: |
    xling codex:run \
      -p "Review PR changes for security issues. Output as JSON." \
      --format json > review.json

    # Check for critical issues
    CRITICAL=$(jq '[.findings[] | select(.severity == "critical")] | length' review.json)
    if [ "$CRITICAL" -gt 0 ]; then
      echo "❌ Found $CRITICAL critical issues!"
      exit 1
    fi
```

### 2. Automated Documentation

```bash
# Generate API documentation
xling codex:run \
  -p "Analyze all TypeScript files in src/ and generate API docs in Markdown" \
  > docs/API.md
```

### 3. Batch Processing

```bash
# Process multiple files
for file in src/**/*.js; do
  echo "Processing $file..."
  xling codex:run \
    -p "Add JSDoc comments to $file" \
    --format json > "$file.report.json"
done
```

### 4. Code Quality Monitoring

```bash
# Weekly code quality check
xling codex:run \
  -p "Analyze codebase for technical debt and code smells. Prioritize by impact." \
  --format json \
  > "reports/$(date +%Y-%m-%d)-quality.json"
```

### 5. Real-time Development Monitoring

```bash
# Watch a complex refactoring in real-time
xling codex:stream \
  "Migrate from REST to GraphQL endpoints including type definitions" \
  --verbose

# Monitor long-running analysis tasks
xling codex:stream \
  "Audit entire codebase for GDPR compliance and privacy issues" \
  --no-colors | tee compliance-audit.log
```

### 6. Multi-turn Development Sessions

```bash
# Start a refactoring session
THREAD=$(xling codex:run -p "Analyze authentication system" --format json | jq -r '.threadId')

# Continue with implementation
xling codex:threads --resume $THREAD -p "Implement JWT tokens"

# Continue with testing
xling codex:threads --resume $THREAD -p "Add comprehensive tests"

# Continue with documentation
xling codex:threads --resume $THREAD -p "Write API documentation"
```

### 7. Interactive Learning Sessions

```bash
# Start a teaching session
xling codex:run -p "Explain reactive programming patterns in JavaScript with examples"

# Continue with questions
xling codex:threads --resume $(xling codex:threads --list | head -n1 | awk '{print $1}') \
  -p "Can you show me how to handle errors in this pattern?"
```

## Comparison: Codex Commands

| Feature | `xling x -t codex` (CLI Launcher) | `xling codex:run` (SDK) | `xling codex:stream` | `xling codex:threads` |
|---------|-----------------------------------|-------------------------|---------------------|----------------------|
| **Mode** | Interactive | Non-interactive | Non-interactive | Both |
| **Use Case** | Manual development | Automation, CI/CD | Long-running tasks | Multi-turn conversations |
| **Output** | Terminal UI | Plain text or JSON | Live progress events | Thread management |
| **Approval** | Manual prompts | Auto-approved | Auto-approved | Auto-approved |
| **Scripting** | Difficult | Easy | Easy (pipeline) | Easy |
| **Progress** | Real-time UI | Silent | Real-time streaming | Session-based |
| **Context** | Single session | Single session | Single session | Persistent across sessions |
| **History** | No | No | No | Yes (thread history) |

**When to use each:**
- **CLI Launcher (`xling x -t codex`)**: Interactive coding sessions with full UI
- **SDK (`xling codex:run`)**: Automation, scripts, CI/CD pipelines
- **Stream (`xling codex:stream`)**: Monitor long-running tasks, watch progress
- **Threads (`xling codex:threads`)**: Multi-turn development, learning sessions, context preservation

## Configuration

### Authentication

xling automatically loads authentication in the following priority:

1. **Codex CLI auth** (recommended): Automatically reads from `~/.codex/auth.json`
2. **Environment variable**: `CODEX_API_KEY` if set
3. **Config parameter**: Pass `apiKey` in config

**Most users don't need to do anything** - just make sure you're logged in with `codex login`!

### Environment Variables

- `CODEX_BASE_URL` - Custom API base URL (optional, rarely needed)

### Working with Profiles

The SDK respects your existing Codex configuration:

```bash
# Uses settings from ~/.codex/config.toml
xling codex:run -p "Your task"
```

## Troubleshooting

### "CODEX_API_KEY not found"

This means xling couldn't find your Codex authentication. To fix:

```bash
# Login with Codex CLI (recommended)
codex login

# Or set environment variable
export CODEX_API_KEY="your-key"
```

### "codex binary not found"

Install Codex CLI:
```bash
# Check installation
which codex
codex --version

# Install if needed - visit https://docs.codex.com/install
```

### "Git repository check failed"

Use `--skip-git-check` if working outside a Git repository:
```bash
xling codex:run -p "Task" --skip-git-check
```

## Advanced Usage

### Structured Output

Pass JSON schema for structured responses:

```bash
xling codex:run \
  -p "Analyze security issues" \
  --config 'outputSchema={"type":"object","properties":{"issues":{"type":"array"}}}' \
  --format json
```

### Include Images

For visual context:

```bash
xling codex:run \
  -p "Analyze this UI screenshot for accessibility issues" \
  --image screenshot.png
```

### Custom Sandbox Mode

Control file system access:

```bash
# Read-only (safe, default)
xling codex:run -p "Analyze code" --sandbox read-only

# Workspace write (allow file modifications in working dir)
xling codex:run -p "Fix bugs" --sandbox read-write

# Full access (dangerous, use with caution)
xling codex:run -p "Install dependencies" --sandbox off
```

## Examples Library

### Security Scanning

```bash
xling codex:run \
  -p "Scan for SQL injection, XSS, and CSRF vulnerabilities. Output severity levels." \
  --format json > security-scan.json
```

### Performance Analysis

```bash
xling codex:run \
  -p "Identify performance bottlenecks: N+1 queries, inefficient loops, memory leaks." \
  --format json > perf-analysis.json
```

### Dependency Audit

```bash
xling codex:run \
  -p "Analyze package.json dependencies for known vulnerabilities and outdated packages." \
  --format json > dep-audit.json
```

## Next Steps

- Explore CI/CD integration examples in your own projects
- Try `codex:stream` for monitoring long-running refactoring tasks
- Use `codex:threads` for complex multi-turn development sessions
- Integrate with your existing development workflows

## Feedback and Support

Found a bug or have a feature request? Please report it at:
https://github.com/kingsword09/xling/issues
