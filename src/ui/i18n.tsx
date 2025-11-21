import React, { createContext, useContext, useMemo, useState } from "react";

export type Locale = "en" | "zh";
type Messages = Record<Locale, Record<string, string>>;

const messages: Messages = {
  en: {
    newDiscussion: "New Discussion",
    noConversations: "No conversations",
    participants: "Participants",
    addParticipant: "Add Participant",
    sessionName: "Session Name",
    topic: "Topic",
    selectModels: "Participants (Select at least 2)",
    createSession: "Create Session",
    multiModelDiscuss: "Multi-Model Discuss",
    sessionLabel: "Session",
    statusSpeaking: "Speaking",
    statusLive: "Live",
    statusPaused: "Paused",
    statusIdle: "Idle",
    modeAuto: "Auto",
    modeManual: "Manual",
    modeLabel: "Mode",
    awaitingSpeaker: "Awaiting speaker",
    nowResponding: "Now responding",
    aiVoicesTotal: "{ai} AI voices · {total} total",
    topicPrefix: "Topic",
    untitled: "Untitled",
    participantsCount: "{count} participants",
    toggleParticipants: "Toggle participants",
    next: "Next",
    interrupt: "Interrupt",
    resume: "Resume",
    pause: "Pause",
    reset: "Reset",
    summarize: "Summarize",
    dismiss: "Dismiss",
    remove: "Remove",
    discussionStopped: "Discussion stopped",
    placeholderTopic: "Enter a topic to start discussion...",
    placeholderMessage: "Type a message...",
    newMessages: "New messages ↓",
    noParticipantsFound: "No participants found",
    displayNameOptional: "Display Name (Optional)",
    speakNext: "Let this participant speak next",
    model: "Model",
    generateSummary: "Generate Summary",
    selectSummarizer: "Select an AI participant to summarize the conversation.",
    summarizer: "Summarizer",
    selectParticipant: "Select a participant",
    close: "Close",
    generate: "Generate",
    summarizing: "Summarizing...",
    startDiscussion: "Start a Discussion",
    startDiscussionBody:
      "Select a chat from the sidebar or create a new session to begin collaborating.",
    startDiscussionCTA: "Create New Discussion",
    language: "Language",
    exportAll: "Export All",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    mentionNoNext: "No later reply from {name} yet",
  },
  zh: {
    newDiscussion: "新建讨论",
    noConversations: "暂无会话",
    participants: "参与者",
    addParticipant: "添加参与者",
    sessionName: "会话名称",
    topic: "主题",
    selectModels: "参与模型（至少选择 2 个）",
    createSession: "创建会话",
    multiModelDiscuss: "多模型讨论",
    sessionLabel: "会话",
    statusSpeaking: "发言中",
    statusLive: "进行中",
    statusPaused: "已暂停",
    statusIdle: "空闲",
    modeAuto: "自动",
    modeManual: "手动",
    modeLabel: "模式",
    awaitingSpeaker: "等待发言",
    nowResponding: "当前发言",
    aiVoicesTotal: "{ai} 个 AI · 共 {total} 人",
    topicPrefix: "主题",
    untitled: "未命名",
    participantsCount: "{count} 个参与者",
    toggleParticipants: "切换参与者",
    next: "下一位",
    interrupt: "打断",
    resume: "继续",
    pause: "暂停",
    reset: "重置",
    summarize: "总结",
    dismiss: "忽略",
    remove: "移除",
    discussionStopped: "讨论已停止",
    placeholderTopic: "输入主题以开始讨论...",
    placeholderMessage: "输入消息...",
    newMessages: "有新消息 ↓",
    noParticipantsFound: "没有匹配的参与者",
    displayNameOptional: "显示名（可选）",
    speakNext: "让 TA 下一轮发言",
    model: "模型",
    generateSummary: "生成总结",
    selectSummarizer: "选择一个 AI 来总结当前讨论。",
    summarizer: "总结人",
    selectParticipant: "选择参与者",
    close: "关闭",
    generate: "生成",
    summarizing: "总结中...",
    startDiscussion: "开始讨论",
    startDiscussionBody: "从侧边栏选择会话或创建新会话开始协作。",
    startDiscussionCTA: "创建新讨论",
    language: "语言",
    exportAll: "导出全部",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    mentionNoNext: "还没有 {name} 的后续回复",
  },
};

type TranslateFn = (
  key: keyof (typeof messages)["en"],
  vars?: Record<string, string | number>,
) => string;

export const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

const format = (template: string, vars?: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(vars ?? {}, name)
      ? String(vars?.[name])
      : `{${name}}`,
  );

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  const value = useMemo(() => {
    const t: TranslateFn = (key, vars) => {
      const fallback = messages.en[key] ?? key;
      const template = messages[locale]?.[key] ?? fallback;
      return format(template, vars);
    };
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
