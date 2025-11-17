/**
 * Two-Stage Discussion: Preprocessing + Discussion
 *
 * Stage 1: Codex analyzes codebase and generates summary
 * Stage 2: All participants discuss based on the summary
 */

import { DiscussionOrchestrator } from "../src/services/discuss/orchestrator.js";
import { ModelRouter } from "../src/services/prompt/router.js";
import { XlingAdapter } from "../src/services/settings/adapters/xling.js";
import { DiscussionStorage } from "../src/services/discuss/storage/discussionStorage.js";
import { displayParticipantList } from "../src/services/discuss/display/participantDisplay.js";
import type { DiscussionConfig } from "../src/domain/discuss/types.js";
import { spawn } from "child_process";

/**
 * Stage 1: Use Codex to analyze codebase and generate summary
 */
async function generateCodeSummary(analysisPrompt: string): Promise<string> {
  console.log("🔍 Stage 1: Codex analyzing codebase...\n");

  return new Promise<string>((resolve, reject) => {
    const codexProcess = spawn(
      "codex",
      [
        "exec",
        "--skip-git-repo-check",
        "-m", "gpt-5.1-codex",
        "--config", "model_reasoning_effort=high",
        "--full-auto",
        analysisPrompt
      ],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";

    codexProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    codexProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    codexProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Codex analysis completed\n");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        resolve(stdout.trim());
      } else {
        reject(new Error(`Codex failed with code ${code}: ${stderr}`));
      }
    });

    codexProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn Codex: ${error.message}`));
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Two-Stage Discussion: Preprocessing + Discussion\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ============================================================================
  // STAGE 1: Codex Preprocessing
  // ============================================================================

  const analysisPrompt = `
请分析 xling 项目中的 discuss 功能实现，生成一份结构化的代码摘要，包括：

## 📋 请提供以下信息：

### 1. 代码结构概览
- 主要模块和文件列表
- 目录结构
- 关键类和接口

### 2. 架构设计
- 整体架构模式（如 MVC、分层架构等）
- 设计模式使用（如工厂模式、策略模式等）
- 模块间依赖关系

### 3. 核心功能
- orchestrator.ts 的核心职责
- 参与者驱动系统如何工作
- 讨论流程控制机制

### 4. 关键代码片段
- 最重要的 3-5 个代码片段（带行号）
- 每个片段的作用说明

### 5. 潜在问题
- 代码质量问题
- 性能瓶颈
- 安全隐患
- 可维护性问题

### 6. 改进建议（简要）
- 3-5 个最重要的改进点
- 优先级排序

**请将摘要控制在 2000 tokens 以内，以便其他模型使用。**
**重点关注架构和设计，不要列举所有细节。**
`;

  let codeSummary: string;
  try {
    codeSummary = await generateCodeSummary(analysisPrompt);
  } catch (error) {
    console.error("❌ Codex preprocessing failed:", error);
    console.log("\n⚠️  Falling back to discussion without preprocessing...\n");
    codeSummary = "⚠️ Codex 分析失败，讨论将基于一般性理解进行。";
  }

  // ============================================================================
  // STAGE 2: Multi-Model Discussion
  // ============================================================================

  console.log("💬 Stage 2: Starting multi-model discussion...\n");

  // Load configuration
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));
  const router = new ModelRouter(config);

  // Create discussion configuration
  const discussionConfig: DiscussionConfig = {
    id: `discuss-preprocessed-${Date.now()}`,
    topic: "Discuss 功能代码审查（基于 Codex 分析）",
    scenario: "code-review",
    language: "zh",
    participants: [
      {
        id: "architect",
        number: 1,
        name: "架构师",
        type: "api",
        role: "System Architect",
        config: {
          api: {
            model: "claude-sonnet-4.5",
            temperature: 0.7,
          },
          systemPrompt: `你是资深系统架构师。
你将看到 Codex 对代码库的分析摘要。
基于这个摘要，从架构角度评估设计质量、可扩展性和维护性。
提供具体、可操作的改进建议。`,
        },
        required: true,
      },
      {
        id: "security",
        number: 2,
        name: "安全专家",
        type: "api",
        role: "Security Expert",
        config: {
          api: {
            model: "gpt-4.1-mini",
            temperature: 0.6,
          },
          systemPrompt: `你是安全专家。
基于 Codex 的代码分析，识别安全风险和漏洞。
重点关注：注入攻击、权限控制、数据验证、敏感信息泄露。
提供修复方案和安全最佳实践建议。`,
        },
        required: true,
      },
      {
        id: "performance",
        number: 3,
        name: "性能工程师",
        type: "api",
        role: "Performance Engineer",
        config: {
          api: {
            model: "gpt-4.1-mini",
            temperature: 0.6,
          },
          systemPrompt: `你是性能工程师。
基于 Codex 的代码分析，识别性能瓶颈和优化机会。
重点关注：算法复杂度、内存使用、并发处理、资源管理。
提供性能优化建议和最佳实践。`,
        },
        required: true,
      },
      // 可选：添加人类参与者
      // {
      //   id: "developer",
      //   number: 4,
      //   name: "开发者（你）",
      //   type: "human",
      //   role: "Developer",
      //   config: {
      //     human: { inputMode: "tty" }
      //   },
      //   required: true,
      // },
    ],
    orchestration: {
      turnOrder: "round-robin",
      maxTurns: 6,
      allowSkip: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      projectPath: process.cwd(),
      tags: ["code-review", "preprocessing", "two-stage"],
    },
  };

  // Build initial prompt with Codex summary
  const initialPrompt = `
# 📊 Codex 代码分析摘要

${codeSummary}

---

# 🎯 讨论任务

基于上述 Codex 的分析，请从各自的专业角度深入讨论：

## 架构师
- 评估整体架构设计的合理性
- 识别设计模式的使用是否恰当
- 提出架构层面的改进建议
- 评估可扩展性和可维护性

## 安全专家
- 基于代码结构识别潜在安全风险
- 评估输入验证和错误处理
- 检查权限控制和数据保护
- 提供安全加固建议

## 性能工程师
- 识别性能瓶颈和优化机会
- 评估算法效率和资源使用
- 分析并发处理和异步操作
- 提供性能优化方案

**请基于 Codex 提供的信息进行分析，如需要具体代码细节，请明确指出。**
`;

  // Display participants
  console.log(
    displayParticipantList(discussionConfig.participants, {
      language: discussionConfig.language,
      maxTurns: discussionConfig.orchestration.maxTurns,
      turnOrder: discussionConfig.orchestration.turnOrder,
    })
  );

  // Create orchestrator
  const orchestrator = new DiscussionOrchestrator(router);

  // Start discussion
  const context = await orchestrator.start(discussionConfig, initialPrompt);

  // Run discussion loop
  console.log("\n🗣️  Starting discussion...\n");

  while (!orchestrator.shouldTerminate()) {
    try {
      await orchestrator.executeTurn();
    } catch (error) {
      console.error(
        "❌ Turn failed:",
        error instanceof Error ? error.message : error
      );
      break;
    }
  }

  // Complete discussion
  orchestrator.complete();

  // Save discussion history
  const storage = new DiscussionStorage();
  const savedPath = await storage.save(context, "project");

  console.log("\n📊 Discussion Statistics:");
  console.log(`   Total turns: ${context.turns.length}`);
  console.log(
    `   Duration: ${Math.round((Date.now() - context.startTime.getTime()) / 1000)}s`
  );
  console.log(`   Saved to: ${savedPath}`);

  console.log("\n✅ Two-stage discussion completed!");
  console.log("\n💡 Summary:");
  console.log("   Stage 1: Codex analyzed codebase and generated summary");
  console.log("   Stage 2: Multiple experts discussed based on summary");
  console.log("\n📚 Benefits:");
  console.log("   ✓ All participants have same code understanding");
  console.log("   ✓ Efficient use of context windows");
  console.log("   ✓ Focused high-level discussion");
}

// Run the example
main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
