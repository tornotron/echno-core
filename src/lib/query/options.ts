/**
 * @module options
 *
 * Shared TanStack Query option profiles used by all Echno domain hooks.
 *
 * Spread the appropriate profile into a `useQuery` call to apply
 * consistent `staleTime`, `gcTime`, and retry behaviour across the
 * codebase without repeating configuration at every call site.
 *
 * | Profile | staleTime | gcTime | Intended use |
 * |---------|-----------|--------|--------------|
 * | {@link realtimeQueryOptions} | 0 | 60 s | Chat, live dashboards, notification counts |
 * | {@link standardQueryOptions} | 60 s | 5 min | Projects, tasks, issues, leave, vendors |
 * | {@link staticQueryOptions} | 10 min | 30 min | Work categories, org settings, shifts |
 * | {@link noCacheQueryOptions} | 0 | 0 | Unread counts, one-shot reads |
 */
import { type QueryObserverOptions } from '@tanstack/react-query';
import { shouldRetry } from './retry';

/**
 * Realtime data: chat messages, notification counts, live dashboards.
 * Always considered stale — refetches on focus/reconnect.
 * Short gc window so stale messages don't linger in cache.
 */
export const realtimeQueryOptions = {
  staleTime: 0,
  gcTime: 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: shouldRetry,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
} satisfies Partial<QueryObserverOptions>;

/**
 * Standard mutable data: projects, tasks, issues, leave requests, vendors, etc.
 * Fresh for 60 s; cached for 5 min. Mirrors the global QueryClient defaults
 * but exported so hooks can be explicit about their intent.
 */
export const standardQueryOptions = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: process.env.NODE_ENV === 'production',
  refetchOnReconnect: true,
  retry: shouldRetry,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
} satisfies Partial<QueryObserverOptions>;

/**
 * Reference / configuration data: work categories, org settings, shift timings,
 * storage locations, shift timings. Changes infrequently during normal use.
 * Fresh for 10 min; cached for 30 min.
 */
export const staticQueryOptions = {
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  retry: shouldRetry,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
} satisfies Partial<QueryObserverOptions>;

/**
 * Never cache: data that must be fresh on every render (e.g. unread counts
 * where the source of truth lives outside the client cache).
 * Always stale, gc immediately after unmount.
 */
export const noCacheQueryOptions = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: false,
} satisfies Partial<QueryObserverOptions>;
