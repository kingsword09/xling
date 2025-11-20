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
      <DialogContent className="sm:max-w-[480px] neo-box p-0 overflow-hidden">
        <DialogHeader className="bg-neo-yellow border-b-2 border-neo-black p-6">
          <DialogTitle className="text-xl font-bold uppercase">
            {t("newDiscussion")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 p-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase">
              {t("sessionName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Ethics"
              className="neo-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase">{t("topic")}</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What to discuss?"
              className="neo-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase">
              {t("selectModels")}
            </label>
            <ScrollArea className="h-[220px] neo-box-sm p-2 bg-neo-white">
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <label
                    key={model}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-neo-yellow/20 p-2 border-2 border-transparent hover:border-neo-black transition-all"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-none border-2 border-neo-black text-neo-black focus:ring-0"
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
                    <span className="text-sm font-bold">{model}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="p-6 pt-0">
          <Button
            onClick={handleSubmit}
            disabled={!name || !topic || selectedModels.length < 2}
            className="neo-btn bg-neo-green text-black hover:bg-neo-green/90 w-full"
          >
            {t("createSession")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
