# Xling Skills for Claude Code

This directory contains Claude Code skills that provide expert knowledge about xling commands and features.

## Available Skills

### Xling CLI Expert (`xling-expert/`)

A comprehensive skill that provides expert knowledge about all xling commands, configuration, and workflows.

**Coverage:**
- Commands: `x`, `p`, `sx`, `settings:*`
- Configuration: Multi-provider setup, shortcuts, settings
- Workflows: Git integration, AI code review, provider fallback
- Troubleshooting: Common issues and solutions

## Quick Start

### Option 1: Download Pre-built Package

Download `xling-expert.zip` and install it in Claude Code:

1. Open Claude Code
2. Click the Skills icon in the sidebar
3. Click "Add Skill"
4. Select `xling-expert.zip`
5. Enable the skill

### Option 2: Build from Source

```bash
cd docs/skill
./build-skill.sh
```

This creates `xling-expert.zip` which you can then install in Claude Code.

## Usage

Once installed, Claude will automatically use the skill when you ask about xling:

```
User: How do I configure multiple AI providers?
Claude: [Uses xling-expert skill to provide detailed answer]
```

```
User: Show me how to create a git commit message shortcut
Claude: [Uses xling-expert skill with examples]
```

You can also explicitly reference the skill:

```
User: @xling-expert How do I set up provider fallback?
```

## Skill Structure

```
xling-expert/
├── Skill.md          # Main skill file (required)
└── README.md         # Installation and usage instructions
```

The skill follows [Claude Code skill format](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills):
- YAML frontmatter with metadata
- Comprehensive documentation
- Examples and workflows
- Troubleshooting guidance

## Building Skills

To rebuild the skill package:

```bash
cd docs/skill
./build-skill.sh
```

This will:
1. Validate the skill structure
2. Create `xling-expert.zip`
3. Verify the package structure

## Updating Skills

To update the skill:

1. Edit `xling-expert/Skill.md`
2. Follow the existing structure
3. Add examples for new features
4. Rebuild: `./build-skill.sh`
5. Reinstall in Claude Code

## Requirements

- Claude Code (latest version)
- xling CLI tool installed

## Related Documentation

- [xling README](../README.md) - Project overview
- [Command Documentation](../) - Detailed command docs
  - [p.md](../p.md) - Prompt command
  - [sx.md](../sx.md) - Shortcuts
  - [x.md](../x.md) - Quick launcher
  - [settings.md](../settings.md) - Settings management

## Support

If you encounter issues:
1. Check the [xling documentation](../README.md)
2. Review the [skill documentation](xling-expert/README.md)
3. Submit an issue on [GitHub](https://github.com/kingsword09/xling/issues)

## License

Skills are part of the xling project and follow the same license (Apache-2.0).
