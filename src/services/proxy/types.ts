/**
 * Proxy service types
 */

import type {
  LoadBalanceStrategy,
  ProviderConfig,
} from "@/domain/xling/config.ts";

// Provider with apiKeys array (normalized)
interface NormalizedProvider extends ProviderConfig {
  apiKeys: string[];
}

/**
 * Provider state for tracking health and key rotation
 */
export interface ProviderState {
  name: string;
  healthy: boolean;
  currentKeyIndex: number;
  failedKeys: Set<number>;
  lastError?: string;
  lastErrorTime?: number;
  requestCount: number;
  errorCount: number;
}

/**
 * Key state for tracking individual API key health
 */
export interface KeyState {
  index: number;
  healthy: boolean;
  lastUsed?: number;
  lastError?: string;
  lastErrorTime?: number;
  cooldownUntil?: number;
}

/**
 * Load balancer interface
 */
export interface LoadBalancer {
  strategy: LoadBalanceStrategy;
  selectProvider(providers: NormalizedProvider[]): NormalizedProvider | null;
  selectKey(provider: NormalizedProvider, state: ProviderState): string | null;
  reportSuccess(providerName: string, keyIndex: number): void;
  reportError(
    providerName: string,
    keyIndex: number,
    error: ProxyError,
  ): void;
  getProviderState(providerName: string): ProviderState | undefined;
}

/**
 * Proxy error types
 */
export type ProxyErrorType =
  | "rate_limit"
  | "auth_failure"
  | "quota_exceeded"
  | "timeout"
  | "network"
  | "upstream"
  | "invalid_request"
  | "unknown";

/**
 * Proxy error with classification
 */
export interface ProxyError {
  type: ProxyErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
  shouldRotateKey: boolean;
}

/**
 * Proxy request context
 */
export interface ProxyRequestContext {
  requestId: string;
  startTime: number;
  provider?: string;
  model?: string;
  keyIndex?: number;
  retryCount: number;
}

/**
 * Proxy server options
 */
export interface ProxyServerOptions {
  host?: string;
  port?: number;
  accessKey?: string;
  logger?: boolean;
}

/**
 * Proxy server context returned after startup
 */
export interface ProxyServerContext {
  baseUrl: string;
  providers: string[];
  models: string[];
  server: unknown;
  shutdown: () => Promise<void>;
}

/**
 * Upstream request options
 */
export interface UpstreamRequestOptions {
  provider: ProxyProviderConfig;
  apiKey: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * Upstream response
 */
export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  stream?: ReadableStream<Uint8Array>;
}
