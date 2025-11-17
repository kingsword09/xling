# 代码讨论策略对比

## 问题背景

xling p 的 API 模型（如 GPT-4.1-mini）上下文窗口较小，无法直接处理整个代码库。如何让它们有效参与代码讨论？

---

## 🎯 方案对比

### 方案 1: 两阶段预处理（推荐 ⭐⭐⭐⭐⭐）

**流程：**
```
阶段 1: Codex 分析整个代码库 → 生成结构化摘要（2000 tokens）
阶段 2: 所有模型基于摘要进行讨论
```

**优点：**
- ✅ 所有参与者获得相同的代码理解
- ✅ 高效利用上下文窗口
- ✅ 讨论聚焦在高层次设计和架构
- ✅ 适合代码审查、架构讨论、设计评审

**缺点：**
- ⚠️ 需要 Codex 可用
- ⚠️ 摘要可能丢失细节
- ⚠️ 增加一次预处理时间（~30-60秒）

**适用场景：**
- 代码审查
- 架构设计讨论
- 重构方案评估
- 技术债务分析

**实现：**
```bash
bun run examples/discuss-with-preprocessing.ts
```

**摘要示例：**
```markdown
## 代码结构
- src/services/discuss/orchestrator.ts (320行) - 核心编排器
- src/domain/discuss/types.ts (400行) - 类型系统
- src/services/discuss/participants/ - 参与者驱动

## 架构模式
- 策略模式: ParticipantDriver 接口
- 工厂模式: createDriver() 方法
- 观察者模式: 事件系统

## 关键代码
orchestrator.ts:74-95 - executeTurn() 核心逻辑
...

## 潜在问题
1. 缺少并发控制
2. 错误恢复机制不完善
3. 内存管理需要优化
```

---

### 方案 2: 按需代码注入（灵活 ⭐⭐⭐⭐）

**流程：**
```
讨论开始 → 参与者提出问题 → 动态添加相关代码片段 → 继续讨论
```

**优点：**
- ✅ 灵活，按需提供信息
- ✅ 节省 tokens
- ✅ 可以深入具体细节
- ✅ 不需要预处理

**缺点：**
- ⚠️ 需要人工介入选择代码
- ⚠️ 上下文可能碎片化
- ⚠️ 讨论流程较慢

**适用场景：**
- Bug 分析
- 特定功能深度讨论
- 交互式代码审查

**实现策略：**
```typescript
// 在讨论过程中动态添加
if (needMoreContext) {
  const relevantCode = extractCodeSnippet("orchestrator.ts", 74, 95);
  await orchestrator.executeTurn(`
    参考以下代码：
    ${relevantCode}

    请继续分析...
  `);
}
```

---

### 方案 3: 分层讨论（全面 ⭐⭐⭐⭐）

**流程：**
```
第一层: Codex 深度分析（完整代码访问）
第二层: 基于分析的架构讨论（所有参与者）
第三层: 针对具体问题的详细讨论（相关参与者）
```

**优点：**
- ✅ 结合了深度分析和广泛讨论
- ✅ 层次清晰，便于追踪
- ✅ 可以处理复杂问题

**缺点：**
- ⚠️ 流程复杂
- ⚠️ 耗时较长
- ⚠️ 需要精心设计层次

**适用场景：**
- 大型重构项目
- 架构升级评估
- 复杂问题分析

---

### 方案 4: 混合问答模式（交互 ⭐⭐⭐）

**流程：**
```
Codex 作为"顾问" → 其他参与者可以 @Codex 提问 → Codex 提供具体信息
```

**优点：**
- ✅ 高度交互
- ✅ 精确获取需要的信息
- ✅ 充分利用 Codex 能力

**缺点：**
- ⚠️ 需要实现问答机制
- ⚠️ 讨论流程复杂
- ⚠️ Codex 调用次数多

**适用场景：**
- 探索式代码分析
- 学习代码库
- 疑难问题排查

**实现示例：**
```typescript
// 参与者发言
"@Codex 请分析 orchestrator.ts 的错误处理机制"

// Codex 响应
"经过分析，错误处理主要在以下位置：
1. Line 145: try-catch 块
2. Line 210: 错误传播
建议: 添加错误恢复机制..."

// 继续讨论
"基于 Codex 的分析，我建议..."
```

---

### 方案 5: 代码嵌入向量搜索（先进 ⭐⭐⭐⭐⭐）

**流程：**
```
预处理: 将代码转换为向量嵌入 → 存储在向量数据库
讨论时: 基于语义搜索相关代码 → 动态注入上下文
```

**优点：**
- ✅ 智能检索相关代码
- ✅ 高效利用上下文
- ✅ 可扩展到大型代码库
- ✅ 语义理解准确

**缺点：**
- ⚠️ 需要额外基础设施（向量数据库）
- ⚠️ 初始化成本高
- ⚠️ 实现复杂

**适用场景：**
- 大型企业级代码库
- 长期维护的项目
- 需要频繁代码讨论

**技术栈：**
- 嵌入模型: OpenAI embeddings / Cohere
- 向量数据库: Pinecone / Weaviate / Qdrant
- 代码分块策略: AST 解析

---

## 📊 方案对比表

| 方案 | 实现难度 | 效果 | 成本 | 适用场景 | 推荐度 |
|------|---------|------|------|---------|--------|
| 两阶段预处理 | 低 | 高 | 中 | 通用代码审查 | ⭐⭐⭐⭐⭐ |
| 按需注入 | 低 | 中 | 低 | Bug分析 | ⭐⭐⭐⭐ |
| 分层讨论 | 中 | 高 | 高 | 复杂项目 | ⭐⭐⭐⭐ |
| 混合问答 | 中 | 高 | 高 | 探索式分析 | ⭐⭐⭐ |
| 向量搜索 | 高 | 极高 | 高 | 大型代码库 | ⭐⭐⭐⭐⭐ |

---

## 🎯 推荐策略

### 对于 xling 项目

**当前推荐：方案 1（两阶段预处理）**

**理由：**
1. ✅ Codex 已集成，可直接使用
2. ✅ 实现简单，效果好
3. ✅ 适合中小型代码库
4. ✅ 成本可控

**未来可考虑：方案 5（向量搜索）**

**条件：**
- 代码库变大（>100k lines）
- 讨论频率高（每天多次）
- 需要更精确的代码检索

---

## 💡 实施建议

### 1. 优化 Codex 摘要质量

**摘要模板：**
```markdown
## 结构（200 tokens）
- 目录树
- 主要模块

## 架构（300 tokens）
- 设计模式
- 依赖关系

## 关键代码（500 tokens）
- 5个最重要片段
- 每个50-100 tokens

## 问题（300 tokens）
- 3-5个主要问题
- 每个50-60 tokens

## 建议（200 tokens）
- 3-5个改进点
- 每个30-40 tokens

总计：~1500 tokens
```

### 2. 动态调整摘要粒度

```typescript
const summaryLevel = {
  overview: "high-level structure only",
  detailed: "include key code snippets",
  deep: "comprehensive analysis"
};

// 根据讨论主题选择
if (topic === "architecture") {
  level = summaryLevel.overview;
} else if (topic === "bug-fix") {
  level = summaryLevel.deep;
}
```

### 3. 缓存常用摘要

```typescript
// 缓存代码摘要，避免重复生成
const summaryCache = new Map();

async function getCachedSummary(codeHash: string) {
  if (summaryCache.has(codeHash)) {
    return summaryCache.get(codeHash);
  }
  const summary = await generateSummary();
  summaryCache.set(codeHash, summary);
  return summary;
}
```

### 4. 支持增量更新

```typescript
// 只分析变更的文件
async function updateSummary(changedFiles: string[]) {
  const partialSummary = await analyzeFiles(changedFiles);
  return mergeSummaries(existingSummary, partialSummary);
}
```

---

## 🔧 实现示例

### 基础版（立即可用）

```bash
# 使用两阶段预处理
bun run examples/discuss-with-preprocessing.ts
```

### 高级版（定制化）

创建自己的预处理脚本：

```typescript
import { generateCodeSummary } from "./preprocessing.js";

// 1. 生成摘要
const summary = await generateCodeSummary({
  focus: "security",  // 关注点
  depth: "detailed",  // 深度
  maxTokens: 2000     // 限制
});

// 2. 开始讨论
await startDiscussion({
  initialContext: summary,
  participants: [...]
});
```

---

## 📈 未来增强

### 1. 智能摘要生成

使用 AI 自动判断需要包含哪些代码：

```typescript
const smartSummary = await generateSmartSummary({
  codebase: "./src",
  discussionTopic: "performance optimization",
  participantExpertise: ["architect", "performance-engineer"]
});
// → 自动选择性能相关的代码片段
```

### 2. 实时代码同步

讨论过程中实时更新代码变更：

```typescript
watchCodeChanges((change) => {
  notifyDiscussionParticipants(change);
  updateContextIfRelevant(change);
});
```

### 3. 多代码库支持

讨论涉及多个仓库：

```typescript
const summary = await generateMultiRepoSummary([
  "xling",
  "xling-plugins",
  "xling-docs"
]);
```

---

## 📚 相关资源

- [两阶段讨论示例](../../examples/discuss-with-preprocessing.ts)
- [代码上下文收集](../../examples/discuss-with-code.ts)
- [Codex 文档](https://docs.factorcode.ai/codex)

---

**总结：使用两阶段预处理策略，让小上下文模型也能有效参与代码讨论！**
