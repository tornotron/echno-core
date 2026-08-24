/**
 * @module api-client
 *
 * Lightweight HTTP client wrapping the browser `fetch` API with
 * enterprise-grade defaults: configurable per-request timeouts via
 * `AbortController`, exponential-backoff retries for transient network
 * errors, and typed JSON response parsing.
 *
 * The exported {@link api} singleton exposes bound convenience methods
 * for the common HTTP verbs. All methods throw {@link ApiError} on
 * non-2xx responses or unrecoverable network failures.
 */
/**
 * Generic wrapper around a successful backend response.
 */
export interface ApiResponse<T = unknown> {
  /** The payload returned by the backend. */
  data: T;
  /** Optional human-readable message from the backend. */
  message?: string;
  /** Operation success flag (optional depending on backend contract). */
  success: boolean;
}

/**
 * Standardized error payload returned by the backend on failure.
 */
export interface ApiErrorData {
  /** Human-readable error message from the backend. */
  message: string;
  /** HTTP status code associated with the error. */
  status: number;
  /** Additional detail string for debugging. */
  details?: string;
  /** Per-field validation errors keyed by field name. */
  errors?: Record<string, string[]>;
}

/**
 * Error thrown by {@link ApiClient} for non-2xx responses and network failures.
 *
 * Use the `is*` boolean flags instead of comparing `status` directly —
 * they remain meaningful even when `status` is 0 (network error) or 504
 * (client-side timeout).
 */
export class ApiError extends Error {
  /** HTTP status code of the failed response. `0` for network errors. */
  status: number;
  /** Additional detail string from the backend error payload. */
  details?: string;
  /** `true` for 401 and 403 responses. */
  isAuthError: boolean;
  /** `true` for 404 responses. */
  isNotFound: boolean;
  /** `true` for 5xx responses. */
  isServerError: boolean;
  /** `true` when the request was aborted due to a client-side timeout. */
  isTimeout: boolean;
  /** Per-field validation errors, present on 400/422 responses. */
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    details?: string,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.errors = errors;
    this.isAuthError = status === 401 || status === 403;
    this.isNotFound = status === 404;
    this.isServerError = status >= 500;
    this.isTimeout = false;
  }

  /**
   * Creates an {@link ApiError} representing a client-side request timeout.
   *
   * @param message - Custom message. Defaults to `'Request timeout'`.
   * @returns An `ApiError` with `status` 504 and `isTimeout` set to `true`.
   */
  static timeout(message = 'Request timeout'): ApiError {
    const error = new ApiError(message, 504);
    error.isTimeout = true;
    return error;
  }

  /**
   * Creates an {@link ApiError} representing a network-level failure
   * (no HTTP response was received).
   *
   * @param message - Custom message. Defaults to `'Network error'`.
   * @returns An `ApiError` with `status` 0.
   */
  static network(message = 'Network error'): ApiError {
    return new ApiError(message, 0);
  }
}

/** Optional per-request settings. */
interface RequestOptions {
  /** Request timeout in milliseconds. Defaults to 30 000 ms. */
  timeout?: number;
  /** Maximum retry attempts on network failure. Defaults to 2. */
  retries?: number;
  /**
   * Extra headers merged over the client's default headers for this request
   * only (e.g. an `Idempotency-Key` on a payment POST). Does not mutate the
   * client's persistent default headers.
   */
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes for file uploads
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Errors that should trigger a retry
const RETRYABLE_ERRORS = new Set(['TypeError', 'AbortError']);

/**
 * HTTP client for communicating with the Echno backend.
 *
 * Wraps `fetch` with automatic timeout enforcement, exponential-backoff
 * retries on transient failures, and centralised response parsing.
 * All public methods are generic on the expected response type `T` and
 * throw {@link ApiError} on non-2xx responses or network failures.
 *
 * Request URLs are formed by concatenating `baseURL + endpoint`. When
 * `baseURL` is relative (e.g. `/api/v1`), the final URL is resolved against
 * `globalThis.location.origin` at request time, so relative configuration
 * requires a browser runtime.
 *
 * Use the pre-configured {@link api} singleton rather than constructing
 * this class directly.
 */
class ApiClient {
  private baseURL: string;
  private headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  /**
   * Create a new ApiClient
   * @param baseURL - Base URL to prefix endpoints with. Defaults to `NEXT_PUBLIC_API_URL`.
   *   May be absolute (e.g. `https://api.example.com`) or relative (e.g. `/api/v1`).
   *   Relative values are resolved against `globalThis.location.origin` at request time
   *   and therefore only work in a browser context.
   */
  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_URL ?? '') {
    this.baseURL = baseURL;
  }

  /**
   * Set or update a default header sent with every request.
   * Call this after session is established (e.g. to set X-Organization-Id).
   */
  setDefaultHeader(key: string, value: string): void {
    (this.headers as Record<string, string>)[key] = value;
  }

  /**
   * Build a `URL` from `endpoint` + optional query params, resolving relative
   * `baseURL` against the browser origin when necessary.
   *
   * @throws {Error} when `baseURL` is relative and no browser origin is available.
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): URL {
    const target = `${this.baseURL}${endpoint}`;
    const origin =
      typeof globalThis.location === 'undefined'
        ? undefined
        : globalThis.location.origin;
    const url = new URL(target, origin);

    if (params) {
      for (const key of Object.keys(params)) {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key].toString());
        }
      }
    }

    return url;
  }

  /**
   * Handle fetch `Response` objects. Throws on non-ok responses and
   * returns parsed JSON otherwise.
   *
   * @throws {ApiError} when response.ok === false
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData: ApiErrorData = await response.json().catch(() => ({
        message: this.getDefaultErrorMessage(response.status),
        status: response.status,
      }));

      throw new ApiError(
        errorData.message || this.getDefaultErrorMessage(response.status),
        response.status,
        errorData.details,
        errorData.errors
      );
    }

    return response.json();
  }

  /**
   * Get user-friendly error message based on HTTP status code.
   */
  private getDefaultErrorMessage(status: number): string {
    switch (status) {
      case 400: {
        return 'Invalid request. Please check your input.';
      }
      case 401: {
        return 'Please sign in to continue.';
      }
      case 403: {
        return 'You do not have permission to perform this action.';
      }
      case 404: {
        return 'The requested resource was not found.';
      }
      case 408: {
        return 'Request timeout. Please try again.';
      }
      case 409: {
        return 'This action conflicts with existing data.';
      }
      case 422: {
        return 'Invalid data provided.';
      }
      case 429: {
        return 'Too many requests. Please wait and try again.';
      }
      case 500: {
        return 'Server error. Please try again later.';
      }
      case 502: {
        return 'Service temporarily unavailable.';
      }
      case 503: {
        return 'Service is currently unavailable.';
      }
      case 504: {
        return 'Request timeout. Please try again.';
      }
      default: {
        return `An error occurred (${status})`;
      }
    }
  }

  /**
   * Perform `fetch` with an AbortController-enforced timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch wrapper that retries on transient network errors using exponential backoff.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    {
      timeout = DEFAULT_TIMEOUT_MS,
      retries = DEFAULT_RETRIES,
    }: RequestOptions = {}
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.fetchWithTimeout(url, options, timeout);
      } catch (error) {
        // Handle timeout (AbortError)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = ApiError.timeout();
          // Don't retry timeouts
          throw lastError;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on network errors
        const isRetryable =
          RETRYABLE_ERRORS.has(lastError.name) ||
          lastError.message.includes('network') ||
          lastError.message.includes('fetch');

        if (!isRetryable || attempt === retries) {
          // Wrap in ApiError if not already
          if (!(lastError instanceof ApiError)) {
            lastError = ApiError.network(lastError.message);
          }
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }

    throw lastError;
  }

  /**
   * Issues a GET request.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param params - Optional query-string parameters appended to the URL.
   * @param options - Per-request timeout and retry overrides.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const response = await this.fetchWithRetry(
      url.toString(),
      { method: 'GET', headers: { ...this.headers, ...options?.headers } },
      options
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a GET request and returns the raw response body as a `Blob`.
   *
   * Use for non-JSON downloads (e.g. a `text/csv` export) where the caller
   * needs the bytes rather than parsed JSON. Errors are still surfaced as
   * {@link ApiError} by inspecting the response status before reading the body.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param params - Optional query-string parameters appended to the URL.
   * @param options - Per-request timeout and retry overrides.
   * @returns The response body as a `Blob`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async getBlob(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<Blob> {
    const url = this.buildUrl(endpoint, params);

    const response = await this.fetchWithRetry(
      url.toString(),
      { method: 'GET', headers: { ...this.headers, ...options?.headers } },
      options
    );

    if (!response.ok) {
      const errorData: ApiErrorData = await response.json().catch(() => ({
        message: this.getDefaultErrorMessage(response.status),
        status: response.status,
      }));

      throw new ApiError(
        errorData.message || this.getDefaultErrorMessage(response.status),
        response.status,
        errorData.details,
        errorData.errors
      );
    }

    return response.blob();
  }

  /**
   * Issues a POST request with a JSON body.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param data - Request body serialised to JSON.
   * @param params - Optional query-string parameters.
   * @param options - Per-request timeout and retry overrides.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const response = await this.fetchWithRetry(
      url.toString(),
      {
        method: 'POST',
        headers: { ...this.headers, ...options?.headers },
        body: data ? JSON.stringify(data) : undefined,
      },
      options
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a PUT request with a JSON body.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param data - Request body serialised to JSON.
   * @param params - Optional query-string parameters.
   * @param options - Per-request timeout and retry overrides.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const response = await this.fetchWithRetry(
      url.toString(),
      {
        method: 'PUT',
        headers: { ...this.headers, ...options?.headers },
        body: data ? JSON.stringify(data) : undefined,
      },
      options
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a PATCH request with a JSON body.
   *
   * Salary numeric values are re-serialised as floats (e.g. `45000.0`)
   * to satisfy the Java backend's Jackson type expectations.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param data - Request body serialised to JSON.
   * @param params - Optional query-string parameters.
   * @param options - Per-request timeout and retry overrides.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    // Custom JSON stringification for PATCH to handle Java backend type expectations
    let body: string | undefined;
    if (data) {
      body = JSON.stringify(data);
      // Fix: Ensure salary values are formatted as floats (with decimal) for Java backend
      // Java's Jackson parser treats "45000" as Integer but "45000.0" as Double
      body = body.replaceAll(/"salary":(\d+)([,}])/g, '"salary":$1.0$2');
    }

    const response = await this.fetchWithRetry(
      url.toString(),
      {
        method: 'PATCH',
        headers: { ...this.headers, ...options?.headers },
        body,
      },
      options
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a DELETE request.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param params - Optional query-string parameters.
   * @param options - Per-request timeout and retry overrides.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and no browser origin is available
   *   (see {@link buildUrl}).
   */
  async delete<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const response = await this.fetchWithRetry(
      url.toString(),
      { method: 'DELETE', headers: { ...this.headers, ...options?.headers } },
      options
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a POST request with `multipart/form-data`.
   *
   * The entity data is sent as a stringified JSON `'data'` field; files
   * are appended under their respective field names. Timeout defaults to
   * 120 000 ms and retries are disabled for uploads.
   *
   * Unlike the JSON request methods, the URL is passed to `fetch` as a raw
   * string. A relative `baseURL` is resolved by `fetch` itself against
   * `document.baseURI` in the browser and throws `TypeError` otherwise.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param data - Entity data serialised to JSON and sent as the `'data'` field.
   * @param files - Map of field names to `File` arrays (e.g. `{ attachments: [file1] }`).
   * @param options - Per-request timeout override (retries remain disabled).
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and `fetch` cannot resolve it
   *   (non-browser runtime).
   */
  async postMultipart<T = unknown>(
    endpoint: string,
    data: unknown,
    files?: Record<string, File[]>,
    options?: RequestOptions
  ): Promise<T> {
    const formData = new FormData();

    // Add JSON data as 'data' field
    formData.append('data', JSON.stringify(data));

    // Add files
    if (files) {
      for (const [fieldName, fileList] of Object.entries(files)) {
        for (const file of fileList) {
          formData.append(fieldName, file);
        }
      }
    }

    // Don't set Content-Type header - browser will set it with boundary
    const response = await this.fetchWithRetry(
      `${this.baseURL}${endpoint}`,
      {
        method: 'POST',
        body: formData,
        // Note: Don't include Content-Type header for multipart
      },
      { timeout: UPLOAD_TIMEOUT_MS, retries: 0, ...options }
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a PATCH request with `multipart/form-data`.
   *
   * Same envelope convention as {@link postMultipart}: entity data in a
   * `'data'` field, files appended by name. Timeout defaults to 120 000 ms;
   * retries are disabled. URL resolution follows the same rules as
   * {@link postMultipart}.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param data - Entity data serialised to JSON and sent as the `'data'` field.
   * @param files - Map of field names to `File` arrays.
   * @param options - Per-request timeout override.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and `fetch` cannot resolve it
   *   (non-browser runtime).
   */
  async patchMultipart<T = unknown>(
    endpoint: string,
    data: unknown,
    files?: Record<string, File[]>,
    options?: RequestOptions
  ): Promise<T> {
    const formData = new FormData();

    // Add JSON data as 'data' field
    formData.append('data', JSON.stringify(data));

    // Add files
    if (files) {
      for (const [fieldName, fileList] of Object.entries(files)) {
        for (const file of fileList) {
          formData.append(fieldName, file);
        }
      }
    }

    // Don't set Content-Type header - browser will set it with boundary
    const response = await this.fetchWithRetry(
      `${this.baseURL}${endpoint}`,
      {
        method: 'PATCH',
        body: formData,
        // Note: Don't include Content-Type header for multipart
      },
      { timeout: UPLOAD_TIMEOUT_MS, retries: 0, ...options }
    );

    return this.handleResponse<T>(response);
  }

  /**
   * Issues a POST request with a raw `FormData` body.
   *
   * Use when the caller constructs the `FormData` directly (e.g. simple
   * single-file uploads without a JSON `'data'` field). Timeout defaults
   * to 120 000 ms; retries are disabled. URL resolution follows the same
   * rules as {@link postMultipart}.
   *
   * @param endpoint - Path appended to `baseURL`. Must begin with `'/'`.
   * @param formData - Pre-built `FormData` object containing files and fields.
   * @param options - Per-request timeout override.
   * @returns Parsed JSON response typed as `T`.
   * @throws {ApiError} On non-2xx HTTP responses or network failure.
   * @throws {TypeError} When `baseURL` is relative and `fetch` cannot resolve it
   *   (non-browser runtime).
   */
  async postFormData<T = unknown>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<T> {
    // Don't set Content-Type header - browser will set it with boundary
    const response = await this.fetchWithRetry(
      `${this.baseURL}${endpoint}`,
      {
        method: 'POST',
        body: formData,
        // Note: Don't include Content-Type header for multipart
      },
      { timeout: UPLOAD_TIMEOUT_MS, retries: 0, ...options }
    );

    return this.handleResponse<T>(response);
  }
}

/** Shared {@link ApiClient} instance configured from `NEXT_PUBLIC_API_URL`. */
export const apiClient = new ApiClient();

/**
 * Convenience object exposing the bound HTTP methods of the shared
 * {@link apiClient}. Import `api` rather than `apiClient` directly in
 * service modules.
 */
export const api = {
  get: apiClient.get.bind(apiClient),
  getBlob: apiClient.getBlob.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  postMultipart: apiClient.postMultipart.bind(apiClient),
  patchMultipart: apiClient.patchMultipart.bind(apiClient),
  postFormData: apiClient.postFormData.bind(apiClient),
};
