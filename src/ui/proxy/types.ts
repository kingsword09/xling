export interface BodyPreview {
  bodyPreview?: string;
  truncated?: boolean;
  size?: number;
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
  errorType?: string;
  errorMessage?: string;
  startedAt: number;
  finishedAt?: number;
  request: BodyPreview;
  response?: BodyPreview;
  upstream?: BodyPreview & {
    url?: string;
    status?: number;
  };
}

export interface ProxyFilters {
  provider: string;
  statusClass: string;
  search: string;
  model: string;
}

export interface ProxyModelOption {
  id: string;
  label: string;
}
