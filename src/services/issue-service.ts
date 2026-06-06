/**
 * @module issue-service
 *
 * Typed client for the issue-management backend endpoints under
 * `/issues/web`. Wraps `api.*` calls and parses raw JSON into strongly-
 * typed {@link Issue} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Issue, parseIssue, IssueFiles } from '../types/issue';
import {
  CreateIssueRequest,
  createIssueToJson,
} from '../types/issue/issue-create';
import {
  UpdateIssueRequest,
  updateIssueToJson,
} from '../types/issue/issue-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Backend response shape audit:
 *
 *   GET    /issues/web                        → IssueDto[]        (full)
 *   GET    /issues/web/{id}                   → IssueDto          (full)
 *   GET    /issues/web/project/{projectId}    → IssueDto[]        (full)
 *   GET    /issues/web/taskId/{taskId}        → IssueDto[]        (full)
 *   POST   /issues/web        (multipart)     → IssueSimpleDto    (partial — comments, attachments, taskName may be absent)
 *   PATCH  /issues/web/{id}   (multipart)     → IssueSimpleDto    (partial — same as POST)
 *   DELETE /issues/web/{id}                   → ApiResponse       (ack only)
 *
 * `create` and `update` parse an `IssueSimpleDto` with {@link parseIssue},
 * which tolerates missing fields by setting them to undefined. The
 * returned `Issue` therefore may lack `comments`, `attachments`, and
 * `taskName`. Mutation hooks must NEVER overwrite the cached detail
 * entry with this response — use {@link mergePreservingNested} from
 * `lib/query/cache-merge` with the constant `ISSUE_NESTED_KEYS` and
 * invalidate the detail key to refetch the full object.
 */

/**
 * Parses a single issue payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link Issue}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseIssue(data: ApiResponse): Issue {
  try {
    return parseIssue(data);
  } catch (error) {
    logger.error('Failed to parse issue data:', error);
    throw new ApiError('Failed to process issue data. Please try again.', 422);
  }
}

/**
 * Parses an array of issue payloads. Throws if the backend returns a
 * non-array, since downstream consumers assume an iterable shape.
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link Issue} objects.
 * @throws {ApiError} When the payload is not an array or any item fails
 *   parsing (HTTP 422).
 */
function safeParseIssues(data: ApiResponse[]): Issue[] {
  if (!Array.isArray(data)) {
    logger.error(
      'Invalid issues payload: expected array, received:',
      `type=${typeof data}, isNull=${data === null}${
        typeof data === 'object' && data !== null
          ? `, keys=${Object.keys(data).slice(0, 5).join(',')}`
          : ''
      }`
    );
    throw new ApiError('Invalid issues payload: expected array.', 422);
  }
  try {
    return data.map((item) => parseIssue(item));
  } catch (error) {
    logger.error('Failed to parse issues data:', error);
    throw new ApiError('Failed to process issues data. Please try again.', 422);
  }
}

/**
 * Thin wrapper around the backend issue REST endpoints.
 */
export const issueService = {
  /**
   * Fetches every issue visible to the current user.
   *
   * `GET /issues/web` → `IssueDto[]` (full — nested entities populated).
   *
   * @returns A resolved array of {@link Issue} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>('/issues/web');
    return safeParseIssues(data);
  },

  /**
   * Fetches a single issue by ID.
   *
   * `GET /issues/web/{id}` → `IssueDto` (full).
   *
   * @param id - Surrogate ID of the issue.
   * @returns The resolved {@link Issue}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<Issue> {
    const data = await api.get<ApiResponse>(`/issues/web/${id}`);
    return safeParseIssue(data);
  },

  /**
   * Creates a new issue, optionally uploading attachments in the same
   * `multipart/form-data` round-trip.
   *
   * `POST /issues/web` → `IssueSimpleDto` (partial — `comments`,
   * `attachments`, and `taskName` may be absent on the response). When no
   * files are supplied the payload still carries `attachments: []` so the
   * backend's multipart parser sees a deterministic shape.
   *
   * @param dto - The create request payload.
   * @param files - Optional file payload uploaded as multipart fields.
   * @returns The newly created {@link Issue}. Nested fields may be absent;
   *   mutation hooks invalidate the detail key after a successful create
   *   so the next observer pulls the canonical `IssueDto`.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateIssueRequest, files?: IssueFiles): Promise<Issue> {
    const payload = createIssueToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.postMultipart<ApiResponse>(
      '/issues/web',
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseIssue(data);
  },

  /**
   * Updates an existing issue, optionally uploading new attachments in the
   * same `multipart/form-data` round-trip.
   *
   * `PATCH /issues/web/{id}` → `IssueSimpleDto` (partial — same shape as
   * `create`). When no files are supplied the payload still carries
   * `attachments: []` for parser consistency.
   *
   * @param id - Surrogate ID of the issue to update.
   * @param dto - Fields to update; only set fields are sent.
   * @param files - Optional new files to attach.
   * @returns The updated {@link Issue}. Nested arrays from the response
   *   are absent; mutation hooks merge into cached state via
   *   {@link mergePreservingNested} and invalidate the detail key.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async update(
    id: number,
    dto: UpdateIssueRequest,
    files?: IssueFiles
  ): Promise<Issue> {
    const payload = updateIssueToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.patchMultipart<ApiResponse>(
      `/issues/web/${id}`,
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseIssue(data);
  },

  /**
   * Fetches every issue belonging to a given project.
   *
   * `GET /issues/web/project/{projectId}` → `IssueDto[]` (full).
   *
   * @param projectId - Surrogate ID of the project.
   * @returns A resolved array of {@link Issue} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getByProjectId(projectId: number): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>(
      `/issues/web/project/${projectId}`
    );
    return safeParseIssues(data);
  },

  /**
   * Fetches every issue belonging to a given task.
   *
   * `GET /issues/web/taskId/{taskId}` → `IssueDto[]` (full).
   *
   * @param taskId - Surrogate ID of the parent task.
   * @returns A resolved array of {@link Issue} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getByTaskId(taskId: number): Promise<Issue[]> {
    const data = await api.get<ApiResponse[]>(`/issues/web/taskId/${taskId}`);
    return safeParseIssues(data);
  },

  /**
   * Deletes an issue by ID.
   *
   * `DELETE /issues/web/{id}` → `ApiResponse` (ack only — no body to parse).
   *
   * @param id - Surrogate ID of the issue to delete.
   * @returns A void promise that resolves on a successful ack.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/issues/web/${id}`);
  },
};
