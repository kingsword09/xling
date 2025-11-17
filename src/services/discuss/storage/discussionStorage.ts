/**
 * Discussion Storage
 * Handles saving and loading discussion histories
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  DiscussionHistory,
  DiscussionContext,
  StorageScope,
} from "../../../domain/discuss/types.js";

/**
 * Discussion Storage Manager
 * Manages discussion history persistence
 */
export class DiscussionStorage {
  private globalPath: string;
  private projectPath: string;

  constructor(projectPath?: string) {
    // Global storage: ~/.claude/discuss/
    this.globalPath = join(homedir(), ".claude", "discuss");

    // Project storage: .claude/discuss/
    this.projectPath = projectPath
      ? join(projectPath, ".claude", "discuss")
      : join(process.cwd(), ".claude", "discuss");

    this.ensureDirectories();
  }

  /**
   * Save discussion history
   */
  async save(
    context: DiscussionContext,
    scope: StorageScope = "project"
  ): Promise<string> {
    const history = this.contextToHistory(context);
    const basePath = scope === "global" ? this.globalPath : this.projectPath;
    const historyPath = join(basePath, "history");

    // Ensure history directory exists
    if (!existsSync(historyPath)) {
      mkdirSync(historyPath, { recursive: true });
    }

    // Generate filename
    const date = new Date().toISOString().split("T")[0];
    const scenarioId = context.config.scenario || "custom";
    const filename = `${date}_${scenarioId}_${history.id.substring(0, 8)}.json`;
    const filepath = join(historyPath, filename);

    // Save to file
    writeFileSync(filepath, JSON.stringify(history, null, 2), "utf-8");

    console.log(`\n💾 Discussion saved: ${filepath}`);
    return filepath;
  }

  /**
   * Load discussion history by ID
   */
  async load(id: string, scope: StorageScope = "project"): Promise<DiscussionHistory | null> {
    const basePath = scope === "global" ? this.globalPath : this.projectPath;
    const historyPath = join(basePath, "history");

    if (!existsSync(historyPath)) {
      return null;
    }

    // Find file by ID
    const files = readdirSync(historyPath);
    const matchingFile = files.find((f) => f.includes(id.substring(0, 8)));

    if (!matchingFile) {
      return null;
    }

    const filepath = join(historyPath, matchingFile);
    const content = readFileSync(filepath, "utf-8");
    return JSON.parse(content) as DiscussionHistory;
  }

  /**
   * List all discussions
   */
  async list(scope: StorageScope = "project"): Promise<DiscussionHistory[]> {
    const basePath = scope === "global" ? this.globalPath : this.projectPath;
    const historyPath = join(basePath, "history");

    if (!existsSync(historyPath)) {
      return [];
    }

    const files = readdirSync(historyPath).filter((f) => f.endsWith(".json"));
    const histories: DiscussionHistory[] = [];

    for (const file of files) {
      try {
        const filepath = join(historyPath, file);
        const content = readFileSync(filepath, "utf-8");
        const history = JSON.parse(content) as DiscussionHistory;
        histories.push(history);
      } catch (error) {
        console.warn(`Failed to load history file ${file}:`, error);
      }
    }

    // Sort by date (newest first)
    return histories.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Ensure storage directories exist
   */
  private ensureDirectories(): void {
    // Create global directory structure
    const globalDirs = [
      this.globalPath,
      join(this.globalPath, "history"),
      join(this.globalPath, "scenarios"),
    ];

    for (const dir of globalDirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create project directory structure (if in a project)
    try {
      const projectDirs = [
        this.projectPath,
        join(this.projectPath, "history"),
        join(this.projectPath, "scenarios"),
      ];

      for (const dir of projectDirs) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }
    } catch (error) {
      // Silently fail if we can't create project directories
      // (might not have write permissions)
    }
  }

  /**
   * Convert context to history for storage
   */
  private contextToHistory(context: DiscussionContext): DiscussionHistory {
    // Calculate statistics
    const participationRate: Record<string, number> = {};
    let totalTokens = 0;

    for (const turn of context.turns) {
      participationRate[turn.participantId] =
        (participationRate[turn.participantId] || 0) + 1;
      totalTokens += turn.metadata.tokens || 0;
    }

    const duration = context.status === "completed"
      ? Math.round((Date.now() - context.startTime.getTime()) / 1000)
      : 0;

    return {
      id: context.config.id,
      config: context.config,
      turns: context.turns,
      status: context.status,
      statistics: {
        totalTurns: context.turns.length,
        totalTokens,
        duration,
        participationRate,
      },
      createdAt: context.startTime.toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: context.status === "completed"
        ? new Date().toISOString()
        : undefined,
    };
  }

  /**
   * Get storage paths for info
   */
  getStoragePaths(): { global: string; project: string } {
    return {
      global: this.globalPath,
      project: this.projectPath,
    };
  }
}
