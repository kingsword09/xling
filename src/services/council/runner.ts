import { ModelRouter } from "@/services/prompt/router.ts";
import type { PromptRequest } from "@/services/prompt/types.ts";

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RUBRIC_KEYS = ["accuracy", "completeness", "clarity", "utility"] as const;

export type RubricKey = (typeof RUBRIC_KEYS)[number];

export interface CandidateResponse {
  label: string;
  model: string;
  content: string;
  error?: string;
}

export interface ScoredCriteria {
  score: number;
  reason: string;
}

export interface JudgeScore {
  accuracy: ScoredCriteria;
  completeness: ScoredCriteria;
  clarity: ScoredCriteria;
  utility: ScoredCriteria;
  total: number;
}

export interface JudgeEvaluation {
  label: string;
  scores: JudgeScore;
  comment?: string;
}

export interface JudgeResult {
  judgeModel: string;
  raw: string;
  evaluations: JudgeEvaluation[];
  ranking: string[];
}

export interface AggregateScore {
  label: string;
  model: string;
  average: number;
  votes: number;
  rankingScore: number;
}

export interface CouncilResult {
  question: string;
  stage1: CandidateResponse[];
  stage2: JudgeResult[];
  aggregates: AggregateScore[];
  final?: {
    model: string;
    content: string;
  };
  metadata: {
    rubric: RubricKey[];
    labelMap: Record<string, string>;
    models: string[];
    judges: string[];
    finalModel?: string;
  };
}

export interface CouncilRequest {
  question: string;
  models: string[];
  judgeModels?: string[];
  finalModel?: string;
  temperature?: number;
}

export type CouncilProgressEvent =
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

export async function runCouncil(
  router: ModelRouter,
  req: CouncilRequest,
  onProgress?: (event: CouncilProgressEvent) => void,
): Promise<CouncilResult> {
  const models = dedupe(req.models).filter(Boolean);
  if (models.length < 2) {
    throw new Error("At least two models are required for council mode.");
  }

  const judges = dedupe(req.judgeModels ?? models);
  const labelMap: Record<string, string> = {};

  // Stage 1
  onProgress?.({ type: "stage1-start", models });
  const stage1 = await collectResponses(router, req.question, models, onProgress);
  if (stage1.length === 0) {
    throw new Error("No models returned a response. Check configuration.");
  }
  stage1.forEach((c) => (labelMap[c.label] = c.model));
  onProgress?.({ type: "stage1-complete", responses: stage1 });

  // Stage 2
  onProgress?.({ type: "stage2-start", judges });
  const stage2: JudgeResult[] = [];
  for (const judge of judges) {
    const results = await evaluateResponses(router, req.question, judge, stage1);
    if (results) {
      stage2.push(results);
      onProgress?.({ type: "stage2-review", result: results });
    }
  }
  const aggregates = aggregateScores(stage1, stage2);
  onProgress?.({ type: "stage2-complete", results: stage2, aggregates });

  // Stage 3
  const finalModel =
    req.finalModel || aggregates[0]?.model || judges[0] || models[0];
  
  console.log("Final Model Selection:", {
    reqFinal: req.finalModel,
    agg0: aggregates[0],
    judges0: judges[0],
    models0: models[0],
    selected: finalModel
  });
  
  onProgress?.({ type: "stage3-start", model: finalModel });
  const final =
    aggregates.length > 0 && finalModel
      ? await synthesize(router, req.question, finalModel, stage1, aggregates)
      : undefined;
  
  if (final) {
    onProgress?.({ type: "stage3-complete", content: final.content });
  }

  const result: CouncilResult = {
    question: req.question,
    stage1,
    stage2,
    aggregates,
    final,
    metadata: {
      rubric: [...RUBRIC_KEYS],
      labelMap,
      models,
      judges,
      finalModel,
    },
  };

  onProgress?.({ type: "complete", result });
  return result;
}

async function collectResponses(
  router: ModelRouter,
  question: string,
  models: string[],
  onProgress?: (event: CouncilProgressEvent) => void,
): Promise<CandidateResponse[]> {
  const requests = models.map(async (model, idx): Promise<CandidateResponse> => {
    const label = formatLabel(idx);
    try {
      const res = await router.execute({
        model,
        messages: [
          {
            role: "system",
            content:
              "Answer the user's question directly. Do not mention your model name or speculate about other responders.",
          },
          { role: "user", content: question },
        ],
      });
      const response: CandidateResponse = {
        label,
        model,
        content: res.content.trim(),
      };
      
      onProgress?.({ type: "stage1-answer", response });
      return response;
    } catch (error) {
      const response: CandidateResponse = {
        label,
        model,
        content: "",
        error: (error as Error).message,
      };
      
      onProgress?.({ type: "stage1-answer", response });
      return response;
    }
  });

  const results = await Promise.all(requests);
  return results;
}

async function evaluateResponses(
  router: ModelRouter,
  question: string,
  judgeModel: string,
  candidates: CandidateResponse[],
): Promise<JudgeResult | null> {
  const visible = candidates.filter((c) => c.model !== judgeModel && !c.error && c.content.length > 0);
  if (visible.length === 0) return null;

  const prompt = buildJudgePrompt(question, visible);
  const request: PromptRequest = {
    model: judgeModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  };

  try {
    const res = await router.execute(request);
    const parsed = parseJudgeResponse(res.content);
    return {
      judgeModel,
      raw: res.content,
      evaluations: parsed.evaluations,
      ranking: parsed.ranking,
    };
  } catch (error) {
    console.error(`Judge ${judgeModel} failed:`, error);
    return null;
  }
}

async function synthesize(
  router: ModelRouter,
  question: string,
  finalModel: string,
  candidates: CandidateResponse[],
  aggregates: AggregateScore[],
) {
  const prompt = buildFinalPrompt(question, candidates, aggregates);
  const res = await router.execute({
    model: finalModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
  });

  return {
    model: finalModel,
    content: res.content.trim(),
  };
}

function buildJudgePrompt(question: string, candidates: CandidateResponse[]) {
  const responsesText = candidates
    .map(
      (c) =>
        `${c.label}:\n${c.content}\n\n`,
    )
    .join("\n");

  return `You are scoring anonymous answers to the same question.

Question:
${question}

Candidate responses:
${responsesText}

Score each response on the rubric (1-5, integers only) and provide a brief reason for each score:
- accuracy: Is it factually correct?
- completeness: Does it cover the question?
- clarity: Is it easy to follow?
- utility: Is it practically useful? (replacing usefulness)

Return ONLY a JSON object with shape:
{
  "evaluations": [
    {
      "label": "Response A",
      "scores": {
        "accuracy": { "score": 4, "reason": "..." },
        "completeness": { "score": 4, "reason": "..." },
        "clarity": { "score": 5, "reason": "..." },
        "utility": { "score": 4, "reason": "..." }
      },
      "comment": "Overall summary..."
    }
  ],
  "ranking": ["Response A", "Response B", "..."]
}

- Use every label provided.
- Do not mention model names.
- Keep reasons concise.`;
}

function buildFinalPrompt(
  question: string,
  candidates: CandidateResponse[],
  aggregates: AggregateScore[],
): string {
  const sorted = [...aggregates].sort((a, b) => b.average - a.average);
  const leaderboard = sorted
    .map(
      (a, i) =>
        `${i + 1}. ${a.label} (model ${a.model}) — avg ${a.average.toFixed(2)} from ${a.votes} votes`,
    )
    .join("\n");

  const candidateText = candidates
    .map((c) => `${c.label} (model ${c.model}):\n${c.content}\n`)
    .join("\n");

  return `You are the chair picking the best answer using peer scores.

Question:
${question}

Leaderboard (higher is better):
${leaderboard}

Candidate responses:
${candidateText}

Write a final, concise answer that:
1) Uses the best ideas from the top-ranked responses.
2) Fixes gaps or errors noted by peers.
3) Stays focused on the user's question.

Return only the answer, no preamble.`;
}

function parseJudgeResponse(text: string): {
  evaluations: JudgeEvaluation[];
  ranking: string[];
} {
  const json = extractJson(text);
  const evaluations: JudgeEvaluation[] = [];
  const ranking: string[] = [];

  if (json && Array.isArray(json.evaluations)) {
    for (const ev of json.evaluations) {
      const label = typeof ev.label === "string" ? ev.label : null;
      const scores = ev.scores;

      if (label && scores) {
        // Helper to ensure shape
        const ensureScore = (val: any): ScoredCriteria => {
          if (typeof val === "number") return { score: val, reason: "" };
          if (typeof val === "object" && typeof val.score === "number")
            return { score: val.score, reason: val.reason || "" };
          return { score: 0, reason: "Invalid format" };
        };

        const accuracy = ensureScore(scores.accuracy);
        const completeness = ensureScore(scores.completeness);
        const clarity = ensureScore(scores.clarity);
        const utility = ensureScore(scores.utility);

        const total =
          accuracy.score + completeness.score + clarity.score + utility.score;

        evaluations.push({
          label,
          scores: {
            accuracy,
            completeness,
            clarity,
            utility,
            total,
          },
          comment: typeof ev.comment === "string" ? ev.comment : undefined,
        });
      }
    }
  }

  if (json && Array.isArray(json.ranking)) {
    json.ranking.forEach((item: unknown) => {
      if (typeof item === "string") {
        ranking.push(item);
      }
    });
  }

  return { evaluations, ranking };
}

function extractJson(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function aggregateScores(
  candidates: CandidateResponse[],
  judgeResults: JudgeResult[],
): AggregateScore[] {
  const totals = new Map<string, { model: string; scores: number[]; rankScore: number }>();

  candidates.forEach((c) => {
    totals.set(c.label, { model: c.model, scores: [], rankScore: 0 });
  });

  for (const jr of judgeResults) {
    jr.evaluations.forEach((ev) => {
      const bucket = totals.get(ev.label);
      if (bucket) {
        bucket.scores.push(ev.scores.total / RUBRIC_KEYS.length);
      }
    });

    jr.ranking.forEach((label, idx) => {
      const bucket = totals.get(label);
      if (bucket) {
        bucket.rankScore += candidates.length - idx;
      }
    });
  }

  const aggregates: AggregateScore[] = [];

  for (const [label, bucket] of totals.entries()) {
    const average =
      bucket.scores.length === 0
        ? 0
        : bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length;
    aggregates.push({
      label,
      model: bucket.model,
      average: Number(average.toFixed(2)),
      votes: bucket.scores.length,
      rankingScore: bucket.rankScore,
    });
  }

  const sorted = aggregates.sort((a, b) => b.average - a.average);
  console.log("Sorted Aggregates:", JSON.stringify(sorted, null, 2));
  return sorted;
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list.map((m) => m.trim()).filter(Boolean)));
}

function formatLabel(idx: number): string {
  const letter = LABELS[idx] ?? `#${idx + 1}`;
  return `Response ${letter}`;
}

function isScoreShape(input: unknown): input is Omit<JudgeScore, "total"> {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return RUBRIC_KEYS.every(
    (k) => typeof record[k] === "number" && Number.isFinite(record[k]),
  );
}
