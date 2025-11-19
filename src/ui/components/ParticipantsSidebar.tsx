import React, { useState, useEffect } from "react";
import { Plus, Trash2, Play, User, Bot, X } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/ui/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";

interface Participant {
  id: string;
  name: string;
  model?: string;
  type: "ai" | "human";
}

interface ParticipantsSidebarProps {
  sessionId: string;
  participants: Participant[];
  mode: string;
  onClose: () => void;
}

export function ParticipantsSidebar({
  sessionId,
  participants,
  mode,
  onClose,
}: ParticipantsSidebarProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [customName, setCustomName] = useState("");
  const [speakNext, setSpeakNext] = useState(true);

  useEffect(() => {
    if (isAddDialogOpen) {
      fetch("/api/models")
        .then((res) => res.json())
        .then((data) => setAvailableModels(data.models || []))
        .catch(() => setAvailableModels([]));
      setSelectedModel("");
      setCustomName("");
      setSpeakNext(mode === "auto");
    }
  }, [isAddDialogOpen, mode]);

  const handleAddParticipant = async () => {
    if (!selectedModel) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/add-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName || selectedModel,
          model: selectedModel,
          type: "ai",
          start: speakNext,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to add participant");
      }
      setIsAddDialogOpen(false);
      setSelectedModel("");
      setCustomName("");
      setSpeakNext(true);
    } catch (error) {
      console.error("Failed to add participant:", error);
      alert(
        error instanceof Error ? error.message : "Failed to add participant",
      );
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/remove-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to remove participant");
      }
    } catch (error) {
      console.error("Failed to remove participant:", error);
      alert(
        error instanceof Error ? error.message : "Failed to remove participant",
      );
    }
  };

  const handleTriggerTurn = async (participantId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to trigger turn");
      }
    } catch (error) {
      console.error("Failed to trigger turn:", error);
      alert(error instanceof Error ? error.message : "Failed to trigger turn");
    }
  };

  return (
    <div className="flex h-full flex-col border-l bg-background w-80">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Participants</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="md:hidden"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between group rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback
                    className={
                      participant.type === "ai"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }
                  >
                    {participant.type === "ai" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate">
                  <span
                    className="text-sm font-medium truncate"
                    title={participant.name}
                  >
                    {participant.name}
                  </span>
                  {participant.model && (
                    <span
                      className="text-xs text-muted-foreground truncate"
                      title={participant.model}
                    >
                      {participant.model}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                {participant.type === "ai" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 flex-shrink-0"
                    onClick={() => handleTriggerTurn(participant.id)}
                    title={mode === "manual" ? "Speak Now" : "Force turn"}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {participant.type === "ai" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Participant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add AI Participant</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Display Name (Optional)</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={selectedModel || "e.g. Helpful Assistant"}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={speakNext}
                  onChange={(e) => setSpeakNext(e.target.checked)}
                />
                Let this participant speak next
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddParticipant} disabled={!selectedModel}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
