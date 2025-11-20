import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/components/ui/dialog";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { useI18n } from "@/ui/i18n";

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; topic: string; models: string[] }) => void;
}

export function NewSessionDialog({
  open,
  onOpenChange,
  onCreate,
}: NewSessionDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/models")
        .then((res) => res.json())
        .then((data) => setAvailableModels(data.models || []))
        .catch(() => setAvailableModels([]));

      setName("");
      setTopic("");
      setSelectedModels([]);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!name || !topic || selectedModels.length < 2) return;
    onCreate({ name, topic, models: selectedModels });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/30 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {t("newDiscussion")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("sessionName")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Ethics"
              className="rounded-xl border-white/40 bg-white/80 dark:bg-white/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("topic")}</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What to discuss?"
              className="rounded-xl border-white/40 bg-white/80 dark:bg-white/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              {t("selectModels")}
            </label>
            <ScrollArea className="h-[220px] border border-white/30 rounded-xl p-2 bg-white/70 dark:bg-white/5 backdrop-blur">
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <label
                    key={model}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-white/50"
                      checked={selectedModels.includes(model)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedModels([...selectedModels, model]);
                        else
                          setSelectedModels(
                            selectedModels.filter((m) => m !== model),
                          );
                      }}
                    />
                    <span className="text-sm font-medium">{model}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name || !topic || selectedModels.length < 2}
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            {t("createSession")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
