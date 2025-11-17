/**
 * Discussion control command parser
 * Parses user input commands during discussion
 */

import type { ControlCommand } from "../../../domain/discuss/types.js";

/**
 * Parse a control command from user input
 */
export function parseControlCommand(input: string): ControlCommand | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  // Command: next #3
  if (trimmed.startsWith("next #") || trimmed.startsWith("next#")) {
    const match = trimmed.match(/next\s*#(\d+)/i);
    if (match) {
      const number = parseInt(match[1], 10);
      return {
        type: "next",
        targetNumbers: [number],
      };
    }
  }

  // Command: ask #1,#2 message
  // Command: ask #1 message
  if (trimmed.startsWith("ask #") || trimmed.startsWith("ask#")) {
    const match = trimmed.match(/ask\s*#([\d,\s]+)(?:\s+(.+))?/i);
    if (match) {
      const numbersStr = match[1];
      const message = match[2] || "";

      const numbers = numbersStr
        .split(",")
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n));

      return {
        type: "ask",
        targetNumbers: numbers,
        message: message.trim(),
      };
    }
  }

  // Command: order #1,#3,#5
  if (trimmed.startsWith("order #") || trimmed.startsWith("order#")) {
    const match = trimmed.match(/order\s*#([\d,\s]+)/i);
    if (match) {
      const numbers = match[1]
        .split(",")
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n));

      return {
        type: "order",
        targetNumbers: numbers,
      };
    }
  }

  // Command: remove #3
  if (trimmed.startsWith("remove #") || trimmed.startsWith("remove#")) {
    const match = trimmed.match(/remove\s*#(\d+)/i);
    if (match) {
      const number = parseInt(match[1], 10);
      return {
        type: "remove",
        targetNumbers: [number],
      };
    }
  }

  // Simple commands (no parameters)
  const simpleCommands = [
    "pass",
    "summary",
    "pause",
    "resume",
    "list",
    "history",
    "status",
    "help",
    "quit",
  ];

  const lowerTrimmed = trimmed.toLowerCase();
  if (simpleCommands.includes(lowerTrimmed)) {
    return {
      type: lowerTrimmed as any,
    };
  }

  // history #3 - Show specific participant's history
  if (trimmed.startsWith("history #") || trimmed.startsWith("history#")) {
    const match = trimmed.match(/history\s*#(\d+)/i);
    if (match) {
      const number = parseInt(match[1], 10);
      return {
        type: "history",
        targetNumbers: [number],
      };
    }
  }

  // Not a recognized command
  return null;
}

/**
 * Check if input is a control command
 */
export function isControlCommand(input: string): boolean {
  return parseControlCommand(input) !== null;
}

/**
 * Get help text for control commands
 */
export function getHelpText(language: "en" | "zh" = "en"): string {
  const help = {
    en: `
Control Commands:

Speaking Control:
  next #N              - Set participant #N to speak next
  ask #N [message]     - Ask specific participant #N to respond
  ask #1,#2 [message]  - Ask multiple participants to respond
  pass                 - Skip current turn

Discussion Control:
  pause                - Pause discussion for manual control
  resume               - Resume discussion
  order #1,#3,#5       - Set custom turn order
  summary              - Request summary from all participants

Information:
  list                 - Show all participants with numbers
  history              - Show recent turns
  history #N           - Show turns from participant #N
  status               - Show current discussion status

Management:
  help                 - Show this help
  quit                 - End discussion

Examples:
  next #3              - Let participant #3 speak next
  ask #1 关于安全问题   - Ask participant #1 about security
  ask #1,#2,#4         - Ask participants #1, #2, #4 to respond
  order #5,#2,#1       - Set speaking order
  pass                 - Skip your turn
`,
    zh: `
控制命令：

发言控制：
  next #N              - 指定参与者 #N 下一个发言
  ask #N [消息]         - 询问特定参与者 #N
  ask #1,#2 [消息]      - 询问多个参与者
  pass                 - 跳过当前轮次

讨论控制：
  pause                - 暂停讨论进行手动控制
  resume               - 恢复讨论
  order #1,#3,#5       - 设置自定义发言顺序
  summary              - 请求所有参与者总结

信息查询：
  list                 - 显示所有参与者和编号
  history              - 显示最近的对话历史
  history #N           - 显示参与者 #N 的发言历史
  status               - 显示当前讨论状态

管理：
  help                 - 显示此帮助
  quit                 - 结束讨论

示例：
  next #3              - 让参与者 #3 下一个发言
  ask #1 关于安全问题   - 询问参与者 #1 关于安全问题
  ask #1,#2,#4         - 询问参与者 #1、#2、#4
  order #5,#2,#1       - 设置发言顺序
  pass                 - 跳过你的发言
`,
  };

  return help[language];
}

/**
 * Validate participant numbers
 */
export function validateParticipantNumbers(
  numbers: number[],
  maxParticipants: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const num of numbers) {
    if (num < 1 || num > maxParticipants) {
      errors.push(
        `Invalid participant number #${num}. Valid range: 1-${maxParticipants}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format command for display
 */
export function formatCommand(command: ControlCommand): string {
  switch (command.type) {
    case "next":
      return `Next speaker: #${command.targetNumbers?.[0]}`;

    case "ask":
      const targets = command.targetNumbers?.map((n) => `#${n}`).join(", ");
      return `Ask ${targets}${command.message ? `: ${command.message}` : ""}`;

    case "order":
      const order = command.targetNumbers?.map((n) => `#${n}`).join(" → ");
      return `Turn order: ${order}`;

    case "remove":
      return `Remove participant #${command.targetNumbers?.[0]}`;

    case "pass":
      return "Pass turn";

    case "summary":
      return "Request summary";

    case "pause":
      return "Pause discussion";

    case "resume":
      return "Resume discussion";

    case "list":
      return "Show participant list";

    case "history":
      if (command.targetNumbers && command.targetNumbers.length > 0) {
        return `Show history for #${command.targetNumbers[0]}`;
      }
      return "Show recent history";

    case "status":
      return "Show status";

    case "help":
      return "Show help";

    default:
      return "Unknown command";
  }
}
