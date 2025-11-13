# Xling CLI Expert Skill

A Claude Code skill that provides comprehensive knowledge about the xling CLI tool.

## What This Skill Does

This skill gives Claude expert knowledge about:
- **xling commands**: `x`, `p`, `sx`, `settings:*`
- **Configuration**: Multi-provider setup, shortcuts, settings management
- **Workflows**: Git integration, AI code review, provider fallback
- **Troubleshooting**: Common issues and solutions

## Installation

### Method 1: Download and Install

1. Download the skill package:
   ```bash
   # From the xling repository
   cd docs/skill
   zip -r xling-expert.zip xling-expert/
   ```

2. In Claude Code:
   - Click the Skills icon in the sidebar
   - Click "Add Skill"
   - Select the `xling-expert.zip` file
   - Enable the skill

### Method 2: Manual Installation

1. Copy the `xling-expert` folder to your Claude Code skills directory:
   ```bash
   # macOS/Linux
   cp -r xling-expert ~/.claude/skills/

   # Windows
   copy xling-expert %USERPROFILE%\.claude\skills\
   ```

2. Restart Claude Code or reload skills

## Usage

### Automatic Activation

Claude will automatically use this skill when you ask about xling:

```
User: How do I configure multiple AI providers in xling?
Claude: [Uses xling-expert skill to provide detailed answer]
```

```
User: Show me how to create a git commit message shortcut
Claude: [Uses xling-expert skill with examples]
```

### Manual Activation

You can explicitly reference the skill:

```
User: @xling-expert How do I set up provider fallback?
Claude: [Uses skill to explain provider priority and fallback]
```

## What's Included

- **Skill.md**: Main skill file with comprehensive xling knowledge
- **README.md**: This file - installation and usage instructions

## Skill Coverage

### Commands
- `xling x` - Quick launcher for Claude Code/Codex
- `xling p` - AI prompt execution with multi-provider support
- `xling sx` - Command shortcuts (command/shell/pipeline types)
- `xling settings:*` - Configuration management

### Configuration
- Provider setup and configuration
- Multi-provider fallback
- Shortcut creation (3 types)
- Settings management across tools

### Workflows
- Setting up new providers
- Creating git integration shortcuts
- AI code review workflows
- Managing multiple AI tools

### Troubleshooting
- Model not supported errors
- Provider failure handling
- Config parse errors
- Shortcut issues

## Examples

### Ask About Commands
```
User: How do I use xling p to review git diffs?
Claude: You can pipe git diff output to xling p using the --stdin flag:

git diff | xling p --stdin "Review this code"

This will send the diff to your configured AI provider for review.
```

### Configuration Help
```
User: Show me how to configure multiple OpenAI providers
Claude: Here's an example configuration with primary and backup providers:

{
  "prompt": {
    "providers": [
      {
        "name": "openai-primary",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-proj-xxx",
        "models": ["gpt-4", "gpt-4-turbo"],
        "priority": 1
      },
      {
        "name": "openai-backup",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-proj-yyy",
        "models": ["gpt-4"],
        "priority": 2
      }
    ]
  }
}
```

### Troubleshooting
```
User: I'm getting "Model not supported" error
Claude: This error means no configured provider supports the requested model.
Check:
1. Model name spelling
2. At least one provider has the model in its "models" array
3. Run `xling settings:list --tool xling` to see available models
```

## Updating the Skill

To update the skill with new features:

1. Edit `Skill.md`
2. Follow the existing structure
3. Add examples for new features
4. Re-zip and reinstall:
   ```bash
   cd docs/skill
   zip -r xling-expert.zip xling-expert/
   ```

## Related Documentation

For more detailed documentation, see:
- [xling README](../../README.md) - Project overview
- [p command docs](../p.md) - Detailed prompt command documentation
- [sx command docs](../sx.md) - Shortcuts documentation
- [x command docs](../x.md) - Quick launcher documentation
- [settings docs](../settings.md) - Settings management documentation

## Requirements

- Claude Code (latest version)
- xling CLI tool installed

## Support

If you encounter issues:
1. Check the [xling documentation](../../README.md)
2. Submit an issue on [GitHub](https://github.com/kingsword09/xling/issues)

## License

This skill is part of the xling project and follows the same license (Apache-2.0).
