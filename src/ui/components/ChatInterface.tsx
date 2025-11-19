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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState("auto");
  const [participants, setParticipants] = useState<Participant[]>([]);
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
            if (payload.status) setStatus(payload.status);
            break;
          case "mode":
            if (payload.mode) setMode(payload.mode);
            break;
          case "participants":
            if (payload.participants) setParticipants(payload.participants);
            break;
          case "message":
            if (payload.message) upsertMessage(payload.message);
            break;
          case "chunk":
            if (payload.chunk) handleChunk(payload.chunk);
            break;
          case "history-cleared":
            setMessages([]);
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
    status !== "idle" ||
    summarizableParticipants.length === 0 ||
    messages.length === 0;

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
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-white/10 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="md:hidden w-8">
              {/* Spacer for mobile menu trigger */}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                {sessionName}
              </h1>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
                <span
                  className={cn(
                    "flex h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]",
                    status === "discussing" || status === "speaking"
                      ? "bg-emerald-500 text-emerald-500 animate-pulse"
                      : "bg-amber-500 text-amber-500",
                  )}
                />
                <span className="capitalize">{status}</span>
                <span className="opacity-30">|</span>
                <span>{participants.length} participants</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "manual" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextTurn}
                disabled={manualTurnDisabled}
                className="text-primary hover:bg-primary/10 hover:text-primary rounded-full px-4"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Next
              </Button>
            )}
            {status === "speaking" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleInterrupt}
                className="rounded-full hover:bg-white/20 dark:hover:bg-white/10"
              >
                <Ban className="h-4 w-4 mr-2" />
                Interrupt
              </Button>
            )}

            {status === "paused" ? (
              <Button
                size="sm"
                onClick={handleResume}
                className="rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 border border-emerald-500/20 shadow-sm"
              >
                <Play className="h-3.5 w-3.5 mr-2 fill-current" />
                Resume
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePause}
                className="rounded-full hover:bg-white/20 dark:hover:bg-white/10"
                disabled={status === "idle"}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={aiParticipants.length === 0}
              className="rounded-full hover:bg-white/20 dark:hover:bg-white/10"
              title="Reset discussion"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={summaryDisabled}
              onClick={openSummaryDialog}
              className="rounded-full hover:bg-white/20 dark:hover:bg-white/10"
            >
              Summarize
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowParticipants(!showParticipants)}
              className={cn(
                "rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors",
                showParticipants &&
                  "bg-white/20 dark:bg-white/10 text-foreground",
              )}
            >
              <Users className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden relative bg-transparent">
          <div className="flex flex-1 flex-col min-w-0">
            {error && (
              <div className="px-6 py-2 z-20">
                <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 backdrop-blur-md p-3 rounded-xl text-sm text-destructive shadow-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 font-medium">{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="h-auto p-1 hover:bg-destructive/10 rounded-full"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="relative flex flex-1 min-h-0">
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
                                Topic
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
                    New messages ↓
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
                <div className="relative flex-1 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[28px] border border-black/10 dark:border-white/10 shadow-lg shadow-black/5 focus-within:shadow-xl focus-within:border-primary/20 focus-within:bg-white/60 dark:focus-within:bg-black/60 transition-all duration-300">
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
                          ? "Enter a topic to start discussion..."
                          : "Type a message..."
                        : "Discussion stopped"
                    }
                    disabled={!canSendMessage}
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 h-14 px-6 rounded-[28px] text-[16px] placeholder:text-muted-foreground/60"
                  />
                  {mentionActive && (
                    <div className="absolute bottom-full left-0 mb-3 w-64 rounded-2xl border border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      {mentionSuggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                          No participants found
                        </div>
                      ) : (
                        mentionSuggestions.map((participant, index) => (
                          <button
                            key={participant.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-sm transition-all",
                              index === mentionHighlightIndex
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-white/10",
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertMention(participant);
                            }}
                          >
                            <Avatar className="h-6 w-6 rounded-md">
                              <AvatarFallback className="text-[10px] rounded-md">
                                {participant.name.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
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
                    "h-14 w-14 rounded-full transition-all duration-300 shrink-0 shadow-lg",
                    input.trim() && canSendMessage
                      ? "bg-primary text-primary-foreground hover:scale-105 hover:shadow-primary/25"
                      : "bg-white/20 dark:bg-white/10 text-muted-foreground shadow-none",
                  )}
                >
                  <Send className="h-5 w-5 ml-0.5" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Summary</DialogTitle>
            <DialogDescription>
              Select an AI participant to summarize the conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Summarizer</Label>
              <Select
                value={selectedSummaryModel}
                onValueChange={setSelectedSummaryModel}
                disabled={summarizableParticipants.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a participant" />
                </SelectTrigger>
                <SelectContent>
                  {summarizableParticipants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                      {participant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {summaryErrorMessage && (
              <p className="text-sm text-destructive">{summaryErrorMessage}</p>
            )}
            {summaryResult && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {summaryResult}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSummaryDialog}>
              Close
            </Button>
            <Button
              onClick={handleRunSummary}
              disabled={!selectedSummaryModel || isSummarizing}
            >
              {isSummarizing ? "Summarizing..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
