/**
 * @module use-issue-mutations
 *
 * TanStack mutation hooks for the issue domain. Read-side hooks live in
 * {@link useIssues}, {@link useIssue}, {@link useIssuesByProject}, and
 * {@link useIssuesByTask}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issueService } from '../../services/issue-service';
import { Issue, IssueFiles } from '../../types/issue';
import { Task } from '../../types/task';
import { CreateIssueRequest } from '../../types/issue/issue-create';
import { UpdateIssueRequest } from '../../types/issue/issue-update';
import { logger } from '../../lib/logger';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { issueKeys } from './issue-keys';
import { taskKeys } from '../task/task-keys';

/**
 * Nested keys preserved from the cached `Issue` when merging a partial
 * `IssueSimpleDto` response into the detail / list caches. The first two
 * are nested arrays; `taskName` is a denormalised join scalar that the
 * SimpleDto may omit.
 */
const ISSUE_NESTED_KEYS = [
  'comments',
  'attachments',
  'taskName',
] as const satisfies ReadonlyArray<keyof Issue>;

/**
 * Matches every `Issue[]` list cache under the `'issues'` namespace while
 * excluding detail entries (which use `['issues', id]` with a numeric
 * second segment). Covers `['issues', 'list']`,
 * `['issues', 'project', projectId]`, and `['issues', 'task', taskId]`
 * in a single `setQueriesData` pass.
 */
function isIssueListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'issues' &&
    key.length > 1 &&
    typeof key[1] !== 'number'
  );
}

/**
 * Creates a new issue, optionally with attachments.
 *
 * Backend response: `IssueSimpleDto` (partial — `comments`, `attachments`,
 * and `taskName` may be absent).
 *
 * On success:
 * - `setQueryData(issueKeys.lists(), append)` — appends to the main list.
 * - `setQueryData(issueKeys.detail(newIssue.id), newIssue)` — seeds detail for instant nav.
 * - `setQueryData(issueKeys.byTask(taskId), append-if-cached)` — appends to the task-scoped list only when already cached (functional updater returns `undefined` for absent entries, avoiding spurious cache rows).
 * - `setQueryData(issueKeys.byProject(projectId), append-if-cached)` — same for the project-scoped list.
 * - `setQueryData(taskKeys.detail(taskId), { ...old, issues: [...issues, newIssue] })` — cross-namespace patch of the parent {@link Task}'s nested `issues` array so task-detail consumers update instantly. Conditional on `data.taskId !== undefined`.
 *
 * Invalidations kept:
 * - `invalidateQueries(issueKeys.detail(newIssue.id))` — canonical refetch so the next observer pulls the full `IssueDto` with nested arrays. The SimpleDto seed is partial.
 * - `invalidateQueries(taskKeys.detail(taskId))` — cross-namespace; refetches derived server-side task fields that the client cannot replicate.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ data: CreateIssueRequest; files?: IssueFiles }`.
 */
export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      files,
    }: {
      data: CreateIssueRequest;
      files?: IssueFiles;
    }) => issueService.create(data, files),
    onSuccess: (newIssue, { data }) => {
      // POST /issues/web → IssueSimpleDto — nested arrays (comments, attachments)
      // and joined fields (taskName) may be absent. Seed for instant nav;
      // invalidate detail so the next observer refetches the canonical IssueDto.
      queryClient.setQueryData<Issue[]>(issueKeys.lists(), (old) =>
        old ? [...old, newIssue] : [newIssue]
      );
      queryClient.setQueryData<Issue>(issueKeys.detail(newIssue.id), newIssue);
      queryClient.invalidateQueries({
        queryKey: issueKeys.detail(newIssue.id),
      });

      // Append to scoped lists only if they're already in cache. Functional
      // updater returns undefined for absent entries, avoiding spurious caches.
      if (data.taskId !== undefined) {
        queryClient.setQueryData<Issue[]>(
          issueKeys.byTask(data.taskId),
          (old) => (old ? [...old, newIssue] : undefined)
        );
        // Cross-namespace: Task entity caches `issues: Issue[]` nested.
        // Consumers (task-overview-tab, task-issues-tab, task-table, tasks-list)
        // read `task.issues` directly. Patch the parent's issues array so the
        // UI updates instantly; invalidate so derived server fields refetch.
        queryClient.setQueryData<Task>(taskKeys.detail(data.taskId), (old) =>
          old ? { ...old, issues: [...(old.issues ?? []), newIssue] } : old
        );
        queryClient.invalidateQueries({
          queryKey: taskKeys.detail(data.taskId),
        });
      }
      if (data.projectId !== undefined) {
        queryClient.setQueryData<Issue[]>(
          issueKeys.byProject(data.projectId),
          (old) => (old ? [...old, newIssue] : undefined)
        );
      }
    },
    onError: (error) => {
      logger.error('Failed to create issue:', error);
    },
  });
}

/**
 * Updates an existing issue with optimistic patching and partial-DTO
 * reconciliation.
 *
 * Backend response: `IssueSimpleDto` (partial — `comments`, `attachments`,
 * and `taskName` may be absent on the response).
 *
 * Optimistic update (`onMutate`):
 * - Cancels in-flight `detail(id)` and predicate-matched list queries.
 * - Snapshots: `previousDetail` (`Issue`), `previousListEntries` (`Array<[QueryKey, Issue[] | undefined]>`).
 * - Falls back to scanning list caches if the detail entry isn't yet cached.
 * - Applies the deterministic scalar fields (`title`, `description`, `type`, `status`, `assigneeId`) over the cached base. Joined objects (`creator`, `assignee`) and nested arrays are left to `onSuccess` reconciliation.
 *
 * Rollback (`onError`): restores `previousDetail` and iterates
 * `previousListEntries` to restore each list key individually.
 *
 * On success:
 * - `setQueryData(issueKeys.detail(id), merge)` — uses {@link mergePreservingNested} with `ISSUE_NESTED_KEYS` so cached `comments`, `attachments`, and `taskName` survive the partial response.
 * - `setQueriesData({ predicate: isIssueListCache }, replace-with-merge)` — mirrors the merge across main, byProject, and byTask list caches.
 * - `setQueryData(taskKeys.detail(taskId), { ...old, issues: old.issues.map(replace) })` — cross-namespace patch of the parent task's nested `issues` array. Conditional on `updatedIssue.taskId !== undefined`.
 *
 * Invalidations kept:
 * - `invalidateQueries(issueKeys.detail(id))` + `invalidateQueries({ predicate: isIssueListCache })` — canonical reconciliation; the merged write is still partial, and the canonical refetch ensures nested arrays render without a hard refresh.
 * - `invalidateQueries(taskKeys.detail(taskId))` — cross-namespace; derived task fields refetch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateIssueRequest; files?: IssueFiles }`.
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      files,
    }: {
      id: number;
      data: UpdateIssueRequest;
      files?: IssueFiles;
    }) => issueService.update(id, data, files),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isIssueListCache });

      const previousDetail = queryClient.getQueryData<Issue>(
        issueKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Issue[]>({
        predicate: isIssueListCache,
      });

      // Build optimistic snapshot from detail cache, falling back to any list
      // entry. Only deterministic scalar fields are applied; joined objects
      // (creator, assignee, category) require cache lookups and are resolved
      // by onSuccess's merge + invalidate. Note: `issueType` (request DTO) maps
      // to `type` on the Issue interface.
      const base =
        previousDetail ??
        previousListEntries
          .flatMap(([, items]) => items ?? [])
          .find((i) => i.id === id);

      if (base) {
        const optimisticIssue: Issue = {
          ...base,
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.issueType !== undefined && { type: data.issueType }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assigneeId !== undefined && {
            assigneeId: data.assigneeId ?? undefined,
          }),
        };
        queryClient.setQueryData<Issue>(issueKeys.detail(id), optimisticIssue);
        queryClient.setQueriesData<Issue[]>(
          { predicate: isIssueListCache },
          (old) => old?.map((i) => (i.id === id ? optimisticIssue : i))
        );
      }

      return { previousDetail, previousListEntries };
    },
    onSuccess: (updatedIssue, { id }) => {
      // PATCH /issues/web/{id} → IssueSimpleDto — nested arrays (comments,
      // attachments) and joined fields (taskName) absent. Merge preserves
      // cached nested data; invalidate triggers a canonical refetch.
      const merge = (old: Issue | undefined): Issue =>
        old
          ? mergePreservingNested(old, updatedIssue, ISSUE_NESTED_KEYS)
          : updatedIssue;
      queryClient.setQueryData<Issue>(issueKeys.detail(id), merge);
      queryClient.setQueriesData<Issue[]>(
        { predicate: isIssueListCache },
        (old) => old?.map((i) => (i.id === id ? merge(i) : i))
      );
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isIssueListCache });

      // Cross-namespace: task detail caches `issues: Issue[]` nested. Patch
      // the parent's issues array so consumers update instantly; invalidate
      // so derived server fields refetch.
      if (updatedIssue.taskId !== undefined) {
        queryClient.setQueryData<Task>(
          taskKeys.detail(updatedIssue.taskId),
          (old) =>
            old
              ? {
                  ...old,
                  issues: (old.issues ?? []).map((i) =>
                    i.id === id ? updatedIssue : i
                  ),
                }
              : old
        );
        queryClient.invalidateQueries({
          queryKey: taskKeys.detail(updatedIssue.taskId),
        });
      }
    },
    onError: (error, { id }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Issue>(
          issueKeys.detail(id),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Issue[]>(key, value);
      }
      logger.error('Failed to update issue:', error);
    },
  });
}

/**
 * Deletes an issue by ID with optimistic eviction and snapshot-based
 * rollback.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * Optimistic update (`onMutate`):
 * - Cancels in-flight `detail(id)` and predicate-matched list queries.
 * - Snapshots: `previousDetail` (`Issue`), `previousListEntries`, and `previousParentTask` (`Task`) — read from `taskKeys.detail(previousDetail.taskId)` if the issue had a parent task. The parent-task snapshot is captured *before* the optimistic eviction so it's available for rollback.
 * - Applies removal immediately: filters every list cache via predicate, evicts the detail entry with `removeQueries`, and filters the parent task's nested `issues` array.
 *
 * Rollback (`onError`):
 * - Restores list caches from `previousListEntries`.
 * - Re-seeds the detail entry from `previousDetail` if it was present.
 * - Restores the parent task's `issues` array from `previousParentTask` if it was present.
 *
 * Cache evictions:
 * - `removeQueries(issueKeys.detail(id))` — entity no longer exists; nothing to refetch.
 *
 * Invalidations kept:
 * - `invalidateQueries(taskKeys.detail(previousDetail.taskId))` — cross-namespace; derived task fields refetch. Read from the pre-deletion snapshot since the live detail is gone. Conditional on `previousDetail.taskId !== undefined`.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the numeric ID of the issue to delete.
 */
export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: issueService.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isIssueListCache });

      const previousDetail = queryClient.getQueryData<Issue>(
        issueKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Issue[]>({
        predicate: isIssueListCache,
      });

      // Cross-namespace snapshot: parent Task caches `issues: Issue[]` nested.
      const previousParentTask =
        previousDetail?.taskId === undefined
          ? undefined
          : queryClient.getQueryData<Task>(
              taskKeys.detail(previousDetail.taskId)
            );

      // Apply deletion immediately — removed from all list caches and detail evicted.
      queryClient.setQueriesData<Issue[]>(
        { predicate: isIssueListCache },
        (old) => old?.filter((i) => i.id !== id)
      );
      queryClient.removeQueries({ queryKey: issueKeys.detail(id) });

      // Filter the issue from the parent task's issues array so consumers
      // update instantly.
      if (previousDetail?.taskId !== undefined && previousParentTask) {
        queryClient.setQueryData<Task>(taskKeys.detail(previousDetail.taskId), {
          ...previousParentTask,
          issues: (previousParentTask.issues ?? []).filter((i) => i.id !== id),
        });
      }

      return { previousDetail, previousListEntries, previousParentTask };
    },
    onSuccess: (_data, _id, context) => {
      // DELETE /issues/web/{id} → ApiResponse (ack).
      // Cache was already updated optimistically in onMutate. Trigger the
      // cross-namespace task invalidation from the pre-deletion snapshot so
      // derived server fields refetch.
      if (context?.previousDetail?.taskId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.detail(context.previousDetail.taskId),
        });
      }
    },
    onError: (error, id, context) => {
      // Restore list caches from snapshot.
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Issue[]>(key, value);
      }
      // Re-seed detail if it was present before the optimistic deletion.
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Issue>(
          issueKeys.detail(id),
          context.previousDetail
        );
      }
      // Restore the parent task's issues array.
      if (
        context?.previousDetail?.taskId !== undefined &&
        context.previousParentTask !== undefined
      ) {
        queryClient.setQueryData<Task>(
          taskKeys.detail(context.previousDetail.taskId),
          context.previousParentTask
        );
      }
      logger.error('Failed to delete issue:', error);
    },
  });
}
