/**
 * @module search-service
 *
 * Typed client for the quick-search endpoint under `/search/web`. One call
 * covers projects, tasks and issues, because the consumer is a single search
 * box showing a single ranked list.
 *
 * Throws {@link ApiError} on non-2xx responses.
 */
import { api } from '../lib/api/api-client';

/** The kind of record a {@link SearchHit} names. */
export type SearchHitType = 'PROJECT' | 'TASK' | 'ISSUE';

/** Every kind the search endpoint can return, in the order the server groups them. */
export const SEARCH_HIT_TYPES: readonly SearchHitType[] = [
  'PROJECT',
  'TASK',
  'ISSUE',
];

/**
 * One quick-search result: the minimum needed to show a row and follow it.
 *
 * Deliberately not a full domain object. The consumer is a navigation palette,
 * so it needs a kind to pick an icon by, a label to show, and the ids to build
 * a link from. Returning whole DTOs would put back the transfer cost the
 * endpoint exists to remove.
 */
export interface SearchHit {
  /** Which kind of record this is. */
  type: SearchHitType;
  /** The record's own id. */
  id: number;
  /** The record's display name. */
  title: string;
  /**
   * The project the record hangs off, for building a link without a second
   * lookup. Equal to `id` for a project, and `null` for an issue raised
   * outside any task.
   */
  projectId: number | null;
}

/** Shortest term the backend will run. Anything shorter comes back empty. */
export const SEARCH_MIN_TERM_LENGTH = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function isSearchHitType(value: unknown): value is SearchHitType {
  return SEARCH_HIT_TYPES.includes(value as SearchHitType);
}

/**
 * Keeps only the rows that carry everything a result needs to be rendered and
 * followed.
 *
 * Skips a malformed row rather than throwing. A search box that goes blank
 * because one row was odd is worse than one that shows the rest, and unlike a
 * detail fetch there is nothing here a caller could act on.
 */
function parseSearchHits(data: ApiResponse): SearchHit[] {
  if (!Array.isArray(data)) {
    return [];
  }
  const hits: SearchHit[] = [];
  for (const row of data) {
    if (
      !isSearchHitType(row?.type) ||
      typeof row?.id !== 'number' ||
      typeof row?.title !== 'string'
    ) {
      continue;
    }
    hits.push({
      type: row.type,
      id: row.id,
      title: row.title,
      projectId: typeof row.projectId === 'number' ? row.projectId : null,
    });
  }
  return hits;
}

export const searchService = {
  /**
   * Finds projects, tasks and issues whose name contains the term.
   *
   * `GET /search/web` → `SearchHit[]`, grouped by kind with projects first and
   * ranked within each kind. The backend bounds the result: `limit` applies per
   * kind and is clamped server-side, and a term shorter than
   * {@link SEARCH_MIN_TERM_LENGTH} returns nothing without running a query.
   *
   * Short terms are short-circuited here too, so an empty or one-character
   * search box costs no request at all.
   *
   * @param term - The search term as the user typed it.
   * @param limit - Optional rows per kind.
   * @returns The matching {@link SearchHit} rows, possibly none.
   * @throws {ApiError} On non-2xx response.
   */
  async search(term: string, limit?: number): Promise<SearchHit[]> {
    const trimmed = term.trim();
    if (trimmed.length < SEARCH_MIN_TERM_LENGTH) {
      return [];
    }
    const query: Record<string, string | number> = { q: trimmed };
    if (limit !== undefined) query.limit = limit;
    const data = await api.get<ApiResponse>('/search/web', query);
    return parseSearchHits(data);
  },
};
