import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Pause, Play, SkipForward, Bot, User, AlertCircle, Users, Ban } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/ui/components/ui/avatar';
import { Card } from '@/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog';
import { Label } from '@/ui/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';

import { cn } from '@/ui/lib/utils';
import { Streamdown } from 'streamdown';
import { ParticipantsSidebar } from './ParticipantsSidebar';

interface ChatInterfaceProps {
  sessionId: string;
  sessionName: string;
}

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  senderId: string;
  timestamp: number;
  mentions?: string[];
}

interface Participant {
  id: string;
  name: string;
  model?: string;
  type: 'ai' | 'human';
}

export function ChatInterface({ sessionId, sessionName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('idle');
  const [mode, setMode] = useState('auto');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const evtSourceRef = useRef<EventSource | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [selectedSummaryModel, setSelectedSummaryModel] = useState('');
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [summaryErrorMessage, setSummaryErrorMessage] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState<number | null>(null);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);

  const [topic, setTopic] = useState('');
  const aiParticipants = useMemo(() => participants.filter((participant) => participant.type === 'ai'), [participants]);
  const mentionableParticipants = useMemo(
    () => participants.filter((participant) => participant.type !== 'human'),
    [participants],
  );
  const summarizableParticipants = useMemo(
    () => participants.filter((participant) => participant.type === 'ai' && participant.model),
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
        if (!res.ok) throw new Error('Failed to load session');
        const data = await res.json();
        setMessages(data.history || []);
        if (data.currentMessage) {
            setMessages(prev => [...prev, data.currentMessage]);
        }
        setStatus(data.status || 'idle');
        setMode(data.mode || 'auto');
        setParticipants(data.participants || []);
        setTopic(data.topic || '');
        setError(null);
      } catch {
        setError('Failed to load session state');
      }
    };
    fetchState();
  }, [sessionId]);

  useEffect(() => {
    if (evtSourceRef.current) {
      evtSourceRef.current.close();
    }

    const source = new EventSource('/api/stream');
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
        if (payload.type === 'connected') {
          setError(null);
          return;
        }

        if (payload.sessionId && payload.sessionId !== sessionId) {
          return;
        }

        switch (payload.type) {
          case 'status':
            if (payload.status) setStatus(payload.status);
            break;
          case 'mode':
            if (payload.mode) setMode(payload.mode);
            break;
          case 'participants':
            if (payload.participants) setParticipants(payload.participants);
            break;
          case 'message':
            if (payload.message) upsertMessage(payload.message);
            break;
          case 'chunk':
            if (payload.chunk) handleChunk(payload.chunk);
            break;
          case 'error':
            if (payload.error) {
              const participant = payload.error.participantId ? `${payload.error.participantId}: ` : '';
              setError(`${participant}${payload.error.error || 'An error occurred'}`);
            }
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed events
      }
    };

    source.addEventListener('message', handleEvent);
    source.onerror = () => {
      setError('Lost connection to discussion stream. Attempting to reconnect...');
    };

    return () => {
      source.removeEventListener('message', handleEvent);
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

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    },
    [],
  );

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
    setMentionQuery('');
    setMentionTriggerIndex(null);
    setMentionHighlightIndex(0);
  }, []);

  const evaluateMention = useCallback(
    (value: string, explicitCaret?: number | null) => {
      const caret =
        explicitCaret ??
        (() => {
          const el = inputRef.current;
          return el ? el.selectionStart ?? value.length : value.length;
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
        const needsSpace = after.length === 0 || !after.startsWith(' ');
        const value = `${before}${participant.name}${needsSpace ? ' ' : ''}${after}`;
        nextCaret = before.length + participant.name.length + (needsSpace ? 1 : 0);
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionHighlightIndex((prev) => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionHighlightIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionHighlightIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetMention();
      }
    },
    [mentionActive, mentionHighlightIndex, mentionSuggestions, insertMention, resetMention],
  );

  const handleInputKeyUp = useCallback(() => {
    evaluateMention(input);
  }, [evaluateMention, input]);

  const handleInputClick = useCallback(() => {
    evaluateMention(input);
  }, [evaluateMention, input]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !canSendMessage) return;
    
    await fetch(`/api/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input })
    });
    setInput('');
    resetMention();
  };

  useEffect(() => {
    if (summarizableParticipants.length === 0) {
      setSelectedSummaryModel('');
      return;
    }

    if (!selectedSummaryModel || !summarizableParticipants.some((p) => p.id === selectedSummaryModel)) {
      setSelectedSummaryModel(summarizableParticipants[0].id);
    }
  }, [summarizableParticipants, selectedSummaryModel]);

  const canSendMessage = status !== 'idle';
  const manualTurnDisabled = mode !== 'manual' || status === 'idle' || aiParticipants.length === 0;
  const summaryDisabled = status !== 'idle' || summarizableParticipants.length === 0;

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  const handleNextTurn = useCallback(async () => {
    if (manualTurnDisabled) return;
    await handleControl('next');
  }, [handleControl, manualTurnDisabled]);

  const handleResume = useCallback(async () => {
    await handleControl('resume');
  }, [handleControl]);

  const handlePause = useCallback(async () => {
    if (status === 'idle') return;
    await handleControl('pause');
  }, [handleControl, status]);

  const handleStop = useCallback(async () => {
    if (status === 'idle') return;
    await handleControl('stop');
  }, [handleControl, status]);

  const handleInterrupt = useCallback(async () => {
    if (status !== 'speaking') return;
    await handleControl('interrupt');
  }, [handleControl, status]);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: selectedSummaryModel }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate summary');
      }
      setSummaryResult(data.summary || '');
    } catch (err) {
      setSummaryErrorMessage(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  }, [selectedSummaryModel, sessionId]);

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur-md border-b z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="md:hidden w-8">
            {/* Spacer for mobile menu trigger */}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{sessionName}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("flex h-1.5 w-1.5 rounded-full", status === 'discussing' || status === 'speaking' ? "bg-green-500" : "bg-gray-300")} />
              <span className="capitalize">{status}</span>
              <span>•</span>
              <span>{participants.length} participants</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'manual' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextTurn}
              disabled={manualTurnDisabled}
              className="text-primary hover:text-primary/80 hover:bg-primary/10"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Next
            </Button>
          )}
          {status === 'paused' ? (
            <Button size="sm" variant="ghost" onClick={handleResume} className="text-green-600 hover:text-green-700 hover:bg-green-50">
              <Play className="h-4 w-4 mr-1 fill-current" />
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePause}
              className="text-foreground hover:bg-secondary"
              disabled={status === 'idle'}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleInterrupt}
            disabled={status !== 'speaking'}
            className="text-foreground hover:bg-secondary"
          >
            <Ban className="h-4 w-4 mr-1" />
            Interrupt
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleStop}
            disabled={status === 'idle'}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={summaryDisabled}
            onClick={openSummaryDialog}
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            Summarize
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowParticipants(!showParticipants)}
            className={cn("text-muted-foreground hover:text-foreground", showParticipants && "bg-secondary text-foreground")}
          >
            <Users className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative bg-background">
        <div className="flex flex-1 flex-col min-w-0">
            {error && (
                <div className="px-6 py-2 z-20">
                <div className="flex items-center gap-3 bg-destructive/10 p-3 rounded-lg text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1 font-medium">{error}</span>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-auto p-1 hover:bg-destructive/10 rounded-full">
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
                viewportClassName="p-4 md:px-6 md:py-6"
                viewportProps={{ onScroll: handleScroll }}
                >
                <div className="space-y-6 max-w-4xl mx-auto pb-8">
                {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const isSystem = msg.role === 'system';
                    const sender = participants.find((participant) => participant.id === msg.senderId);

                    if (isSystem) {
                    return (
                        <div key={msg.id} className="flex justify-center my-6">
                        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider px-2">
                            {msg.content}
                        </span>
                        </div>
                    );
                    }

                    return (
                    <div
                        key={msg.id}
                        className={cn(
                        "flex gap-3 max-w-3xl transition-all duration-300",
                        isUser ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                        )}
                    >
                        {!isUser && (
                          <Avatar className="h-8 w-8 border-0 shrink-0 mt-1">
                            <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
                                {sender?.name?.substring(0, 2).toUpperCase() || <Bot className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn("flex flex-col gap-1 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                          {!isUser && (
                            <span className="text-[11px] text-muted-foreground ml-1">
                              {sender?.name}
                            </span>
                          )}
                          
                          <div className={cn(
                            "px-4 py-2.5 shadow-sm text-[15px] leading-relaxed",
                            isUser 
                              ? "bg-primary text-primary-foreground rounded-[20px] rounded-tr-sm" 
                              : "bg-secondary text-secondary-foreground rounded-[20px] rounded-tl-sm"
                          )}>
                            <div className={cn("markdown-container min-h-[20px]", isUser ? "prose-invert" : "prose-neutral dark:prose-invert")}>
                                <Streamdown>{msg.content}</Streamdown>
                            </div>
                          </div>
                          
                          {/* Timestamp - visible on hover could be better, but for now keep it simple */}
                          {/* <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity px-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span> */}
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
                    className="pointer-events-auto shadow-sm rounded-full bg-background/90 backdrop-blur border hover:bg-background text-xs"
                    onClick={handleJumpToBottom}
                    >
                    New messages ↓
                    </Button>
                </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background border-t relative z-20">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3 relative items-end">
                  <div className="relative flex-1 bg-secondary/50 rounded-[20px] border border-transparent focus-within:border-border focus-within:bg-background transition-all duration-200">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      onKeyUp={handleInputKeyUp}
                      onClick={handleInputClick}
                      onBlur={resetMention}
                      placeholder={canSendMessage ? "iMessage" : "Discussion stopped"}
                      disabled={!canSendMessage}
                      className="flex-1 bg-transparent border-0 focus-visible:ring-0 h-10 px-4 rounded-[20px] text-[15px] placeholder:text-muted-foreground"
                    />
                    {mentionActive && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden">
                        {mentionSuggestions.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground">No participants found</div>
                        ) : (
                          mentionSuggestions.map((participant, index) => (
                            <button
                              key={participant.id}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
                                index === mentionHighlightIndex ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                              )}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                insertMention(participant);
                              }}
                            >
                              <span className="font-medium">{participant.name}</span>
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
                      "h-8 w-8 rounded-full transition-all duration-200 shrink-0 mb-1",
                      input.trim() && canSendMessage 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Send className="h-4 w-4 ml-0.5" />
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
          <DialogDescription>Select an AI participant to summarize the conversation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Summarizer</Label>
            <Select value={selectedSummaryModel} onValueChange={setSelectedSummaryModel} disabled={summarizableParticipants.length === 0}>
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
          {summaryErrorMessage && <p className="text-sm text-destructive">{summaryErrorMessage}</p>}
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
          <Button onClick={handleRunSummary} disabled={!selectedSummaryModel || isSummarizing}>
            {isSummarizing ? 'Summarizing...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
