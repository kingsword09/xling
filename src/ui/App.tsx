import React, { useState, useEffect } from "react";
import { Sidebar } from "@/ui/components/Sidebar";
import { ChatInterface } from "@/ui/components/ChatInterface";
import { NewSessionDialog } from "@/ui/components/NewSessionDialog";
import { Sheet, SheetContent } from "@/ui/components/ui/sheet";
import { Button } from "@/ui/components/ui/button";
import { Menu } from "lucide-react";
import { I18nProvider, useI18n, Locale } from "@/ui/i18n";

interface Session {
  id: string;
  name: string;
  createdAt: number;
}

function AppContent() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { t, locale, setLocale } = useI18n();

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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const toggleLocale = () => {
    setLocale(locale === "en" ? ("zh" as Locale) : "en");
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-screen overflow-hidden bg-transparent p-4 gap-4 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_50%)] opacity-80 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.14),transparent_50%)] opacity-80 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_70%,rgba(236,72,153,0.12),transparent_50%)] opacity-60 blur-3xl" />
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[280px] h-full shrink-0">
        <div className="h-full rounded-2xl border border-white/30 bg-white/60 dark:bg-black/50 backdrop-blur-2xl shadow-lg overflow-hidden">
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
          <div className="h-full rounded-r-2xl border-r border-y border-l-0 bg-white/80 dark:bg-background/80 backdrop-blur-2xl overflow-hidden shadow-xl">
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
        <div className="absolute right-4 top-3 z-30 flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleTheme}
            className="rounded-full border border-white/40 bg-white/70 dark:bg-white/10 backdrop-blur shadow-sm hover:-translate-y-[1px] transition-all"
          >
            {t("theme")}: {theme === "light" ? t("light") : t("dark")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleLocale}
            className="rounded-full border border-white/40 bg-white/70 dark:bg-white/10 backdrop-blur shadow-sm hover:-translate-y-[1px] transition-all"
          >
            {t("language")}: {locale === "en" ? "EN" : "中文"}
          </Button>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="md:hidden absolute top-3 left-4 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            className="hover:bg-secondary/50 bg-white/70 dark:bg-white/10 backdrop-blur-xl border border-white/40 shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 h-full rounded-2xl border border-white/30 bg-white/60 dark:bg-black/50 backdrop-blur-2xl shadow-xl overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/30 to-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/0 pointer-events-none" />
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
                  {t("startDiscussion")}
                </h3>
                <p className="mb-8 max-w-xs mx-auto text-base text-muted-foreground/80">
                  {t("startDiscussionBody")}
                </p>
                <Button
                  onClick={() => setIsNewSessionOpen(true)}
                  size="lg"
                  className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground"
                >
                  {t("startDiscussionCTA")}
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

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
