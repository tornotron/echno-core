/**
 * @module use-search
 *
 * Read-side TanStack Query hook for quick search.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  searchService,
  SEARCH_MIN_TERM_LENGTH,
  type SearchHit,
} from '../../services/search-service';
import { shouldRetry } from '../../lib/query/retry';
import { searchKeys } from './keys';

/**
 * Finds projects, tasks and issues matching a term.
 *
 * One request per distinct term rather than one per kind: the endpoint covers
 * all three, so a search box has one loading state and the server does the
 * ranking across kinds.
 *
 * Stays disabled until the term is long enough to be worth running, so an
 * empty or one-character box issues nothing. `keepPreviousData` holds the last
 * result set while the next term loads, which is what stops the list flashing
 * empty between keystrokes.
 *
 * The caller is expected to pass an already-debounced term. Debouncing belongs
 * with the input that produces the keystrokes, not with the cache.
 *
 * `staleTime` is 30 seconds: long enough that retyping a term is instant, short
 * enough that a record created a moment ago turns up.
 *
 * @param term - The debounced search term.
 * @param limit - Optional rows per kind; the backend clamps it.
 * @returns A TanStack `UseQueryResult` wrapping {@link SearchHit}`[]`.
 */
export function useSearch(term: string, limit?: number) {
  const trimmed = term.trim();
  return useQuery<SearchHit[]>({
    queryKey: searchKeys.query(trimmed, limit),
    queryFn: () => searchService.search(trimmed, limit),
    enabled: trimmed.length >= SEARCH_MIN_TERM_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}
