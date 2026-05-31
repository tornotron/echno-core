/**
 * @module api-utils
 *
 * Type definitions and utility functions for structured API response
 * envelopes used across all Echno service modules.
 *
 * Provides discriminated-union response types (`ApiSuccessResponse` /
 * `ApiErrorResponse`), type guards, factory helpers, and error message
 * extraction utilities.
 */

/**
 * Envelope for a successful API response with a typed `data` payload.
 */
export interface ApiSuccessResponse<T = unknown> {
  /** The domain payload returned by the backend. */
  data: T;
  /** Optional human-readable status message. */
  message?: string;
  /** Discriminant — always `true` for success responses. */
  success: true;
}

/**
 * Comprehensive error response structure for API errors
 * Used across all API endpoints for consistent error handling
 */
export interface ApiErrorResponse {
  /** Error category/type (e.g., 'Unauthorized', 'Validation Error') */
  error: string;
  /** Technical error message for logging/debugging */
  message: string;
  /** User-friendly error message for display in UI */
  userMessage?: string;
  /** Additional error details or context */
  details?: unknown;
  /** HTTP status code */
  statusCode?: number;
  /** Error timestamp */
  timestamp?: string;
  /** Request path that caused the error */
  path?: string;
  /** Validation errors (for 400/422 responses) */
  validationErrors?: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
  success: false;
}

/** Discriminated union of {@link ApiSuccessResponse} and {@link ApiErrorResponse}. */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard that narrows `response` to {@link ApiErrorResponse}.
 *
 * @param response - Any value, typically the raw result of an API call.
 * @returns `true` when `response` has `success: false` and an `error` field.
 */
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as { success: boolean }).success === false &&
    'error' in response
  );
}

/**
 * Type guard that narrows `response` to {@link ApiSuccessResponse}`<T>`.
 *
 * @param response - Any value, typically the raw result of an API call.
 * @returns `true` when `response` has `success: true` and a `data` field.
 */
export function isApiSuccess<T>(
  response: unknown
): response is ApiSuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as { success: boolean }).success === true &&
    'data' in response
  );
}

/**
 * Constructs a typed {@link ApiSuccessResponse} envelope.
 *
 * @param data - The domain payload to wrap.
 * @param message - Optional status message.
 * @returns An `ApiSuccessResponse<T>` with `success: true`.
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> {
  return {
    data,
    message,
    success: true,
  };
}

/**
 * Constructs a typed {@link ApiErrorResponse} envelope.
 *
 * @param error - Error category/type string (e.g. `'Unauthorized'`).
 * @param message - Technical error message for logging.
 * @param options - Optional additional fields: `userMessage`, `details`, `statusCode`, `path`, `validationErrors`.
 * @returns An `ApiErrorResponse` with `success: false` and a current `timestamp`.
 */
export function createErrorResponse(
  error: string,
  message: string,
  options?: {
    userMessage?: string;
    details?: unknown;
    statusCode?: number;
    path?: string;
    validationErrors?: Array<{
      field: string;
      message: string;
      value?: unknown;
    }>;
  }
): ApiErrorResponse {
  return {
    error,
    message,
    userMessage: options?.userMessage,
    details: options?.details,
    statusCode: options?.statusCode,
    timestamp: new Date().toISOString(),
    path: options?.path,
    validationErrors: options?.validationErrors,
    success: false,
  };
}

/**
 * Returns a user-facing string from an error object.
 *
 * Precedence: `userMessage` → `message` → generic fallback via
 * {@link extractErrorMessage}.
 *
 * @param error - An {@link ApiErrorResponse} or any unknown error.
 * @returns A display-ready error string.
 */
export function getUserFriendlyMessage(
  error: ApiErrorResponse | unknown
): string {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    const apiError = error as ApiErrorResponse;
    return (
      apiError.userMessage || apiError.message || 'An unexpected error occurred'
    );
  }

  return extractErrorMessage(error);
}

/**
 * Parses a failed `fetch` `Response` into a structured {@link ApiErrorResponse}.
 *
 * Attempts JSON parsing first; falls back to plain text. Never throws —
 * parse failures produce a `'Parse Error'` envelope instead.
 *
 * @param response - A non-ok `Response` from `fetch`.
 * @returns A resolved `ApiErrorResponse` derived from the response body.
 */
export async function parseErrorResponse(
  response: Response
): Promise<ApiErrorResponse> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const errorData = await response.json();
      // If it's already an ApiErrorResponse, return it
      if (errorData.error && errorData.message) {
        return {
          ...errorData,
          statusCode: errorData.statusCode || response.status,
          success: false,
        };
      }
      // Otherwise, construct one
      return createErrorResponse(
        'API Error',
        errorData.message || JSON.stringify(errorData),
        {
          userMessage: errorData.userMessage,
          details: errorData,
          statusCode: response.status,
        }
      );
    }

    // Handle text responses
    const text = await response.text();
    return createErrorResponse('API Error', text || `HTTP ${response.status}`, {
      userMessage: getDefaultErrorMessage(response.status),
      statusCode: response.status,
    });
  } catch (parseError) {
    return createErrorResponse(
      'Parse Error',
      'Failed to parse error response',
      {
        userMessage: getDefaultErrorMessage(response.status),
        details: parseError,
        statusCode: response.status,
      }
    );
  }
}

/**
 * Maps a numeric HTTP status code to a user-facing error string.
 *
 * @param statusCode - An HTTP status code (e.g. 404, 500).
 * @returns A human-readable message appropriate for the given status.
 */
export function getDefaultErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400: {
      return 'Invalid request. Please check your input and try again.';
    }
    case 401: {
      return 'Your session has expired. Please log in again.';
    }
    case 403: {
      return 'You do not have permission to perform this action.';
    }
    case 404: {
      return 'The requested resource was not found.';
    }
    case 409: {
      return 'Conflict detected. The resource may have been modified.';
    }
    case 422: {
      return 'Invalid data provided. Please check all fields and try again.';
    }
    case 429: {
      return 'Too many requests. Please wait a moment and try again.';
    }
    case 500: {
      return 'Server error occurred. Please try again later.';
    }
    case 502:
    case 503: {
      return 'Service is temporarily unavailable. Please try again in a few moments.';
    }
    case 504: {
      return 'Request timeout. Please check your connection and try again.';
    }
    default: {
      return 'An unexpected error occurred. Please try again.';
    }
  }
}

/**
 * Extracts a raw message string from any error value.
 *
 * Handles `Error` instances, plain strings, and objects with a `message`
 * property. Returns a generic fallback for all other shapes.
 *
 * @param error - Any caught error value.
 * @returns The extracted message string.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'An unexpected error occurred';
}

/**
 * Parses the JSON body of a `Response`, returning `fallback` on failure.
 *
 * @param response - A `fetch` `Response` object.
 * @param fallback - Value returned when `.json()` throws.
 * @returns The parsed JSON typed as `T`, or `fallback` on parse error.
 *
 * @example
 * ```ts
 * const data = await safeJsonParse<MyDto>(response, null);
 * ```
 */
export async function safeJsonParse<T = unknown>(
  response: Response,
  fallback: T
): Promise<T> {
  try {
    return await response.json();
  } catch {
    return fallback;
  }
}

/**
 * Converts any caught error into a display-ready message string.
 *
 * Applies a lookup table of common error patterns (e.g. `'Failed to fetch'`,
 * HTTP codes) before falling back to {@link extractErrorMessage}.
 *
 * @param error - Any caught error value.
 * @returns A user-facing error message.
 */
export function handleApiError(error: unknown): string {
  const message = extractErrorMessage(error);

  // Map common error messages to user-friendly versions
  const errorMap: Record<string, string> = {
    'Failed to fetch':
      'Unable to connect to the server. Please check your internet connection.',
    'Network request failed': 'Network error. Please try again.',
    Unauthorized: 'Your session has expired. Please login again.',
    '401': 'Authentication required. Please login.',
    '403': 'You do not have permission to access this resource.',
    '404': 'The requested resource was not found.',
    '500': 'Server error. Please try again later.',
  };

  // Check if any mapped error matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return message;
}

/**
 * Wraps `fetch` with automatic retries on server-side and network errors.
 *
 * Returns immediately on successful responses and client errors (4xx).
 * Retries on 5xx and network failures with exponential backoff.
 *
 * @param url - The request URL.
 * @param options - `RequestInit` options forwarded to `fetch`.
 * @param maxRetries - Maximum number of attempts. Defaults to 3.
 * @param initialDelay - Base delay in milliseconds for backoff. Defaults to 1000.
 * @returns The first successful `Response`.
 * @throws {Error} When all retry attempts are exhausted.
 *
 * @example
 * ```ts
 * const response = await fetchWithRetry('/api/data', { headers });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // If successful or client error (4xx), return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // For server errors (5xx), retry
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Wait before retrying (exponential backoff)
    if (i < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, initialDelay * Math.pow(2, i))
      );
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}
