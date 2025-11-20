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
import { cn } from "@/ui/lib/utils";

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
    <div className="flex h-full w-80 shrink-0 flex-col bg-neo-bg border-l-2 border-neo-black relative z-10">
      <div className="flex items-center justify-between p-4 border-b-2 border-neo-black bg-neo-yellow text-black">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight uppercase">
            {t("participants")}
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-bold text-black">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-neo-black bg-neo-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-neo-black">
              <span className="h-1.5 w-1.5 bg-neo-green border border-neo-black" />
              {t("participantsCount", { count: participants.length })}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-neo-black bg-neo-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-neo-black">
              <span className="h-1.5 w-1.5 bg-neo-blue border border-neo-black" />
              {mode === "auto" ? t("modeAuto") : t("modeManual")}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="md:hidden hover:bg-black/10 rounded-none"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4 relative bg-neo-bg">
        <div className="space-y-4">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 group neo-box-sm p-3 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all min-w-0"
            >
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <Avatar className="h-10 w-10 border-2 border-neo-black rounded-none">
                  <AvatarFallback
                    className={cn(
                      "rounded-none font-bold border-neo-black",
                      participant.type === "ai"
                        ? "bg-neo-purple text-black"
                        : "bg-neo-green text-black",
                    )}
                  >
                    {participant.type === "ai" ? (
                      <Bot className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate min-w-0">
                  <span
                    className="text-sm font-bold truncate"
                    title={participant.name}
                  >
                    {participant.name}
                  </span>
                  {participant.model && (
                    <span
                      className="text-xs text-muted-foreground truncate font-medium"
                      title={participant.model}
                    >
                      {participant.model}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 shrink-0">
                {participant.type === "ai" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-neo-green hover:text-black border-2 border-transparent hover:border-neo-black hover:shadow-neo-sm rounded-none"
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
                    className="h-8 w-8 hover:bg-neo-red hover:text-black border-2 border-transparent hover:border-neo-black hover:shadow-neo-sm rounded-none"
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

      <div className="p-4 border-t-2 border-neo-black bg-neo-white">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 neo-btn bg-neo-black text-neo-yellow dark:bg-neo-yellow dark:text-black hover:bg-neo-black/90 dark:hover:bg-neo-yellow/90">
              <Plus className="h-4 w-4" />
              {t("addParticipant")}
            </Button>
          </DialogTrigger>
          <DialogContent className="neo-box p-0 overflow-hidden sm:max-w-[425px]">
            <DialogHeader className="p-6 bg-neo-yellow border-b-2 border-neo-black text-black">
              <DialogTitle className="text-xl font-bold uppercase">
                {t("addParticipant")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 p-6">
              <div className="grid gap-2">
                <Label className="font-bold">{t("model")}</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="neo-input w-full">
                    <SelectValue placeholder={t("model")} />
                  </SelectTrigger>
                  <SelectContent className="neo-box border-2 border-neo-black">
                    {availableModels.map((model) => (
                      <SelectItem
                        key={model}
                        value={model}
                        className="focus:bg-neo-purple focus:text-black cursor-pointer font-medium"
                      >
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="font-bold">{t("displayNameOptional")}</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={selectedModel || "e.g. Helpful Assistant"}
                  className="neo-input"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 border-2 border-neo-black rounded-none checked:bg-neo-black checked:text-white focus:ring-0 focus:ring-offset-0"
                  checked={speakNext}
                  onChange={(e) => setSpeakNext(e.target.checked)}
                />
                {t("speakNext")}
              </label>
            </div>
            <DialogFooter className="p-6 bg-neo-white border-t-2 border-neo-black flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="neo-btn bg-neo-white hover:bg-[color:var(--neo-surface)]"
              >
                {t("close")}
              </Button>
              <Button
                onClick={handleAddParticipant}
                disabled={!selectedModel}
                className="neo-btn bg-neo-green text-black hover:bg-neo-green/90"
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
