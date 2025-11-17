/**
 * Core types for xling discuss (d) command
 * Supports multi-participant AI discussions with language customization
 */

import { z } from "zod";

// ============================================================================
// Language Support
// ============================================================================

const LanguageValues = {
  en: "en",
  zh: "zh",
  es: "es",
  ja: "ja",
  auto: "auto",
} as const;
export const LanguageSchema: z.ZodType<Language> = z.nativeEnum(LanguageValues);
export type Language = (typeof LanguageValues)[keyof typeof LanguageValues];

export interface LanguageConfig {
  default: Language;
  perParticipant?: Record<string, Language>;
  fallback: Language;
}

// ============================================================================
// Participant Configuration
// ============================================================================

const ParticipantTypeValues = {
  api: "api",
  cli: "cli",
  human: "human",
} as const;
export const ParticipantTypeSchema: z.ZodType<ParticipantType> = z.nativeEnum(ParticipantTypeValues);
export type ParticipantType = (typeof ParticipantTypeValues)[keyof typeof ParticipantTypeValues];

// API Participant (OpenAI, Anthropic, etc.)
export const ApiDriverConfigSchema: z.ZodObject<{
  model: z.ZodString;
  provider: z.ZodOptional<z.ZodString>;
  temperature: z.ZodOptional<z.ZodNumber>;
  maxTokens: z.ZodOptional<z.ZodNumber>;
  topP: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  model: z.string(),
  provider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

export type ApiDriverConfig = z.infer<typeof ApiDriverConfigSchema>;

// CLI Participant (codex, claude)
export const CliDriverConfigSchema: z.ZodType<{
  tool: "codex" | "claude";
  args?: string[];
  workingDir?: string;
  timeout?: number;
}> = z.object({
  tool: z.enum(["codex", "claude"]),
  args: z.array(z.string()).optional(),
  workingDir: z.string().optional(),
  timeout: z.number().int().positive().optional(), // milliseconds
});

export type CliDriverConfig = z.infer<typeof CliDriverConfigSchema>;

// Human Participant
export const HumanDriverConfigSchema: z.ZodType<{
  inputMode: "tty" | "editor";
  timeout?: number;
  prompt?: string;
}> = z.object({
  inputMode: z.enum(["tty", "editor"]),
  timeout: z.number().int().positive().optional(), // milliseconds
  prompt: z.string().optional(), // Custom prompt text
});

export type HumanDriverConfig = z.infer<typeof HumanDriverConfigSchema>;

// Unified Participant Config
export const ParticipantConfigSchema: z.ZodType<{
  systemPrompt?: string;
  languageInstruction?: string;
  api?: ApiDriverConfig;
  cli?: CliDriverConfig;
  human?: HumanDriverConfig;
}> = z.object({
  systemPrompt: z.string().optional(),
  languageInstruction: z.string().optional(),
  api: ApiDriverConfigSchema.optional(),
  cli: CliDriverConfigSchema.optional(),
  human: HumanDriverConfigSchema.optional(),
});

export type ParticipantConfig = z.infer<typeof ParticipantConfigSchema>;

// Participant Definition (Enhanced)
export const ParticipantSchema: z.ZodType<{
  id: string;
  number?: number;
  name: string;
  type: ParticipantType;
  role: string;
  config: ParticipantConfig;
  required: boolean;
  group?: string;
  priority?: number;
  codeNeeds?: {
    topic: string;
    specificNeeds: string[];
    focus?: string;
  };
}> = z.object({
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
  // Code needs for dynamic code advisor
  codeNeeds: z.object({
    topic: z.string(),
    specificNeeds: z.array(z.string()),
    focus: z.string().optional(),
  }).optional(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

// ============================================================================
// Discussion Turn
// ============================================================================

export const TurnSchema: z.ZodType<{
  index: number;
  participantId: string;
  participantName: string;
  content: string;
  timestamp: string;
  metadata: {
    model?: string;
    tokens?: number;
    language?: string;
    duration?: number;
    error?: string;
    controlCommand?: ControlCommand;
  };
}> = z.object({
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
    controlCommand: z.lazy(() => ControlCommandSchema).optional(),
  }),
});

export type Turn = z.infer<typeof TurnSchema>;

// ============================================================================
// Discussion Orchestration
// ============================================================================

const TurnOrderValues = {
  sequential: "sequential",
  "round-robin": "round-robin",
  dynamic: "dynamic",
} as const;
export const TurnOrderSchema: z.ZodType<TurnOrder> = z.nativeEnum(TurnOrderValues);
export type TurnOrder = (typeof TurnOrderValues)[keyof typeof TurnOrderValues];

export const OrchestrationConfigSchema: z.ZodType<{
  turnOrder: TurnOrder;
  maxTurns: number;
  terminationCondition?: string;
  allowSkip: boolean;
  timeout?: number;
  enableCodeAdvisor?: boolean;
}> = z.object({
  turnOrder: TurnOrderSchema,
  maxTurns: z.number().int().positive(),
  terminationCondition: z.string().optional(), // Regex pattern
  allowSkip: z.boolean().default(false), // Allow participants to skip turns
  timeout: z.number().int().positive().optional(), // milliseconds
  enableCodeAdvisor: z.boolean().optional(),
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

// ============================================================================
// Discussion Scenario (Template)
// ============================================================================

const ScenarioCategoryValues = {
  "code-review": "code-review",
  architecture: "architecture",
  brainstorm: "brainstorm",
  decision: "decision",
  custom: "custom",
} as const;
export const ScenarioCategorySchema: z.ZodType<ScenarioCategory> = z.nativeEnum(ScenarioCategoryValues);

export type ScenarioCategory = (typeof ScenarioCategoryValues)[keyof typeof ScenarioCategoryValues];

export const ParticipantTemplateSchema: z.ZodType<{
  role: string;
  type: ParticipantType;
  preferredModels?: string[];
  systemPrompt: string;
  required: boolean;
  config?: {
    tool?: "codex" | "claude";
    inputMode?: "tty" | "editor";
  };
}> = z.object({
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

export const DiscussionScenarioSchema: z.ZodType<{
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  participants: ParticipantTemplate[];
  orchestration: OrchestrationConfig;
  prompts: {
    initial?: string;
    perTurn?: string;
  };
  tags?: string[];
}> = z.object({
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

export const DiscussionConfigSchema: z.ZodType<{
  id: string;
  topic: string;
  scenario: string;
  language: Language;
  participants: Participant[];
  orchestration: OrchestrationConfig;
  metadata: {
    createdAt: string;
    projectPath?: string;
    tags?: string[];
    initialPrompt?: string;
  };
}> = z.object({
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
    initialPrompt: z.string().optional(),
  }),
});

export type DiscussionConfig = z.infer<typeof DiscussionConfigSchema>;

// ============================================================================
// Discussion Status & Statistics
// ============================================================================

const DiscussionStatusValues = {
  active: "active",
  paused: "paused",
  completed: "completed",
  aborted: "aborted",
} as const;
export const DiscussionStatusSchema: z.ZodType<DiscussionStatus> = z.nativeEnum(DiscussionStatusValues);

export type DiscussionStatus = (typeof DiscussionStatusValues)[keyof typeof DiscussionStatusValues];

export const DiscussionStatisticsSchema: z.ZodType<{
  totalTurns: number;
  totalTokens: number;
  duration: number;
  participationRate: Record<string, number>;
  averageTurnDuration?: number;
}> = z.object({
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

export const DiscussionHistorySchema: z.ZodType<{
  id: string;
  config: DiscussionConfig;
  turns: Turn[];
  status: DiscussionStatus;
  statistics: DiscussionStatistics;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}> = z.object({
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
  initialPrompt?: string;
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

const ControlCommandValues = {
  next: "next",
  ask: "ask",
  pass: "pass",
  summary: "summary",
  pause: "pause",
  resume: "resume",
  list: "list",
  history: "history",
  order: "order",
  add: "add",
  remove: "remove",
  status: "status",
  help: "help",
  quit: "quit",
} as const;
export const ControlCommandTypeSchema: z.ZodType<ControlCommandType> = z.nativeEnum(ControlCommandValues);

export type ControlCommandType = (typeof ControlCommandValues)[keyof typeof ControlCommandValues];

export const ControlCommandSchema: z.ZodType<{
  type: ControlCommandType;
  targetNumbers?: number[];
  message?: string;
  params?: Record<string, unknown>;
}> = z.object({
  type: ControlCommandTypeSchema,
  targetNumbers: z.array(z.number().int().positive()).optional(), // Target participant numbers
  message: z.string().optional(), // Additional message
  params: z.record(z.string(), z.unknown()).optional(), // Additional parameters
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

const ExportFormatValues = {
  json: "json",
  markdown: "markdown",
  html: "html",
  pdf: "pdf",
} as const;
export const ExportFormatSchema: z.ZodType<ExportFormat> = z.nativeEnum(ExportFormatValues);
export type ExportFormat = (typeof ExportFormatValues)[keyof typeof ExportFormatValues];

// ============================================================================
// Storage Scope
// ============================================================================

const StorageScopeValues = {
  global: "global",
  project: "project",
} as const;
export const StorageScopeSchema: z.ZodType<StorageScope> = z.nativeEnum(StorageScopeValues);
export type StorageScope = (typeof StorageScopeValues)[keyof typeof StorageScopeValues];

// ============================================================================
// Enhanced Types for New Features
// ============================================================================

// Turn Context Interface
export interface TurnContext {
  scenario?: DiscussionScenario;
  history: Turn[];
  currentPrompt: string;
  metadata: {
    turnNumber: number;
    previousSpeaker?: string;
    startTime: Date;
    contextSize: number;
    estimatedTokens: number;
  };
  codeContext?: string; // From code advisor
}

// Code Request Interface
export interface CodeRequest {
  topic: string;
  specificNeeds: string[];
  focus?: string;
}

// Enhanced Turn Order Strategy
export type TurnOrderStrategy = "sequential" | "round-robin" | "dynamic";

// Enhanced Configuration
export interface EnhancedDiscussionConfig {
  id: string;
  topic: string;
  scenario?: DiscussionScenario;
  language: Language;
  participants: Participant[];
  orchestration: {
    turnOrder: TurnOrderStrategy;
    maxTurns: number;
    timeout?: number;
    enableCodeAdvisor?: boolean;
    terminationCondition?: string;
  };
  security?: {
    inputMaxLength: number;
    enableInputSanitization: boolean;
    allowedEditors: string[];
    cliToolWhitelist: string[];
  };
  performance?: {
    maxHistoryTurns: number;
    enableCaching: boolean;
    asyncIO: boolean;
  };
}

// Enhanced Control Command
export interface EnhancedControlCommand {
  type: string;
  args?: {
    participant?: number;
    order?: TurnOrderStrategy;
    [key: string]: unknown;
  };
}

// Enhanced Discussion Context
export interface EnhancedDiscussionContext {
  config: EnhancedDiscussionConfig;
  turns: Turn[];
  currentTurnIndex: number;
  status: DiscussionStatus;
  startTime: Date;
  participants: Participant[];
  metadata?: {
    totalTurns?: number;
    totalTokens?: number;
    errors?: Array<{
      turn: number;
      error: string;
      timestamp: Date;
    }>;
  };
}
