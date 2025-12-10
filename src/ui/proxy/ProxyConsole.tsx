import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { filterRecords } from "./filter.ts";
import type { ProxyFilters, ProxyModelOption, ProxyRecord } from "./types.ts";
import { JsonViewer } from "./JsonViewer.tsx";
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  Copy,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Search,
} from "lucide-react";
import { ChatPanel } from "./ChatPanel.tsx";

function upsertRecord(
  list: ProxyRecord[],
  incoming: ProxyRecord,
): ProxyRecord[] {
  const idx = list.findIndex((r) => r.id === incoming.id);
  if (idx === -1) {
    return [...list, incoming].sort((a, b) => b.startedAt - a.startedAt);
  }
  const clone = [...list];
  clone[idx] = { ...clone[idx], ...incoming };
  return clone.sort((a, b) => b.startedAt - a.startedAt);
}

export function ProxyConsole() {
  const [records, setRecords] = useState<ProxyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProxyFilters>({
    provider: "all",
    statusClass: "all",
    search: "",
    model: "all",
  });
  const [detailTab, setDetailTab] = useState<
    "overview" | "request" | "response" | "timeline"
  >("overview");
  const [paneWidths, setPaneWidths] = useState<{
    list: number;
    detail: number;
    chat: number;
  }>({
    list: 32,
    detail: 38,
    chat: 30,
  });
  const [draggingHandle, setDraggingHandle] = useState<
    null | "list-detail" | "detail-chat"
  >(null);
  const [analysisErrorMap, setAnalysisErrorMap] = useState<
    Record<string, string>
  >({});
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(0);
  const [models, setModels] = useState<ProxyModelOption[]>([]);
  const [analysisModel, setAnalysisModel] = useState<string>("auto");
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [popoutSize, setPopoutSize] = useState<{ w: number; h: number }>({
    w: 420,
    h: 520,
  });
  const [popoutPos, setPopoutPos] = useState<{ x: number; y: number }>({
    x: 160,
    y: 120,
  });
  const [draggingPopout, setDraggingPopout] = useState(false);
  const [resizingPopout, setResizingPopout] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const getPaneWidth = (pane: "list" | "detail" | "chat"): string => {
    if (isNarrow) return "100%";
    const visible: Array<"list" | "detail" | "chat"> = [];
    if (showList) visible.push("list");
    if (showDetail) visible.push("detail");
    if (showChat) visible.push("chat");
    const total = visible.reduce((sum, key) => sum + paneWidths[key], 0);
    const val = paneWidths[pane];
    if (!visible.includes(pane) || total === 0) return "0%";
    return `${(val / total) * 100}%`;
  };

  const insertMention = (id: string) => {
    const token = `@${id}`;
    setChatInput((prev) => {
      const prefix = prev ?? "";
      const needsSpace =
        prefix.length > 0 && !prefix.endsWith(" ") && !prefix.endsWith("\n");
      return `${prefix}${needsSpace ? " " : ""}${token} `;
    });
  };

  // Initial snapshot
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/proxy/records");
        if (!res.ok) return;
        const data = await res.json();
        setRecords(
          (data.records as ProxyRecord[]).sort(
            (a, b) => b.startedAt - a.startedAt,
          ),
        );
        if (!selectedId && data.records?.length) {
          setSelectedId((data.records[0] as ProxyRecord).id);
        }
      } catch (err) {
        console.error("Failed to load proxy records", err);
      }
    })();
  }, []);

  // Live stream
  useEffect(() => {
    const es = new EventSource("/proxy/stream");
    es.onmessage = (ev) => {
      try {
        const rec = JSON.parse(ev.data) as ProxyRecord;
        setRecords((prev) => upsertRecord(prev, rec));
        if (!selectedId) {
          setSelectedId(rec.id);
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };
    es.onerror = () => {
      // Silence; user can refresh
    };
    return () => es.close();
  }, [selectedId]);

  // Responsive breakpoint
  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 1280);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setDetailTab("overview");
  }, [selectedId]);

  // Split drag handlers for 3 panes
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingHandle) return;
      const container = document.getElementById("proxy-console-root");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      setPaneWidths((prev) => {
        const min = 18;
        const max = 70;
        // clamp current visible panes
        if (draggingHandle === "list-detail") {
          const list = Math.min(max, Math.max(min, xPct));
          const detail = Math.min(
            max,
            Math.max(min, prev.detail + prev.list - list),
          );
          const chat = Math.max(min, 100 - list - detail);
          return normalizeWidths({ list, detail, chat }, min);
        }
        const chat = Math.min(max, Math.max(min, 100 - xPct));
        const detail = Math.min(
          max,
          Math.max(min, prev.detail + prev.chat - chat),
        );
        const list = Math.max(min, 100 - detail - chat);
        return normalizeWidths({ list, detail, chat }, min);
      });
    };
    const onUp = () => setDraggingHandle(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingHandle]);

  // Popout drag/resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingPopout) {
        setPopoutPos((pos) => ({
          x: pos.x + e.movementX,
          y: pos.y + e.movementY,
        }));
      }
      if (resizingPopout) {
        setPopoutSize((size) => ({
          w: Math.max(320, size.w + e.movementX),
          h: Math.max(260, size.h + e.movementY),
        }));
      }
    };
    const onUp = () => {
      setDraggingPopout(false);
      setResizingPopout(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingPopout, resizingPopout]);

  // Load models list
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/v1/models");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const opts = data.data
            .map((m: any, idx: number) => {
              const id =
                typeof m.id === "string" && m.id.trim().length > 0
                  ? m.id
                  : `unknown-model-${idx}`;
              return { id, label: id };
            })
            .filter((m: ProxyModelOption) => m.id);
          setModels(opts);
        }
      } catch (err) {
        console.error("Failed to load models", err);
      }
    })();
  }, []);

  const filteredRecords = useMemo(
    () => filterRecords(records, filters),
    [records, filters],
  );

  const providers = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) =>
      set.add(
        r.provider && r.provider.trim() ? r.provider : "unknown-provider",
      ),
    );
    return Array.from(set).sort();
  }, [records]);

  const selected = records.find((r) => r.id === selectedId) ?? null;
  const [showList, setShowList] = useState(true);
  const [showDetail, setShowDetail] = useState(true);
  const [showChat, setShowChat] = useState(true);

  const handleChatSend = async (text: string, modelOverride?: string) => {
    if (!selected) return;
    setChatPending((n) => n + 1);
    setAnalysisErrorMap((m) => ({ ...m, [selected.id]: "" }));
    const id = selected.id;
    let placeholderIndex = -1;
    setChatMessages((m) => {
      placeholderIndex = m.length;
      return [...m, { role: "assistant", text: "" }];
    });
    try {
      const basePrompt = normalizePrompt(text);
      const mention = buildMentionContext(basePrompt, records, id);
      const res = await fetch("/proxy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          prompt: basePrompt + (mention ? `\n\nContext:\n${mention}` : ""),
          model:
            modelOverride ??
            (analysisModel === "auto" ? undefined : analysisModel),
        }),
      });
      if (!res.ok) {
        setAnalysisErrorMap((m) => ({
          ...m,
          [id]: `Chat failed: ${res.status}`,
        }));
        return;
      }
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.replace(/^data:\s*/, "");
            try {
              const parsed = JSON.parse(payload) as {
                text?: string;
                error?: string;
              };
              if (parsed.text) {
                const chunk = parsed.text;
                setChatMessages((msgs) => {
                  if (placeholderIndex < 0 || placeholderIndex >= msgs.length)
                    return msgs;
                  const next = [...msgs];
                  const existing = next[placeholderIndex]?.text ?? "";
                  next[placeholderIndex] = {
                    role: "assistant",
                    text: existing + chunk,
                  };
                  return next;
                });
              }
              if (parsed.error) {
                setAnalysisErrorMap((m) => ({
                  ...m,
                  [id]: parsed.error ?? "",
                }));
              }
            } catch {
              // ignore
            }
          }
        }
      } else {
        const bodyText = await res.text();
        setChatMessages((msgs) => {
          if (placeholderIndex < 0 || placeholderIndex >= msgs.length) {
            return [...msgs, { role: "assistant", text: bodyText }];
          }
          const next = [...msgs];
          next[placeholderIndex] = { role: "assistant", text: bodyText };
          return next;
        });
      }
    } catch (err) {
      setAnalysisErrorMap((m) => ({
        ...m,
        [selected.id]: (err as Error).message,
      }));
    } finally {
      setChatPending((n) => Math.max(0, n - 1));
    }
  };

  const handleExport = async (format: "har" | "json") => {
    const ids = filteredRecords.map((r) => r.id).join(",");
    const res = await fetch(`/proxy/export?format=${format}&ids=${ids}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxy-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div id="proxy-console-root" className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3 select-none">
        <div className="flex items-center gap-2">
          <div className="relative w-60">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search path/model..."
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
              className="pl-8"
            />
          </div>
          <Select
            value={filters.provider || "all"}
            onValueChange={(val) =>
              setFilters((f) => ({ ...f, provider: val || "all" }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {providers.map((p) => {
                const value = p && p.trim() ? p : "unknown-provider";
                const label =
                  value === "unknown-provider" ? "Unknown provider" : p;
                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select
            value={filters.model || "all"}
            onValueChange={(val) =>
              setFilters((f) => ({ ...f, model: val || "all" }))
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {models.map((m, idx) => {
                const value =
                  m.id && m.id.trim() ? m.id : `unknown-model-${idx}`;
                const label =
                  m.label && m.label.trim() ? m.label : "Unknown model";
                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select
            value={filters.statusClass || "all"}
            onValueChange={(val) =>
              setFilters((f) => ({ ...f, statusClass: val || "all" }))
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="2xx">2xx</SelectItem>
              <SelectItem value="4xx">4xx</SelectItem>
              <SelectItem value="5xx">5xx</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("json")}
            title="Export JSON"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport("har")}
            title="Export HAR"
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            HAR
          </Button>
          <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-background/80 shadow-neo-sm">
            <LayoutGrid className="h-4 w-4 text-foreground/70" />
            <Button
              size="icon"
              variant={showList ? "neo" : "ghost"}
              className="h-8 w-8"
              title={showList ? "Hide list" : "Show list"}
              onClick={() => setShowList((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                aria-hidden="true"
                focusable="false"
              >
                <rect
                  x="3"
                  y="4"
                  width="6"
                  height="16"
                  rx="1.5"
                  className="fill-current"
                />
                <rect
                  x="11"
                  y="4"
                  width="10"
                  height="16"
                  rx="1.5"
                  className="fill-transparent stroke-current"
                  strokeWidth="1.6"
                />
              </svg>
            </Button>
            <Button
              size="icon"
              variant={showDetail ? "neo" : "ghost"}
              className="h-8 w-8"
              title={showDetail ? "Hide detail" : "Show detail"}
              onClick={() => setShowDetail((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                aria-hidden="true"
                focusable="false"
              >
                <rect
                  x="3"
                  y="4"
                  width="6"
                  height="16"
                  rx="1.5"
                  className="fill-transparent stroke-current"
                  strokeWidth="1.6"
                />
                <rect
                  x="10"
                  y="4"
                  width="6"
                  height="16"
                  rx="1.5"
                  className="fill-current"
                />
                <rect
                  x="17"
                  y="4"
                  width="4"
                  height="16"
                  rx="1.5"
                  className="fill-transparent stroke-current"
                  strokeWidth="1.6"
                />
              </svg>
            </Button>
            <Button
              size="icon"
              variant={showChat ? "neo" : "ghost"}
              className="h-8 w-8"
              title={showChat ? "Hide chat" : "Show chat"}
              onClick={() => setShowChat((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                aria-hidden="true"
                focusable="false"
              >
                <rect
                  x="3"
                  y="4"
                  width="10"
                  height="16"
                  rx="1.5"
                  className="fill-transparent stroke-current"
                  strokeWidth="1.6"
                />
                <rect
                  x="15"
                  y="4"
                  width="6"
                  height="16"
                  rx="1.5"
                  className="fill-current"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      <div
        className={
          isNarrow ? "flex flex-col gap-3 min-h-0" : "flex flex-1 gap-0 min-h-0"
        }
      >
        {showList && (
          <div
            className="min-w-[200px] rounded-xl border p-2 bg-background/70 overflow-hidden select-none"
            style={{ width: getPaneWidth("list") }}
          >
            <div className="flex text-xs font-medium text-muted-foreground px-2 py-1 border-b">
              <div className="w-16">Status</div>
              <div className="w-16">Upstream</div>
              <div className="w-20">Provider</div>
              <div className="w-20">Model</div>
              <div className="w-16">Method</div>
              <div className="flex-1">Path</div>
              <div className="w-20 text-right">Duration</div>
            </div>
            <div className="overflow-auto h-full">
              {filteredRecords.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-2 py-2 border-b hover:bg-muted/40 border-l-2 ${
                    selectedId === r.id
                      ? "bg-primary/5 border-primary"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-center text-sm">
                    <div className="w-16 font-semibold">
                      {r.status ?? r.upstreamStatus ?? "—"}
                    </div>
                    <div className="w-16 text-muted-foreground">
                      {r.upstreamStatus ?? "—"}
                    </div>
                    <div className="w-20 truncate">{r.provider ?? "—"}</div>
                    <div className="w-20 truncate text-muted-foreground">
                      {r.model ?? "—"}
                    </div>
                    <div className="w-16 uppercase">{r.method}</div>
                    <div className="flex-1 truncate">{r.path}</div>
                    <div className="w-20 text-right text-muted-foreground">
                      {(r.durationMs ?? 0).toFixed(0)} ms
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isNarrow && showList && showDetail ? (
          <div
            className="w-2 cursor-col-resize flex items-stretch select-none"
            onMouseDown={() => setDraggingHandle("list-detail")}
            title="拖动调整列表宽度"
          >
            <div className="mx-auto h-full w-[4px] rounded bg-muted hover:bg-foreground/30" />
          </div>
        ) : null}

        {showDetail && (
          <div
            className="rounded-xl border p-3 bg-background/80 flex flex-col gap-3 relative min-w-[260px] max-w-full"
            style={{ width: getPaneWidth("detail") }}
          >
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 select-none flex-wrap">
                  <div className="min-w-[220px] max-w-full">
                    <div className="text-sm font-semibold break-words">
                      {selected.method} {selected.path}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status {selected.status ?? selected.upstreamStatus ?? "—"}{" "}
                      · {selected.durationMs ?? 0} ms · Provider{" "}
                      {selected.provider ?? "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                      <Badge
                        variant="neo"
                        className="cursor-pointer"
                        title="Click to copy request ID"
                        onClick={() =>
                          void navigator.clipboard.writeText(selected.id)
                        }
                      >
                        ID {selected.id}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Insert @ID into chat"
                        className="h-8 px-2"
                        onClick={() => insertMention(selected.id)}
                      >
                        @{selected.id.slice(0, 8)}
                      </Button>
                      {selected.streaming ? (
                        <span className="text-[10px] text-primary uppercase font-semibold">
                          stream
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Pop out"
                      onClick={() => setPopoutOpen(true)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs select-none">
                  {["overview", "request", "response", "timeline"].map(
                    (tab) => (
                      <Button
                        key={tab}
                        size="sm"
                        variant={detailTab === tab ? "default" : "ghost"}
                        className="capitalize min-w-[120px] h-9"
                        onClick={() =>
                          setDetailTab(
                            tab as
                              | "overview"
                              | "request"
                              | "response"
                              | "timeline",
                          )
                        }
                      >
                        {tab}
                      </Button>
                    ),
                  )}
                </div>

                {detailTab === "overview" && (
                  <div className="text-xs rounded border bg-muted/30 p-2 space-y-1">
                    <div>Model: {selected.model ?? "—"}</div>
                    <div>Provider: {selected.provider ?? "—"}</div>
                    <div>
                      Status:{" "}
                      {selected.status ?? selected.upstreamStatus ?? "—"} ·{" "}
                      Upstream: {selected.upstreamStatus ?? "—"}
                    </div>
                    <div>
                      Duration: {selected.durationMs ?? 0} ms · Upstream:{" "}
                      {selected.upstreamDurationMs ?? 0} ms
                    </div>
                    {selected.errorMessage ? (
                      <div className="text-destructive">
                        Error: {selected.errorMessage}
                      </div>
                    ) : null}
                  </div>
                )}
                {detailTab === "request" && (
                  <DetailBlock title="Request" preview={selected.request} />
                )}
                {detailTab === "response" && (
                  <>
                    <DetailBlock
                      title="Upstream Response"
                      preview={selected.upstream}
                      badge="UPSTREAM"
                    />
                    <DetailBlock
                      title="Client Response"
                      preview={selected.response}
                      badge="CLIENT"
                    />
                  </>
                )}
                {detailTab === "timeline" && (
                  <div className="text-xs rounded border bg-muted/30 p-2 space-y-1">
                    <div>
                      Started:{" "}
                      {new Date(selected.startedAt).toLocaleTimeString()}
                    </div>
                    <div>
                      Finished:{" "}
                      {selected.finishedAt
                        ? new Date(selected.finishedAt).toLocaleTimeString()
                        : "—"}
                    </div>
                    <div>Retries: {selected.retryCount ?? 0}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a request to inspect details.
              </div>
            )}
          </div>
        )}

        {!isNarrow && showDetail && showChat ? (
          <div
            className="w-2 cursor-col-resize flex items-stretch select-none"
            onMouseDown={() => setDraggingHandle("detail-chat")}
            title="拖动调整详情/聊天宽度"
          >
            <div className="mx-auto h-full w-[4px] rounded bg-muted hover:bg-foreground/30" />
          </div>
        ) : null}

        {showChat && (
          <div
            className="rounded-xl border p-3 bg-background/80 flex flex-col gap-3 min-w-[240px] min-h-0"
            style={{ width: getPaneWidth("chat") }}
          >
            {selected ? (
              <ChatPanel
                selected={selected}
                analysisModel={analysisModel}
                onModelChange={(val) => setAnalysisModel(val)}
                models={models}
                chatInput={chatInput}
                setChatInput={setChatInput}
                chatMessages={chatMessages}
                setChatMessages={setChatMessages}
                onSend={handleChatSend}
                loading={chatPending > 0}
                error={analysisErrorMap[selected.id]}
                setError={(msg) =>
                  setAnalysisErrorMap((m) => ({ ...m, [selected.id]: msg }))
                }
                onClear={() => {
                  setChatMessages([]);
                  setChatInput("");
                  setAnalysisErrorMap((m) => ({ ...m, [selected.id]: "" }));
                }}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a request to start chatting.
              </div>
            )}
          </div>
        )}
      </div>
      {popoutOpen && selected ? (
        <div
          className="fixed z-50 border bg-background shadow-neo-lg rounded-lg overflow-hidden"
          style={{
            width: popoutSize.w,
            height: popoutSize.h,
            left: popoutPos.x,
            top: popoutPos.y,
          }}
        >
          <div
            className="h-10 px-3 flex items-center justify-between border-b cursor-move bg-muted/60"
            onMouseDown={() => setDraggingPopout(true)}
          >
            <div className="text-sm font-semibold">
              {selected.method} {selected.path}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPopoutOpen(false)}
                className="h-8 w-8"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-3 overflow-auto h-[calc(100%-52px)]">
            <div className="text-xs rounded border bg-muted/30 p-2 space-y-1 mb-2">
              <div>Model: {selected.model ?? "—"}</div>
              <div>Provider: {selected.provider ?? "—"}</div>
              <div>
                Status: {selected.status ?? selected.upstreamStatus ?? "—"} ·{" "}
                Upstream: {selected.upstreamStatus ?? "—"}
              </div>
            </div>
            <DetailBlock title="Request" preview={selected.request} />
            <DetailBlock title="Upstream" preview={selected.upstream} />
            <DetailBlock title="Response" preview={selected.response} />
          </div>
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={() => setResizingPopout(true)}
          />
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({
  title,
  preview,
  badge,
}: {
  title: string;
  badge?: string;
  preview?:
    | ProxyRecord["request"]
    | ProxyRecord["upstream"]
    | ProxyRecord["response"];
}) {
  const { raw, parsed, pretty, isJson, likelyJson } = formatBody(
    preview?.bodyPreview,
  );
  const headerEntries = Object.entries(preview?.headers ?? {});
  const [view, setView] = useState<"tree" | "raw">(isJson ? "tree" : "raw");
  const [headersOpen, setHeadersOpen] = useState(headerEntries.length <= 6);

  useEffect(() => {
    setView(isJson ? "tree" : "raw");
  }, [isJson, raw]);

  if (!preview) {
    return (
      <div className="text-sm">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-muted-foreground">No data</div>
      </div>
    );
  }

  const onCopyBody = () => {
    void navigator.clipboard.writeText(raw ?? "");
  };

  const onCopyHeaders = () => {
    if (!headerEntries.length) return;
    const json = JSON.stringify(Object.fromEntries(headerEntries), null, 2);
    void navigator.clipboard.writeText(json);
  };

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted uppercase tracking-wide">
              {badge}
            </span>
          ) : null}
          <div className="font-semibold">{title}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {isJson || likelyJson ? (
            <div className="flex rounded border bg-muted/60 overflow-hidden">
              <Button
                size="sm"
                variant={view === "tree" ? "default" : "ghost"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setView("tree")}
              >
                Tree
              </Button>
              <Button
                size="sm"
                variant={view === "raw" ? "default" : "ghost"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setView("raw")}
              >
                Raw
              </Button>
            </div>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopyBody}
            className="h-7 px-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded border bg-muted/30 p-2 text-xs max-h-80 overflow-auto">
        {headerEntries.length ? (
          <div className="rounded border bg-background/60">
            <button
              className="w-full flex items-center justify-between px-2 py-1 text-left"
              onClick={() => setHeadersOpen((o) => !o)}
            >
              <div className="flex items-center gap-2">
                {headersOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span className="text-foreground/80">
                  Headers ({headerEntries.length})
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyHeaders();
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </button>
            {headersOpen ? (
              <div className="divide-y px-2 pb-2 max-h-48 overflow-auto">
                {headerEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="py-1 flex gap-2 items-start hover:bg-muted/40 cursor-pointer rounded px-1"
                    onClick={() =>
                      void navigator.clipboard.writeText(`${k}: ${v}`)
                    }
                    title="Click to copy this header"
                  >
                    <span className="min-w-[140px] text-foreground/70 break-words">
                      {k}
                    </span>
                    <span className="font-mono text-[11px] break-all text-foreground/90">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded border bg-background/60 p-2 select-text">
          <div className="mb-1 text-foreground/70 flex items-center justify-between">
            <span>Body</span>
            {preview.truncated ? (
              <span className="text-[11px] text-amber-700">truncated</span>
            ) : null}
          </div>
          {view === "tree" ? (
            parsed ? (
              <JsonViewer value={parsed} />
            ) : (
              <div className="text-[11px] text-amber-800">
                Unable to parse JSON (possibly truncated or invalid). Switch to
                Raw.
              </div>
            )
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
              {view === "raw" && raw ? raw : (pretty ?? raw ?? "[no body]")}
              {preview.truncated ? " …(truncated)" : ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBody(
  bodyPreview?: string | Record<string, unknown> | unknown[],
): {
  raw?: string;
  pretty?: string;
  parsed?: unknown;
  isJson: boolean;
  likelyJson: boolean;
} {
  if (bodyPreview === undefined || bodyPreview === null) {
    return {
      raw: "",
      pretty: "",
      parsed: undefined,
      isJson: false,
      likelyJson: false,
    };
  }
  let raw = "";
  if (typeof bodyPreview === "string") {
    raw = bodyPreview;
  } else {
    try {
      raw = JSON.stringify(bodyPreview);
    } catch {
      raw = "[unserializable]";
    }
  }
  const trimmed = raw.trim();
  const likelyJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  try {
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    return { raw, pretty, parsed, isJson: true, likelyJson };
  } catch {
    return {
      raw,
      pretty: undefined,
      parsed: undefined,
      isJson: false,
      likelyJson,
    };
  }
}

function normalizePrompt(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  if (typeof value === "symbol" || typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value.trim();
  return "";
}

function buildMentionContext(
  basePrompt: string,
  records: ProxyRecord[],
  currentId: string,
): string {
  const mentions = Array.from(
    new Set(
      (basePrompt.match(/@([A-Za-z0-9_-]{6,})/g) || []).map((m) =>
        m.slice(1).toLowerCase(),
      ),
    ),
  );
  if (mentions.length === 0) return "";

  const pick = (token: string) =>
    records.find(
      (r) =>
        r.id.toLowerCase().includes(token) ||
        r.path.toLowerCase().includes(token),
    );

  const lines: string[] = [];
  for (const token of mentions) {
    const rec = pick(token);
    if (!rec) continue;
    lines.push(
      `[${rec.id}] ${rec.method} ${rec.path} status=${rec.status ?? rec.upstreamStatus ?? "—"} provider=${rec.provider ?? "—"} model=${rec.model ?? "—"}`,
    );
  }

  // always include the current record summary
  const current = records.find((r) => r.id === currentId);
  if (current) {
    lines.push(
      `[current ${current.id}] ${current.method} ${current.path} status=${current.status ?? current.upstreamStatus ?? "—"} provider=${current.provider ?? "—"} model=${current.model ?? "—"}`,
    );
  }

  return lines.join("\n");
}

function normalizeWidths(
  widths: { list: number; detail: number; chat: number },
  min: number,
): { list: number; detail: number; chat: number } {
  let { list, detail, chat } = widths;
  const total = list + detail + chat;
  if (total !== 100) {
    list = (list / total) * 100;
    detail = (detail / total) * 100;
    chat = 100 - list - detail;
  }
  // enforce minimums again after normalization
  if (list < min) list = min;
  if (detail < min) detail = min;
  if (chat < min) chat = min;
  const scale = 100 / (list + detail + chat);
  return {
    list: list * scale,
    detail: detail * scale,
    chat: chat * scale,
  };
}
