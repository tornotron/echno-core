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
 *   GET    /tasks/web                           → TaskDto[]       (full, capped)
 *   GET    /tasks/web/paginated                 → Page<TaskDto>   (full)
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

/** One page of tasks with the Spring page metadata preserved. */
export interface PagedTask {
  /** The tasks on this page. */
  content: Task[];
  /** Total tasks across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** 0-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

/** Paging and filter options for the paginated task list. */
export interface TaskPageParams {
  /** 0-based page index. */
  page?: number;
  /** Rows per page. The backend clamps this to its result cap. */
  size?: number;
  /** Restrict to a single project. */
  projectId?: number;
  /** Free-text match on title and description, resolved server-side. */
  search?: string;
}

function safeParseTaskPage(
  data: ApiResponse,
  params: TaskPageParams
): PagedTask {
  return {
    content: safeParseTasks(data?.content ?? []),
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    number: data?.number ?? 0,
    size: data?.size ?? params.size ?? 20,
  };
}

export const taskService = {
  /**
   * Fetches the current tenant's tasks.
   *
   * `GET /tasks/web` → `TaskDto[]` (full — nested entities populated).
   *
   * The backend bounds this at 500 rows and reports the true total in
   * `X-Total-Count`, setting `X-Result-Capped` when rows were left out. It
   * used to page at ten by default and discard the envelope, so this method
   * silently returned the ten lowest-id tasks in the tenant. Use
   * {@link getPage} where a list needs to walk past the cap, and
   * {@link getByProjectId} where only one project's tasks are wanted.
   *
   * @returns A resolved array of {@link Task} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getAll(): Promise<Task[]> {
    const data = await api.get<ApiResponse[]>('/tasks/web');
    return safeParseTasks(data);
  },

  /**
   * Fetches one page of tasks, newest first.
   *
   * `GET /tasks/web/paginated` → `Page<TaskDto>`. The Spring page envelope is
   * normalized to {@link PagedTask}, so a caller can tell a complete result
   * from a truncated one, which is exactly what the bare list could not do.
   *
   * @param params - 0-based `page`, `size`, and optional `projectId` /
   *   `search` filters (both resolved server-side).
   * @returns A {@link PagedTask} page of tasks.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getPage(params: TaskPageParams = {}): Promise<PagedTask> {
    const query: Record<string, string | number> = {};
    if (params.page !== undefined) query.pageNo = params.page;
    if (params.size !== undefined) query.pageSize = params.size;
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.search) query.search = params.search;
    const data = await api.get<ApiResponse>('/tasks/web/paginated', query);
    return safeParseTaskPage(data, params);
  },

  /**
   * Fetches every task belonging to one project.
   *
   * `GET /tasks/web/projectId/{projectId}` → `TaskDto[]` (full). The filter
   * runs in the database over the project's own tasks, not over a page of the
   * tenant's.
   *
   * @param projectId - Surrogate ID of the project.
   * @returns A resolved array of {@link Task} objects.
   * @throws {ApiError} On non-2xx response or unparseable payload.
   */
  async getByProjectId(projectId: number): Promise<Task[]> {
    const data = await api.get<ApiResponse[]>(
      `/tasks/web/projectId/${projectId}`
    );
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
   * The files are their own multipart part, read from a `@RequestParam`,
   * so the JSON body says nothing about them. An empty `attachments` key
   * used to be added when there was nothing to upload, on the stated
   * grounds that it separated "no upload" from "untouched"; the key is not
   * a field of `TaskCreationDto`, so binding dropped it and both cases
   * produced the same request.
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
   * An empty `attachments` key used to be added when there was nothing to
   * upload, on the stated grounds that it separated "no upload" from
   * "untouched". It never did: the partial-update handler switches over
   * the keys it was given and names `attachments` in the branch it drops.
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
