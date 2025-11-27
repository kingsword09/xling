/**
 * Error classifier for proxy service
 * Classifies upstream errors to determine retry and key rotation behavior
 */

import type { ProxyError, ProxyErrorType } from "./types.ts";

/**
 * Classify an error from upstream response
 */
export function classifyError(
  statusCode: number,
  body?: unknown,
  error?: Error,
): ProxyError {
  // Network errors
  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("etimedout")
    ) {
      return {
        type: "timeout",
        message: `Request timed out: ${error.message}`,
        retryable: true,
        shouldRotateKey: false,
      };
    }

    if (
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("network") ||
      message.includes("socket")
    ) {
      return {
        type: "network",
        message: `Network error: ${error.message}`,
        retryable: true,
        shouldRotateKey: false,
      };
    }

    return {
      type: "unknown",
      message: error.message,
      retryable: true,
      shouldRotateKey: false,
    };
  }

  // HTTP status code based classification
  const errorBody = parseErrorBody(body);

  switch (statusCode) {
    case 401:
      return {
        type: "auth_failure",
        message:
          errorBody?.message ?? "Authentication failed - invalid API key",
        statusCode,
        retryable: false,
        shouldRotateKey: true, // Rotate to next key
      };

    case 403:
      return {
        type: "auth_failure",
        message:
          errorBody?.message ?? "Access forbidden - check API key permissions",
        statusCode,
        retryable: false,
        shouldRotateKey: true,
      };

    case 429:
      return {
        type: "rate_limit",
        message: errorBody?.message ?? "Rate limit exceeded",
        statusCode,
        retryable: true,
        shouldRotateKey: true, // Rotate to next key to avoid rate limit
      };

    case 402:
      return {
        type: "quota_exceeded",
        message: errorBody?.message ?? "Quota exceeded - insufficient credits",
        statusCode,
        retryable: false,
        shouldRotateKey: true, // Rotate to next key with available quota
      };

    case 400:
      return {
        type: "invalid_request",
        message: errorBody?.message ?? "Invalid request",
        statusCode,
        retryable: false,
        shouldRotateKey: false,
      };

    case 404:
      return {
        type: "invalid_request",
        message: errorBody?.message ?? "Resource not found",
        statusCode,
        retryable: false,
        shouldRotateKey: false,
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        type: "upstream",
        message: errorBody?.message ?? `Upstream server error (${statusCode})`,
        statusCode,
        retryable: true,
        shouldRotateKey: false, // Server error, not key related
      };

    default:
      if (statusCode >= 400 && statusCode < 500) {
        return {
          type: "invalid_request",
          message: errorBody?.message ?? `Client error (${statusCode})`,
          statusCode,
          retryable: false,
          shouldRotateKey: false,
        };
      }

      if (statusCode >= 500) {
        return {
          type: "upstream",
          message: errorBody?.message ?? `Server error (${statusCode})`,
          statusCode,
          retryable: true,
          shouldRotateKey: false,
        };
      }

      return {
        type: "unknown",
        message: errorBody?.message ?? `Unknown error (${statusCode})`,
        statusCode,
        retryable: false,
        shouldRotateKey: false,
      };
  }
}

/**
 * Parse error body from various formats
 */
function parseErrorBody(
  body: unknown,
): { message?: string; code?: string } | null {
  if (!body) return null;

  const toSafeString = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value === null || value === undefined) return "";

    if (value instanceof Error && typeof value.message === "string") {
      return value.message;
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[object Object]";
      }
    }

    if (typeof value === "symbol") return value.toString();
    if (typeof value === "function") return value.name || "[function]";

    return "";
  };

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { message: body };
    }
  }

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;

    // OpenAI format: { error: { message, type, code } }
    if (obj.error && typeof obj.error === "object") {
      const error = obj.error as Record<string, unknown>;
      return {
        message: toSafeString(error.message ?? ""),
        code: toSafeString(error.code ?? error.type ?? ""),
      };
    }

    // Anthropic format: { error: { type, message } }
    if (obj.type === "error" && obj.error) {
      const error = obj.error as Record<string, unknown>;
      return {
        message: toSafeString(error.message ?? ""),
        code: toSafeString(error.type ?? ""),
      };
    }

    // Generic format
    if (obj.message) {
      return {
        message: toSafeString(obj.message),
        code: obj.code ? toSafeString(obj.code) : undefined,
      };
    }
  }

  return null;
}

/**
 * Check if error indicates the key should be rotated
 */
export function shouldRotateKey(error: ProxyError): boolean {
  return error.shouldRotateKey;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: ProxyError): boolean {
  return error.retryable;
}

/**
 * Get error type from status code (quick check)
 */
export function getErrorTypeFromStatus(statusCode: number): ProxyErrorType {
  if (statusCode === 401 || statusCode === 403) return "auth_failure";
  if (statusCode === 429) return "rate_limit";
  if (statusCode === 402) return "quota_exceeded";
  if (statusCode >= 400 && statusCode < 500) return "invalid_request";
  if (statusCode >= 500) return "upstream";
  return "unknown";
}
