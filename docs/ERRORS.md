# xling Error Reference

Common errors and how to resolve them.

## Configuration Errors

### ConfigFileNotFoundError

**Message**: `Config file not found: <path>`

**Cause**: The specified configuration file doesn't exist.

**Solution**:
```bash
# Create the config file
xling settings:set --tool <tool> --scope <scope>
```

### ConfigParseError

**Message**: `Failed to parse config file <path>: <reason>`

**Cause**: The configuration file contains invalid JSON/TOML.

**Solution**:
1. Check the file syntax with a JSON/TOML validator
2. Restore from backup (`.bak` file if available)
3. Delete and recreate the config file

### ProfileNotFoundError

**Message**: `Profile "<name>" not found`

**Cause**: The specified profile doesn't exist in the configuration.

**Solution**:
```bash
# List available profiles
xling settings:list --tool codex

# Create a new profile
xling settings:set --tool codex --name <profile>
```

## Tool Errors

### UnsupportedToolError

**Message**: `Tool "<name>" is not supported`

**Cause**: The specified tool is not registered.

**Solution**: Use one of the supported tools: `claude`, `codex`, `gemini`, `xling`

### InvalidScopeError

**Message**: `Scope "<scope>" is not valid for tool "<tool>"`

**Cause**: The specified scope is not supported by the tool.

**Solution**: Check supported scopes:
- Claude: `user`, `project`, `local`
- Codex: `user`
- Gemini: `user`, `project`, `system`

### ExecutableNotFoundError

**Message**: `Tool "<name>" is not installed or not found in PATH`

**Cause**: The CLI tool is not installed.

**Solution**:
```bash
# Install the missing tool
# For Claude Code:
npm install -g @anthropic-ai/claude-code

# For Codex:
npm install -g @openai/codex

# For Gemini:
npm install -g @google/gemini-cli
```

## Validation Errors

### ValidationError

**Message**: `Validation failed: <details>`

**Cause**: Input validation failed.

**Common cases**:
- Invalid port number (must be 1-65535)
- Invalid host format
- Invalid PR ID format

**Solution**: Check the input format and try again.

## Git Errors

### PROperationError

**Message**: `PR operation failed: <reason>`

**Cause**: GitHub CLI operation failed.

**Solution**:
1. Ensure `gh` CLI is installed and authenticated
2. Check if you have access to the repository
3. Verify the PR number exists

### WorktreeError

**Message**: `Worktree operation failed: <reason>`

**Cause**: Git worktree operation failed.

**Solution**:
1. Ensure you're in a git repository
2. Check if the branch/path already exists
3. Run `git worktree prune` to clean up stale worktrees

## Provider Errors

### ModelNotSupportedError

**Message**: `Model "<name>" is not supported by any configured provider`

**Cause**: The requested model is not available.

**Solution**:
1. Check available models in your configuration
2. Add a provider that supports the model
3. Use `--model` to specify a different model

### AllProvidersFailedError

**Message**: `All providers failed: <details>`

**Cause**: All configured providers returned errors.

**Solution**:
1. Check your API keys are valid
2. Verify provider endpoints are accessible
3. Check provider status pages for outages

## Debugging Tips

### Enable Verbose Output

```bash
DEBUG=* xling <command>
```

### Check Configuration

```bash
xling settings:inspect --tool <tool>
```

### Verify Tool Installation

```bash
which claude codex gemini
```

### Check xling Version

```bash
xling version
```
