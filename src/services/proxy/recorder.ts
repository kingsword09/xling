import type { ProxyErrorType } from "./types.ts";

interface BodyPreview {
  bodyPreview?: string;
  truncated?: boolean;
  size?: number;
}

interface HeadersPreview {
  headers?: Record<string, string>;
}

export interface ProxyRecord {
  id: string;
  method: string;
  path: string;
  model?: string;
  provider?: string;
  streaming?: boolean;
  status?: number;
  durationMs?: number;
  upstreamStatus?: number;
  upstreamDurationMs?: number;
  retryCount?: number;
  errorType?: ProxyErrorType;
  errorMessage?: string;
  startedAt: number;
  finishedAt?: number;
  request: HeadersPreview & BodyPreview;
  response?: HeadersPreview & BodyPreview;
  upstream?: {
    url?: string;
    status?: number;
    headers?: Record<string, string>;
  } & BodyPreview;
}

export interface ProxyEventStoreOptions {
  maxRecords?: number;
  maxBodyBytes?: number;
  captureBodies?: boolean;
}

const REDACT_HEADERS = [
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-claude-api-key",
  "x-anthropic-api-key",
  "api-key",
  "cookie",
];

function redactHeaders(
  headers: Headers | Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (REDACT_HEADERS.includes(key.toLowerCase())) {
      sanitized[key] = "[redacted]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function previewBody(
  body: unknown,
  maxBytes: number,
  captureBodies: boolean,
): BodyPreview {
  if (!captureBodies) return {};
  if (body === undefined || body === null) return {};

  let text = "";
  try {
    if (typeof body === "string") {
      text = body;
    } else {
      text = JSON.stringify(body);
    }
  } catch {
    text = "[unserializable]";
  }

  const truncated = text.length > maxBytes;
  const bodyPreview = truncated ? text.slice(0, maxBytes) : text;

  return {
    bodyPreview,
    truncated,
    size: text.length,
  };
}

type Subscriber = (record: ProxyRecord) => void;

export class ProxyEventStore {
  #records: ProxyRecord[] = [];
  #recordMap: Map<string, ProxyRecord> = new Map();
  #subscribers: Set<Subscriber> = new Set();
  #maxRecords: number;
  #maxBodyBytes: number;
  #captureBodies: boolean;

  constructor(options: ProxyEventStoreOptions = {}) {
    this.#maxRecords = options.maxRecords ?? 200;
    this.#maxBodyBytes = options.maxBodyBytes ?? 8000;
    this.#captureBodies = options.captureBodies ?? true;
  }

  startRecord(data: {
    id: string;
    method: string;
    path: string;
    model?: string;
    provider?: string;
    streaming?: boolean;
    headers?: Headers | Record<string, string>;
    body?: unknown;
  }): ProxyRecord {
    const record: ProxyRecord = {
      id: data.id,
      method: data.method,
      path: data.path,
      model: data.model,
      provider: data.provider,
      streaming: data.streaming,
      startedAt: Date.now(),
      request: {
        headers: redactHeaders(data.headers),
        ...previewBody(data.body, this.#maxBodyBytes, this.#captureBodies),
      },
    };

    this.#insertOrUpdate(record);
    return record;
  }

  updateRecord(
    id: string,
    patch: Partial<Omit<ProxyRecord, "id">>,
  ): ProxyRecord | null {
    const existing = this.#recordMap.get(id);
    if (!existing) return null;

    const merged: ProxyRecord = {
      ...existing,
      ...patch,
      request: { ...existing.request, ...patch.request },
      response: { ...existing.response, ...patch.response },
      upstream: { ...existing.upstream, ...patch.upstream },
    };

    this.#recordMap.set(id, merged);
    const idx = this.#records.findIndex((r) => r.id === id);
    if (idx !== -1) this.#records[idx] = merged;

    this.#broadcast(merged);
    return merged;
  }

  finalizeRecord(
    id: string,
    data: {
      status?: number;
      durationMs?: number;
      finishedAt?: number;
      responseHeaders?: Headers | Record<string, string>;
      responseBody?: unknown;
      upstream?: ProxyRecord["upstream"];
      errorType?: ProxyErrorType;
      errorMessage?: string;
      retryCount?: number;
    },
  ): ProxyRecord | null {
    const existing = this.#recordMap.get(id);
    if (!existing) return null;

    const response: ProxyRecord["response"] = {
      ...(existing.response ? { ...existing.response } : {}),
      headers: redactHeaders(data.responseHeaders),
      ...previewBody(
        data.responseBody,
        this.#maxBodyBytes,
        this.#captureBodies,
      ),
    };

    return this.updateRecord(id, {
      status: data.status ?? existing.status,
      durationMs: data.durationMs ?? existing.durationMs,
      finishedAt: data.finishedAt ?? Date.now(),
      response,
      upstream: { ...existing.upstream, ...data.upstream },
      errorType: data.errorType ?? existing.errorType,
      errorMessage: data.errorMessage ?? existing.errorMessage,
      retryCount: data.retryCount ?? existing.retryCount,
    });
  }

  getSnapshot(): ProxyRecord[] {
    return [...this.#records];
  }

  subscribe(subscriber: Subscriber): () => void {
    this.#subscribers.add(subscriber);
    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  #insertOrUpdate(record: ProxyRecord): void {
    const existing = this.#recordMap.get(record.id);
    if (!existing) {
      this.#records.push(record);
      this.#recordMap.set(record.id, record);
      if (this.#records.length > this.#maxRecords) {
        const removed = this.#records.shift();
        if (removed) this.#recordMap.delete(removed.id);
      }
    } else {
      this.updateRecord(record.id, record);
    }
    this.#broadcast(record);
  }

  #broadcast(record: ProxyRecord): void {
    const payload = { ...record };
    for (const sub of this.#subscribers) {
      sub(payload);
    }
  }
}

export function sanitizeHeaders(
  headers: Headers | Record<string, string> | undefined,
): Record<string, string> | undefined {
  return redactHeaders(headers);
}

export function makeBodyPreview(
  body: unknown,
  maxBytes: number,
  captureBodies: boolean,
): BodyPreview {
  return previewBody(body, maxBytes, captureBodies);
}
