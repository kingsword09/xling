# Xling Discuss (d) Command - Complete Design

## Executive Summary

`xling d` (discuss) 是一个多角色 AI 讨论系统，支持：
- 🤖 多个 AI 模型协同讨论（API + CLI 工具）
- 👤 人类参与者实时互动
- 🧠 智能推荐讨论组织架构
- 💾 完整的讨论历史管理
- 🌍 多语言支持（默认英文，可配置中文等）
- 📁 结构化的讨论存储（全局 + 项目级）

---

## Command Structure

```bash
# 核心命令
xling d <topic>                    # 快速启动讨论（使用默认场景）
xling d:start [options]            # 启动新讨论
xling d:recommend <topic>          # 推荐讨论场景和角色配置
xling d:list [options]             # 列出历史讨论
xling d:show <id>                  # 查看具体讨论详情
xling d:resume <id>                # 恢复之前的讨论
xling d:export <id> [format]       # 导出讨论记录

# 场景管理
xling d:scenarios                  # 列出所有预设场景
xling d:scenario:create <file>     # 创建自定义场景
xling d:scenario:edit <id>         # 编辑场景配置

# 配置管理
xling d:config                     # 显示当前配置
xling d:config:language <lang>     # 设置讨论语言
```

---

## Directory Structure

### 全局配置与历史 (`~/.claude/discuss/`)
```
~/.claude/discuss/
├── config.json                    # 全局配置（语言、默认场景等）
├── scenarios/                     # 预设讨论场景
│   ├── code-review.json
│   ├── architecture-design.json
│   ├── brainstorm.json
│   └── technical-decision.json
└── history/                       # 全局讨论历史
    ├── 2024-01-15_code-review_a1b2c3.json
    └── 2024-01-16_brainstorm_d4e5f6.json
```

### 项目级讨论 (`.claude/discuss/`)
```
.claude/discuss/
├── config.json                    # 项目级配置覆盖
├── scenarios/                     # 项目特定场景
│   └── custom-review.json
└── history/                       # 项目讨论历史
    ├── 2024-01-15_feature-planning_123abc.json
    └── 2024-01-16_bug-triage_456def.json
```

---

## Core Data Structures

### Discussion Configuration
```typescript
interface DiscussionConfig {
  id: string;
  topic: string;
  scenario: string;                 // 场景 ID
  language: "en" | "zh" | "es" | "ja" | "auto";
  participants: Participant[];
  metadata: {
    createdAt: string;
    projectPath?: string;           // 项目路径（项目级讨论）
    tags?: string[];
  };
}

interface Participant {
  id: string;
  name: string;
  type: "api" | "cli" | "human";
  role: string;                      // 角色描述（架构师、安全专家等）
  config: ParticipantConfig;
}

interface ParticipantConfig {
  // API 类型
  model?: string;                    // "gpt-4o", "claude-sonnet-4"
  provider?: string;                 // 可选，覆盖默认路由
  temperature?: number;
  maxTokens?: number;

  // CLI 类型
  tool?: "codex" | "claude";
  args?: string[];

  // 人类类型
  inputMode?: "tty" | "editor";

  // 通用
  systemPrompt?: string;             // 角色定义
  languageInstruction?: string;      // 语言指令（自动注入）
}
```

### Discussion Scenario (预设模板)
```typescript
interface DiscussionScenario {
  id: string;
  name: string;
  description: string;
  category: "code-review" | "architecture" | "brainstorm" | "decision" | "custom";
  participants: ParticipantTemplate[];
  orchestration: {
    turnOrder: "sequential" | "round-robin" | "dynamic";
    maxTurns: number;
    terminationCondition?: string;
  };
  prompts: {
    initial?: string;                // 初始化提示模板
    perTurn?: string;                // 每轮提示模板
  };
  tags?: string[];
}

interface ParticipantTemplate {
  role: string;                      // "架构师", "安全专家"
  type: "api" | "cli" | "human";
  preferredModels?: string[];        // 推荐模型列表
  systemPrompt: string;
  required: boolean;                 // 是否必需
}
```

### Discussion History
```typescript
interface DiscussionHistory {
  id: string;
  config: DiscussionConfig;
  turns: Turn[];
  status: "active" | "paused" | "completed" | "aborted";
  statistics: {
    totalTurns: number;
    totalTokens: number;
    duration: number;                // 秒
    participationRate: Record<string, number>; // 每个参与者的发言次数
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Turn {
  index: number;
  participantId: string;
  participantName: string;
  content: string;
  timestamp: string;
  metadata: {
    model?: string;                  // 使用的模型
    tokens?: number;
    language?: string;               // 实际使用的语言
  };
}
```

---

## Prompt 流程（首轮种子 & 续写）

- **首轮种子**：`DiscussionOrchestrator.start(config, initialPrompt)` 会将 `initialPrompt` 写入运行时上下文与 `config.metadata.initialPrompt`。`executeTurn()` 的首轮默认提示优先级为：
  1. `context.initialPrompt`（来自调用方传入的初始提示）
  2. `config.metadata.initialPrompt`（持久化的默认开场）
  3. 回退文案：`"Please provide your analysis as the <role>."`
- **后续轮次**：若未显式传入 `prompt`，使用 `Based on the discussion so far...` 的默认续写提示。
- **人工覆盖**：调用方仍可为任意轮传入自定义 `prompt`，用于插入新上下文或纠偏。

这一流程确保示例脚本和 CLI 将开场意图传递给参与者，避免讨论从无上下文开始的回归。

---

## Built-in Scenarios

### 1. Code Review Council (`code-review`)
```json
{
  "id": "code-review",
  "name": "Code Review Council",
  "category": "code-review",
  "participants": [
    {
      "role": "Security Expert",
      "type": "api",
      "preferredModels": ["gpt-4o", "gpt-4-turbo"],
      "systemPrompt": "You are a security expert. Focus on finding vulnerabilities, authentication issues, SQL injection, XSS, and other security concerns.",
      "required": true
    },
    {
      "role": "Performance Engineer",
      "type": "api",
      "preferredModels": ["claude-sonnet-4", "claude-opus-4"],
      "systemPrompt": "You are a performance engineer. Analyze algorithmic complexity, database query optimization, memory usage, and scalability.",
      "required": true
    },
    {
      "role": "Code Quality Reviewer",
      "type": "api",
      "preferredModels": ["gpt-4o-mini", "claude-sonnet-4"],
      "systemPrompt": "You are a code quality expert. Focus on readability, maintainability, adherence to SOLID principles, and best practices.",
      "required": true
    },
    {
      "role": "Codex Deep Analysis",
      "type": "cli",
      "tool": "codex",
      "systemPrompt": "Perform deep codebase analysis to identify patterns, suggest refactoring, and check consistency with existing code.",
      "required": false
    },
    {
      "role": "Developer (Human)",
      "type": "human",
      "inputMode": "tty",
      "systemPrompt": "You are the original developer. Respond to feedback and explain design decisions.",
      "required": false
    }
  ],
  "orchestration": {
    "turnOrder": "round-robin",
    "maxTurns": 12
  },
  "prompts": {
    "initial": "Please review the following code changes. Focus on your area of expertise and provide actionable feedback.\n\n{code}"
  }
}
```

### 2. Architecture Design Session (`architecture-design`)
```json
{
  "id": "architecture-design",
  "name": "Architecture Design Session",
  "category": "architecture",
  "participants": [
    {
      "role": "System Architect",
      "type": "api",
      "preferredModels": ["o1", "claude-opus-4"],
      "systemPrompt": "You are a system architect. Focus on scalability, maintainability, design patterns, and long-term architectural decisions.",
      "required": true
    },
    {
      "role": "Database Specialist",
      "type": "api",
      "preferredModels": ["gpt-4o", "claude-sonnet-4"],
      "systemPrompt": "You are a database expert. Analyze data modeling, query patterns, indexing strategies, and database selection.",
      "required": true
    },
    {
      "role": "DevOps Engineer",
      "type": "api",
      "preferredModels": ["gpt-4o", "claude-sonnet-4"],
      "systemPrompt": "You are a DevOps engineer. Focus on deployment strategies, CI/CD, monitoring, and operational concerns.",
      "required": false
    },
    {
      "role": "Product Owner (Human)",
      "type": "human",
      "inputMode": "editor",
      "systemPrompt": "You represent product requirements and business constraints.",
      "required": true
    }
  ],
  "orchestration": {
    "turnOrder": "round-robin",
    "maxTurns": 15
  }
}
```

### 3. Technical Brainstorm (`brainstorm`)
```json
{
  "id": "brainstorm",
  "name": "Technical Brainstorm",
  "category": "brainstorm",
  "participants": [
    {
      "role": "Innovator",
      "type": "api",
      "preferredModels": ["claude-sonnet-4", "gpt-4o"],
      "systemPrompt": "You are an innovator. Propose creative, cutting-edge solutions without worrying about constraints.",
      "required": true
    },
    {
      "role": "Pragmatist",
      "type": "api",
      "preferredModels": ["gpt-4o", "gpt-4-turbo"],
      "systemPrompt": "You are a pragmatist. Focus on feasibility, implementation difficulty, and time-to-market.",
      "required": true
    },
    {
      "role": "Devil's Advocate",
      "type": "api",
      "preferredModels": ["gpt-4o", "claude-sonnet-4"],
      "systemPrompt": "You challenge ideas constructively. Identify potential problems, edge cases, and risks.",
      "required": true
    },
    {
      "role": "Facilitator (Human)",
      "type": "human",
      "inputMode": "tty",
      "required": false
    }
  ],
  "orchestration": {
    "turnOrder": "round-robin",
    "maxTurns": 20
  }
}
```

### 4. Technical Decision Review (`decision`)
```json
{
  "id": "decision",
  "name": "Technical Decision Review",
  "category": "decision",
  "participants": [
    {
      "role": "Technical Lead",
      "type": "api",
      "preferredModels": ["o1", "claude-opus-4"],
      "systemPrompt": "You are a technical lead. Evaluate trade-offs, long-term implications, and team capacity.",
      "required": true
    },
    {
      "role": "Cost Analyst",
      "type": "api",
      "preferredModels": ["gpt-4o"],
      "systemPrompt": "You analyze cost implications, licensing, infrastructure costs, and ROI.",
      "required": false
    },
    {
      "role": "Security Advisor",
      "type": "api",
      "preferredModels": ["gpt-4o"],
      "systemPrompt": "You evaluate security implications and compliance requirements.",
      "required": true
    },
    {
      "role": "Stakeholder (Human)",
      "type": "human",
      "inputMode": "editor",
      "required": true
    }
  ],
  "orchestration": {
    "turnOrder": "sequential",
    "maxTurns": 8
  }
}
```

---

## Smart Recommender System

### Recommender Logic
```typescript
interface RecommendationRequest {
  topic: string;                     // 用户输入的讨论主题
  context?: {
    codeChanges?: boolean;           // 是否涉及代码变更
    projectType?: string;            // 项目类型（web, cli, library）
    urgency?: "low" | "medium" | "high";
  };
  preferences?: {
    maxParticipants?: number;
    includeHuman?: boolean;
    budget?: "low" | "medium" | "high"; // 控制模型选择
  };
}

interface Recommendation {
  scenario: DiscussionScenario;     // 推荐的场景
  participants: ConfiguredParticipant[]; // 配置好的参与者
  availableModels: ModelInfo[];     // 当前可用的模型
  command: string;                  // 生成的执行命令
  estimatedCost: {
    tokens: number;
    usd?: number;
  };
}

interface ConfiguredParticipant extends Participant {
  rationale: string;                 // 推荐理由
}

interface ModelInfo {
  id: string;
  provider: string;
  available: boolean;
  capabilities: string[];
  costTier: "low" | "medium" | "high";
}
```

### Recommendation Algorithm
```typescript
async function recommendScenario(request: RecommendationRequest): Promise<Recommendation> {
  // 1. 分析主题关键词
  const keywords = analyzeTopicKeywords(request.topic);

  // 2. 匹配场景类别
  const category = matchCategory(keywords);
  // "code review" → "code-review"
  // "design", "architecture" → "architecture"
  // "idea", "brainstorm" → "brainstorm"
  // "decide", "choice" → "decision"

  // 3. 加载场景模板
  const scenario = loadScenario(category);

  // 4. 获取可用模型列表
  const availableModels = await getAvailableModels();

  // 5. 为每个参与者匹配最佳模型
  const participants = scenario.participants.map(template => {
    const model = selectBestModel(template, availableModels, request.preferences);
    return {
      ...template,
      config: { model, ...template.config },
      rationale: explainSelection(model, template)
    };
  });

  // 6. 生成执行命令
  const command = generateCommand(scenario, participants, request);

  // 7. 估算成本
  const estimatedCost = estimateCost(scenario, participants);

  return {
    scenario,
    participants,
    availableModels,
    command,
    estimatedCost
  };
}
```

### Example Recommendation Output
```bash
$ xling d:recommend "Review authentication implementation for security issues"

📊 Recommendation Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: Review authentication implementation for security issues
Detected Category: Code Review (Security Focus)
Recommended Scenario: code-review

👥 Recommended Participants
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Security Expert (API)
   Model: gpt-4o
   Rationale: Best for security analysis, high accuracy in vulnerability detection

2. Performance Engineer (API)
   Model: claude-sonnet-4
   Rationale: Excellent at analyzing auth flow performance and caching strategies

3. Code Quality Reviewer (API)
   Model: gpt-4o-mini
   Rationale: Cost-effective for general code quality checks

4. Codex Deep Analysis (CLI) [OPTIONAL]
   Tool: codex
   Rationale: Deep codebase context for consistency checking
   Available: ✅ (codex CLI detected)

5. Developer (Human) [OPTIONAL]
   Input: Terminal (TTY)
   Rationale: You can respond to feedback in real-time

🤖 Available Models in Your Config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OpenAI:
  ✅ gpt-4o (available)
  ✅ gpt-4o-mini (available)
  ✅ o1 (available)

Anthropic:
  ✅ claude-sonnet-4 (available)
  ✅ claude-opus-4 (available)

📝 Generated Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Config saved to: .claude/discuss/scenarios/auth-review-2024-01-15.json

💰 Estimated Cost
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Expected turns: 12
Estimated tokens: ~50,000
Estimated cost: $0.50 - $2.00 USD

🚀 Ready to Start?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run the following command:

  xling d:start \
    --scenario code-review \
    --topic "Review authentication implementation" \
    --participants security-expert,performance-engineer,code-quality \
    --include-human

Or use the quick command:

  xling d "Review authentication implementation"
```

---

## Language Support

### Language Configuration
```typescript
interface LanguageConfig {
  default: "en" | "zh" | "es" | "ja" | "auto";
  perParticipant?: Record<string, string>; // 为特定参与者设置语言
  fallback: "en";
}
```

### Language Injection Mechanism
```typescript
function injectLanguageInstruction(
  systemPrompt: string,
  language: string
): string {
  const instructions = {
    en: "Respond in English.",
    zh: "请使用中文回复。Use Chinese (Simplified) for all responses.",
    es: "Responde en español.",
    ja: "日本語で返答してください。"
  };

  return `${systemPrompt}\n\nIMPORTANT: ${instructions[language]}`;
}
```

### Usage Examples
```bash
# 设置默认语言为中文
xling d:config:language zh

# 临时使用中文进行讨论
xling d "讨论新功能架构" --language zh

# 查看当前语言配置
xling d:config

# 输出：
# Language: zh (Chinese)
# Fallback: en (English)
```

---

## CLI Command Details

### `xling d <topic>` (Quick Start)
```bash
# 使用默认场景快速启动
xling d "Review new authentication flow"

# 自动选择最合适的场景并开始讨论
```

### `xling d:start [options]`
```bash
xling d:start \
  --scenario code-review \
  --topic "Review PR #123" \
  --participants security,performance,quality \
  --include-human \
  --language zh \
  --max-turns 10 \
  --output .claude/discuss/history/pr-123-review.json

# Options:
#   --scenario, -s      Scenario ID or path to custom scenario file
#   --topic, -t         Discussion topic
#   --participants, -p  Comma-separated participant IDs
#   --include-human     Include human participant (you)
#   --language, -l      Discussion language (en, zh, es, ja, auto)
#   --max-turns, -m     Maximum turns (default: from scenario)
#   --output, -o        Output path for discussion history
#   --stdin             Read code/content from stdin
#   --file, -f          Read code/content from file
```

### `xling d:recommend <topic>`
```bash
xling d:recommend "Design microservices architecture for e-commerce platform"

# Options:
#   --context           Additional context (json)
#   --max-participants  Maximum number of participants
#   --include-human     Include human in recommendation
#   --budget            Cost tier (low, medium, high)
#   --output, -o        Save recommended config to file
```

### `xling d:list [options]`
```bash
xling d:list
xling d:list --scope project
xling d:list --scope global
xling d:list --format table
xling d:list --format json
xling d:list --tag security
xling d:list --since 2024-01-01

# Output:
# ID       | Topic                  | Scenario      | Date       | Status    | Turns
# ---------|------------------------|---------------|------------|-----------|------
# a1b2c3   | Auth Review           | code-review   | 2024-01-15 | completed | 12
# d4e5f6   | API Design            | architecture  | 2024-01-16 | completed | 18
```

### `xling d:show <id>`
```bash
xling d:show a1b2c3
xling d:show a1b2c3 --format json
xling d:show a1b2c3 --turns 5-10

# Output:
# Discussion: Auth Review (a1b2c3)
# Scenario: code-review
# Status: completed
# Date: 2024-01-15 14:30:00
# Duration: 45 minutes
# Turns: 12
# Tokens: 48,234
#
# Participants:
#   - Security Expert (gpt-4o) - 4 turns
#   - Performance Engineer (claude-sonnet-4) - 4 turns
#   - Code Quality Reviewer (gpt-4o-mini) - 4 turns
#
# Turn History:
# [1] Security Expert (gpt-4o)
#     I've identified several security concerns in the authentication flow...
#
# [2] Performance Engineer (claude-sonnet-4)
#     The current implementation has O(n) complexity for token validation...
# ...
```

### `xling d:resume <id>`
```bash
xling d:resume a1b2c3

# Resume a paused or completed discussion
# Loads context and continues from last turn
```

### `xling d:export <id> [format]`
```bash
xling d:export a1b2c3 markdown
xling d:export a1b2c3 pdf
xling d:export a1b2c3 json

# Export discussion to various formats
# Default: markdown
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
1. Create domain types (`src/domain/discuss/`)
2. Implement storage layer (`src/services/discuss/storage/`)
3. Create scenario loader and validator
4. Build language configuration system

### Phase 2: Core Engine (Days 4-7)
1. Implement participant drivers (API, CLI, Human)
2. Build discussion orchestrator with language support
3. Create turn management and context building
4. Implement termination conditions

### Phase 3: Smart Recommender (Days 8-10)
1. Build topic analyzer (keyword extraction)
2. Implement scenario matching algorithm
3. Create model selection logic
4. Build recommendation output formatter

### Phase 4: CLI Commands (Days 11-13)
1. Implement `d` quick command
2. Implement `d:start` with all options
3. Implement `d:recommend`
4. Implement `d:list`, `d:show`, `d:resume`, `d:export`
5. Implement scenario management commands

### Phase 5: Testing & Documentation (Days 14-15)
1. Write comprehensive tests
2. Create user documentation
3. Add example scenarios
4. Performance optimization

---

## File Structure

### New Files to Create
```
src/domain/discuss/
├── types.ts                       # Core type definitions
├── scenario.ts                    # Scenario types
└── language.ts                    # Language types

src/services/discuss/
├── orchestrator.ts                # Discussion orchestration
├── recommender.ts                 # Smart scenario recommender
├── storage/
│   ├── discussionStorage.ts       # History persistence
│   └── scenarioStorage.ts         # Scenario management
├── participants/
│   ├── base.ts                    # Base participant interface
│   ├── apiParticipant.ts          # API model participant
│   ├── cliParticipant.ts          # CLI tool participant
│   └── humanParticipant.ts        # Human participant
└── language/
    ├── detector.ts                # Language detection
    └── injector.ts                # Language instruction injection

src/commands/d/
├── index.ts                       # Quick start command
├── start.ts                       # d:start command
├── recommend.ts                   # d:recommend command
├── list.ts                        # d:list command
├── show.ts                        # d:show command
├── resume.ts                      # d:resume command
├── export.ts                      # d:export command
├── scenarios.ts                   # d:scenarios command
└── config.ts                      # d:config commands

test/services/discuss/
├── orchestrator.test.ts
├── recommender.test.ts
├── storage.test.ts
└── participants.test.ts
```

### Files to Modify
```
src/services/prompt/router.ts     # Add language support
src/services/settings/adapters/xling.ts  # Add discuss config
```

---

## Next Steps

Ready to start implementation? I recommend:

1. **Phase 1**: Create foundation types and storage
2. **Phase 2**: Build core orchestration engine
3. **Phase 3**: Implement smart recommender
4. **Phase 4**: Create CLI commands
5. **Phase 5**: Test and document

Should I begin with Phase 1?
