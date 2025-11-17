/**
 * Core types for xling discuss (d) command
 * Supports multi-participant AI discussions with language customization
 */

import { z } from "zod";

// ============================================================================
// Language Support
// ============================================================================

export const LanguageSchema = z.enum(["en", "zh", "es", "ja", "auto"]);
export type Language = z.infer<typeof LanguageSchema>;

export interface LanguageConfig {
  default: Language;
  perParticipant?: Record<string, Language>;
  fallback: Language;
}

// ============================================================================
// Participant Configuration
// ============================================================================

export const ParticipantTypeSchema = z.enum(["api", "cli", "human"]);
export type ParticipantType = z.infer<typeof ParticipantTypeSchema>;

// API Participant (OpenAI, Anthropic, etc.)
export const ApiDriverConfigSchema = z.object({
  model: z.string(),
  provider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

export type ApiDriverConfig = z.infer<typeof ApiDriverConfigSchema>;

// CLI Participant (codex, claude)
export const CliDriverConfigSchema = z.object({
  tool: z.enum(["codex", "claude"]),
  args: z.array(z.string()).optional(),
  workingDir: z.string().optional(),
  timeout: z.number().int().positive().optional(), // milliseconds
});

export type CliDriverConfig = z.infer<typeof CliDriverConfigSchema>;

// Human Participant
export const HumanDriverConfigSchema = z.object({
  inputMode: z.enum(["tty", "editor"]),
  timeout: z.number().int().positive().optional(), // milliseconds
  prompt: z.string().optional(), // Custom prompt text
});

export type HumanDriverConfig = z.infer<typeof HumanDriverConfigSchema>;

// Unified Participant Config
export const ParticipantConfigSchema = z.object({
  systemPrompt: z.string().optional(),
  languageInstruction: z.string().optional(),
  api: ApiDriverConfigSchema.optional(),
  cli: CliDriverConfigSchema.optional(),
  human: HumanDriverConfigSchema.optional(),
});

export type ParticipantConfig = z.infer<typeof ParticipantConfigSchema>;

// Participant Definition
export const ParticipantSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive().optional(), // Participant number (#1, #2, etc.)
  name: z.string().min(1),
  type: ParticipantTypeSchema,
  role: z.string(), // "Security Expert", "Architect", etc.
  config: ParticipantConfigSchema,
  required: z.boolean().default(true),
  // Group for display organization
  group: z.string().optional(), // e.g., "Security Experts", "Developers"
  // Priority for speaking order (1-10, higher = more priority)
  priority: z.number().int().min(1).max(10).optional(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

// ============================================================================
// Discussion Turn
// ============================================================================

export const TurnSchema = z.object({
  index: z.number().int().nonnegative(),
  participantId: z.string(),
  participantName: z.string(),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.object({
    model: z.string().optional(),
    tokens: z.number().int().optional(),
    language: z.string().optional(),
    duration: z.number().optional(), // milliseconds
    error: z.string().optional(),
  }),
});

export type Turn = z.infer<typeof TurnSchema>;

// ============================================================================
// Discussion Orchestration
// ============================================================================

export const TurnOrderSchema = z.enum(["sequential", "round-robin", "dynamic"]);
export type TurnOrder = z.infer<typeof TurnOrderSchema>;

export const OrchestrationConfigSchema = z.object({
  turnOrder: TurnOrderSchema,
  maxTurns: z.number().int().positive(),
  terminationCondition: z.string().optional(), // Regex pattern
  allowSkip: z.boolean().default(false), // Allow participants to skip turns
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

// ============================================================================
// Discussion Scenario (Template)
// ============================================================================

export const ScenarioCategorySchema = z.enum([
  "code-review",
  "architecture",
  "brainstorm",
  "decision",
  "custom",
]);

export type ScenarioCategory = z.infer<typeof ScenarioCategorySchema>;

export const ParticipantTemplateSchema = z.object({
  role: z.string(),
  type: ParticipantTypeSchema,
  preferredModels: z.array(z.string()).optional(),
  systemPrompt: z.string(),
  required: z.boolean().default(true),
  config: z
    .object({
      tool: z.enum(["codex", "claude"]).optional(), // For CLI types
      inputMode: z.enum(["tty", "editor"]).optional(), // For human types
    })
    .optional(),
});

export type ParticipantTemplate = z.infer<typeof ParticipantTemplateSchema>;

export const DiscussionScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: ScenarioCategorySchema,
  participants: z.array(ParticipantTemplateSchema).min(2),
  orchestration: OrchestrationConfigSchema,
  prompts: z.object({
    initial: z.string().optional(),
    perTurn: z.string().optional(),
  }),
  tags: z.array(z.string()).optional(),
});

export type DiscussionScenario = z.infer<typeof DiscussionScenarioSchema>;

// ============================================================================
// Discussion Configuration
// ============================================================================

export const DiscussionConfigSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  scenario: z.string(), // Scenario ID
  language: LanguageSchema,
  participants: z.array(ParticipantSchema).min(1),
  orchestration: OrchestrationConfigSchema,
  metadata: z.object({
    createdAt: z.string(),
    projectPath: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export type DiscussionConfig = z.infer<typeof DiscussionConfigSchema>;

// ============================================================================
// Discussion Status & Statistics
// ============================================================================

export const DiscussionStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "aborted",
]);

export type DiscussionStatus = z.infer<typeof DiscussionStatusSchema>;

export const DiscussionStatisticsSchema = z.object({
  totalTurns: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  duration: z.number().nonnegative(), // seconds
  participationRate: z.record(z.string(), z.number().int().nonnegative()),
  averageTurnDuration: z.number().optional(), // seconds
});

export type DiscussionStatistics = z.infer<typeof DiscussionStatisticsSchema>;

// ============================================================================
// Discussion History
// ============================================================================

export const DiscussionHistorySchema = z.object({
  id: z.string().min(1),
  config: DiscussionConfigSchema,
  turns: z.array(TurnSchema),
  status: DiscussionStatusSchema,
  statistics: DiscussionStatisticsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export type DiscussionHistory = z.infer<typeof DiscussionHistorySchema>;

// ============================================================================
// Discussion Context (Runtime State)
// ============================================================================

export interface DiscussionContext {
  config: DiscussionConfig;
  turns: Turn[];
  currentTurnIndex: number;
  status: DiscussionStatus;
  startTime: Date;
  pausedAt?: Date;
  participants: Participant[];
}

// ============================================================================
// Recommender Types
// ============================================================================

export interface RecommendationRequest {
  topic: string;
  context?: {
    codeChanges?: boolean;
    projectType?: string;
    urgency?: "low" | "medium" | "high";
  };
  preferences?: {
    maxParticipants?: number;
    includeHuman?: boolean;
    budget?: "low" | "medium" | "high";
  };
}

export interface ModelInfo {
  id: string;
  provider: string;
  available: boolean;
  capabilities: string[];
  costTier: "low" | "medium" | "high";
}

export interface ConfiguredParticipant extends Participant {
  rationale: string;
}

export interface Recommendation {
  scenario: DiscussionScenario;
  participants: ConfiguredParticipant[];
  availableModels: ModelInfo[];
  command: string;
  estimatedCost: {
    tokens: number;
    usd?: number;
  };
}

// ============================================================================
// Participant Driver Interface
// ============================================================================

export interface ParticipantDriver {
  /**
   * Execute a turn for this participant
   * @param context Current discussion context
   * @param prompt The prompt to send to this participant
   * @returns The participant's response
   */
  execute(context: DiscussionContext, prompt: string): Promise<string>;

  /**
   * Validate that this participant can execute
   * @returns true if participant is ready, false otherwise
   */
  validate(): Promise<boolean>;

  /**
   * Optional cleanup when discussion ends
   */
  cleanup?(): Promise<void>;
}

// ============================================================================
// Discussion Event Types
// ============================================================================

export type DiscussionEventType =
  | "start"
  | "turn-start"
  | "turn-complete"
  | "turn-error"
  | "pause"
  | "resume"
  | "complete"
  | "abort";

export interface DiscussionEvent {
  type: DiscussionEventType;
  timestamp: string;
  data?: unknown;
}

// ============================================================================
// Discussion Control Commands
// ============================================================================

export const ControlCommandTypeSchema = z.enum([
  "next", // Specify next speaker
  "ask", // Ask specific participant(s)
  "pass", // Skip current turn
  "summary", // Request summary from all
  "pause", // Pause discussion
  "resume", // Resume discussion
  "list", // Show participant list
  "history", // Show turn history
  "order", // Set custom turn order
  "add", // Add participant
  "remove", // Remove participant
  "status", // Show status
  "help", // Show help
]);

export type ControlCommandType = z.infer<typeof ControlCommandTypeSchema>;

export const ControlCommandSchema = z.object({
  type: ControlCommandTypeSchema,
  targetNumbers: z.array(z.number().int().positive()).optional(), // Target participant numbers
  message: z.string().optional(), // Additional message
  params: z.record(z.unknown()).optional(), // Additional parameters
});

export type ControlCommand = z.infer<typeof ControlCommandSchema>;

// ============================================================================
// Participant Group (for display)
// ============================================================================

export interface ParticipantGroup {
  name: string;
  participants: Participant[];
  description?: string;
}

// ============================================================================
// Discussion Statistics (Enhanced)
// ============================================================================

export interface ParticipantStats {
  number: number;
  name: string;
  turnCount: number;
  totalTokens: number;
  averageResponseTime: number; // seconds
  lastTurnIndex: number;
}

// ============================================================================
// Export Formats
// ============================================================================

export const ExportFormatSchema = z.enum(["json", "markdown", "html", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

// ============================================================================
// Storage Scope
// ============================================================================

export const StorageScopeSchema = z.enum(["global", "project"]);
export type StorageScope = z.infer<typeof StorageScopeSchema>;
