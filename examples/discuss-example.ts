/**
 * Example: Multi-Role AI Discussion
 *
 * This example demonstrates how to use the Discuss system to create
 * a multi-role discussion with various AI models and yourself.
 *
 * Usage:
 *   bun run examples/discuss-example.ts
 */

import { DiscussionOrchestrator } from "../src/services/discuss/orchestrator.js";
import { ModelRouter } from "../src/services/prompt/router.js";
import { DiscussionStorage } from "../src/services/discuss/storage/discussionStorage.js";
import { XlingAdapter } from "../src/services/settings/adapters/xling.js";
import { displayParticipantList } from "../src/services/discuss/display/participantDisplay.js";
import type { DiscussionConfig } from "../src/domain/discuss/types.js";

/**
 * Main function
 */
async function main() {
  console.log("🚀 Xling Discuss - Multi-Role AI Discussion Example\n");

  // 1. Load xling configuration
  console.log("Loading configuration...");
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));

  // 2. Create ModelRouter
  const router = new ModelRouter(config);

  // 3. Create discussion configuration
  const discussionConfig: DiscussionConfig = {
    id: `discuss-${Date.now()}`,
    topic: "Code Security Review",
    scenario: "code-review",
    language: "zh", // Use Chinese
    participants: [
      {
        id: "sec-1",
        number: 1,
        name: "Security Expert",
        type: "api",
        role: "Security Expert",
        config: {
          api: {
            model: "claude-sonnet-4.5", // Using Claude Sonnet for security analysis
            temperature: 0.7,
          },
          systemPrompt: "You are a security expert. Focus on finding vulnerabilities like SQL injection, XSS, authentication issues, and other security concerns. Be specific and provide actionable recommendations.",
        },
        required: true,
      },
      {
        id: "perf-1",
        number: 2,
        name: "Performance Engineer",
        type: "api",
        role: "Performance Engineer",
        config: {
          api: {
            model: "gpt-4.1-mini", // Using GPT-4.1-mini for performance analysis
            temperature: 0.6,
          },
          systemPrompt: "You are a performance engineer. Analyze algorithmic complexity, database queries, memory usage, and identify performance bottlenecks.",
        },
        required: true,
      },
      // Codex CLI - CAN READ YOUR CODEBASE!
      {
        id: "codex-1",
        number: 3,
        name: "Codex Analyst",
        type: "cli",
        role: "Codebase Analyst",
        config: {
          cli: {
            tool: "codex",
            timeout: 180000,
            args: ["--config", "model_reasoning_effort=medium"]
          },
          systemPrompt: "Analyze the codebase for patterns, consistency, and suggest improvements based on existing code structure.",
        },
        required: false, // Won't fail if codex not available
      },
    ],
    orchestration: {
      turnOrder: "round-robin",
      maxTurns: 4, // Short demo
      allowSkip: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      projectPath: process.cwd(),
    },
  };

  // Initial prompt for the discussion - 讨论真实的代码库
  const initialPrompt = `请审查 xling 项目中的 discuss 功能实现，重点关注：

1. **架构设计**：
   - orchestrator.ts 的设计是否合理？
   - 参与者驱动模式是否易于扩展？
   - 类型系统设计是否完善？

2. **代码质量**：
   - 是否有重复代码或可以提取的公共逻辑？
   - 错误处理是否完善？
   - 命名和注释是否清晰？

3. **性能考虑**：
   - 讨论循环是否高效？
   - 是否有潜在的内存泄漏？
   - API 调用是否可以优化？

4. **安全性**：
   - CLI 工具调用是否安全？
   - 用户输入处理是否安全？
   - 文件存储是否有安全风险？

请从各自的专业角度分析这个代码库并给出具体建议。Codex 可以直接分析代码库，其他专家请基于整体理解提供意见。`;

  // 4. Display participants
  console.log(
    displayParticipantList(discussionConfig.participants, {
      language: discussionConfig.language,
      maxTurns: discussionConfig.orchestration.maxTurns,
      turnOrder: discussionConfig.orchestration.turnOrder,
    })
  );

  // 5. Create orchestrator
  const orchestrator = new DiscussionOrchestrator(router);

  // 6. Start discussion
  const context = await orchestrator.start(discussionConfig, initialPrompt);

  // 7. Run discussion loop
  console.log("\n🗣️  Starting discussion...\n");

  while (!orchestrator.shouldTerminate()) {
    try {
      await orchestrator.executeTurn();
    } catch (error) {
      console.error("❌ Turn failed:", error instanceof Error ? error.message : error);
      break;
    }
  }

  // 8. Complete discussion
  orchestrator.complete();

  // 9. Save discussion history
  const storage = new DiscussionStorage();
  const savedPath = await storage.save(context, "project");

  console.log("\n📊 Discussion Statistics:");
  console.log(`   Total turns: ${context.turns.length}`);
  console.log(`   Duration: ${Math.round((Date.now() - context.startTime.getTime()) / 1000)}s`);
  console.log(`   Saved to: ${savedPath}`);

  console.log("\n✅ Example completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Check the saved discussion in .claude/discuss/history/");
  console.log("2. Modify the discussion config to add more participants");
  console.log("3. Try adding a human participant to join the discussion");
  console.log("4. Use different scenarios from src/domain/discuss/scenarios.ts");
}

// Run the example
main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
