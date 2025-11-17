/**
 * Discussion with Code Context
 * Automatically includes relevant code files in the discussion
 */

import { DiscussionOrchestrator } from "../src/services/discuss/orchestrator.js";
import { ModelRouter } from "../src/services/prompt/router.js";
import { XlingAdapter } from "../src/services/settings/adapters/xling.js";
import { DiscussionStorage } from "../src/services/discuss/storage/discussionStorage.js";
import { displayParticipantList } from "../src/services/discuss/display/participantDisplay.js";
import type { DiscussionConfig } from "../src/domain/discuss/types.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Collect code context from specified files or directories
 */
function collectCodeContext(paths: string[], baseDir: string = process.cwd()): string {
  let context = "## 📁 Project Code Context\n\n";

  for (const filePath of paths) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);

    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const relativePath = path.relative(baseDir, fullPath);
          context += `### File: \`${relativePath}\`\n\`\`\`\n${content}\n\`\`\`\n\n`;
        } else if (stats.isDirectory()) {
          // Read all files in directory
          const files = fs.readdirSync(fullPath);
          for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
              const fileFullPath = path.join(fullPath, file);
              const content = fs.readFileSync(fileFullPath, "utf-8");
              const relativePath = path.relative(baseDir, fileFullPath);
              context += `### File: \`${relativePath}\`\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
            }
          }
        }
      } else {
        context += `### ⚠️ File not found: \`${filePath}\`\n\n`;
      }
    } catch (error) {
      context += `### ❌ Error reading \`${filePath}\`: ${(error as Error).message}\n\n`;
    }
  }

  return context;
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Xling Discuss - Discussion with Code Context\n");

  // 1. Specify files to include in discussion
  const filesToDiscuss = [
    "src/services/discuss/orchestrator.ts",
    "src/domain/discuss/types.ts",
    // Add more files as needed
  ];

  // 2. Collect code context
  console.log("📖 Collecting code context...");
  const codeContext = collectCodeContext(filesToDiscuss);

  // 3. Load configuration
  console.log("Loading configuration...");
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));
  const router = new ModelRouter(config);

  // 4. Create discussion configuration
  const discussionConfig: DiscussionConfig = {
    id: `discuss-code-${Date.now()}`,
    topic: "Code Review with Context",
    scenario: "code-review",
    language: "zh",
    participants: [
      {
        id: "architect",
        number: 1,
        name: "架构师",
        type: "api",
        role: "Code Architect",
        config: {
          api: {
            model: "claude-sonnet-4.5",
            temperature: 0.7,
          },
          systemPrompt: "你是架构师，分析代码结构、设计模式和架构决策。",
        },
        required: true,
      },
      {
        id: "reviewer",
        number: 2,
        name: "代码审查员",
        type: "api",
        role: "Code Reviewer",
        config: {
          api: {
            model: "gpt-4.1-mini",
            temperature: 0.6,
          },
          systemPrompt: "你是代码审查员，关注代码质量、可维护性和最佳实践。",
        },
        required: true,
      },
      // Codex can also read the codebase directly
      {
        id: "codex",
        number: 3,
        name: "Codex分析",
        type: "cli",
        role: "Deep Code Analyst",
        config: {
          cli: {
            tool: "codex",
            timeout: 180000,
            args: ["--config", "model_reasoning_effort=high"]
          },
          systemPrompt: "深度分析代码库，找出潜在问题和改进机会。",
        },
        required: false,
      },
    ],
    orchestration: {
      turnOrder: "round-robin",
      maxTurns: 6,
      allowSkip: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      projectPath: process.cwd(),
    },
  };

  // 5. Build initial prompt with code context
  const initialPrompt = `${codeContext}

## 🎯 讨论主题

请审查上述代码，重点关注：

1. **架构设计**：整体结构是否合理？是否遵循SOLID原则？
2. **代码质量**：是否有重复代码？命名是否清晰？
3. **性能考虑**：是否有潜在的性能瓶颈？
4. **可维护性**：代码是否易于理解和修改？
5. **最佳实践**：是否遵循TypeScript/JavaScript最佳实践？

请从各自的专业角度给出具体的改进建议。`;

  // 6. Display participants
  console.log(
    displayParticipantList(discussionConfig.participants, {
      language: discussionConfig.language,
      maxTurns: discussionConfig.orchestration.maxTurns,
      turnOrder: discussionConfig.orchestration.turnOrder,
    })
  );

  // 7. Create orchestrator
  const orchestrator = new DiscussionOrchestrator(router);

  // 8. Start discussion
  const context = await orchestrator.start(discussionConfig, initialPrompt);

  // 9. Run discussion loop
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

  // 10. Complete discussion
  orchestrator.complete();

  // 11. Save discussion history
  const storage = new DiscussionStorage();
  const savedPath = await storage.save(context, "project");

  console.log("\n📊 Discussion Statistics:");
  console.log(`   Total turns: ${context.turns.length}`);
  console.log(
    `   Duration: ${Math.round((Date.now() - context.startTime.getTime()) / 1000)}s`
  );
  console.log(`   Saved to: ${savedPath}`);

  console.log("\n✅ Discussion completed!");
}

// Run the example
main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
