# Participant Numbering & Dynamic Control System

## 概述

为每个参与者分配编号，并支持讨论过程中的动态控制，包括：
- 清晰的参与者编号和角色展示
- 人类主持人可以指定下一个发言者
- 支持同一角色的多模型实例
- 灵活的参与控制命令

---

## 参与者编号系统

### 编号格式

```
#N - [角色名] - [模型/工具] (类型)

示例：
#1 - Security Expert - gpt-4o (API)
#2 - Security Expert - claude-opus-4 (API)
#3 - Performance Engineer - claude-sonnet-4 (API)
#4 - Codex Analyst - codex (CLI)
#5 - Developer (You) - human (HUMAN)
```

### 参与者列表展示

讨论开始时展示完整的参与者列表：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Discussion Participants (5 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security Experts (2):
  #1 - gpt-4o (API)
  #2 - claude-opus-4 (API)

Performance Analysis (1):
  #3 - Performance Engineer - claude-sonnet-4 (API)

Codebase Analysis (1):
  #4 - Codex Analyst - codex (CLI)

Human Participants (1):
  #5 - Developer (You) - human (HUMAN)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn Order: Round-robin (automatic)
Max Turns: 15
Language: Chinese (zh)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type 'help' for control commands, 'quit' to exit
Press Ctrl+P to pause and take manual control
```

---

## 讨论过程中的输出格式

### 常规轮次输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn 1/15 - #1 Security Expert (gpt-4o)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

我发现这段代码存在几个安全问题...

[输出内容]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Turn completed (1.2s, 234 tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 人类轮次输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Turn 5/15 - #5 Developer (You)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your turn to speak. Commands available:
  - Type your response (end with Ctrl+D or type 'EOF')
  - 'pass' - Skip this turn
  - 'ask #N' - Ask specific participant #N to respond
  - 'next #N' - Set participant #N to speak next
  - 'pause' - Pause discussion for manual control
  - 'summary' - Request a summary from all participants
  - 'help' - Show all commands

> _
```

---

## 动态控制命令

### 基本命令

#### 1. 指定下一个发言者
```bash
# 在您的轮次中
> next #3
# 下一轮将由 #3 Performance Engineer 发言

# 或者在讨论中按 Ctrl+P 暂停
[Paused] > next #3
```

#### 2. 直接询问某个参与者
```bash
> ask #1 关于SQL注入的问题，你有什么建议？
# 系统会立即让 #1 回答这个问题，然后继续正常轮次
```

#### 3. 请求多个参与者回答
```bash
> ask #1,#2 你们对这个安全漏洞的看法是什么？
# #1 和 #2 会依次回答
```

#### 4. 跳过当前轮次
```bash
> pass
# 跳过当前参与者的发言
```

#### 5. 请求总结
```bash
> summary
# 所有参与者依次给出简短总结
```

#### 6. 暂停/恢复
```bash
# 按 Ctrl+P 暂停
[Paused] Discussion paused. Commands available:
  - 'resume' - Resume discussion
  - 'next #N' - Set next speaker and resume
  - 'order #1,#3,#5' - Set custom turn order
  - 'add participant' - Add new participant
  - 'remove #N' - Remove participant
  - 'status' - Show current status
  - 'quit' - End discussion

[Paused] > next #4
Resuming discussion with #4 Codex Analyst...
```

#### 7. 显示参与者列表
```bash
> list
# 显示所有参与者及其编号
```

#### 8. 显示历史
```bash
> history
# 显示最近的对话历史

> history #3
# 显示 #3 的所有发言
```

---

## 同一角色多模型配置

### 设计理念

**✅ 推荐使用场景**：
1. **开发者角色** - 多个模型代表不同的开发者
2. **安全专家角色** - 不同模型有不同的安全知识侧重
3. **架构师角色** - 多个架构师提供不同视角

**⚠️ 需要注意的场景**：
- 避免完全相同的角色+模型+提示，会导致重复输出
- 确保每个实例有明确的差异化（系统提示或模型不同）

### 配置示例

#### 场景1：多开发者讨论（推荐）

```json
{
  "id": "multi-developer-review",
  "name": "Multi-Developer Code Review",
  "participants": [
    {
      "id": "dev-1",
      "role": "Senior Developer",
      "type": "api",
      "config": {
        "api": {
          "model": "gpt-4o",
          "temperature": 0.7
        },
        "systemPrompt": "You are a senior developer with 10+ years experience. Focus on architecture and best practices."
      }
    },
    {
      "id": "dev-2",
      "role": "Junior Developer",
      "type": "api",
      "config": {
        "api": {
          "model": "gpt-4o",
          "temperature": 0.8
        },
        "systemPrompt": "You are a junior developer eager to learn. Ask clarifying questions and focus on understanding the code."
      }
    },
    {
      "id": "dev-3",
      "role": "Developer (You)",
      "type": "human",
      "config": {
        "human": {
          "inputMode": "tty"
        }
      }
    }
  ]
}
```

展示效果：
```
Developers (3):
  #1 - Senior Developer - gpt-4o (API)
  #2 - Junior Developer - gpt-4o (API)
  #3 - Developer (You) - human (HUMAN)
```

#### 场景2：多安全专家视角（推荐）

```json
{
  "participants": [
    {
      "id": "sec-app",
      "role": "Application Security Expert",
      "type": "api",
      "config": {
        "api": { "model": "gpt-4o" },
        "systemPrompt": "Focus on application-level vulnerabilities: XSS, CSRF, SQL injection, authentication issues."
      }
    },
    {
      "id": "sec-infra",
      "role": "Infrastructure Security Expert",
      "type": "api",
      "config": {
        "api": { "model": "claude-opus-4" },
        "systemPrompt": "Focus on infrastructure security: network security, access control, secrets management, deployment security."
      }
    }
  ]
}
```

展示效果：
```
Security Experts (2):
  #1 - Application Security - gpt-4o (API)
  #2 - Infrastructure Security - claude-opus-4 (API)
```

#### 场景3：同一角色同一模型但不同视角（需谨慎）

```json
{
  "participants": [
    {
      "id": "arch-scalability",
      "role": "Architect (Scalability)",
      "type": "api",
      "config": {
        "api": {
          "model": "o1",
          "temperature": 0.3
        },
        "systemPrompt": "You are an architect focused exclusively on scalability and performance. Analyze horizontal scaling, load distribution, caching strategies."
      }
    },
    {
      "id": "arch-maintainability",
      "role": "Architect (Maintainability)",
      "type": "api",
      "config": {
        "api": {
          "model": "o1",
          "temperature": 0.3
        },
        "systemPrompt": "You are an architect focused exclusively on code maintainability and team productivity. Analyze modularity, testability, documentation."
      }
    }
  ]
}
```

### 效果评估

#### ✅ 优点

1. **多样化的观点**
   - 不同模型有不同的知识库和推理方式
   - 即使同一模型，不同的系统提示会产生不同视角

2. **更丰富的讨论**
   - 多个开发者可以形成真实的团队讨论氛围
   - 不同专家之间可能产生有建设性的分歧

3. **减少单一模型的局限性**
   - 某个模型可能在某方面有知识盲区
   - 多个模型可以互补

4. **更接近真实场景**
   - 真实的代码审查通常有多个开发者参与
   - 真实的架构讨论有多个架构师参与

#### ⚠️ 潜在问题

1. **成本增加**
   - 更多参与者 = 更多API调用 = 更高成本
   - 解决方案：使用 `gpt-4o-mini` 等低成本模型

2. **可能的重复内容**
   - 相似的模型可能给出相似的答案
   - 解决方案：通过系统提示明确差异化

3. **讨论时间变长**
   - 更多参与者 = 更多轮次
   - 解决方案：设置 `maxTurns` 限制

4. **输出质量不一定提升**
   - 有时候一个高质量专家胜过多个一般专家
   - 解决方案：提供质量评估和总结功能

### 推荐配置策略

#### 策略1：角色分层（推荐用于大型讨论）

```
Security (2 experts):
  #1 - Application Security - gpt-4o
  #2 - Infrastructure Security - claude-opus-4

Development (3 developers):
  #3 - Senior Developer - o1
  #4 - Mid-level Developer - gpt-4o
  #5 - Junior Developer - gpt-4o-mini

Quality (2 reviewers):
  #6 - Code Quality - claude-sonnet-4
  #7 - Testing Strategy - gpt-4o

Human (1):
  #8 - Tech Lead (You) - human
```

#### 策略2：专家互补（推荐用于深度分析）

```
Analysis (3 perspectives):
  #1 - Security Expert - gpt-4o
  #2 - Performance Expert - claude-opus-4
  #3 - Maintainability Expert - o1

Tools (1):
  #4 - Codex Analysis - codex (CLI)

Human (1):
  #5 - Developer (You) - human
```

#### 策略3：快速审查（推荐用于日常代码审查）

```
Reviewers (3):
  #1 - Security - gpt-4o
  #2 - Quality - gpt-4o-mini
  #3 - Performance - claude-sonnet-4

Human (1):
  #4 - Author (You) - human
```

---

## 技术实现

### 更新后的类型定义

```typescript
// 扩展 Participant 类型
interface Participant {
  id: string;
  number: number;              // 新增：参与者编号
  name: string;
  role: string;
  type: ParticipantType;
  config: ParticipantConfig;
  required: boolean;

  // 新增：分组信息
  group?: string;              // 用于分组展示，如 "Security Experts"
  priority?: number;           // 发言优先级 (1-10)
}

// 新增：讨论控制命令
interface DiscussionCommand {
  type: "next" | "ask" | "pass" | "summary" | "pause" | "resume" | "list" | "history";
  targetNumbers?: number[];    // 目标参与者编号
  message?: string;            // 附加消息
}

// 新增：参与者分组
interface ParticipantGroup {
  name: string;
  participants: Participant[];
  description?: string;
}
```

### 参与者编号分配逻辑

```typescript
function assignParticipantNumbers(
  participants: Participant[]
): Participant[] {
  return participants.map((p, index) => ({
    ...p,
    number: index + 1,
  }));
}

function groupParticipants(
  participants: Participant[]
): ParticipantGroup[] {
  const groups = new Map<string, Participant[]>();

  for (const p of participants) {
    const groupName = p.group || p.role;
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(p);
  }

  return Array.from(groups.entries()).map(([name, participants]) => ({
    name,
    participants,
  }));
}
```

### 参与者列表展示

```typescript
function displayParticipantList(
  participants: Participant[],
  language: Language
): void {
  const groups = groupParticipants(participants);

  console.log("━".repeat(70));
  console.log(`📋 ${t("Discussion Participants", language)} (${participants.length} total)`);
  console.log("━".repeat(70));
  console.log();

  for (const group of groups) {
    console.log(`${group.name} (${group.participants.length}):`);
    for (const p of group.participants) {
      const modelInfo = getModelInfo(p);
      console.log(`  #${p.number} - ${p.name} - ${modelInfo} (${p.type.toUpperCase()})`);
    }
    console.log();
  }

  console.log("━".repeat(70));
}
```

### 动态控制命令解析

```typescript
function parseControlCommand(input: string): DiscussionCommand | null {
  input = input.trim();

  // next #3
  if (input.startsWith("next #")) {
    const number = parseInt(input.slice(6));
    return { type: "next", targetNumbers: [number] };
  }

  // ask #1,#2 message
  if (input.startsWith("ask #")) {
    const parts = input.slice(5).split(/\s+/);
    const numbers = parts[0].split(",").map(n => parseInt(n.replace("#", "")));
    const message = parts.slice(1).join(" ");
    return { type: "ask", targetNumbers: numbers, message };
  }

  // Other commands...
  const simpleCommands = ["pass", "summary", "pause", "resume", "list", "history"];
  if (simpleCommands.includes(input)) {
    return { type: input as any };
  }

  return null;
}
```

---

## 使用示例

### 示例1：多开发者代码审查

```bash
xling d:start --scenario multi-developer-review --language zh

# 输出：
📋 讨论参与者 (5人)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

开发者 (3):
  #1 - 高级开发者 - gpt-4o (API)
  #2 - 中级开发者 - gpt-4o (API)
  #3 - 初级开发者 (你) - human (HUMAN)

安全专家 (1):
  #4 - 安全专家 - claude-opus-4 (API)

性能专家 (1):
  #5 - 性能专家 - claude-sonnet-4 (API)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Turn 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
轮次 1/15 - #1 高级开发者 (gpt-4o)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

从架构角度看，这段代码有几个需要改进的地方...
[内容]

# Turn 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
轮次 2/15 - #2 中级开发者 (gpt-4o)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

我同意 #1 的观点，另外我注意到...
[内容]

# Turn 3 - Your turn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
轮次 3/15 - #3 初级开发者 (你)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> ask #4 关于 #1 提到的安全问题，能详细说明一下吗？

# System immediately asks #4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
特别询问 - #4 安全专家 (claude-opus-4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

关于 #1 提到的安全问题，具体来说...
[详细安全分析]

# Continue with Turn 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
轮次 4/15 - #5 性能专家 (claude-sonnet-4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
```

### 示例2：手动控制讨论流程

```bash
# 讨论进行中，按 Ctrl+P 暂停
[已暂停] 讨论已暂停。可用命令：
  - 'resume' - 恢复讨论
  - 'next #N' - 指定下一个发言者并恢复
  - 'list' - 显示参与者列表
  - 'history' - 显示历史
  - 'quit' - 结束讨论

[已暂停] > list

参与者列表：
  #1 - 高级开发者 - gpt-4o (已发言 3次)
  #2 - 中级开发者 - gpt-4o (已发言 2次)
  #3 - 初级开发者 (你) - human (已发言 2次)
  #4 - 安全专家 - claude-opus-4 (已发言 1次)
  #5 - 性能专家 - claude-sonnet-4 (已发言 2次)

[已暂停] > next #4

恢复讨论，下一个发言者: #4 安全专家...
```

---

## 总结

### 核心改进

1. ✅ **参与者编号系统** - 清晰的 #N 编号
2. ✅ **分组展示** - 按角色分组显示参与者
3. ✅ **动态控制** - 人类可以指定发言者和控制流程
4. ✅ **同角色多模型** - 支持多个相同角色不同模型
5. ✅ **丰富的命令** - ask, next, pass, summary等

### 推荐配置

- **开发者角色**：多模型 ✅ 推荐
- **专家角色**：多模型 ✅ 推荐（不同专业方向）
- **单一角色**：多模型 ⚠️ 谨慎（确保差异化）

### 实施优先级

1. **Phase 1**：基础编号系统
2. **Phase 2**：动态控制命令
3. **Phase 3**：高级功能（分组、统计等）
