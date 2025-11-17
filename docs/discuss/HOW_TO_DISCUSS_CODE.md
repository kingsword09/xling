# 如何用 Discuss 讨论您的代码

## 🎯 问题：AI 无法读取代码？

**解决了！** 有 3 种方式让 AI 参与者访问您的代码：

---

## ✅ 方式 1: Codex CLI（最强大）

**Codex 可以直接读取整个代码库！**

### 配置
```typescript
{
  type: "cli",
  config: {
    cli: {
      tool: "codex",
      timeout: 180000,
      args: ["--config", "model_reasoning_effort=high"]
    },
    systemPrompt: "分析代码库结构、模式和潜在问题。"
  },
  required: false  // 如果 codex 不可用也不会失败
}
```

### 使用
```bash
# 直接运行，Codex 会自动分析代码库
bun run examples/discuss-example.ts
```

### 优势
- ✅ 可以访问整个代码库
- ✅ 可以理解代码结构和依赖关系
- ✅ 可以进行深度分析
- ✅ 不需要手动指定文件

---

## ✅ 方式 2: 自动包含代码文件

使用 `discuss-with-code.ts` 脚本自动收集代码。

### 配置文件列表
```typescript
const filesToDiscuss = [
  "src/services/discuss/orchestrator.ts",
  "src/domain/discuss/types.ts",
  "src/services/discuss/participants/",  // 整个目录
  "examples/discuss-example.ts",
];
```

### 运行
```bash
bun run examples/discuss-with-code.ts
```

### 优势
- ✅ API 参与者也能看到代码
- ✅ 可以精确控制包含哪些文件
- ✅ 适合讨论特定文件
- ✅ 所有参与者看到相同的上下文

---

## ✅ 方式 3: 在 Prompt 中手动包含

直接在 `initialPrompt` 中包含代码片段。

### 示例
```typescript
const initialPrompt = `
请审查以下代码：

\`\`\`typescript
// 您的代码
export class DiscussionOrchestrator {
  // ...
}
\`\`\`

请分析：
1. 架构设计
2. 性能问题
3. 安全风险
`;
```

### 优势
- ✅ 最灵活
- ✅ 可以添加具体说明
- ✅ 适合小代码片段

---

## 🎬 实战示例

### 示例 1: 讨论整个功能模块

```typescript
// 使用 Codex + API 参与者
const discussionConfig = {
  topic: "Discuss 功能代码审查",
  language: "zh",
  participants: [
    {
      name: "Codex 深度分析",
      type: "cli",
      config: { cli: { tool: "codex" } }
    },
    {
      name: "架构师",
      type: "api",
      config: { api: { model: "claude-sonnet-4.5" } }
    },
    {
      name: "安全专家",
      type: "api",
      config: { api: { model: "gpt-4.1-mini" } }
    }
  ]
};

const initialPrompt = `
请审查 src/services/discuss/ 目录下的实现：
1. 架构设计是否合理？
2. 是否有安全风险？
3. 性能如何优化？
`;
```

### 示例 2: 讨论特定文件

```typescript
// 使用代码收集脚本
const filesToDiscuss = [
  "src/services/discuss/orchestrator.ts"
];

const initialPrompt = `
请审查 orchestrator.ts 的实现：
1. 类设计是否符合 SOLID 原则？
2. 错误处理是否完善？
3. 是否有可以改进的地方？
`;
```

### 示例 3: Bug 分析

```typescript
const initialPrompt = `
我在 orchestrator.ts:127 发现一个 bug：

\`\`\`typescript
const participant = this.getNextParticipant();
// 这里没有检查 null
await driver.execute(context, prompt);
\`\`\`

请分析：
1. 为什么会出现这个问题？
2. 如何修复？
3. 如何避免类似问题？
`;
```

---

## 💡 最佳实践

### 1. 合理使用 Codex
```typescript
// ✅ 好：让 Codex 做深度分析
{
  type: "cli",
  systemPrompt: "分析整个 discuss 模块的代码库一致性和架构模式"
}

// ❌ 不好：Codex 只是简单评论
{
  type: "cli",
  systemPrompt: "说这段代码很好"
}
```

### 2. 结合使用多种方式
```typescript
// Codex 分析整体
// API 参与者关注特定代码片段
participants: [
  { type: "cli", name: "Codex 整体分析" },
  { type: "api", name: "架构师看特定文件" }
]
```

### 3. 明确讨论范围
```typescript
const initialPrompt = `
代码范围：src/services/discuss/
重点关注：orchestrator.ts 和 participants/

请分析：
1. [具体问题]
2. [具体问题]
`;
```

---

## 🔧 故障排除

### Codex 不可用
```typescript
// 设置为可选
{
  type: "cli",
  required: false  // 不会因 Codex 不可用而失败
}
```

### 代码文件太大
```typescript
// 只包含关键文件
const filesToDiscuss = [
  "src/services/discuss/orchestrator.ts",  // 核心文件
  // 不要包含整个 node_modules
];
```

### Token 限制
```typescript
// 使用更大的模型或减少代码量
{
  api: {
    model: "claude-sonnet-4.5",  // 更大的上下文
    maxTokens: 8000
  }
}
```

---

## 📚 更多资源

- [Codex 文档](https://docs.factorcode.ai/codex)
- [讨论系统文档](./README.md)
- [快速开始指南](../../QUICK_START.md)

---

**现在您可以让 AI 真正读取和理解您的代码了！** 🎉
