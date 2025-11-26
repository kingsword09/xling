import React, { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import { Separator } from "@/ui/components/ui/separator";
import { ModelSelector } from "@/ui/components/ModelSelector";
import { useI18n } from "@/ui/i18n";
import { StreamdownRenderer } from "@/ui/components/StreamdownRenderer";
import { cn } from "@/ui/lib/utils";
import { Loader2, Gavel, Crown, AlertCircle, Layout, MessageSquare, FileText, Settings } from "lucide-react";

// Types matching backend
interface CandidateResponse {
  label: string;
  model: string;
  content: string;
  error?: string;
}

interface ScoredCriteria {
  score: number;
  reason: string;
}

interface JudgeScore {
  accuracy: ScoredCriteria;
  completeness: ScoredCriteria;
  clarity: ScoredCriteria;
  utility: ScoredCriteria;
  total: number;
}

interface JudgeEvaluation {
  label: string;
  scores: JudgeScore;
  comment?: string;
}

interface JudgeResult {
  judgeModel: string;
  evaluations: JudgeEvaluation[];
  ranking: string[];
  raw: string;
}

interface AggregateScore {
  label: string;
  model: string;
  average: number;
  votes: number;
  rankingScore: number;
}

interface CouncilResult {
  question: string;
  stage1: CandidateResponse[];
  stage2: JudgeResult[];
  aggregates: AggregateScore[];
  final?: {
    model: string;
    content: string;
  };
  metadata: {
    models: string[];
    judges: string[];
    finalModel?: string;
  };
}

type CouncilProgressEvent =
  | { type: "stage1-start"; models: string[] }
  | { type: "stage1-answer"; response: CandidateResponse }
  | { type: "stage1-complete"; responses: CandidateResponse[] }
  | { type: "stage2-start"; judges: string[] }
  | { type: "stage2-review"; result: JudgeResult }
  | { type: "stage2-complete"; results: JudgeResult[]; aggregates: AggregateScore[] }
  | { type: "stage3-start"; model: string }
  | { type: "stage3-complete"; content: string }
  | { type: "complete"; result: CouncilResult }
  | { type: "error"; error: string };

type Tab = "candidates" | "evaluation" | "synthesis";

export function CouncilPanel() {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [judgeModels, setJudgeModels] = useState<string[]>([]);
  const [finalModel, setFinalModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  // State for streaming results
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage1Responses, setStage1Responses] = useState<CandidateResponse[]>([]);
  const [stage2Results, setStage2Results] = useState<JudgeResult[]>([]);
  const [aggregates, setAggregates] = useState<AggregateScore[]>([]);
  const [finalResult, setFinalResult] = useState<{ model: string; content: string } | null>(null);
  const [currentStage, setCurrentStage] = useState<"idle" | "stage1" | "stage2" | "stage3" | "complete">("idle");
  const [pendingModels, setPendingModels] = useState<string[]>([]);
  const [pendingJudges, setPendingJudges] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState<Tab>("candidates");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        setAvailableModels(data.models ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const judgesToUse = useMemo(
    () => (judgeModels.length > 0 ? judgeModels : models),
    [judgeModels, models],
  );

  const handleRun = async () => {
    if (!question.trim()) {
      setError(t("councilErrorQuestion"));
      return;
    }
    if (models.length < 2) {
      setError(t("councilErrorModels"));
      return;
    }

    // Reset state
    setError(null);
    setIsRunning(true);
    setStage1Responses([]);
    setStage2Results([]);
    setAggregates([]);
    setFinalResult(null);
    setCurrentStage("idle");
    setPendingModels([]);
    setPendingJudges([]);
    setActiveTab("candidates");

    try {
      const response = await fetch("/api/council/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          models,
          judges: judgesToUse,
          finalModel: finalModel || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start council session");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6);
            try {
              const event = JSON.parse(json) as CouncilProgressEvent;
              handleEvent(event);
            } catch (e) {
              console.error("Failed to parse event", e);
            }
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setIsRunning(false);
    }
  };

  const handleEvent = (event: CouncilProgressEvent) => {
    switch (event.type) {
      case "stage1-start":
        setCurrentStage("stage1");
        setPendingModels(event.models);
        setActiveTab("candidates");
        break;
      case "stage1-answer":
        setStage1Responses((prev) => [...prev, event.response]);
        setPendingModels((prev) => prev.filter((m) => m !== event.response.model));
        break;
      case "stage1-complete":
        setStage1Responses(event.responses);
        setPendingModels([]);
        break;
      case "stage2-start":
        setCurrentStage("stage2");
        setPendingJudges(event.judges);
        setActiveTab("evaluation");
        break;
      case "stage2-review":
        setStage2Results((prev) => [...prev, event.result]);
        setPendingJudges((prev) => prev.filter((m) => m !== event.result.judgeModel));
        break;
      case "stage2-complete":
        setStage2Results(event.results);
        setAggregates(event.aggregates);
        setPendingJudges([]);
        break;
      case "stage3-start":
        setCurrentStage("stage3");
        setFinalResult({ model: event.model, content: "" });
        setActiveTab("synthesis");
        break;
      case "stage3-complete":
        setFinalResult((prev) => prev ? { ...prev, content: event.content } : null);
        break;
      case "complete":
        setCurrentStage("complete");
        setIsRunning(false);
        break;
      case "error":
        setError(event.error);
        setIsRunning(false);
        break;
    }
  };

  return (
    <div className="flex h-full bg-neo-white overflow-hidden">
      {/* Left Sidebar - Configuration */}
      <div className="w-[320px] shrink-0 border-r-2 border-neo-black bg-white flex flex-col h-full">
        <div className="p-4 border-b-2 border-neo-black bg-neo-purple">
          <div className="text-xs font-bold uppercase tracking-widest text-black mb-1">
            {t("councilMode")}
          </div>
          <h1 className="text-xl font-black uppercase text-black">
            {t("councilSubtitle")}
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t("councilQuestion")}
            </label>
            <textarea
              className="w-full neo-input min-h-[120px] p-3 resize-none text-sm"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("councilQuestionPlaceholder")}
              disabled={isRunning}
            />
          </div>
          
          <Separator className="bg-neo-black/20" />
          
          <ModelSelector
            availableModels={availableModels}
            selectedModels={models}
            onChange={setModels}
            disabled={isRunning}
            className="text-sm"
          />
          
          <Separator className="bg-neo-black/20" />
          
          <div className="space-y-2">
             <div className="flex items-center justify-between">
              <label className="text-sm font-bold uppercase flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                {t("councilJudges")}
              </label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs hover:bg-neo-yellow/20 px-2"
                onClick={() => setJudgeModels(models)}
                disabled={isRunning}
              >
                {t("councilMirror")}
              </Button>
            </div>
            <ModelSelector
              availableModels={availableModels}
              selectedModels={judgeModels}
              onChange={setJudgeModels}
              disabled={isRunning}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase flex items-center gap-2">
              <Crown className="h-4 w-4" />
              {t("councilFinalModel")}
            </label>
            <select
              value={finalModel}
              onChange={(e) => setFinalModel(e.target.value)}
              disabled={isRunning}
              className="neo-input h-9 text-sm w-full bg-white"
            >
              <option value="">{t("councilFinalModelPlaceholder")}</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t-2 border-neo-black bg-white">
          {error && (
            <div className="mb-4 neo-box-sm bg-neo-red text-white p-2 flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          )}
          <Button
            size="lg"
            disabled={isRunning}
            onClick={() => void handleRun()}
            className="neo-btn bg-neo-green text-black hover:bg-neo-green/90 w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("councilRunning")}
              </>
            ) : (
              t("councilRun")
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Tabs */}
        <div className="flex items-center border-b-2 border-neo-black bg-white px-4 pt-4 gap-2 shrink-0">
          <TabButton 
            active={activeTab === "candidates"} 
            onClick={() => setActiveTab("candidates")}
            icon={<Layout className="h-4 w-4" />}
            label={t("councilStage1")}
            count={stage1Responses.length}
            loading={currentStage === "stage1"}
          />
          <TabButton 
            active={activeTab === "evaluation"} 
            onClick={() => setActiveTab("evaluation")}
            icon={<Gavel className="h-4 w-4" />}
            label={t("councilStage2")}
            count={stage2Results.length}
            loading={currentStage === "stage2"}
          />
          <TabButton 
            active={activeTab === "synthesis"} 
            onClick={() => setActiveTab("synthesis")}
            icon={<FileText className="h-4 w-4" />}
            label={t("councilStage3")}
            loading={currentStage === "stage3"}
          />
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-6 bg-neo-white scroll-smooth relative">
          {/* Empty State */}
          {currentStage === "idle" && !stage1Responses.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-40">
              <Settings className="h-24 w-24 mb-4 stroke-1" />
              <p className="text-xl font-black uppercase tracking-widest">Configure & Run Council</p>
            </div>
          )}

          {/* Candidates View */}
          {activeTab === "candidates" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {stage1Responses.map((c) => (
                <div key={c.label} className="neo-box bg-white flex flex-col h-full">
                  <div className="p-3 border-b-2 border-neo-black bg-neo-yellow/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-neo-yellow text-black rounded-none border-neo-black font-bold">
                        {c.label}
                      </Badge>
                      <span className="text-xs font-bold uppercase text-muted-foreground">{c.model}</span>
                    </div>
                  </div>
                  <div className="p-4 prose prose-sm max-w-none flex-1 overflow-y-auto max-h-[500px]">
                    <StreamdownRenderer content={c.content} />
                  </div>
                  {c.error && (
                    <div className="p-2 bg-red-100 text-red-600 text-xs font-bold border-t-2 border-neo-black">
                      Error: {c.error}
                    </div>
                  )}
                </div>
              ))}
              {pendingModels.map((m) => (
                <div key={m} className="neo-box bg-white/50 p-8 flex flex-col items-center justify-center gap-3 opacity-60 border-dashed min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-neo-black" />
                  <span className="font-bold uppercase text-sm">Waiting for {m}...</span>
                </div>
              ))}
            </div>
          )}

          {/* Evaluation View */}
          {activeTab === "evaluation" && (
            <div className="flex flex-col gap-6 h-full">
              {/* Score Matrix */}
              <div className="neo-box bg-white p-4 shrink-0">
                <h3 className="font-black uppercase mb-4 flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Score Matrix
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="p-3 border-2 border-neo-black bg-neo-black text-white font-bold uppercase text-left text-xs w-48">
                          Judge \ Candidate
                        </th>
                        {models.map((m) => {
                          const resp = stage1Responses.find((r) => r.model === m);
                          return (
                            <th
                              key={m}
                              className="p-2 border-2 border-neo-black bg-neo-yellow/20 font-bold text-center min-w-[100px]"
                            >
                              <div className="flex flex-col items-center">
                                {resp && (
                                  <Badge
                                    variant="outline"
                                    className="bg-neo-yellow text-black rounded-none border-neo-black mb-1"
                                  >
                                    {resp.label}
                                  </Badge>
                                )}
                                <span className="text-[10px] font-normal opacity-70 truncate max-w-[120px]">
                                  {m}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {judgesToUse.map((judge) => (
                        <tr key={judge}>
                          <td className="p-3 border-2 border-neo-black font-bold text-xs bg-white">
                            {judge}
                          </td>
                          {models.map((candidate) => {
                            const isSelf = judge === candidate;
                            const result = stage2Results.find(
                              (r) => r.judgeModel === judge,
                            );
                            const candidateLabel = stage1Responses.find(
                              (r) => r.model === candidate,
                            )?.label;
                            
                            // Match evaluation by label (e.g. "A" or "Response A")
                            const evaluation = result?.evaluations.find(
                              (e) =>
                                e.label === candidateLabel ||
                                e.label === `Response ${candidateLabel}`,
                            );

                            return (
                              <td
                                key={candidate}
                                className={cn(
                                  "p-2 border-2 border-neo-black text-center transition-colors",
                                  isSelf
                                    ? "bg-gray-100 text-gray-400"
                                    : "bg-white hover:bg-neo-yellow/10",
                                )}
                              >
                                {isSelf ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider">
                                    Self
                                  </span>
                                ) : evaluation ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-black text-xl leading-none">
                                      {evaluation.scores.total}
                                    </span>
                                    <div className="flex gap-1 mt-1">
                                      <span className="text-[9px] font-mono text-muted-foreground bg-gray-100 px-1 rounded">
                                        U:{evaluation.scores.utility.score}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    -
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                {/* Leaderboard (Sticky on Desktop) */}
                <div className="lg:w-80 shrink-0 space-y-4 overflow-y-auto">
                  <div className="neo-box bg-neo-yellow text-black p-4">
                    <h3 className="font-black uppercase flex items-center gap-2 mb-4">
                      <Crown className="h-5 w-5" />
                      Leaderboard
                    </h3>
                    {aggregates.length === 0 ? (
                      <div className="text-sm opacity-60 italic">
                        Waiting for scores...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {aggregates.map((a, i) => (
                          <div
                            key={a.label}
                            className="neo-box-sm bg-white p-2 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-black text-lg w-6 text-center">
                                {i + 1}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">
                                  {a.label}
                                </span>
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  {a.model}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-black text-lg">
                                {a.average.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {a.votes} votes
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Reviews */}
                <div className="flex-1 space-y-4 overflow-y-auto pb-4">
                  {stage2Results.map((j) => (
                    <div key={j.judgeModel} className="neo-box bg-white p-4">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-neo-black/10">
                        <Gavel className="h-4 w-4" />
                        <span className="font-bold uppercase text-sm">
                          Judge: {j.judgeModel}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {j.evaluations.map((ev) => (
                          <div
                            key={ev.label}
                            className="flex flex-col sm:flex-row gap-3 p-3 bg-neo-black/5 rounded-lg border border-neo-black/10"
                          >
                            <div className="flex items-center gap-3 sm:w-40 shrink-0">
                              <Badge
                                variant="outline"
                                className="bg-white rounded-none h-8 w-8 flex items-center justify-center p-0 text-sm"
                              >
                                {ev.label.replace("Response ", "")}
                              </Badge>
                              <div className="flex flex-col">
                                <span className="text-xs uppercase font-bold text-muted-foreground">
                                  Total
                                </span>
                                <span className="font-black text-2xl leading-none">
                                  {ev.scores.total}
                                </span>
                              </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <ScoreItem
                                labelKey="accuracy"
                                item={ev.scores.accuracy}
                              />
                              <ScoreItem
                                labelKey="completeness"
                                item={ev.scores.completeness}
                              />
                              <ScoreItem
                                labelKey="clarity"
                                item={ev.scores.clarity}
                              />
                              <ScoreItem
                                labelKey="utility"
                                item={ev.scores.utility}
                              />
                            </div>

                            {ev.comment && (
                              <div className="sm:w-1/3 text-xs italic text-muted-foreground border-l-2 border-neo-black/20 pl-3 flex items-center">
                                "{ev.comment}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {pendingJudges.map((m) => (
                    <div
                      key={m}
                      className="neo-box-sm bg-white/50 p-4 flex items-center justify-center gap-2 opacity-70 border-dashed"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-bold uppercase">
                        Judge {m} is reviewing...
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Synthesis View */}
          {activeTab === "synthesis" && (
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              {finalResult ? (
                <div className="neo-box bg-white border-neo-green shadow-neo-lg flex flex-col h-full">
                  <div className="p-4 bg-neo-green border-b-2 border-neo-black flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-black" />
                      <span className="font-black uppercase text-black">Final Synthesis</span>
                    </div>
                    <Badge variant="outline" className="bg-white text-black border-neo-black">
                      Chair: {finalResult.model}
                    </Badge>
                  </div>
                  <div className="p-8 prose prose-lg max-w-none flex-1 overflow-y-auto">
                    <StreamdownRenderer content={finalResult.content} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <FileText className="h-16 w-16 mb-4" />
                  <p className="text-lg font-bold uppercase">Synthesis not started</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count, loading }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 font-bold uppercase text-sm border-t-2 border-x-2 rounded-t-lg transition-all relative top-[2px]",
        active 
          ? "bg-neo-white border-neo-black text-black z-10" 
          : "bg-gray-100 border-transparent text-muted-foreground hover:bg-gray-200"
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
      {count !== undefined && (
        <span className={cn(
          "ml-1 text-xs px-1.5 py-0.5 rounded-full",
          active ? "bg-neo-black text-white" : "bg-gray-300 text-gray-600"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function ScoreItem({ labelKey, item, expanded = false }: { labelKey: string; item: ScoredCriteria | number; expanded?: boolean }) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(expanded);

  // Handle both object format { score, reason } and legacy number format
  const score = typeof item === "number" ? item : (item?.score ?? 0);
  const reason = typeof item === "object" ? (item?.reason ?? "") : "";

  // Color based on score (1-5 scale)
  const getScoreColor = (s: number) => {
    if (s >= 4) return "bg-green-100 text-green-700";
    if (s >= 3) return "bg-yellow-100 text-yellow-700";
    if (s >= 1) return "bg-red-100 text-red-600";
    return "bg-gray-100 text-gray-500";
  };

  return (
    <div
      className={cn(
        "flex flex-col p-2 bg-white/50 rounded border border-neo-black/5 transition-all",
        reason && "cursor-pointer hover:bg-white/80",
        isExpanded ? "min-h-[80px]" : "min-h-[60px]"
      )}
      onClick={() => reason && setIsExpanded(!isExpanded)}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
          {t(labelKey as any) || labelKey}
          {reason && (
            <span className="text-[8px] opacity-50">{isExpanded ? "▼" : "▶"}</span>
          )}
        </span>
        <span className={`font-black text-lg px-1.5 rounded ${getScoreColor(score)}`}>{score}</span>
      </div>
      {reason && (
        <p
          className={cn(
            "text-[10px] text-muted-foreground leading-tight transition-all",
            isExpanded ? "" : "line-clamp-2"
          )}
          title={reason}
        >
          {reason}
        </p>
      )}
    </div>
  );
}
