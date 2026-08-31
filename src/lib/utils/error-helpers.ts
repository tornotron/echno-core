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
 * The base is `error.message`, which mirrors the backend problem's `detail`
 * and is the sentence written for the caller. It deliberately does not use
 * `error.details`: the backend fills that with the request description
 * (`'uri=/api/v1/leave-requests/9/approve'`), so preferring it showed the user
 * a URI where the explanation should have been.
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
    const base = error.message;
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
 * (authentication, authorization, timeout, server errors, network errors).
 *
 * Two rules shape the order of the branches:
 *
 * 1. **401 and 403 are different problems.** Only a 401 means the caller is
 *    not signed in. A 403 means they are signed in and the account lacks the
 *    permission, so telling them to authenticate sends them to re-login, which
 *    changes nothing. Every refusal that moved onto a stored record or a
 *    session-derived actor answers 403, and each one has a person to go to
 *    rather than a login screen.
 * 2. **The backend titles its own failures.** Its problem body carries a
 *    `title` naming the problem class ('Access Denied', 'Validation Failed',
 *    'Duplicate Resource'), while `message` carries the sentence, which on a
 *    refused `@PreAuthorize` names the role or authority that was missing.
 *    Pairing the server's title with the server's sentence beats any title
 *    derived from the status code alone, so the body wins wherever it spoke.
 *
 * The generic titles remain for the cases with no body to read: a client-side
 * timeout, a network failure, and a gateway error that never reached the
 * application.
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
    if (error.status === 401) return 'Authentication Required';
    if (error.isTimeout) return 'Request Timeout';
    if (error.status === 0) return 'Network Error';
    if (error.title) return error.title;
    if (error.isServerError) return 'Server Error';
    if (error.status === 403) return 'Not Permitted';
  }
  return defaultTitle;
}
