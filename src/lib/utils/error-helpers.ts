/**
 * @module error-helpers
 *
 * Utility functions for deriving user-facing error titles and messages
 * from {@link ApiError} and generic `Error` instances.
 *
 * Intended for use in mutation `onError` callbacks to populate toast
 * notifications with context-appropriate copy.
 */
import { ApiError } from '../api/api-client';

/**
 * getErrorMessage
 *
 * Extracts a user-friendly error message from any error object.
 * For {@link ApiError}, appends field-level validation messages from
 * `error.errors` (if present) to the base message. Returns the error's
 * message property for generic errors, or a fallback string otherwise.
 *
 * @param error - The error object (unknown type for flexibility)
 * @returns A user-friendly error message string
 *
 * @example
 * ```ts
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   toast.error('Operation Failed', { description: message });
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const base = error.details ?? error.message;
    if (error.errors && Object.keys(error.errors).length > 0) {
      const fieldMessages = Object.entries(error.errors)
        .flatMap(([field, messages]) => messages.map((m) => `${field}: ${m}`))
        .join('; ');
      return `${base} — ${fieldMessages}`;
    }
    return base;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * getErrorTitle
 *
 * Determines an appropriate toast title based on the error type.
 * Provides context-aware titles for different error scenarios
 * (authentication, timeout, server errors, network errors).
 *
 * @param error - The error object to analyze
 * @param defaultTitle - Fallback title if no specific error type is detected
 * @returns A contextual error title string
 *
 * @example
 * ```ts
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   const title = getErrorTitle(error, 'Operation Failed');
 *   const description = getErrorMessage(error);
 *   toast.error(title, { description });
 * }
 * ```
 */
export function getErrorTitle(error: unknown, defaultTitle: string): string {
  if (error instanceof ApiError) {
    if (error.isAuthError) return 'Authentication Required';
    if (error.isTimeout) return 'Request Timeout';
    if (error.isServerError) return 'Server Error';
    if (error.status === 0) return 'Network Error';
    // Use the backend's message as the title when details provides the description
    if (error.details) return error.message;
  }
  return defaultTitle;
}
