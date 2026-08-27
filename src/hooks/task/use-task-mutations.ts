/**
 * @module use-task-mutations
 *
 * Write-side TanStack Query hooks for the task domain. Each mutation
 * patches the task module's own caches (`taskKeys.lists()`,
 * `taskKeys.detail(id)`, `taskKeys.byProject(projectId)`) plus the
 * cross-namespace parent {@link Project} cache that carries
 * `tasks: Task[]` as a nested array — gantt, EVM s-curve, health, and
 * projects-grid views read `project.tasks` directly, so the parent's
 * nested array must update instantly for the UI to feel live.
 *
 * Update mutations use {@link mergePreservingNested} with
 * {@link TASK_NESTED_KEYS} so that `creator`, `assignees`, `category`,
 * `issues`, and `attachments` cached from a prior full-DTO fetch
 * survive a partial `TaskSimpleDto` response.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../../services/task-service';
import { Task } from '../../types/task';
import { Project } from '../../types/project';
import { CreateTaskRequest, TaskFiles } from '../../types/task/task-create';
import { UpdateTaskRequest } from '../../types/task/task-update';
import { logger } from '../../lib/logger';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { taskKeys } from './keys';
import { projectKeys } from '../project/keys';

/**
 * Nested keys on {@link Task} that update mutations preserve when
 * merging a partial `TaskSimpleDto` response into the cached detail.
 * Passed to {@link mergePreservingNested}.
 */
const TASK_NESTED_KEYS = [
  'creator',
  'assignees',
  'category',
  'issues',
  'attachments',
] as const satisfies ReadonlyArray<keyof Task>;

/**
 * Matches every Task[] list cache under the 'tasks' namespace while excluding
 * detail entries (Task), which have a numeric second segment.
 */
function isTaskListCache(query: { queryKey: ReadonlyArray<unknown> }): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'tasks' &&
    key.length > 1 &&
    typeof key[1] !== 'number' &&
    // Paginated caches (`['tasks', 'page', params]`) hold a PagedTask envelope
    // rather than a flat Task[], so the optimistic array patches would break on
    // them. They are refetch-driven, invalidated via taskKeys.pages().
    key[1] !== 'page'
  );
}

/**
 * Creates a new task.
 *
 * Backend response: `TaskSimpleDto` (partial — `creator`, `assignees`,
 * `category`, `issues`, and `attachments` absent).
 *
 * Create is excluded from optimistic updates because the server assigns
 * the task ID; no deterministic optimistic entry can be constructed.
 *
 * On success:
 * - `setQueryData(taskKeys.lists(), append)` — appends the returned task
 *   to the main list cache. Safe because list rows do not render the
 *   nested fields.
 * - `setQueryData(taskKeys.detail(newTask.id), newTask)` — seeds the
 *   detail cache so navigating to the new task page is instant.
 * - `invalidateQueries(taskKeys.detail(newTask.id))` — kept: the seed is
 *   a partial `TaskSimpleDto`; the next observer refetches the canonical
 *   full `TaskDto` so joined fields render without a hard refresh.
 * - `setQueryData(taskKeys.byProject(projectId), append-if-exists)` —
 *   appends to the project-scoped list only if that cache already
 *   exists. The functional updater returns `undefined` for absent
 *   entries so no spurious cache entry is created for unvisited project
 *   views.
 * - `setQueryData(projectKeys.detail(projectId), patch tasks array)` —
 *   patches the parent project's `tasks` array directly so consumers
 *   reading `project.tasks` (gantt, EVM s-curve, health, projects-grid)
 *   see the new task instantly.
 * - `invalidateQueries(projectKeys.detail(projectId))` — kept
 *   (cross-namespace): the project's server-computed derived fields
 *   (progress %, etc.) must refetch after a task is added.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ data: CreateTaskRequest; files?: TaskFiles }`.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      files,
    }: {
      data: CreateTaskRequest;
      files?: TaskFiles;
    }) => taskService.create(data, files),
    onSuccess: (newTask, { data }) => {
      // POST /task/web returns TaskSimpleDto — nested fields (creator,
      // assignees, category, issues, attachments) absent. Seed for instant
      // navigation, then invalidate the detail key so the next observer
      // refetches the canonical full Task.
      queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
        old ? [...old, newTask] : [newTask]
      );
      queryClient.setQueryData<Task>(taskKeys.detail(newTask.id), newTask);
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(newTask.id) });
      // Append to the project-scoped list only if that cache already exists.
      // Functional updater returns undefined for absent entries, avoiding a
      // spurious cache entry for projects the user hasn't visited.
      queryClient.setQueryData<Task[]>(
        taskKeys.byProject(data.projectId),
        (old) => (old ? [...old, newTask] : undefined)
      );
      // Cross-namespace: Project entity carries `tasks: Task[]` nested.
      // Consumers (gantt, evm s-curve, health, projects-grid) read
      // `project.tasks` directly. Patch the parent's tasks array so the UI
      // updates instantly; invalidate so derived server fields (progress %)
      // refetch.
      queryClient.setQueryData<Project>(
        projectKeys.detail(data.projectId),
        (old) =>
          old ? { ...old, tasks: [...(old.tasks ?? []), newTask] } : old
      );
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(data.projectId),
      });
      // Page caches hold a PagedTask envelope, so they are refetched rather
      // than patched.
      queryClient.invalidateQueries({ queryKey: taskKeys.pages() });
    },
    onError: (error) => {
      logger.error('Failed to create task:', error);
    },
  });
}

/**
 * Updates an existing task.
 *
 * Backend response: `TaskSimpleDto` (partial — `creator`, `assignees`,
 * `category`, `issues`, and `attachments` absent).
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries on `taskKeys.detail(id)` and
 *   every cache matched by `isTaskListCache`, snapshots `previousDetail`
 *   and `previousListEntries`, then applies the scalar fields from
 *   `data` over the cached base. If the detail cache is absent, the
 *   base is recovered by scanning the snapshotted list entries.
 * - Applied scalar fields: `title`, `projectId`, `description`,
 *   `startDate`, `endDate`, `status`, `progress`, `tags`.
 * - Excluded: `creatorId`, `categoryId`, `assigneeIds` — resolving these
 *   to the joined entities (`Employee`, `WorkCategory`) would require
 *   separate cache lookups; the reconciliation step handles them.
 * - Files are not reflected optimistically (file IDs and URLs are only
 *   known after the server processes the upload).
 *
 * Rollback:
 * - `onError` restores `previousDetail` to `taskKeys.detail(id)` and
 *   iterates `previousListEntries` to restore each list key individually.
 *
 * On success:
 * - `setQueryData(taskKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with {@link TASK_NESTED_KEYS} to
 *   preserve cached joined fields across the partial response.
 * - `setQueriesData({ predicate: isTaskListCache }, replace-with-merge)`
 *   — mirrors the merge across `taskKeys.lists()` and every
 *   `byProject` cache.
 * - `invalidateQueries(taskKeys.detail(id))` — kept: SimpleDto omits
 *   nested fields; canonical refetch ensures the full `TaskDto`.
 * - `invalidateQueries({ predicate: isTaskListCache })` — kept for the
 *   same reason; list entries are also partial after merge.
 * - `setQueryData(projectKeys.detail(updatedTask.projectId), patch tasks)`
 *   — patches the parent project's `tasks` array using the same `merge`
 *   function. Conditional on `updatedTask.projectId !== undefined`.
 * - `invalidateQueries(projectKeys.detail(updatedTask.projectId))` —
 *   kept (cross-namespace): project's server-computed derived fields
 *   (progress %) must refetch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateTaskRequest; files?: TaskFiles }`.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      files,
    }: {
      id: number;
      data: UpdateTaskRequest;
      files?: TaskFiles;
    }) => taskService.update(id, data, files),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isTaskListCache });

      const previousDetail = queryClient.getQueryData<Task>(
        taskKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Task[]>({
        predicate: isTaskListCache,
      });

      // Build an optimistic snapshot from the detail cache, falling back to any
      // list entry. Fields that require joins (creatorId → Employee,
      // categoryId → WorkCategory, assigneeIds → Employee[]) are excluded;
      // onSuccess reconciles with the authoritative server response.
      const base =
        previousDetail ??
        previousListEntries
          .flatMap(([, items]) => items ?? [])
          .find((t) => t.id === id);

      if (base) {
        const optimisticTask: Task = {
          ...base,
          ...(data.title !== undefined && { title: data.title }),
          ...(data.projectId !== undefined && { projectId: data.projectId }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.progress !== undefined && { progress: data.progress }),
          ...(data.tags !== undefined && { tags: data.tags }),
        };
        queryClient.setQueryData<Task>(taskKeys.detail(id), optimisticTask);
        queryClient.setQueriesData<Task[]>(
          { predicate: isTaskListCache },
          (old) => old?.map((t) => (t.id === id ? optimisticTask : t))
        );
      }

      return { previousDetail, previousListEntries };
    },
    onError: (error, { id }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Task>(
          taskKeys.detail(id),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Task[]>(key, value);
      }
      logger.error('Failed to update task:', error);
    },
    onSuccess: (updatedTask, { id }) => {
      // PATCH /task/web/{id} returns TaskSimpleDto — nested fields (creator,
      // assignees, category, issues, attachments) absent. Merge preserves
      // cached nested data; invalidate triggers a canonical refetch.
      const merge = (old: Task | undefined): Task =>
        old
          ? mergePreservingNested(old, updatedTask, TASK_NESTED_KEYS)
          : updatedTask;
      queryClient.setQueryData<Task>(taskKeys.detail(id), merge);
      queryClient.setQueriesData<Task[]>(
        { predicate: isTaskListCache },
        (old) => old?.map((t) => (t.id === id ? merge(t) : t))
      );
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isTaskListCache });
      queryClient.invalidateQueries({ queryKey: taskKeys.pages() });

      // Cross-namespace: Project caches `tasks: Task[]` nested. Consumers
      // (gantt, evm s-curve, health, projects-grid) read project.tasks
      // directly. Patch the parent's tasks array so the UI updates instantly;
      // invalidate so derived server fields (progress %) refetch.
      if (updatedTask.projectId !== undefined) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(updatedTask.projectId),
          (old) =>
            old
              ? {
                  ...old,
                  tasks: (old.tasks ?? []).map((t) =>
                    t.id === id ? merge(t) : t
                  ),
                }
              : old
        );
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(updatedTask.projectId),
        });
      }
    },
  });
}

/**
 * Deletes a task.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries on `taskKeys.detail(id)` and
 *   every cache matched by `isTaskListCache`. Snapshots three caches:
 *   `previousDetail`, `previousListEntries`, and
 *   `previousParentProject` (looked up via the soon-to-be-deleted
 *   task's `projectId`, conditional on its presence).
 * - Applies the deletion immediately:
 *   `setQueriesData({ predicate: isTaskListCache }, filter)` removes the
 *   task from every list cache, `removeQueries(taskKeys.detail(id))`
 *   evicts the detail, and `setQueryData(projectKeys.detail(projectId),
 *   filter tasks)` removes the task from the parent project's nested
 *   `tasks` array (conditional on the snapshotted parent).
 *
 * Rollback:
 * - `onError` restores `previousListEntries` to each list key, re-seeds
 *   the detail cache from `previousDetail` (this is the reverse of
 *   `removeQueries` — using `setQueryData` to bring the entry back),
 *   and restores the parent project's `tasks` array from
 *   `previousParentProject` when present.
 *
 * On success:
 * - `invalidateQueries(projectKeys.detail(previousDetail.projectId))` —
 *   kept (cross-namespace): refreshes the parent project's
 *   server-computed derived fields (progress %) after deletion.
 *   Conditional on the snapshotted `projectId`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the task's `id` directly (not wrapped in an object).
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskService.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isTaskListCache });

      const previousDetail = queryClient.getQueryData<Task>(
        taskKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Task[]>({
        predicate: isTaskListCache,
      });

      // Cross-namespace snapshot: Project caches `tasks: Task[]` nested.
      // Capture before applying the optimistic deletion so onError can restore.
      const previousParentProject =
        previousDetail?.projectId === undefined
          ? undefined
          : queryClient.getQueryData<Project>(
              projectKeys.detail(previousDetail.projectId)
            );

      // Apply deletion immediately — removed from all list caches and detail evicted.
      queryClient.setQueriesData<Task[]>(
        { predicate: isTaskListCache },
        (old) => old?.filter((t) => t.id !== id)
      );
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });

      // Filter the task from the parent project's tasks array so consumers
      // (gantt, evm s-curve, health) update instantly.
      if (previousDetail?.projectId !== undefined && previousParentProject) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(previousDetail.projectId),
          {
            ...previousParentProject,
            tasks: (previousParentProject.tasks ?? []).filter(
              (t) => t.id !== id
            ),
          }
        );
      }

      return { previousDetail, previousListEntries, previousParentProject };
    },
    onError: (error, id, context) => {
      // Restore list caches from snapshot.
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Task[]>(key, value);
      }
      // Re-seed detail if it was present before the optimistic deletion.
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Task>(
          taskKeys.detail(id),
          context.previousDetail
        );
      }
      // Restore the parent project's tasks array.
      if (
        context?.previousDetail?.projectId !== undefined &&
        context.previousParentProject !== undefined
      ) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(context.previousDetail.projectId),
          context.previousParentProject
        );
      }
      logger.error('Failed to delete task:', error);
    },
    onSuccess: (_data, _id, context) => {
      // Server confirmed; invalidate the parent project so derived fields
      // (progress %) refetch with fresh data.
      if (context?.previousDetail?.projectId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(context.previousDetail.projectId),
        });
      }
      queryClient.invalidateQueries({ queryKey: taskKeys.pages() });
    },
  });
}
