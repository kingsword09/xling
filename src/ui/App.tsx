import React, { useState, useEffect } from "react";
import { Sidebar } from "@/ui/components/Sidebar";
import { ChatInterface } from "@/ui/components/ChatInterface";
import { NewSessionDialog } from "@/ui/components/NewSessionDialog";
import { Sheet, SheetContent } from "@/ui/components/ui/sheet";
import { Button } from "@/ui/components/ui/button";
import { Menu } from "lucide-react";

interface Session {
  id: string;
  name: string;
  createdAt: number;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchSessions = async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions);

    // Auto-select first session if none selected
    if (!currentSessionId && data.sessions.length > 0) {
      setCurrentSessionId(data.sessions[0].id);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Poll for session list updates? Or use stream?
    // For simplicity, just fetch on mount.
    // In a real app, we'd listen to "session-created" events.
  }, []);

  const handleCreateSession = async (data: {
    name: string;
    topic: string;
    models: string[];
  }) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const newSession = await res.json();
    await fetchSessions();
    setCurrentSessionId(newSession.session.id);
  };

  const handleDeleteSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    await fetchSessions();
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-screen overflow-hidden bg-transparent p-4 gap-4">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[280px] h-full shrink-0">
        <div className="h-full rounded-2xl border border-white/20 bg-white/50 dark:bg-black/50 backdrop-blur-xl shadow-sm overflow-hidden">
          <Sidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={setCurrentSessionId}
            onCreateSession={() => setIsNewSessionOpen(true)}
            onDeleteSession={handleDeleteSession}
          />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[280px] border-r-0 bg-transparent shadow-none"
        >
          <div className="h-full rounded-r-2xl border-r border-y border-l-0 bg-background/80 backdrop-blur-xl overflow-hidden">
            <Sidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={(id) => {
                setCurrentSessionId(id);
                setIsMobileMenuOpen(false);
              }}
              onCreateSession={() => {
                setIsNewSessionOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Mobile Menu Trigger */}
        <div className="md:hidden absolute top-3 left-4 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            className="hover:bg-secondary/50 bg-background/30 backdrop-blur-md"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 h-full rounded-2xl border border-white/20 bg-white/50 dark:bg-black/50 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col">
          {currentSessionId && currentSession ? (
            <ChatInterface
              key={currentSessionId} // Force remount on session change
              sessionId={currentSessionId}
              sessionName={currentSession.name}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/10">
                  <Menu className="h-10 w-10 text-primary/60" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-foreground tracking-tight">
                  Start a Discussion
                </h3>
                <p className="mb-8 max-w-xs mx-auto text-base text-muted-foreground/80">
                  Select a chat from the sidebar or create a new session to
                  begin collaborating.
                </p>
                <Button
                  onClick={() => setIsNewSessionOpen(true)}
                  size="lg"
                  className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95"
                >
                  Create New Discussion
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewSessionDialog
        open={isNewSessionOpen}
        onOpenChange={setIsNewSessionOpen}
        onCreate={handleCreateSession}
      />
    </div>
  );
}

export default App;
