/**
 * @module logger
 *
 * Structured logger with environment-aware output and automatic PII
 * sanitisation. Suppresses debug and info in production; routes warn
 * and error to the console (and optionally to Sentry / DataDog /
 * CloudWatch via the stub hooks inside each method).
 *
 * @example
 * ```ts
 * import { logger } from '@echno-core/lib/logger';
 *
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Token refresh failed', error);
 * ```
 */

/** Severity level for a log entry. */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Arbitrary key-value metadata attached to a log entry. */
type LogMeta = Record<string, unknown>;

/**
 * Sensitive field names that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'secret',
  'apiKey',
  'sessionToken',
  'authorization',
  'cookie',
  'csrf',
] as const;

/**
 * Sanitize object by redacting sensitive fields
 */
function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if field name contains sensitive keywords
    const isSensitive = SENSITIVE_FIELDS.some((field) =>
      lowerKey.includes(field)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Format log message with timestamp and context
 */
function formatLogMessage(
  level: LogLevel,
  message: string,
  meta?: LogMeta
): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(sanitizeLogData(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

/**
 * Check if we're in production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  return process.env.ENABLE_DEBUG_LOGS === 'true';
}

/**
 * Structured logger with PII sanitisation and environment-aware output.
 *
 * Use the exported {@link logger} singleton — do not instantiate directly.
 */
class Logger {
  /**
   * Logs at `debug` level. Output is suppressed in production unless
   * `ENABLE_DEBUG_LOGS=true`.
   *
   * @param message - The log message.
   * @param meta - Optional structured metadata; PII fields are redacted.
   */
  debug(message: string, meta?: LogMeta): void {
    if (!isProduction() || isDebugEnabled()) {
      console.debug(formatLogMessage('debug', message, meta));
    }
  }

  /**
   * Logs at `info` level. Suppressed in production; route to an external
   * service for production observability.
   *
   * @param message - The log message.
   * @param meta - Optional structured metadata; PII fields are redacted.
   */
  info(message: string, meta?: LogMeta): void {
    // In production, only log important info
    if (!isProduction()) {
      console.info(formatLogMessage('info', message, meta));
    }
    // In production, you'd send to your logging service
    // e.g., dataDog.log('info', message, meta);
  }

  /**
   * Logs at `warn` level. Always emits, including in production.
   *
   * @param message - The log message.
   * @param meta - Optional structured metadata; PII fields are redacted.
   */
  warn(message: string, meta?: LogMeta): void {
    console.warn(formatLogMessage('warn', message, meta));
    // In production, send to monitoring service
  }

  /**
   * Logs at `error` level. Always emits. Stack traces are included in
   * development only.
   *
   * @param message - The log message.
   * @param error - The caught error object (optional).
   * @param meta - Optional structured metadata; PII fields are redacted.
   */
  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta: LogMeta = {
      ...meta,
      error: error instanceof Error ? error.message : String(error),
      // Only include stack trace in development
      stack:
        !isProduction() && error instanceof Error ? error.stack : undefined,
    };

    console.error(formatLogMessage('error', message, errorMeta));

    // In production, you can integrate with error monitoring services here
    // e.g., Sentry, DataDog, CloudWatch, etc.
  }

  /**
   * Namespaced helpers for authentication-lifecycle events.
   * All metadata is passed through the internal sanitiser before logging.
   */
  auth = {
    login: (provider: string, meta?: LogMeta) => {
      this.info(`User login via ${provider}`, sanitizeLogData(meta) as LogMeta);
    },

    logout: (provider: string, meta?: LogMeta) => {
      this.info(
        `User logout from ${provider}`,
        sanitizeLogData(meta) as LogMeta
      );
    },

    tokenRefresh: (success: boolean, meta?: LogMeta) => {
      const message = success
        ? 'Token refresh successful'
        : 'Token refresh failed';
      if (success) {
        this.info(message, sanitizeLogData(meta) as LogMeta);
      } else {
        this.warn(message, sanitizeLogData(meta) as LogMeta);
      }
    },

    sessionRevoked: (sessionId: string) => {
      this.warn('Session revoked', {
        // Hash session ID instead of logging it directly
        sessionIdHash: this.hashString(sessionId),
      });
    },

    frontchannel: (action: string, meta?: LogMeta) => {
      this.info(
        `Frontchannel logout: ${action}`,
        sanitizeLogData(meta) as LogMeta
      );
    },
  };

  /**
   * Simple string hash for logging IDs (one-way)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.codePointAt(i) || 0;
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();

/**
 * Export type for external monitoring integrations
 */
export type { LogLevel, LogMeta };
