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
    <div className={cn("flex flex-col h-full bg-transparent", className)}>
      <div className="p-3">
        <Button onClick={onCreateSession} className="w-full justify-start gap-2 shadow-none border-0 bg-transparent hover:bg-background/50 text-primary font-normal px-2" variant="ghost">
          <MessageSquarePlus className="h-5 w-5" />
          <span className="text-base">New Discussion</span>
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-4">
          {sessions.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No conversations
            </div>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-[13px] cursor-pointer transition-colors",
                currentSessionId === session.id 
                  ? "bg-primary text-primary-foreground" 
                  : "text-foreground hover:bg-background/50"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate font-medium">{session.name}</span>
                <span className={cn("text-[11px] truncate", currentSessionId === session.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 transition-all rounded-md",
                  currentSessionId === session.id 
                    ? "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/20" 
                    : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
