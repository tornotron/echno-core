/**
 * @module task-service
 *
 * Typed client for the task-management backend endpoints under
 * `/tasks/web`. Wraps `api.*` calls and parses raw JSON into strongly-
 * typed {@link Task} domain objects.
 *
 * All exported functions throw {@link ApiError} on non-2xx responses or
 * when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { Task, parseTask } from '../types/task';
import {
  CreateTaskRequest,
  TaskFiles,
  createTaskToJson,
} from '../types/task/task-create';
import { UpdateTaskRequest, updateTaskToJson } from '../types/task/task-update';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Backend response shape audit (per local-docs/backend-api-docs.md):
 *
 *   GET    /tasks/web                           → TaskDto[]       (full)
 *   GET    /tasks/web/{id}                      → TaskDto         (full)
 *   GET    /tasks/web/projectId/{projectId}     → TaskDto[]       (full)
 *   POST   /tasks/web                           → TaskSimpleDto   (partial — no nested)
 *   PATCH  /tasks/web/{id}                      → TaskSimpleDto   (partial — no nested)
 *   DELETE /tasks/web/{id}                      → ApiResponse     (ack only)
 *
 * `create` and `update` parse a TaskSimpleDto with `parseTask`, which tolerates
 * missing fields by setting them to undefined. The returned Task therefore lacks
 * `creator`, `assignees`, `category`, `issues`, and `attachments`. Callers must
 * NEVER overwrite the cached detail entry with this response — use
 * `mergePreservingNested` from `lib/query/cache-merge` and invalidate the
 * detail key to refetch the full object.
 */
function safeParseTask(data: ApiResponse): Task {
  try {
    return parseTask(data);
  } catch (error) {
    logger.error('Failed to parse task data:', error);
    throw new ApiError('Failed to process task data. Please try again.', 422);
  }
}

function safeParseTasks(data: ApiResponse[]): Task[] {
  if (!Array.isArray(data)) {
    return [];
  }
  try {
    return data.map((item) => parseTask(item));
  } catch (error) {
    logger.error('Failed to parse tasks data:', error);
    throw new ApiError('Failed to process tasks data. Please try again.', 422);
  }
}

export const taskService = {
  /**
   * Fetches every task visible to the current user.
   *
   * `GET /tasks/web` → `TaskDto[]` (full — nested entities populated).
   *
   * @returns A resolved array of {@link Task} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Task[]> {
    const data = await api.get<ApiResponse[]>('/tasks/web');
    return safeParseTasks(data);
  },

  /**
   * Fetches a single task by ID.
   *
   * `GET /tasks/web/{id}` → `TaskDto` (full).
   *
   * @param id - Surrogate ID of the task.
   * @returns The resolved {@link Task}.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getById(id: number): Promise<Task> {
    const data = await api.get<ApiResponse>(`/tasks/web/${id}`);
    return safeParseTask(data);
  },

  /**
   * Creates a new task, optionally with attachment uploads in the same
   * multipart request.
   *
   * `POST /tasks/web` (multipart) → `TaskSimpleDto` (partial — `creator`,
   * `assignees`, `category`, `issues`, and `attachments` absent).
   *
   * If `files.attachments` is empty, an empty `attachments` field is sent
   * so the backend distinguishes "no upload" from "untouched".
   *
   * @param dto - Domain create request.
   * @param files - Optional files to upload alongside the request.
   * @returns The created {@link Task} with empty nested fields — callers
   *   must merge into cached state or refetch via the detail query.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async create(dto: CreateTaskRequest, files?: TaskFiles): Promise<Task> {
    const payload = createTaskToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.postMultipart<ApiResponse>(
      '/tasks/web',
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseTask(data);
  },

  /**
   * Updates an existing task, optionally with attachment uploads in the
   * same multipart request.
   *
   * `PATCH /tasks/web/{id}` (multipart) → `TaskSimpleDto` (partial —
   * `creator`, `assignees`, `category`, `issues`, and `attachments`
   * absent).
   *
   * If `files.attachments` is empty, an empty `attachments` field is sent
   * so the backend distinguishes "no upload" from "untouched".
   *
   * @param id - Surrogate ID of the task.
   * @param dto - Fields to update; only set fields are transmitted.
   * @param files - Optional files to upload alongside the request.
   * @returns The updated {@link Task} with empty nested fields.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async update(
    id: number,
    dto: UpdateTaskRequest,
    files?: TaskFiles
  ): Promise<Task> {
    const payload = updateTaskToJson(dto);
    const hasFiles = files?.attachments && files.attachments.length > 0;

    if (!hasFiles) {
      payload.attachments = [];
    }

    const data = await api.patchMultipart<ApiResponse>(
      `/tasks/web/${id}`,
      payload,
      hasFiles ? { attachments: files!.attachments! } : undefined
    );
    return safeParseTask(data);
  },

  /**
   * Deletes a task.
   *
   * `DELETE /tasks/web/{id}` → `ApiResponse` (ack only).
   *
   * @param id - Surrogate ID of the task.
   * @returns Resolves once the server acknowledges the deletion.
   * @throws {ApiError} On non-2xx response.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/tasks/web/${id}`);
  },
};
