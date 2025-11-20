import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Send,
  Pause,
  Play,
  SkipForward,
  Bot,
  AlertCircle,
  Users,
  Ban,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/ui/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Label } from "@/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";

import { cn } from "@/ui/lib/utils";
import { Streamdown } from "streamdown";
import { ParticipantsSidebar } from "./ParticipantsSidebar";
import { useI18n } from "@/ui/i18n";

interface ChatInterfaceProps {
  sessionId: string;
  sessionName: string;
}

interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  senderId: string;
  timestamp: number;
  mentions?: string[];
}

interface Participant {
  id: string;
  name: string;
  model?: string;
  type: "ai" | "human";
}

const formatMentions = (content: string) =>
  content.replace(/@ ?([\w.-]+)/g, "[@$1](#mention)");

export function ChatInterface({ sessionId, sessionName }: ChatInterfaceProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState("auto");
  const [topic, setTopic] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const evtSourceRef = useRef<EventSource | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [selectedSummaryModel, setSelectedSummaryModel] = useState("");
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(
    null,
  );
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState<number | null>(
    null,
  );
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);

  const aiParticipants = useMemo(
    () => participants.filter((participant) => participant.type === "ai"),
    [participants],
  );
  const mentionableParticipants = useMemo(
    () => participants.filter((participant) => participant.type !== "human"),
    [participants],
  );
  const summarizableParticipants = useMemo(
    () =>
      participants.filter(
        (participant) => participant.type === "ai" && participant.model,
      ),
    [participants],
  );
  const mentionSuggestions = useMemo(() => {
    if (!mentionActive) return [];
    const query = mentionQuery.toLowerCase();
    return mentionableParticipants.filter((participant) =>
      participant.name.toLowerCase().includes(query),
    );
  }, [mentionActive, mentionQuery, mentionableParticipants]);
  const currentSpeaker = useMemo(
    () =>
      currentSpeakerId
        ? participants.find(
            (participant) => participant.id === currentSpeakerId,
          )
        : null,
    [currentSpeakerId, participants],
  );

  useEffect(() => {
    if (currentSpeakerId && !currentSpeaker) {
      setCurrentSpeakerId(null);
    }
  }, [currentSpeaker, currentSpeakerId]);

  // Fetch initial state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Failed to load session");
        const data = await res.json();
        setMessages(data.history || []);
        if (data.currentMessage) {
          setMessages((prev) => [...prev, data.currentMessage]);
        }
        setStatus(data.status || "idle");
        setMode(data.mode || "auto");
        setParticipants(data.participants || []);
        setTopic(data.topic || "");
        setError(null);
      } catch {
        setError("Failed to load session state");
      }
    };
    fetchState();
  }, [sessionId]);

  useEffect(() => {
    if (evtSourceRef.current) {
      evtSourceRef.current.close();
    }

    const source = new EventSource("/api/stream");
    evtSourceRef.current = source;

    const upsertMessage = (incoming: ChatMessage) => {
      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === incoming.id);
        if (index === -1) {
          return [...prev, incoming].sort((a, b) => a.timestamp - b.timestamp);
        }

        const next = [...prev];
        next[index] = { ...next[index], ...incoming };
        return next;
      });
    };

    const handleChunk = (chunk: { id: string; content: string }) => {
      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === chunk.id);
        if (index === -1) return prev;

        const next = [...prev];
        next[index] = { ...next[index], content: chunk.content };
        return next;
      });
    };

    const handleEvent = (event: MessageEvent) => {
      if (!event.data) return;

      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "connected") {
          setError(null);
          return;
        }

        if (payload.sessionId && payload.sessionId !== sessionId) {
          return;
        }

        switch (payload.type) {
          case "status":
            if (payload.status) {
              setStatus(payload.status);
              if (payload.status !== "speaking") {
                setCurrentSpeakerId(null);
              }
            }
            break;
          case "mode":
            if (payload.mode) setMode(payload.mode);
            break;
          case "participants":
            if (payload.participants) setParticipants(payload.participants);
            break;
          case "turn-start":
            if (payload.participantId) {
              setCurrentSpeakerId(payload.participantId);
            }
            break;
          case "message":
            if (payload.message) {
              if (
                payload.message.role === "system" &&
                typeof payload.message.content === "string" &&
                payload.message.content.startsWith("Topic:")
              ) {
                const nextTopic = payload.message.content
                  .split("\n")[0]
                  .replace("Topic: ", "")
                  .trim();
                setTopic(nextTopic);
              }
              upsertMessage(payload.message);
            }
            break;
          case "chunk":
            if (payload.chunk) handleChunk(payload.chunk);
            break;
          case "history-cleared":
            setMessages([]);
            setCurrentSpeakerId(null);
            break;
          case "error":
            if (payload.error) {
              const participant = payload.error.participantId
                ? `${payload.error.participantId}: `
                : "";
              setError(
                `${participant}${payload.error.error || "An error occurred"}`,
              );
            }
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed events
      }
    };

    source.addEventListener("message", handleEvent);
    source.onerror = () => {
      setError(
        "Lost connection to discussion stream. Attempting to reconnect...",
      );
    };

    return () => {
      source.removeEventListener("message", handleEvent);
      source.close();
      evtSourceRef.current = null;
    };
  }, [sessionId]);

  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const nearBottom = scrollHeight - (scrollTop + clientHeight) < 80;
    setIsAtBottom(nearBottom);
    if (nearBottom) {
      setHasNewActivity(false);
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
  }, []);

  const handleJumpToBottom = useCallback(() => {
    setHasNewActivity(false);
    setIsAtBottom(true);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    } else if (messages.length > 0) {
      setHasNewActivity(true);
    }
  }, [messages, isAtBottom, scrollToBottom]);

  const resetMention = useCallback(() => {
    setMentionActive(false);
    setMentionQuery("");
    setMentionTriggerIndex(null);
    setMentionHighlightIndex(0);
  }, []);

  const evaluateMention = useCallback(
    (value: string, explicitCaret?: number | null) => {
      const caret =
        explicitCaret ??
        (() => {
          const el = inputRef.current;
          return el ? (el.selectionStart ?? value.length) : value.length;
        })();
      const textBeforeCaret = value.slice(0, caret ?? value.length);
      const match = textBeforeCaret.match(/(?:^|\s)@([^\s@]*)$/);

      if (match) {
        setMentionActive(true);
        setMentionQuery(match[1]);
        setMentionTriggerIndex((caret ?? 0) - match[1].length - 1);
        setMentionHighlightIndex(0);
      } else {
        resetMention();
      }
    },
    [resetMention],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value, selectionStart } = e.target;
      setInput(value);
      evaluateMention(value, selectionStart);
    },
    [evaluateMention],
  );

  const insertMention = useCallback(
    (participant: Participant) => {
      if (mentionTriggerIndex == null) return;
      let nextCaret = 0;
      setInput((prev) => {
        const before = prev.slice(0, mentionTriggerIndex + 1);
        const after = prev.slice(mentionTriggerIndex + 1 + mentionQuery.length);
        const needsSpace = after.length === 0 || !after.startsWith(" ");
        const value = `${before}${participant.name}${needsSpace ? " " : ""}${after}`;
        nextCaret =
          before.length + participant.name.length + (needsSpace ? 1 : 0);
        return value;
      });
      resetMention();
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    },
    [mentionTriggerIndex, mentionQuery, resetMention],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!mentionActive || mentionSuggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlightIndex(
          (prev) => (prev + 1) % mentionSuggestions.length,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlightIndex(
          (prev) =>
            (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionHighlightIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        resetMention();
      }
    },
    [
      mentionActive,
      mentionHighlightIndex,
      mentionSuggestions,
      insertMention,
      resetMention,
    ],
  );

  const handleInputKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) return;
      evaluateMention(input);
    },
    [evaluateMention, input],
  );

  const handleInputClick = useCallback(() => {
    evaluateMention(input);
  }, [evaluateMention, input]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !canSendMessage) return;

    if (status === "idle") {
      await handleControl("reset");
      await handleControl("start", { topic: input });
    } else {
      await fetch(`/api/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
    }
    setInput("");
    resetMention();
  };

  useEffect(() => {
    if (summarizableParticipants.length === 0) {
      setSelectedSummaryModel("");
      return;
    }

    if (
      !selectedSummaryModel ||
      !summarizableParticipants.some((p) => p.id === selectedSummaryModel)
    ) {
      setSelectedSummaryModel(summarizableParticipants[0].id);
    }
  }, [summarizableParticipants, selectedSummaryModel]);

  const canSendMessage =
    status !== "idle" || (status === "idle" && aiParticipants.length > 0);
  const manualTurnDisabled =
    mode !== "manual" || status === "idle" || aiParticipants.length === 0;
  const summaryDisabled =
    summarizableParticipants.length === 0 ||
    messages.length === 0 ||
    status === "speaking";

  useEffect(() => {
    if (!mentionActive) return;
    if (mentionHighlightIndex >= mentionSuggestions.length) {
      setMentionHighlightIndex(Math.max(mentionSuggestions.length - 1, 0));
    }
    if (mentionSuggestions.length === 0) {
      setMentionHighlightIndex(0);
    }
  }, [mentionActive, mentionSuggestions.length, mentionHighlightIndex]);

  useEffect(() => {
    if (!canSendMessage) {
      resetMention();
    }
  }, [canSendMessage, resetMention]);

  const handleControl = async (action: string, body: any = {}) => {
    await fetch(`/api/sessions/${sessionId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const handleNextTurn = useCallback(async () => {
    if (manualTurnDisabled) return;
    await handleControl("next");
  }, [handleControl, manualTurnDisabled]);

  const handleResume = useCallback(async () => {
    await handleControl("resume");
  }, [handleControl]);

  const handlePause = useCallback(async () => {
    if (status === "idle") return;
    await handleControl("pause");
  }, [handleControl, status]);

  const handleInterrupt = useCallback(async () => {
    if (status !== "speaking") return;
    await handleControl("interrupt");
  }, [handleControl, status]);

  const handleReset = useCallback(async () => {
    if (
      confirm(
        "Are you sure you want to reset? This will clear the current discussion.",
      )
    ) {
      await handleControl("reset");
    }
  }, [handleControl]);

  const openSummaryDialog = useCallback(() => {
    if (summaryDisabled) return;
    setSummaryResult(null);
    setSummaryErrorMessage(null);
    setIsSummaryDialogOpen(true);
  }, [summaryDisabled]);

  const closeSummaryDialog = useCallback(() => {
    setIsSummaryDialogOpen(false);
    setSummaryResult(null);
    setSummaryErrorMessage(null);
  }, []);

  const handleRunSummary = useCallback(async () => {
    if (!selectedSummaryModel) return;
    setIsSummarizing(true);
    setSummaryErrorMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedSummaryModel }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate summary");
      }
      setSummaryResult(data.summary || "");
    } catch (err) {
      setSummaryErrorMessage(
        err instanceof Error ? err.message : "Failed to generate summary",
      );
    } finally {
      setIsSummarizing(false);
    }
  }, [selectedSummaryModel, sessionId]);

  return (
    <>
      <div className="flex flex-col h-full relative">
        {/* Header */}
        <header className="relative border-b-2 border-neo-black bg-neo-purple shadow-neo z-10">
          <div className="relative px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 border-2 border-neo-black bg-neo-white shadow-neo-sm flex items-center justify-center text-neo-black">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-black flex items-center gap-2">
                    <span
                      className={cn(
                        "relative inline-flex h-3 w-3 border border-neo-black",
                        status === "discussing" || status === "speaking"
                          ? "bg-neo-green animate-pulse"
                          : "bg-neo-yellow",
                      )}
                    />
                    {t("multiModelDiscuss")}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-black uppercase">
                      {topic || sessionName}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 border-2 border-neo-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                        status === "speaking"
                          ? "bg-neo-blue text-black"
                          : status === "discussing"
                            ? "bg-neo-green text-black"
                            : status === "paused"
                              ? "bg-neo-yellow text-black"
                              : "bg-neo-white text-neo-black",
                      )}
                    >
                      {status === "speaking"
                        ? t("statusSpeaking")
                        : status === "discussing"
                          ? t("statusLive")
                          : status === "paused"
                            ? t("statusPaused")
                            : t("statusIdle")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 border-2 border-neo-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                        mode === "auto"
                          ? "bg-neo-blue text-black"
                          : "bg-neo-red text-black",
                      )}
                    >
                      {t("modeLabel")}:{" "}
                      {mode === "auto" ? t("modeAuto") : t("modeManual")}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 border-2 border-neo-black bg-neo-white text-neo-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Users className="h-3.5 w-3.5" />
                      {t("participantsCount", { count: participants.length })}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 border-2 border-neo-black bg-neo-white text-neo-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Bot className="h-3.5 w-3.5" />
                      {currentSpeaker
                        ? `${t("nowResponding")}: ${currentSpeaker.name}`
                        : t("awaitingSpeaker")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {mode === "manual" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextTurn}
                    disabled={manualTurnDisabled}
                    className="bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-green hover:text-black hover:shadow-neo-sm rounded-none"
                    title={t("next")}
                  >
                    <SkipForward className="h-5 w-5" />
                    <span className="sr-only">{t("next")}</span>
                  </Button>
                )}
                {status === "speaking" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleInterrupt}
                    className="bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-red hover:text-white hover:shadow-neo-sm rounded-none"
                    title={t("interrupt")}
                  >
                    <Ban className="h-5 w-5" />
                    <span className="sr-only">{t("interrupt")}</span>
                  </Button>
                )}

                {status === "paused" ? (
                  <Button
                    size="icon"
                    onClick={handleResume}
                    className="bg-neo-green text-black border-2 border-neo-black hover:bg-neo-green/80 hover:shadow-neo-sm rounded-none"
                    title={t("resume")}
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span className="sr-only">{t("resume")}</span>
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePause}
                    className="bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-yellow hover:text-black hover:shadow-neo-sm rounded-none"
                    disabled={status === "idle"}
                    title={t("pause")}
                  >
                    <Pause className="h-5 w-5" />
                    <span className="sr-only">{t("pause")}</span>
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleReset}
                  disabled={aiParticipants.length === 0}
                  className="bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-red hover:text-white hover:shadow-neo-sm rounded-none"
                  title={t("reset")}
                >
                  <RotateCcw className="h-5 w-5" />
                  <span className="sr-only">{t("reset")}</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={summaryDisabled}
                  onClick={openSummaryDialog}
                  className="bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-purple hover:text-black hover:shadow-neo-sm rounded-none"
                  title={t("summarize")}
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="sr-only">{t("summarize")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowParticipants(!showParticipants)}
                  className={cn(
                    "bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-blue hover:text-black hover:shadow-neo-sm rounded-none transition-all",
                    showParticipants && "bg-neo-blue text-black shadow-neo-sm",
                  )}
                  title={t("toggleParticipants")}
                >
                  <Users className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-x-visible overflow-y-hidden relative bg-transparent">
          <div className="flex flex-1 flex-col min-w-0">
            {error && (
              <div className="px-6 py-2 z-20">
                <div className="flex items-center gap-3 bg-neo-red border-2 border-neo-black p-3 shadow-neo text-sm text-white font-bold">
                  <AlertCircle className="h-5 w-5 shrink-0 text-white" />
                  <span className="flex-1">{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="h-auto p-1 hover:bg-black/20 rounded-none text-white"
                  >
                    {t("dismiss")}
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="relative flex flex-1 min-h-0">
              {/* Removed gradient for brutalism */}
              <ScrollArea
                className="flex-1 h-full"
                viewportRef={scrollViewportRef}
                viewportClassName="p-4 md:px-8 md:py-8"
                viewportProps={{ onScroll: handleScroll }}
              >
                <div className="space-y-8 max-w-4xl mx-auto pb-8">
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    const isSystem = msg.role === "system";
                    const sender = participants.find(
                      (participant) => participant.id === msg.senderId,
                    );

                    if (isSystem) {
                      // Parse Topic/Participants message
                      if (msg.content.startsWith("Topic: ")) {
                        const lines = msg.content.split("\n");
                        const topicLine = lines.find((l) =>
                          l.startsWith("Topic: "),
                        );
                        const participantsLine = lines.find((l) =>
                          l.startsWith("Participants: "),
                        );

                        if (topicLine && participantsLine) {
                          const topicText = topicLine.replace("Topic: ", "");

                          return (
                            <div
                              key={msg.id}
                              className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-700"
                            >
                              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/50 uppercase tracking-[0.2em] mb-4">
                                <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-muted-foreground/50" />
                                {t("topicPrefix")}
                                <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-muted-foreground/50" />
                              </div>
                              <div className="markdown-container text-2xl md:text-3xl font-semibold text-center text-foreground/90 max-w-3xl leading-relaxed tracking-tight px-4 drop-shadow-sm prose-headings:m-0 prose-p:m-0">
                                <Streamdown>
                                  {formatMentions(topicText)}
                                </Streamdown>
                              </div>
                            </div>
                          );
                        }
                      }

                      return (
                        <div key={msg.id} className="flex justify-center my-4">
                          <span className="bg-secondary/50 backdrop-blur-sm text-secondary-foreground/60 text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 shadow-sm">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-4 max-w-3xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
                          isUser
                            ? "ml-auto flex-row-reverse"
                            : "mr-auto flex-row",
                        )}
                      >
                        {!isUser && (
                          <Avatar className="h-10 w-10 border border-white/10 shadow-md shrink-0 mt-1 ring-2 ring-background/50">
                            <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 text-foreground">
                              {sender?.name?.substring(0, 2).toUpperCase() || (
                                <Bot className="h-5 w-5" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={cn(
                            "flex flex-col gap-1.5 max-w-[85%]",
                            isUser ? "items-end" : "items-start",
                          )}
                        >
                          {!isUser && (
                            <span className="text-[11px] font-semibold text-muted-foreground/80 ml-1 tracking-wide">
                              {sender?.name}
                            </span>
                          )}

                          <div
                            className={cn(
                              "px-6 py-4 shadow-sm text-[15px] leading-relaxed backdrop-blur-sm border",
                              isUser
                                ? "bg-primary text-primary-foreground rounded-[24px] rounded-tr-sm border-primary/20 shadow-primary/10"
                                : "bg-white/60 dark:bg-white/5 text-foreground rounded-[24px] rounded-tl-sm border-white/20 shadow-black/5",
                            )}
                          >
                            {(!msg.content ||
                              msg.content.trim().length === 0) &&
                            !isUser ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="flex gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.2s]" />
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.1s]" />
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                                </div>
                                <span className="uppercase tracking-[0.2em] text-[11px] font-semibold">
                                  Thinking…
                                </span>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "markdown-container min-h-[20px]",
                                  isUser
                                    ? "prose-invert"
                                    : "prose-neutral dark:prose-invert",
                                )}
                              >
                                <Streamdown>
                                  {formatMentions(msg.content)}
                                </Streamdown>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {!isAtBottom && hasNewActivity && (
                <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center z-20">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto shadow-lg rounded-full bg-background/80 backdrop-blur-xl border border-white/20 hover:bg-background text-xs px-4 py-2 h-auto"
                    onClick={handleJumpToBottom}
                  >
                    {t("newMessages")}
                  </Button>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-transparent relative z-20">
              <form
                onSubmit={handleSend}
                className="max-w-4xl mx-auto flex gap-3 relative items-end"
              >
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    onKeyUp={handleInputKeyUp}
                    onClick={handleInputClick}
                    onBlur={resetMention}
                    placeholder={
                      canSendMessage
                        ? status === "idle"
                          ? t("placeholderTopic")
                          : t("placeholderMessage")
                        : t("discussionStopped")
                    }
                    disabled={!canSendMessage}
                    className="flex-1 neo-input h-14 px-6 text-[16px] placeholder:text-muted-foreground/60"
                  />
                  {mentionActive && (
                    <div className="absolute bottom-full left-0 mb-3 w-64 neo-box p-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      {mentionSuggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                          {t("noParticipantsFound")}
                        </div>
                      ) : (
                        mentionSuggestions.map((participant, index) => (
                          <button
                            key={participant.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-sm transition-all border-b-2 border-neo-black last:border-0",
                              index === mentionHighlightIndex
                                ? "bg-neo-yellow text-black"
                                : "hover:bg-neo-yellow/20",
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertMention(participant);
                            }}
                          >
                            <Avatar className="h-6 w-6 rounded-none border border-neo-black">
                              <AvatarFallback
                                className={cn(
                                  "text-[10px] rounded-none font-bold",
                                  participant.type === "ai"
                                    ? "bg-neo-purple text-black"
                                    : "bg-neo-green text-black",
                                )}
                              >
                                {participant.name.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-bold uppercase">
                              {participant.name}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || !canSendMessage}
                  className={cn(
                    "h-14 w-14 neo-btn shrink-0",
                    input.trim() && canSendMessage
                      ? "bg-neo-blue text-black hover:bg-neo-blue/90"
                      : "bg-gray-200 text-gray-400 border-gray-400 shadow-none",
                  )}
                >
                  <Send className="h-6 w-6 ml-0.5" />
                </Button>
              </form>
            </div>
          </div>

          {showParticipants && (
            <ParticipantsSidebar
              sessionId={sessionId}
              participants={participants}
              mode={mode}
              onClose={() => setShowParticipants(false)}
            />
          )}
        </div>
      </div>

      <Dialog
        open={isSummaryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSummaryDialog();
          } else {
            setIsSummaryDialogOpen(true);
          }
        }}
      >
        <DialogContent className="neo-box p-0 overflow-hidden sm:max-w-[425px]">
          <DialogHeader className="bg-neo-yellow border-b-2 border-neo-black p-6">
            <DialogTitle className="text-xl font-bold uppercase">
              {t("generateSummary")}
            </DialogTitle>
            <DialogDescription className="text-black font-medium">
              {t("selectSummarizer")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label className="font-bold uppercase">{t("summarizer")}</Label>
              <Select
                value={selectedSummaryModel}
                onValueChange={setSelectedSummaryModel}
                disabled={summarizableParticipants.length === 0}
              >
                <SelectTrigger className="neo-input">
                  <SelectValue placeholder={t("selectParticipant")} />
                </SelectTrigger>
                <SelectContent className="neo-box p-0">
                  {summarizableParticipants.map((participant) => (
                    <SelectItem
                      key={participant.id}
                      value={participant.id}
                      className="font-bold hover:bg-neo-yellow focus:bg-neo-yellow cursor-pointer border-b-2 border-neo-black last:border-0 p-3"
                    >
                      {participant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {summaryErrorMessage && (
              <div className="bg-neo-red text-white p-3 border-2 border-neo-black font-bold text-sm shadow-neo-sm">
                {summaryErrorMessage}
              </div>
            )}
            {summaryResult && (
              <div className="neo-box-sm p-3 text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-neo-bg">
                {summaryResult}
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button
              variant="ghost"
              onClick={closeSummaryDialog}
              className="neo-btn bg-neo-white text-neo-black hover:bg-gray-100"
            >
              {t("close")}
            </Button>
            <Button
              onClick={handleRunSummary}
              disabled={!selectedSummaryModel || isSummarizing}
              className="neo-btn bg-neo-purple text-black hover:bg-neo-purple/90"
            >
              {isSummarizing ? t("summarizing") : t("generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
