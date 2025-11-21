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
        "relative flex h-full flex-col overflow-hidden bg-neo-bg border-r-2 border-neo-black",
        className,
      )}
    >
      <div className="p-3 pb-2">
        <Button
          onClick={onCreateSession}
          className="w-full justify-start gap-2 neo-btn bg-neo-yellow text-black hover:bg-neo-yellow/90"
        >
          <MessageSquarePlus className="h-5 w-5" />
          <span className="text-base font-bold uppercase">
            {t("newDiscussion")}
          </span>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 pb-3">
        <div className="space-y-2 pb-6">
          {sessions.length === 0 && (
            <div className="text-center text-sm text-neo-black font-bold py-8 neo-box-sm border-dashed">
              {t("noConversations")}
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group relative flex items-center justify-between px-3 py-2.5 text-[13px] cursor-pointer transition-all border-2 border-neo-black mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
                currentSessionId === session.id
                  ? "bg-neo-purple text-black"
                  : "bg-neo-white text-neo-black hover:bg-neo-purple/20",
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex flex-col overflow-hidden gap-0.5">
                <span className="truncate font-bold uppercase">
                  {session.name}
                </span>
                <span
                  className={cn(
                    "text-[11px] truncate font-medium",
                    currentSessionId === session.id
                      ? "text-neo-black/80"
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
                  "h-7 w-7 transition-all rounded-none border-2 border-transparent hover:border-neo-black",
                  currentSessionId === session.id
                    ? "text-neo-black hover:bg-neo-white/20"
                    : "text-muted-foreground hover:text-neo-red hover:bg-neo-red/10",
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
