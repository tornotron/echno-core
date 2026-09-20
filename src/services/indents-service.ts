/**
 * @module indents-service
 *
 * Typed client for the indents (material requisitions) backend
 * endpoints under `/indents/web`. Wraps `api.*` calls and parses raw
 * JSON into strongly-typed {@link Indent} domain objects (each one
 * carrying its embedded {@link IndentItem} array).
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Indent,
  IndentItem,
  parseIndent,
  parseIndentItem,
  CreateIndentRequest,
  UpdateIndentRequest,
  createIndentToJson,
  updateIndentToJson,
  IndentSummary,
  IndentSummaryPage,
  parseIndentSummary,
} from '../types/indents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   POST   /indents/web                                  → IndentDto     (full; items array embedded)
 *   GET    /indents/web                                  → IndentDto[]   (full list)
 *   GET    /indents/web/all?pageNo&pageSize              → IndentDto[]   (paginated; returned as plain array, no envelope)
 *   GET    /indents/web/summary?pageNo&pageSize          → Page<IndentSummaryDto> (no lines; counts only)
 *   GET    /indents/web/{id}                             → IndentDto     (full)
 *   PATCH  /indents/web/{id}                             → IndentDto     (full)
 *   DELETE /indents/web/{id}                             → ApiResponse   (ack)
 */

/**
 * Parses a single indent payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link Indent}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseIndent(data: Raw): Indent {
  try {
    return parseIndent(data);
  } catch (error) {
    logger.error('Failed to parse indent:', error);
    throw new ApiError('Failed to process indent data.', 422);
  }
}

/**
 * Parses an array of indent payloads. Returns `[]` for any non-array
 * input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link Indent} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseIndents(data: Raw[]): Indent[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseIndent(item));
  } catch (error) {
    logger.error('Failed to parse indents:', error);
    throw new ApiError('Failed to process indents data.', 422);
  }
}

function safeParseIndentSummaries(data: Raw[]): IndentSummary[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseIndentSummary(item));
  } catch (error) {
    logger.error('Failed to parse indent summaries:', error);
    throw new ApiError(
      'Failed to process indents data. Please try again.',
      422
    );
  }
}

/**
 * Normalizes a Spring `Page<IndentSummaryDto>` body (or a bare array, for
 * resilience) into an {@link IndentSummaryPage}.
 */
function safeParseIndentSummaryPage(data: Raw, size: number): IndentSummaryPage {
  if (Array.isArray(data)) {
    const content = safeParseIndentSummaries(data);
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size,
    };
  }
  return {
    content: safeParseIndentSummaries(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? size,
  };
}

export const indentsService = {
  // ==================== Indents ====================

  /**
   * Creates a new indent together with its line items
   * (`POST /indents/web`).
   *
   * @param dto - The {@link CreateIndentRequest} payload.
   * @returns The newly-created {@link Indent} with embedded items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(dto: CreateIndentRequest): Promise<Indent> {
    const data = await api.post<Raw>('/indents/web', createIndentToJson(dto));
    return safeParseIndent(data);
  },

  /**
   * Fetches every indent unpaginated (`GET /indents/web`).
   *
   * @returns Every {@link Indent} in the organisation.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(): Promise<Indent[]> {
    const data = await api.get<Raw[]>('/indents/web');
    return safeParseIndents(data);
  },

  /**
   * Fetches a page of indents (`GET /indents/web/all`). The backend
   * returns a plain array (no envelope); pagination metadata is not
   * exposed.
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of indents per page. Defaults to `10`.
   * @returns The {@link Indent}s for the requested page.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAllPaginated(pageNo = 0, pageSize = 10): Promise<Indent[]> {
    const data = await api.get<Raw[]>('/indents/web/all', { pageNo, pageSize });
    return safeParseIndents(data);
  },

  /**
   * Fetches a page of indent summaries (`GET /indents/web/summary`).
   *
   * Each row is the indent without its lines: the full DTO carries a
   * material on every line, so a page of indents was reading the material
   * catalogue to render a column of numbers. The backend counts the lines
   * and the lines already on a purchase order for the whole page in one
   * aggregate. Use it for the indent list; the detail page stays on
   * `getById`.
   *
   * @param pageNo - Zero-based page number. Defaults to `0`.
   * @param pageSize - Number of indents per page, at most 500. Defaults to `10`.
   * @returns The {@link IndentSummaryPage} for the requested page.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getSummaries(pageNo = 0, pageSize = 10): Promise<IndentSummaryPage> {
    const data = await api.get<Raw>('/indents/web/summary', {
      pageNo,
      pageSize,
    });
    return safeParseIndentSummaryPage(data, pageSize);
  },

  /**
   * Fetches a single indent by ID (`GET /indents/web/{id}`).
   *
   * @param id - Surrogate ID of the indent.
   * @returns The {@link Indent} with embedded items.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(id: number): Promise<Indent> {
    const data = await api.get<Raw>(`/indents/web/${id}`);
    return safeParseIndent(data);
  },

  /**
   * Updates an indent (`PATCH /indents/web/{id}`). The backend returns
   * the full updated entity.
   *
   * @param id - Surrogate ID of the indent to update.
   * @param dto - The {@link UpdateIndentRequest} payload.
   * @returns The updated {@link Indent}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async update(id: number, dto: UpdateIndentRequest): Promise<Indent> {
    const data = await api.patch<Raw>(
      `/indents/web/${id}`,
      updateIndentToJson(dto)
    );
    return safeParseIndent(data);
  },

  /**
   * Deletes an indent (`DELETE /indents/web/{id}`). Response is an ack
   * only.
   *
   * @param id - Surrogate ID of the indent to delete.
   * @throws {ApiError} On a non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/indents/web/${id}`);
  },
};
