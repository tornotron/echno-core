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
  async getAll(): Promise<Task[]> {
    const data = await api.get<ApiResponse[]>('/tasks/web');
    return safeParseTasks(data);
  },

  async getById(id: number): Promise<Task> {
    const data = await api.get<ApiResponse>(`/tasks/web/${id}`);
    return safeParseTask(data);
  },

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

  async delete(id: number): Promise<void> {
    await api.delete(`/tasks/web/${id}`);
  },
};
