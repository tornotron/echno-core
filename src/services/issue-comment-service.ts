/**
 * @module issue-comment-service
 *
 * Typed client for the issue-comment backend endpoints under
 * `/issues/comments/web`. Wraps `api.*` calls and parses raw JSON into
 * strongly-typed {@link IssueComment} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { IssueComment, parseIssueComment } from '../types/issue/issue-comment';
import {
  CreateIssueCommentRequest,
  createIssueCommentToJson,
} from '../types/issue/issue-create';
import {
  UpdateIssueCommentRequest,
  updateIssueCommentToJson,
} from '../types/issue/issue-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Backend response shape audit:
 *
 *   GET    /issues/comments/web                       → IssueCommentDto[]        (full)
 *   GET    /issues/comments/web/{id}                  → IssueCommentDto          (full)
 *   POST   /issues/comments/web                       → IssueCommentSimpleDto    (partial — optional scalars may be absent)
 *   PATCH  /issues/comments/web/{id}                  → (orphan — endpoint does not exist; calls will 404)
 *   GET    /issues/comments/web/issueId/{issueId}     → IssueCommentDto[]        (full)
 *   DELETE /issues/comments/web/{id}                  → ApiResponse              (ack only)
 *
 * `IssueComment` is a shallow type (scalars only); no nested keys to
 * preserve, so mutation hooks can `setQueryData` directly without
 * {@link mergePreservingNested}.
 */

/**
 * Parses a single issue-comment payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link IssueComment}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseIssueComment(data: ApiResponse): IssueComment {
  try {
    return parseIssueComment(data);
  } catch (error) {
    logger.error('Failed to parse issue comment data:', error);
    throw new ApiError(
      'Failed to process issue comment data. Please try again.',
      422
    );
  }
}

/**
 * Parses an array of issue-comment payloads. Throws if the backend
 * returns a non-array.
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link IssueComment} objects.
 * @throws {ApiError} When the payload is not an array or any item fails
 *   parsing (HTTP 422).
 */
function safeParseIssueComments(data: ApiResponse[]): IssueComment[] {
  if (!Array.isArray(data)) {
    throw new ApiError(
      'Expected an array of issue comments but received an invalid response shape.',
      422
    );
  }
  try {
    return data.map((item) => parseIssueComment(item));
  } catch (error) {
    logger.error('Failed to parse issue comments data:', error);
    throw new ApiError(
      'Failed to process issue comments data. Please try again.',
      422
    );
  }
}

/**
 * Thin wrapper around the backend issue-comment REST endpoints.
 */
export const issueCommentService = {
  /**
   * Fetches every issue comment.
   *
   * `GET /issues/comments/web` → `IssueCommentDto[]` (full).
   *
   * @returns A resolved array of {@link IssueComment} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<IssueComment[]> {
    const data = await api.get<ApiResponse[]>('/issues/comments/web');
    return safeParseIssueComments(data);
  },

  /**
   * Fetches a single issue comment by ID.
   *
   * `GET /issues/comments/web/{id}` → `IssueCommentDto` (full).
   *
   * @param id - Surrogate ID of the issue comment.
   * @returns The resolved {@link IssueComment}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<IssueComment> {
    const data = await api.get<ApiResponse>(`/issues/comments/web/${id}`);
    return safeParseIssueComment(data);
  },

  /**
   * Creates a new comment on an issue.
   *
   * `POST /issues/comments/web` → `IssueCommentSimpleDto` (partial). Since
   * `IssueComment` is shallow, the partial response is safe to write
   * directly; mutation hooks invalidate detail to pull the canonical
   * `IssueCommentDto`.
   *
   * @param dto - The create-comment request payload.
   * @returns The newly created {@link IssueComment}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateIssueCommentRequest): Promise<IssueComment> {
    const payload = createIssueCommentToJson(dto);
    const data = await api.post<ApiResponse>('/issues/comments/web', payload);
    return safeParseIssueComment(data);
  },

  /**
   * Updates an issue comment.
   *
   * **Orphan endpoint:** the backend has no PATCH route for issue
   * comments at present. This method will 404/405 until the backend
   * adds support. The corresponding hook ({@link useUpdateIssueComment})
   * is preserved unchanged for the day the endpoint lands.
   *
   * @param id - Surrogate ID of the issue comment.
   * @param dto - Update payload.
   * @returns The updated {@link IssueComment} (in theory).
   * @throws {ApiError} 404/405 in current backend versions.
   * @internal
   */
  async update(
    id: number,
    dto: UpdateIssueCommentRequest
  ): Promise<IssueComment> {
    const payload = updateIssueCommentToJson(dto);
    const data = await api.patch<ApiResponse>(
      `/issues/comments/web/${id}`,
      payload
    );
    return safeParseIssueComment(data);
  },

  /**
   * Fetches every comment for a given issue.
   *
   * `GET /issues/comments/web/issueId/{issueId}` → `IssueCommentDto[]` (full).
   *
   * @param issueId - Surrogate ID of the parent issue.
   * @returns A resolved array of {@link IssueComment} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getByIssueId(issueId: number): Promise<IssueComment[]> {
    const data = await api.get<ApiResponse[]>(
      `/issues/comments/web/issueId/${issueId}`
    );
    return safeParseIssueComments(data);
  },

  /**
   * Deletes an issue comment by ID.
   *
   * `DELETE /issues/comments/web/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the comment to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/issues/comments/web/${id}`);
  },
};
