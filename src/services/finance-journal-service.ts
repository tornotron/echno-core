/**
 * @module finance-journal-service
 *
 * Typed client for the journal-entry endpoints (`/finance/journal-entries/web`,
 * resolved against the `/api/v1` base).
 *
 * Endpoint audit (response DTO label → classification):
 * - `POST /finance/journal-entries/web`            → `JournalEntryDto`   (full)
 * - `GET  /finance/journal-entries/web?id={id}`    → `JournalEntryDto`   (query; single)
 * - `GET  /finance/journal-entries/web/all`        → `JournalEntryDto[]` (query; paged)
 * - `POST /finance/journal-entries/web/reverse?id` → `JournalEntryDto`   (full; the reversal entry)
 * - `GET  /finance/journal/web/export[?from][&to]` → CSV file            (`text/csv` blob)
 *
 * NOTE: single-fetch takes the id as a **query param** (`?id=`). Reverse also
 * takes `?id=` plus a `{ reason }` body and returns the newly-created reversal
 * entry (not the original). A journal line is `{ accountId, debit, credit,
 * narration }` — see `journal-entry-create.ts` for the OpenAPI naming caveat.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  JournalEntry,
  parseJournalEntry,
  PostJournalRequest,
  postJournalToJson,
  ReverseJournalRequest,
} from '../types/finance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/finance/journal-entries/web';

/**
 * Export lives under a distinct base path (`/finance/journal/web`) from the
 * journal-entries CRUD endpoints (`/finance/journal-entries/web`).
 */
const EXPORT_BASE = '/finance/journal/web';

/** Safely parse a journal entry, converting parse failures into a 422 ApiError. */
function safeParseJournalEntry(data: ApiResponse): JournalEntry {
  try {
    return parseJournalEntry(data);
  } catch (error) {
    logger.error('Failed to parse journal entry data:', error);
    throw new ApiError(
      'Failed to process journal entry data. Please try again.',
      422
    );
  }
}

/** Safely parse a journal-entry array. */
function safeParseJournalEntries(data: ApiResponse[]): JournalEntry[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseJournalEntry(item));
  } catch (error) {
    logger.error('Failed to parse journal entries data:', error);
    throw new ApiError(
      'Failed to process journal entries data. Please try again.',
      422
    );
  }
}

/**
 * Finance Journal Service — manual journal posting, reads, and reversal.
 */
export const financeJournalService = {
  /**
   * Fetches a single journal entry by id.
   *
   * `GET /finance/journal-entries/web?id={id}`
   *
   * @param id - UUID of the entry (sent as a query param).
   * @returns The {@link JournalEntry}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async getById(id: string): Promise<JournalEntry> {
    const data = await api.get<ApiResponse>(BASE, { id });
    return safeParseJournalEntry(data);
  },

  /**
   * Fetches a page of journal entries (sorted by entry date, then created-at).
   *
   * `GET /finance/journal-entries/web/all[?pageNo][&pageSize]`
   *
   * @param pageNo - 0-based page index (default 0 server-side).
   * @param pageSize - Page size (default 10 server-side).
   * @returns The matching {@link JournalEntry} records.
   * @throws {ApiError} On non-2xx responses or if a record fails to parse.
   */
  async listAll(pageNo?: number, pageSize?: number): Promise<JournalEntry[]> {
    const params: Record<string, number> = {};
    if (pageNo !== undefined) params.pageNo = pageNo;
    if (pageSize !== undefined) params.pageSize = pageSize;
    const data = await api.get<ApiResponse[]>(
      `${BASE}/all`,
      Object.keys(params).length > 0 ? params : undefined
    );
    return safeParseJournalEntries(data);
  },

  /**
   * Posts a manual journal entry.
   *
   * `POST /finance/journal-entries/web` → `JournalEntryDto` (full; status
   * `POSTED`).
   *
   * @param dto - Entry fields ({@link PostJournalRequest}); lines must balance
   *   (total debits == total credits) with at least 2 lines.
   * @returns The posted {@link JournalEntry}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async post(dto: PostJournalRequest): Promise<JournalEntry> {
    const data = await api.post<ApiResponse>(BASE, postJournalToJson(dto));
    return safeParseJournalEntry(data);
  },

  /**
   * Reverses a posted journal entry.
   *
   * `POST /finance/journal-entries/web/reverse?id={id}` (body carries the
   * optional reason) → `JournalEntryDto` (full; **the reversal entry**, dated
   * today).
   *
   * @param id - UUID of the entry to reverse (query param).
   * @param dto - Reversal details ({@link ReverseJournalRequest}).
   * @returns The newly-created reversal {@link JournalEntry}.
   * @throws {ApiError} On non-2xx responses or if the response fails to parse.
   */
  async reverse(
    id: string,
    dto: ReverseJournalRequest = {}
  ): Promise<JournalEntry> {
    const body =
      dto.reason === undefined ? {} : { reason: dto.reason };
    const data = await api.post<ApiResponse>(`${BASE}/reverse`, body, { id });
    return safeParseJournalEntry(data);
  },

  /**
   * Exports journal entries as a CSV file, optionally bounded by a date range.
   *
   * `GET /finance/journal/web/export[?from={from}][&to={to}]` → `text/csv`.
   *
   * @param params - Optional `from`/`to` ISO date strings (`YYYY-MM-DD`); both
   *   are optional and omitted from the query when absent.
   * @returns The CSV payload as a {@link Blob} (the caller triggers the download).
   * @throws {ApiError} On non-2xx responses or network failure.
   */
  async exportJournalEntries(params?: {
    from?: string;
    to?: string;
  }): Promise<Blob> {
    const query: Record<string, string> = {};
    if (params?.from !== undefined) query.from = params.from;
    if (params?.to !== undefined) query.to = params.to;
    return api.getBlob(
      `${EXPORT_BASE}/export`,
      Object.keys(query).length > 0 ? query : undefined
    );
  },
};
