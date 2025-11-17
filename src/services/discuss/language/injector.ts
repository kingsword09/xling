/**
 * Language instruction injector
 * Injects language-specific instructions into system prompts
 */

import type { Language } from "../../../domain/discuss/types.js";

export interface LanguageInstruction {
  language: Language;
  instruction: string;
  emphasis: string; // Strong emphasis for the model
}

/**
 * Get language instruction for a given language code
 */
export function getLanguageInstruction(language: Language): LanguageInstruction {
  const instructions: Record<
    Exclude<Language, "auto">,
    LanguageInstruction
  > = {
    en: {
      language: "en",
      instruction: "Respond in English.",
      emphasis:
        "IMPORTANT: All responses must be in English. Do not use any other language.",
    },
    zh: {
      language: "zh",
      instruction: "请使用中文回复。",
      emphasis:
        "重要提示：所有回复必须使用中文（简体）。Use Chinese (Simplified) for all responses. 不要使用其他语言。",
    },
    es: {
      language: "es",
      instruction: "Responde en español.",
      emphasis:
        "IMPORTANTE: Todas las respuestas deben estar en español. No uses ningún otro idioma.",
    },
    ja: {
      language: "ja",
      instruction: "日本語で返答してください。",
      emphasis:
        "重要：すべての回答は日本語で行ってください。他の言語は使用しないでください。",
    },
  };

  if (language === "auto") {
    // For auto, we don't inject any specific instruction
    // The model will match the language of the input
    return {
      language: "auto",
      instruction: "Respond in the same language as the input.",
      emphasis:
        "Match the language of the user's input in your responses.",
    };
  }

  return instructions[language];
}

/**
 * Inject language instruction into a system prompt
 */
export function injectLanguageInstruction(
  systemPrompt: string,
  language: Language
): string {
  const instruction = getLanguageInstruction(language);

  // Add the instruction at the end of the system prompt
  // with emphasis to ensure the model follows it
  return `${systemPrompt}\n\n${instruction.emphasis}`;
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(text: string): Language {
  // Chinese detection (CJK Unified Ideographs)
  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh";
  }

  // Japanese detection (Hiragana, Katakana)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return "ja";
  }

  // Spanish detection (common Spanish words and accented characters)
  const spanishIndicators = /\b(el|la|los|las|un|una|es|está|son|están|que|de|del|con|por|para|su|sus)\b/i;
  if (spanishIndicators.test(text) || /[áéíóúñ¿¡]/i.test(text)) {
    return "es";
  }

  // Default to English
  return "en";
}

/**
 * Create a multilingual prompt template
 */
export function createMultilingualPrompt(
  basePrompt: string,
  language: Language,
  variables?: Record<string, string>
): string {
  let prompt = basePrompt;

  // Replace variables
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }

  // For auto language, try to detect from variables
  if (language === "auto" && variables) {
    const combinedText = Object.values(variables).join(" ");
    language = detectLanguage(combinedText);
  }

  // Add language-specific context
  const languageContext = getLanguageContext(language);
  if (languageContext) {
    prompt = `${languageContext}\n\n${prompt}`;
  }

  return prompt;
}

/**
 * Get language-specific context for better understanding
 */
function getLanguageContext(language: Language): string {
  const contexts: Record<Exclude<Language, "auto">, string> = {
    en: "",
    zh: "在以下讨论中，所有参与者都应使用中文（简体）进行交流。",
    es: "En la siguiente discusión, todos los participantes deben comunicarse en español.",
    ja: "以下のディスカッションでは、すべての参加者が日本語でコミュニケーションを取る必要があります。",
  };

  return language === "auto" ? "" : contexts[language];
}

/**
 * Format a turn for display with language-aware formatting
 */
export function formatTurn(
  participantName: string,
  content: string,
  language: Language
): string {
  const separators: Record<Exclude<Language, "auto">, string> = {
    en: "says:",
    zh: "说：",
    es: "dice:",
    ja: "：",
  };

  const separator = language === "auto" ? "says:" : separators[language];

  return `[${participantName}] ${separator}\n${content}\n`;
}
