/**
 * @module retry
 *
 * TanStack Query retry predicate for the shared `QueryClient`.
 *
 * Retries on 5xx, network (status 0), and rate-limit (429) failures up
 * to three times. Skips retries for 4xx client errors and 401/403/404
 * responses where retrying would not change the outcome.
 */
import { ApiError } from '@echno-core/lib/api/api-client';

/**
 * shouldRetry
 *
 * Shared retry logic for React Query hooks. Determines if a failed query
 * should be retried based on the error type and failure count.
 *
 * Retry strategy:
 * - Stop after 3 attempts
 * - Don't retry authentication errors (401, 403) or not found (404)
 * - Retry server errors (5xx), timeouts, and network errors (status 0)
 * - Retry rate limiting (429)
 * - Don't retry other client errors (4xx)
 * - Retry unknown/network errors by default
 *
 * @param failureCount - Number of consecutive failures
 * @param error - The error that triggered the failure
 * @returns boolean indicating whether to retry
 */
export function shouldRetry(failureCount: number, error: Error): boolean {
  // Stop after 3 attempts
  if (failureCount >= 3) return false;

  if (error instanceof ApiError) {
    // Don't retry auth errors or not found
    if (error.isAuthError || error.isNotFound) return false;

    // Retry server errors, timeouts, and network errors
    if (error.isServerError || error.isTimeout || error.status === 0)
      return true;

    // Retry rate limiting
    if (error.status === 429) return true;

    // Don't retry other client errors
    if (error.status >= 400 && error.status < 500) return false;
  }

  // Default: retry network errors
  return true;
}
