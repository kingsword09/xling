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
import { useI18n } from "@/ui/i18n";

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
  const { t } = useI18n();
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
    <div className="flex h-full w-80 flex-col bg-gradient-to-b from-white/85 via-white/60 to-white/40 dark:from-white/10 dark:via-white/5 dark:to-white/5 backdrop-blur-2xl relative overflow-hidden border-l border-white/10">
      <div className="pointer-events-none absolute inset-x-4 top-2 h-24 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.24),transparent_55%)] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute inset-x-4 top-12 h-28 bg-[radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.24),transparent_55%)] blur-3xl opacity-60" />
      <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/40 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between p-4 border-b border-white/20 relative">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("participants")}
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/80">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t("participantsCount", { count: participants.length })}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              {mode === "auto" ? t("modeAuto") : t("modeManual")}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="md:hidden hover:bg-white/30 dark:hover:bg-white/10 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4 relative">
        <div className="space-y-3">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between group rounded-xl border border-white/30 bg-white/75 dark:bg-white/5 p-3 hover:-translate-y-[1px] hover:shadow-md hover:border-white/50 transition-all backdrop-blur relative overflow-hidden"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-primary/10 via-transparent to-transparent opacity-60" />
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-9 w-9 border border-white/50 shadow-inner">
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
                    className="text-sm font-semibold truncate"
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
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100/60 dark:hover:bg-green-500/15 flex-shrink-0 rounded-full"
                    onClick={() => handleTriggerTurn(participant.id)}
                    title={mode === "manual" ? t("next") : t("next")}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {participant.type === "ai" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 rounded-full"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    title={t("remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-white/20 bg-white/60 dark:bg-white/5 backdrop-blur relative">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 rounded-xl shadow-md shadow-primary/10">
              <Plus className="h-4 w-4" />
              {t("addParticipant")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/30 shadow-2xl">
            <DialogHeader>
              <DialogTitle>{t("addParticipant")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t("model")}</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="rounded-xl border-white/40 bg-white/70 dark:bg-white/10">
                    <SelectValue placeholder={t("model")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-white/40 bg-white/90 dark:bg-slate-900/90">
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("displayNameOptional")}</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={selectedModel || "e.g. Helpful Assistant"}
                  className="rounded-xl border-white/40 bg-white/70 dark:bg-white/10"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border border-white/40"
                  checked={speakNext}
                  onChange={(e) => setSpeakNext(e.target.checked)}
                />
                {t("speakNext")}
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="rounded-xl"
              >
                {t("close")}
              </Button>
              <Button
                onClick={handleAddParticipant}
                disabled={!selectedModel}
                className="rounded-xl"
              >
                {t("addParticipant")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
