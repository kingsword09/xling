import React from 'react';
import { MessageSquarePlus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { ScrollArea } from '@/ui/components/ui/scroll-area';
import { cn } from '@/ui/lib/utils';

interface Session {
  id: string;
  name: string;
  createdAt: number;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  className?: string;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  className
}: SidebarProps) {
  return (
    <div className={cn("flex flex-col h-full bg-muted/30 border-r", className)}>
      <div className="p-4 border-b">
        <Button onClick={onCreateSession} className="w-full justify-start gap-2" variant="default">
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                currentSessionId === session.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{session.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
