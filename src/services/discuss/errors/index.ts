/**
 * Discussion Error Classes
 * Standardized error handling with proper error codes and context
 */

export abstract class DiscussionError extends Error {
  public abstract readonly code: string;
  public abstract readonly category: 'VALIDATION' | 'PARTICIPANT' | 'STATE' | 'SECURITY' | 'PERFORMANCE' | 'NETWORK';
  public context?: unknown;

  constructor(
    message: string,
    context?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    this.context = context;
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(): boolean {
    return this.category === 'NETWORK';
  }

  /**
   * Check if error is user-correctable
   */
  isUserCorrectable(): boolean {
    return this.category === 'VALIDATION' || this.category === 'SECURITY';
  }

  /**
   * Get safe error message (without sensitive context)
   */
  getSafeMessage(): string {
    return this.message;
  }
}

export class ValidationError extends DiscussionError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly category = 'VALIDATION' as const;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, { field, value });
  }

  getSafeMessage(): string {
    if (this.context && typeof this.context === 'object' && 'field' in this.context) {
      return `${this.message} (field: ${this.context.field})`;
    }
    return this.message;
  }
}

export class ParticipantError extends DiscussionError {
  public readonly code = 'PARTICIPANT_ERROR';
  public readonly category = 'PARTICIPANT' as const;

  constructor(message: string, participantId?: string, cause?: Error) {
    super(message, { participantId, cause: cause?.message });
  }
}

export class StateError extends DiscussionError {
  public readonly code = 'STATE_ERROR';
  public readonly category = 'STATE' as const;

  constructor(message: string, currentState?: string, attemptedState?: string) {
    super(message, { currentState, attemptedState });
  }
}

export class SecurityError extends DiscussionError {
  public readonly code = 'SECURITY_ERROR';
  public readonly category = 'SECURITY' as const;

  constructor(message: string, securityIssue?: string, input?: string) {
    super(message, {
      securityIssue,
      inputLength: input?.length || 0,
      inputType: typeof input,
    });
  }

  getSafeMessage(): string {
    // Never include input details in security error messages
    return this.message;
  }
}

export class PerformanceError extends DiscussionError {
  public readonly code = 'PERFORMANCE_ERROR';
  public readonly category = 'PERFORMANCE' as const;

  constructor(message: string, metric?: string, value?: number) {
    super(message, { metric, value });
  }
}

export class NetworkError extends DiscussionError {
  public readonly code = 'NETWORK_ERROR';
  public readonly category = 'NETWORK' as const;

  constructor(message: string, url?: string, statusCode?: number, retryable: boolean = true) {
    super(message, { url, statusCode, retryable });
  }

  shouldRetry(): boolean {
    return !!(this.context && typeof this.context === 'object' && 'retryable' in this.context &&
             this.context.retryable === true);
  }
}

export class TimeoutError extends DiscussionError {
  public readonly code = 'TIMEOUT_ERROR';
  public readonly category = 'NETWORK' as const;

  constructor(message: string, operation?: string, timeoutMs?: number) {
    super(message, { operation, timeoutMs });
  }

  shouldRetry(): boolean {
    return true; // Timeouts are generally retryable
  }
}

export class ConfigurationError extends DiscussionError {
  public readonly code = 'CONFIGURATION_ERROR';
  public readonly category = 'VALIDATION' as const;

  constructor(message: string, configPath?: string, configValue?: unknown) {
    super(message, { configPath, configValue });
  }
}
