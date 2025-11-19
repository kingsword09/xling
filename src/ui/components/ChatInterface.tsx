import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Pause, Play, SkipForward, Settings2, Bot, User, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/ui/components/ui/avatar';
import { Card } from '@/ui/components/ui/card';

import { cn } from '@/ui/lib/utils';
import { Streamdown } from 'streamdown';

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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  const [topic, setTopic] = useState('');

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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    
    await fetch(`/api/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input })
    });
    setInput('');
  };

  const handleControl = async (action: string, body: any = {}) => {
    await fetch(`/api/sessions/${sessionId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h2 className="text-lg font-semibold">{sessionName}</h2>
          <p className="text-sm text-muted-foreground">{topic}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className={cn("flex h-2 w-2 rounded-full", status === 'discussing' ? "bg-green-500" : "bg-yellow-500")} />
            <span className="capitalize">{status}</span>
            <span>•</span>
            <span className="capitalize">{mode} Mode</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleControl(status === 'paused' ? 'resume' : 'pause')}>
            {status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleControl('mode', { mode: mode === 'auto' ? 'manual' : 'auto' })}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleControl('stop')}>
            Stop
          </Button>
        </div>
      </header>

      {error && (
        <div className="px-6 py-3">
          <Card className="flex items-center gap-3 border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </Card>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex flex-1 min-h-0">
        <ScrollArea
          className="flex-1 h-full"
          viewportRef={scrollViewportRef}
          viewportClassName="p-4"
          viewportProps={{ onScroll: handleScroll }}
        >
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const sender = participants.find((participant) => participant.id === msg.senderId);

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}>
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm", msg.role === 'user' ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  <div className="font-semibold text-xs opacity-70 mb-1">
                    {msg.role === 'user' ? 'You' : sender?.name || msg.role}
                  </div>
                  <div className="markdown-container min-h-[20px]">
                      <Streamdown>{msg.content}</Streamdown>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </ScrollArea>
        {!isAtBottom && hasNewActivity && (
          <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              className="pointer-events-auto shadow-md"
              onClick={handleJumpToBottom}
            >
              New messages • Jump to bottom
            </Button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Manual Controls */}
          {mode === 'manual' && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {participants.filter(p => p.type === 'ai').map(p => (
                <Button 
                  key={p.id} 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleControl('next', { participantId: p.id })}
                >
                  Next: {p.name}
                </Button>
              ))}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleControl('next')}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Next Random
              </Button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2">
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={status === 'idle' ? "Start a discussion first..." : "Type a message to participate..."}
              disabled={status === 'idle'}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || status === 'idle'}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
