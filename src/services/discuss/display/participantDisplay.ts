/**
 * Participant display utilities
 * Handles participant list formatting and turn output
 */

import type {
  Participant,
  ParticipantGroup,
  Language,
  Turn,
} from "../../../domain/discuss/types.js";

/**
 * Assign sequential numbers to participants
 */
export function assignParticipantNumbers(
  participants: Participant[]
): Participant[] {
  return participants.map((p, index) => ({
    ...p,
    number: index + 1,
  }));
}

/**
 * Group participants by their group field or role
 */
export function groupParticipants(
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

/**
 * Get model/tool information for display
 */
export function getModelInfo(participant: Participant): string {
  switch (participant.type) {
    case "api":
      return participant.config.api?.model || "unknown";
    case "cli":
      return participant.config.cli?.tool || "unknown";
    case "human":
      return "human";
    default:
      return "unknown";
  }
}

/**
 * Format participant for display
 */
export function formatParticipant(participant: Participant): string {
  const modelInfo = getModelInfo(participant);
  const typeLabel = participant.type.toUpperCase();
  return `#${participant.number} - ${participant.name} - ${modelInfo} (${typeLabel})`;
}

/**
 * Display participant list at the start of discussion
 */
export function displayParticipantList(
  participants: Participant[],
  options?: {
    language?: Language;
    maxTurns?: number;
    turnOrder?: string;
  }
): string {
  const groups = groupParticipants(participants);
  const separator = "━".repeat(70);

  const lines: string[] = [];

  lines.push(separator);
  lines.push(
    `📋 ${translate("Discussion Participants", options?.language)} (${participants.length} ${translate("total", options?.language)})`
  );
  lines.push(separator);
  lines.push("");

  // Display groups
  for (const group of groups) {
    const groupCount = group.participants.length;
    const groupLabel =
      groupCount > 1
        ? `${group.name} (${groupCount})`
        : `${group.name} (${groupCount})`;

    lines.push(groupLabel + ":");

    for (const p of group.participants) {
      const modelInfo = getModelInfo(p);
      const typeLabel = p.type.toUpperCase();
      lines.push(
        `  #${p.number} - ${p.name} - ${modelInfo} (${typeLabel})`
      );
    }
    lines.push("");
  }

  lines.push(separator);

  // Display orchestration info
  if (options?.turnOrder) {
    lines.push(
      `${translate("Turn Order", options.language)}: ${options.turnOrder}`
    );
  }
  if (options?.maxTurns) {
    lines.push(
      `${translate("Max Turns", options.language)}: ${options.maxTurns}`
    );
  }
  if (options?.language) {
    lines.push(
      `${translate("Language", options.language)}: ${getLanguageName(options.language)}`
    );
  }

  lines.push(separator);
  lines.push("");
  lines.push(
    translate(
      "Type 'help' for control commands, 'quit' to exit",
      options?.language
    )
  );
  lines.push(
    translate(
      "Press Ctrl+P to pause and take manual control",
      options?.language
    )
  );

  return lines.join("\n");
}

/**
 * Display turn header
 */
export function displayTurnHeader(
  turn: Turn,
  totalTurns: number,
  participant: Participant
): string {
  const separator = "━".repeat(70);
  const modelInfo = getModelInfo(participant);

  const lines: string[] = [];
  lines.push(separator);
  lines.push(
    `Turn ${turn.index + 1}/${totalTurns} - #${participant.number} ${participant.name} (${modelInfo})`
  );
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Display turn footer with metadata
 */
export function displayTurnFooter(turn: Turn): string {
  const separator = "━".repeat(70);
  const duration = turn.metadata.duration
    ? `${(turn.metadata.duration / 1000).toFixed(1)}s`
    : "N/A";
  const tokens = turn.metadata.tokens || "N/A";

  const lines: string[] = [];
  lines.push(separator);
  lines.push(`✓ Turn completed (${duration}, ${tokens} tokens)`);
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Display special turn (ask, summary, etc.)
 */
export function displaySpecialTurnHeader(
  type: string,
  participant: Participant,
  message?: string
): string {
  const separator = "━".repeat(70);
  const modelInfo = getModelInfo(participant);

  const lines: string[] = [];
  lines.push(separator);
  lines.push(
    `${type} - #${participant.number} ${participant.name} (${modelInfo})`
  );
  if (message) {
    lines.push(`Question: ${message}`);
  }
  lines.push(separator);

  return lines.join("\n");
}

/**
 * Display human input prompt
 */
export function displayHumanInputPrompt(
  participant: Participant,
  turn: number,
  totalTurns: number
): string {
  const separator = "━".repeat(70);

  const lines: string[] = [];
  lines.push(separator);
  lines.push(
    `Turn ${turn}/${totalTurns} - #${participant.number} ${participant.name}`
  );
  lines.push(separator);
  lines.push("");
  lines.push("Your turn to speak. Commands available:");
  lines.push("  - Type your response (end with Ctrl+D or type 'EOF')");
  lines.push("  - 'pass' - Skip this turn");
  lines.push("  - 'ask #N [message]' - Ask specific participant #N");
  lines.push("  - 'next #N' - Set participant #N to speak next");
  lines.push("  - 'pause' - Pause discussion for manual control");
  lines.push("  - 'summary' - Request summary from all participants");
  lines.push("  - 'list' - Show participant list");
  lines.push("  - 'history' - Show recent turns");
  lines.push("  - 'help' - Show all commands");
  lines.push("");
  lines.push("> ");

  return lines.join("\n");
}

/**
 * Display pause menu
 */
export function displayPauseMenu(): string {
  const separator = "━".repeat(70);

  const lines: string[] = [];
  lines.push(separator);
  lines.push("[PAUSED] Discussion paused. Commands available:");
  lines.push(separator);
  lines.push("  - 'resume' - Resume discussion");
  lines.push("  - 'next #N' - Set next speaker and resume");
  lines.push("  - 'order #1,#3,#5' - Set custom turn order");
  lines.push("  - 'list' - Show participant list");
  lines.push("  - 'history' - Show turn history");
  lines.push("  - 'status' - Show current status");
  lines.push("  - 'quit' - End discussion");
  lines.push(separator);
  lines.push("");
  lines.push("[PAUSED] > ");

  return lines.join("\n");
}

/**
 * Display participant list in pause mode
 */
export function displayParticipantStats(
  participants: Participant[],
  turns: Turn[]
): string {
  const stats = calculateParticipantStats(participants, turns);

  const lines: string[] = [];
  lines.push("Participant Statistics:");
  lines.push("");

  for (const stat of stats) {
    const participant = participants.find((p) => p.number === stat.number);
    if (!participant) continue;

    const modelInfo = getModelInfo(participant);
    lines.push(
      `  #${stat.number} - ${stat.name} - ${modelInfo} (${stat.turnCount} turns, ${stat.totalTokens} tokens)`
    );
  }

  return lines.join("\n");
}

/**
 * Calculate participant statistics
 */
function calculateParticipantStats(
  participants: Participant[],
  turns: Turn[]
): Array<{
  number: number;
  name: string;
  turnCount: number;
  totalTokens: number;
}> {
  const stats = new Map<
    number,
    { number: number; name: string; turnCount: number; totalTokens: number }
  >();

  for (const p of participants) {
    if (!p.number) continue;
    stats.set(p.number, {
      number: p.number,
      name: p.name,
      turnCount: 0,
      totalTokens: 0,
    });
  }

  for (const turn of turns) {
    const participant = participants.find(
      (p) => p.id === turn.participantId
    );
    if (!participant?.number) continue;

    const stat = stats.get(participant.number);
    if (stat) {
      stat.turnCount++;
      stat.totalTokens += turn.metadata.tokens || 0;
    }
  }

  return Array.from(stats.values());
}

/**
 * Simple translation helper
 */
function translate(key: string, language?: Language): string {
  const translations: Record<string, Record<string, string>> = {
    "Discussion Participants": {
      en: "Discussion Participants",
      zh: "讨论参与者",
      es: "Participantes de la Discusión",
      ja: "ディスカッション参加者",
    },
    total: {
      en: "total",
      zh: "人",
      es: "total",
      ja: "人",
    },
    "Turn Order": {
      en: "Turn Order",
      zh: "轮次顺序",
      es: "Orden de Turnos",
      ja: "順番",
    },
    "Max Turns": {
      en: "Max Turns",
      zh: "最大轮次",
      es: "Turnos Máximos",
      ja: "最大ターン数",
    },
    Language: {
      en: "Language",
      zh: "语言",
      es: "Idioma",
      ja: "言語",
    },
    "Type 'help' for control commands, 'quit' to exit": {
      en: "Type 'help' for control commands, 'quit' to exit",
      zh: "输入 'help' 查看控制命令，'quit' 退出",
      es: "Escribe 'help' para comandos, 'quit' para salir",
      ja: "'help' でコマンド表示、'quit' で終了",
    },
    "Press Ctrl+P to pause and take manual control": {
      en: "Press Ctrl+P to pause and take manual control",
      zh: "按 Ctrl+P 暂停并手动控制",
      es: "Presiona Ctrl+P para pausar y tomar control manual",
      ja: "Ctrl+P で一時停止して手動制御",
    },
  };

  const lang = language || "en";
  return translations[key]?.[lang] || key;
}

/**
 * Get language name
 */
function getLanguageName(language: Language): string {
  const names: Record<Language, string> = {
    en: "English",
    zh: "Chinese (中文)",
    es: "Español",
    ja: "日本語",
    auto: "Auto-detect",
  };
  return names[language];
}
