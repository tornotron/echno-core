import { describe, expect, test } from 'bun:test';
import { ApiError } from '../api/api-client';
import { shouldRetry } from './retry';

// ApiError(message, status): the retry flags (isAuthError/isServerError/isNotFound)
// are derived from status in the constructor, so status alone drives the cases.
const apiError = (status: number) => new ApiError('test', status);

describe('shouldRetry', () => {
  test('stops after 3 attempts regardless of error type', () => {
    expect(shouldRetry(3, apiError(503))).toBe(false);
    expect(shouldRetry(4, new Error('network'))).toBe(false);
  });

  test('retries server errors (5xx)', () => {
    expect(shouldRetry(0, apiError(500))).toBe(true);
    expect(shouldRetry(2, apiError(503))).toBe(true);
  });

  test('retries rate limiting (429)', () => {
    expect(shouldRetry(0, apiError(429))).toBe(true);
  });

  test('retries network errors (status 0)', () => {
    expect(shouldRetry(0, apiError(0))).toBe(true);
  });

  test('does not retry auth errors (401, 403)', () => {
    expect(shouldRetry(0, apiError(401))).toBe(false);
    expect(shouldRetry(0, apiError(403))).toBe(false);
  });

  test('does not retry not found (404)', () => {
    expect(shouldRetry(0, apiError(404))).toBe(false);
  });

  test('does not retry other 4xx client errors', () => {
    expect(shouldRetry(0, apiError(400))).toBe(false);
    expect(shouldRetry(0, apiError(422))).toBe(false);
  });

  test('retries unknown, non-ApiError errors by default (network layer)', () => {
    expect(shouldRetry(0, new Error('fetch failed'))).toBe(true);
  });
});
