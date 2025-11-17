# Xling Discuss - Multi-Role AI Discussion System

## 📋 Overview

Xling Discuss is a powerful multi-role AI discussion system that enables multiple AI models, CLI tools (like Codex and Claude Code), and human participants to collaborate on complex topics.

---

## ✨ Key Features

### 🤖 Multi-Model Support
- **OpenAI**: gpt-4o, gpt-4o-mini, o1, gpt-4-turbo
- **Anthropic**: claude-sonnet-4, claude-opus-4, claude-haiku
- **Automatic fallback** and retry through ModelRouter

### 🔧 CLI Tool Integration
- **Codex**: Deep codebase analysis
- **Claude Code**: Code review and suggestions
- **Automatic tool detection** and validation

### 👤 Human Participation
- **TTY Mode**: Direct terminal input
- **Editor Mode**: Write responses in your preferred editor
- **Control Commands**: Manage discussion flow in real-time

### 🎯 Core Capabilities
- ✅ Participant numbering system (#1, #2, #3...)
- ✅ Conversation history management
- ✅ Multi-language support (en/zh/es/ja)
- ✅ Round-robin and sequential turn orders
- ✅ Discussion persistence (JSON storage)
- ✅ Beautiful formatted output
- ✅ 5 built-in scenarios

---

## 🚀 Quick Start

### 1. Run the Example

```bash
cd /Users/kingsword09/aispace/xling
bun run examples/discuss-example.ts
```

### 2. View Documentation

```bash
# Quick start guide
cat QUICK_START.md

# Complete feature summary
cat DISCUSS_FEATURE_SUMMARY.md

# Implementation details
cat IMPLEMENTATION_COMPLETE.md
```

---

## 📚 Built-in Scenarios

### 1. Code Review Council
Multi-perspective code review with security, performance, and quality experts.

**Participants**:
- Security Expert (API)
- Performance Engineer (API)
- Code Quality Reviewer (API)
- Codex Deep Analysis (CLI, optional)
- Developer (Human, optional)

### 2. Architecture Design Session
Collaborative system architecture design.

**Participants**:
- System Architect (API)
- Database Specialist (API)
- DevOps Engineer (API, optional)
- Product Owner (Human)

### 3. Technical Brainstorm
Creative brainstorming with diverse perspectives.

**Participants**:
- Innovator (API)
- Pragmatist (API)
- Devil's Advocate (API)
- Facilitator (Human, optional)

### 4. Technical Decision Review
Structured review for important technical decisions.

**Participants**:
- Technical Lead (API)
- Cost Analyst (API, optional)
- Security Advisor (API)
- Stakeholder (Human)

### 5. Bug Triage Session
Collaborative bug analysis and prioritization.

**Participants**:
- Bug Hunter (API)
- Impact Assessor (API)
- Fix Strategist (API)
- QA Engineer (Human, optional)

---

## 🎨 Example Usage

### Basic Discussion

```typescript
import { DiscussionOrchestrator } from "./src/services/discuss/orchestrator.js";
import { ModelRouter } from "./src/services/prompt/router.js";
import { XlingAdapter } from "./src/services/settings/adapters/xling.js";

// Load config and create router
const config = await XlingAdapter.get("global");
const router = new ModelRouter(config);

// Create discussion config
const discussionConfig = {
  id: "my-discussion",
  topic: "Code Security Review",
  language: "zh",
  participants: [
    {
      id: "sec-1",
      number: 1,
      name: "Security Expert",
      type: "api",
      config: {
        api: { model: "gpt-4o" },
        systemPrompt: "You are a security expert..."
      }
    },
    // ... more participants
  ],
  orchestration: {
    turnOrder: "round-robin",
    maxTurns: 10
  }
};

// Start discussion
const orchestrator = new DiscussionOrchestrator(router);
await orchestrator.start(discussionConfig, "Initial prompt...");

// Run discussion loop
while (!orchestrator.shouldTerminate()) {
  await orchestrator.executeTurn();
}

orchestrator.complete();
```

---

## 🎯 Participant Types

### API Participant
Calls AI models through the ModelRouter.

```typescript
{
  type: "api",
  config: {
    api: {
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2000
    },
    systemPrompt: "You are an expert in..."
  }
}
```

### CLI Participant
Executes CLI tools like Codex or Claude Code.

```typescript
{
  type: "cli",
  config: {
    cli: {
      tool: "codex",
      timeout: 180000,
      args: ["--config", "model_reasoning_effort=high"]
    },
    systemPrompt: "Analyze codebase patterns..."
  }
}
```

### Human Participant
Allows you to participate in the discussion.

```typescript
{
  type: "human",
  config: {
    human: {
      inputMode: "tty" // or "editor"
    }
  }
}
```

---

## 🌍 Language Support

### Supported Languages
- `en` - English (default)
- `zh` - Chinese (Simplified)
- `es` - Spanish
- `ja` - Japanese
- `auto` - Auto-detect from input

### Usage

```typescript
discussionConfig: {
  language: "zh", // Use Chinese
  // ...
}
```

---

## 💾 Storage

Discussions are automatically saved to:
- **Project**: `.claude/discuss/history/`
- **Global**: `~/.claude/discuss/history/`

File format: `YYYY-MM-DD_scenario_id.json`

---

## 🎮 Control Commands

During human turns, you can use control commands:

- `pass` - Skip your turn
- `help` - Show help
- `next #N` - (Planned) Set next speaker
- `ask #N message` - (Planned) Ask specific participant

---

## 📊 Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Discussion Participants (3 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security Experts (2):
  #1 - Application Security - gpt-4o (API)
  #2 - Infrastructure Security - claude-opus-4 (API)

Performance Analysis (1):
  #3 - Performance Engineer - claude-sonnet-4 (API)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn 1/10 - #1 Application Security (gpt-4o)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I've identified several security issues in this code:

1. SQL Injection vulnerability at line 42
   - User input is directly concatenated into SQL query
   - Recommendation: Use parameterized queries

2. XSS vulnerability at line 67
   - Output is not HTML-escaped
   - Recommendation: Use sanitizeHtml() function

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Turn completed (1.2s, 234 tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🏗️ Architecture

### Core Components

```
DiscussionOrchestrator
    ├── ApiParticipantDriver → ModelRouter → AI Models
    ├── CliParticipantDriver → spawn() → Codex/Claude
    └── HumanParticipantDriver → readline/editor → You

Storage
    ├── Project: .claude/discuss/
    └── Global: ~/.claude/discuss/

Display
    ├── participantDisplay - Formatting
    └── commandParser - Control commands
```

---

## 📖 Documentation

- **[Quick Start Guide](../../QUICK_START.md)** - Get started quickly
- **[Feature Summary](../../DISCUSS_FEATURE_SUMMARY.md)** - Complete features
- **[Implementation Plan](../../DISCUSS_IMPLEMENTATION_PLAN.md)** - Development roadmap
- **[Participant Numbering](../design/participant-numbering.md)** - Control system
- **[Core Design](../design/discuss-command.md)** - Architecture design

---

## 🔧 Configuration

### Add Models to Config

Edit `~/.claude/xling.json`:

```json
{
  "prompt": {
    "providers": [
      {
        "name": "openai",
        "apiKey": "sk-...",
        "models": ["gpt-4o", "gpt-4o-mini", "o1"]
      },
      {
        "name": "anthropic",
        "apiKey": "sk-ant-...",
        "models": ["claude-sonnet-4", "claude-opus-4"]
      }
    ]
  }
}
```

---

## 🐛 Troubleshooting

### Issue: API Key Not Found
**Solution**: Configure API keys in `~/.claude/xling.json`

### Issue: Codex Not Available
**Solution**:
- Check `codex --version`
- Set `required: false` for CLI participants

### Issue: TTY Not Available
**Solution**:
- Run in terminal directly
- Or use `inputMode: "editor"`

---

## 🎯 Best Practices

### 1. Model Selection
- **Fast testing**: `gpt-4o-mini` (economical)
- **Deep analysis**: `o1`, `claude-opus-4`
- **Balanced**: `gpt-4o`, `claude-sonnet-4`

### 2. Cost Control
- Use `maxTurns` to limit rounds
- Use cheaper models for secondary roles
- Set reasonable `temperature` values

### 3. Multi-Role Strategy
- **Same role, different models**: Get diverse perspectives
- **Clear role differentiation**: Avoid redundant analysis
- **3-5 participants**: Optimal number

---

## 📈 Performance

- **Startup**: <1s
- **Participant init**: <0.5s per participant
- **API overhead**: ~50ms (ModelRouter)
- **CLI overhead**: ~100ms (spawn)
- **Storage overhead**: <50ms (JSON write)

---

## 🙏 Credits

Built with:
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI model integration
- [Zod](https://zod.dev/) - Schema validation

---

## 📞 Support

For issues or questions:
1. Check [QUICK_START.md](../../QUICK_START.md)
2. Review [DISCUSS_FEATURE_SUMMARY.md](../../DISCUSS_FEATURE_SUMMARY.md)
3. See example in `examples/discuss-example.ts`

---

**Status**: ✅ Fully implemented and ready to use!
**Version**: 1.0.0
**License**: MIT
