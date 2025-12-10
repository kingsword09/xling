import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Button } from "@/ui/components/ui/button";
import { Loader2, Shield, Send } from "lucide-react";
import { StreamdownRenderer } from "@/ui/components/StreamdownRenderer";
import type { ProxyModelOption, ProxyRecord } from "./types.ts";

interface ChatPanelProps {
  selected: ProxyRecord;
  analysisModel: string;
  onModelChange: (val: string) => void;
  models: ProxyModelOption[];
  chatInput: string;
  setChatInput: (v: string) => void;
  chatMessages: Array<{ role: "user" | "assistant"; text: string }>;
  setChatMessages: React.Dispatch<
    React.SetStateAction<Array<{ role: "user" | "assistant"; text: string }>>
  >;
  onSend: (text: string, model?: string) => Promise<void>;
  loading: boolean;
  error?: string;
  setError: (msg: string) => void;
  onClear: () => void;
}

export function ChatPanel({
  selected,
  analysisModel,
  models,
  chatInput,
  setChatInput,
  chatMessages,
  setChatMessages,
  onModelChange,
  onSend,
  loading,
  error,
  setError,
  onClear,
}: ChatPanelProps) {
  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text) {
      setError("Message cannot be empty.");
      return;
    }
    setError("");
    setChatMessages((m) => [...m, { role: "user", text }]);
    setChatInput("");
    await onSend(text, analysisModel === "auto" ? undefined : analysisModel);
  };

  return (
    <div className="border-t pt-2 flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-2 select-none">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">AI Console</span>
        <span className="text-[10px] text-muted-foreground">
          Use @{selected.id} or @path fragments to reference requests
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground select-none flex-wrap">
        <span>Model:</span>
        <Select
          value={analysisModel || "auto"}
          onValueChange={(val) => {
            setError("");
            onModelChange(val || "auto");
          }}
        >
          <SelectTrigger className="w-full sm:w-56 h-8 text-xs max-w-xs">
            <SelectValue placeholder="Auto (router default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (router default)</SelectItem>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-h-0 border rounded-md bg-muted/30 overflow-auto p-2 space-y-2">
        {chatMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Ask anything about the selected request. Use @{selected.id} or @path
            keywords to target others.
          </div>
        ) : (
          chatMessages.map((m, idx) => (
            <div
              key={idx}
              className={`text-sm rounded-md p-2 border flex gap-2 ${
                m.role === "assistant"
                  ? "bg-background border-foreground/10"
                  : "bg-primary/5 border-primary/50"
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm self-start ${
                  m.role === "assistant"
                    ? "bg-foreground/10 text-foreground/80"
                    : "bg-primary text-black"
                }`}
              >
                {m.role}
              </span>
              <div className="leading-relaxed min-w-0">
                <StreamdownRenderer content={m.text} className="text-sm" />
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          placeholder="Ask the proxy AI… (use @req_xxx to reference a request)"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void handleSend()}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
