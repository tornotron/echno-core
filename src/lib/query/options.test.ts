import { describe, expect, test } from 'bun:test';
import { shouldRetry } from './retry';
import {
  noCacheQueryOptions,
  realtimeQueryOptions,
  standardQueryOptions,
  staticQueryOptions,
} from './options';

describe('query option profiles', () => {
  test('realtime is always stale with a short gc window', () => {
    expect(realtimeQueryOptions.staleTime).toBe(0);
    expect(realtimeQueryOptions.gcTime).toBe(60 * 1000);
    expect(realtimeQueryOptions.refetchOnWindowFocus).toBe(true);
  });

  test('standard stays fresh for a minute and caches for five', () => {
    expect(standardQueryOptions.staleTime).toBe(60 * 1000);
    expect(standardQueryOptions.gcTime).toBe(5 * 60 * 1000);
  });

  test('static caches reference data for far longer and skips focus refetch', () => {
    expect(staticQueryOptions.staleTime).toBe(10 * 60 * 1000);
    expect(staticQueryOptions.gcTime).toBe(30 * 60 * 1000);
    expect(staticQueryOptions.refetchOnWindowFocus).toBe(false);
  });

  test('no-cache keeps nothing and disables retries', () => {
    expect(noCacheQueryOptions.staleTime).toBe(0);
    expect(noCacheQueryOptions.gcTime).toBe(0);
    expect(noCacheQueryOptions.retry).toBe(false);
  });

  test('the caching profiles reuse the shared retry predicate', () => {
    expect(realtimeQueryOptions.retry).toBe(shouldRetry);
    expect(standardQueryOptions.retry).toBe(shouldRetry);
    expect(staticQueryOptions.retry).toBe(shouldRetry);
  });
});

describe('retryDelay backoff', () => {
  test('realtime doubles the delay per attempt and caps at 10s', () => {
    const delay = realtimeQueryOptions.retryDelay as (a: number) => number;
    expect(delay(0)).toBe(1000);
    expect(delay(1)).toBe(2000);
    expect(delay(2)).toBe(4000);
    // 1000 * 2^4 = 16000, capped to the 10s ceiling.
    expect(delay(4)).toBe(10_000);
  });

  test('standard and static cap the backoff at 30s', () => {
    const standardDelay = standardQueryOptions.retryDelay as (
      a: number
    ) => number;
    const staticDelay = staticQueryOptions.retryDelay as (a: number) => number;
    // 1000 * 2^6 = 64000, capped to the 30s ceiling.
    expect(standardDelay(6)).toBe(30_000);
    expect(staticDelay(6)).toBe(30_000);
    expect(standardDelay(1)).toBe(2000);
  });
});
