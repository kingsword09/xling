import React from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { cn } from "@/ui/lib/utils";
import { useI18n } from "@/ui/i18n";

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
  className,
}: SidebarProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-white/80 via-white/60 to-white/30 dark:from-white/5 dark:via-white/5 dark:to-white/5 backdrop-blur-2xl",
        "before:absolute before:inset-x-3 before:top-2 before:h-28 before:rounded-full before:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24),transparent_55%)] before:blur-3xl before:opacity-80 before:pointer-events-none before:-z-10",
        "after:absolute after:-left-10 after:bottom-10 after:h-28 after:w-28 after:rounded-full after:bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_55%)] after:blur-3xl after:opacity-80 after:pointer-events-none after:-z-10",
        className,
      )}
    >
      <div className="p-3 pb-2">
        <Button
          onClick={onCreateSession}
          className="w-full justify-start gap-2 rounded-xl border border-white/40 bg-white/80 dark:bg-white/10 shadow-lg shadow-primary/10 hover:bg-primary/10 hover:text-primary transition-all hover:-translate-y-[1px]"
          variant="ghost"
        >
          <MessageSquarePlus className="h-5 w-5" />
          <span className="text-base font-semibold">{t("newDiscussion")}</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <div className="space-y-2 pb-6">
          {sessions.length === 0 && (
            <div className="text-center text-sm text-muted-foreground/80 py-8 rounded-xl border border-dashed border-white/40 bg-white/70 dark:bg-white/5 backdrop-blur">
              {t("noConversations")}
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] cursor-pointer transition-all border border-transparent",
                "bg-white/70 dark:bg-white/5 backdrop-blur hover:-translate-y-[1px] shadow-sm hover:shadow-md hover:border-white/50",
                currentSessionId === session.id &&
                  "bg-gradient-to-r from-primary/90 via-primary/80 to-primary/70 text-primary-foreground shadow-lg border-primary/40",
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate font-semibold">{session.name}</span>
                <span
                  className={cn(
                    "text-[11px] truncate",
                    currentSessionId === session.id
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 transition-all rounded-lg hover:-translate-y-[1px]",
                  currentSessionId === session.id
                    ? "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
                    : "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10",
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
