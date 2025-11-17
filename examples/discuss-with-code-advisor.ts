/**
 * Dynamic Code Advisor Pattern
 *
 * Each participant can request specific code context from Codex
 * before generating their response.
 *
 * Flow:
 * 1. Participant identifies what code context they need
 * 2. Request sent to Codex (Code Advisor)
 * 3. Codex provides targeted code analysis
 * 4. Participant absorbs the context and generates response
 */

import { DiscussionOrchestrator } from "../src/services/discuss/orchestrator.js";
import { ModelRouter } from "../src/services/prompt/router.js";
import { XlingAdapter } from "../src/services/settings/adapters/xling.js";
import { DiscussionStorage } from "../src/services/discuss/storage/discussionStorage.js";
import { displayParticipantList } from "../src/services/discuss/display/participantDisplay.js";
import type { DiscussionConfig, DiscussionContext } from "../src/domain/discuss/types.js";
import { spawn } from "child_process";

/**
 * Code Advisor - Uses Codex to provide targeted code context
 */
class CodeAdvisor {
  private cache: Map<string, string> = new Map();

  /**
   * Request specific code context from Codex
   */
  async requestCodeContext(request: {
    topic: string;
    specificNeeds: string[];
    focus?: string;
  }): Promise<string> {
    const cacheKey = JSON.stringify(request);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`    ↻ Using cached code context for: ${request.topic}`);
      return this.cache.get(cacheKey)!;
    }

    console.log(`    🔍 Codex analyzing: ${request.topic}...`);

    const prompt = this.buildCodeRequestPrompt(request);
    const context = await this.queryCodex(prompt);

    // Cache the result
    this.cache.set(cacheKey, context);

    return context;
  }

  /**
   * Build prompt for Codex based on participant's needs
   */
  private buildCodeRequestPrompt(request: {
    topic: string;
    specificNeeds: string[];
    focus?: string;
  }): string {
    return `
请分析 xling 项目中关于「${request.topic}」的代码，重点关注：

${request.specificNeeds.map((need, i) => `${i + 1}. ${need}`).join('\n')}

${request.focus ? `\n特别关注：${request.focus}\n` : ''}

请提供：
1. 相关代码文件和位置
2. 关键代码片段（带行号）
3. 实现细节说明
4. 潜在问题或改进点

**限制**：
- 控制在 800-1000 tokens 以内
- 只包含与主题直接相关的内容
- 代码片段要精选，不要全部列出
`;
  }

  /**
   * Query Codex for code analysis
   */
  private async queryCodex(prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const codexProcess = spawn(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "-m", "gpt-5.1-codex",
          "--config", "model_reasoning_effort=medium", // Medium for faster response
          "--full-auto",
          prompt
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
          console.log(`    ✓ Code context retrieved`);
          resolve(stdout.trim());
        } else {
          console.warn(`    ⚠ Codex query failed, continuing without context`);
          resolve("⚠️ 无法获取代码上下文，将基于一般理解分析。");
        }
      });

      codexProcess.on("error", (error) => {
        console.warn(`    ⚠ Codex not available: ${error.message}`);
        resolve("⚠️ Codex 不可用，将基于一般理解分析。");
      });
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Enhanced Participant Configuration with Code Needs
 */
interface EnhancedParticipantConfig {
  id: string;
  number: number;
  name: string;
  type: "api";
  role: string;
  config: {
    api: {
      model: string;
      temperature: number;
    };
    systemPrompt: string;
  };
  // NEW: Define what code context this participant needs
  codeNeeds?: {
    topic: string;
    specificNeeds: string[];
    focus?: string;
  };
  required: boolean;
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Dynamic Code Advisor Discussion\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Initialize Code Advisor
  const codeAdvisor = new CodeAdvisor();

  // Load configuration
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));
  const router = new ModelRouter(config);

  // Enhanced participant configuration with code needs
  const participants: EnhancedParticipantConfig[] = [
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
你将接收关于代码结构和设计的上下文信息。
请基于这些信息分析架构设计的合理性、可扩展性和维护性。`,
      },
      // Define what code context this architect needs
      codeNeeds: {
        topic: "discuss 功能的整体架构",
        specificNeeds: [
          "orchestrator.ts 的核心设计",
          "参与者驱动模式的实现",
          "模块间的依赖关系",
          "扩展点和接口设计"
        ],
        focus: "架构模式和设计原则"
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
你将接收关于安全相关代码的上下文信息。
请识别安全风险、漏洞和改进建议。`,
      },
      // Security expert needs different code context
      codeNeeds: {
        topic: "CLI 工具调用和用户输入处理",
        specificNeeds: [
          "cliParticipant.ts 中的命令执行",
          "humanParticipant.ts 中的用户输入处理",
          "输入验证和清理逻辑",
          "错误处理和异常管理"
        ],
        focus: "安全漏洞和注入攻击"
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
你将接收关于性能关键路径的代码信息。
请分析性能瓶颈和优化机会。`,
      },
      // Performance engineer needs yet another perspective
      codeNeeds: {
        topic: "讨论循环和 API 调用",
        specificNeeds: [
          "executeTurn() 的实现细节",
          "API 调用的并发处理",
          "内存管理和资源释放",
          "存储操作的性能"
        ],
        focus: "性能瓶颈和优化空间"
      },
      required: true,
    },
  ];

  // Create standard discussion config
  const discussionConfig: DiscussionConfig = {
    id: `discuss-advisor-${Date.now()}`,
    topic: "Discuss 功能代码审查（动态代码顾问模式）",
    scenario: "code-review",
    language: "zh",
    participants: participants.map(p => ({
      id: p.id,
      number: p.number,
      name: p.name,
      type: p.type,
      role: p.role,
      config: p.config,
      required: p.required
    })),
    orchestration: {
      turnOrder: "round-robin",
      maxTurns: 6,
      allowSkip: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      projectPath: process.cwd(),
      tags: ["code-review", "dynamic-advisor", "on-demand"],
    },
  };

  // Initial prompt
  const initialPrompt = `
# 🎯 讨论任务：Discuss 功能代码审查

请从各自的专业角度审查 xling 的 discuss 功能实现。

**注意**：每位专家会先接收针对性的代码上下文（由 Codex 提供），然后再进行分析。

## 讨论重点

### 架构师
- 评估整体架构设计
- 分析设计模式的应用
- 评估可扩展性和可维护性

### 安全专家
- 识别安全风险和漏洞
- 评估输入验证和错误处理
- 提供安全加固建议

### 性能工程师
- 识别性能瓶颈
- 分析资源使用效率
- 提供优化建议

请基于你们接收到的代码上下文进行深入分析。
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

  console.log("\n🗣️  Starting discussion with dynamic code advisor...\n");

  // Custom discussion loop with code advisor integration
  let turnIndex = 0;
  while (!orchestrator.shouldTerminate()) {
    try {
      const participant = participants[turnIndex % participants.length];

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Turn ${turnIndex + 1}/${discussionConfig.orchestration.maxTurns} - #${participant.number} ${participant.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // STEP 1: Request code context from Codex (if needed)
      let codeContext = "";
      if (participant.codeNeeds && turnIndex < 3) { // First round gets code context
        console.log(`  📥 Requesting code context for ${participant.name}...`);
        codeContext = await codeAdvisor.requestCodeContext(participant.codeNeeds);
        console.log(`  ✓ Code context received (${codeContext.length} chars)\n`);
      }

      // STEP 2: Build enhanced prompt with code context
      const enhancedPrompt = codeContext
        ? `
## 📄 针对你的代码上下文

${codeContext}

---

## 💭 请基于上述代码上下文进行分析

${turnIndex === 0 ? initialPrompt : '请继续你的专业分析。'}
`
        : (turnIndex === 0 ? initialPrompt : '请继续你的专业分析。');

      // STEP 3: Execute turn with enhanced context
      await orchestrator.executeTurn(enhancedPrompt);

      turnIndex++;
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
  console.log(`   Codex queries: ${turnIndex}`);
  console.log(`   Saved to: ${savedPath}`);

  console.log("\n✅ Dynamic code advisor discussion completed!");
  console.log("\n💡 Benefits of this approach:");
  console.log("   ✓ Each expert gets precisely the code they need");
  console.log("   ✓ No context wasted on irrelevant information");
  console.log("   ✓ More targeted and accurate analysis");
  console.log("   ✓ Efficient use of token limits");
}

// Run the example
main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
