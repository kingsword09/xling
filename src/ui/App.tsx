import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/ui/components/Sidebar';
import { ChatInterface } from '@/ui/components/ChatInterface';
import { NewSessionDialog } from '@/ui/components/NewSessionDialog';
import { Sheet, SheetContent } from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';
import { Menu } from 'lucide-react';

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
    const res = await fetch('/api/sessions');
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

  const handleCreateSession = async (data: { name: string; topic: string; models: string[] }) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const newSession = await res.json();
    await fetchSessions();
    setCurrentSessionId(newSession.session.id);
  };

  const handleDeleteSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    await fetchSessions();
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-[280px] h-full shrink-0 border-r bg-secondary/30 backdrop-blur-xl">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onCreateSession={() => setIsNewSessionOpen(true)}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[280px] border-r-0 bg-secondary/95 backdrop-blur-xl">
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
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-background">
        {/* Mobile Menu Trigger */}
        <div className="md:hidden absolute top-3 left-4 z-20">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)} className="hover:bg-secondary">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 h-full overflow-hidden flex flex-col">
          {currentSessionId && currentSession ? (
            <ChatInterface 
              key={currentSessionId} // Force remount on session change
              sessionId={currentSessionId} 
              sessionName={currentSession.name} 
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Menu className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">No Active Discussion</h3>
                <p className="mb-6 max-w-xs mx-auto text-sm">Select a chat from the sidebar or start a new discussion to begin.</p>
                <Button onClick={() => setIsNewSessionOpen(true)} size="lg" className="rounded-full px-6">
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
