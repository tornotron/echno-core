import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../../services/task-service';
import { Task } from '../../types/task';
import { Project } from '../../types/project';
import { CreateTaskRequest, TaskFiles } from '../../types/task/task-create';
import { UpdateTaskRequest } from '../../types/task/task-update';
import { logger } from '../../lib/logger';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { taskKeys } from './task-keys';
import { projectKeys } from '../project/project-keys';

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
    typeof key[1] !== 'number'
  );
}

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
    },
    onError: (error) => {
      logger.error('Failed to create task:', error);
    },
  });
}

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
    },
  });
}
