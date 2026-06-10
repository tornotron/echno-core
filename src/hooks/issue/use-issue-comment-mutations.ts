/**
 * @module use-issue-comment-mutations
 *
 * TanStack mutation hooks for issue comments. Read-side hooks live in
 * {@link useIssueComments}, {@link useIssueComment}, and
 * {@link useIssueCommentsByIssue}.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issueCommentService } from '../../services/issue-comment-service';
import { Issue } from '../../types/issue';
import { IssueComment } from '../../types/issue/issue-comment';
import { CreateIssueCommentRequest } from '../../types/issue/issue-create';
import { UpdateIssueCommentRequest } from '../../types/issue/issue-update';
import { logger } from '../../lib/logger';
import { issueKeys, issueCommentKeys } from './keys';

/**
 * Matches every `IssueComment[]` list cache under the `'issue-comments'`
 * namespace while excluding detail entries (numeric second segment).
 * Covers `['issue-comments', 'list']` and
 * `['issue-comments', 'issue', issueId]`.
 */
function isIssueCommentListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'issue-comments' &&
    key.length > 1 &&
    typeof key[1] !== 'number'
  );
}

/**
 * Creates a new comment on an issue.
 *
 * Backend response: `IssueCommentSimpleDto` (partial). `IssueComment` has
 * no nested arrays, so no merge helper is required.
 *
 * On success:
 * - `setQueryData(issueCommentKeys.byIssue(issueId), append-if-cached)` — appends to the issue-scoped comment list only when already cached.
 * - `setQueryData(issueCommentKeys.lists(), append-if-cached)` — appends to the main comments list only when already cached.
 * - `setQueryData(issueCommentKeys.detail(newComment.id), newComment)` — seeds detail for instant nav.
 * - `setQueryData(issueKeys.detail(issueId), { ...detail, comments: [...comments, newComment] })` — cross-namespace direct patch of the parent {@link Issue}'s nested `comments` array so the issue view updates without a refetch. Falls back to invalidation when the parent isn't cached.
 *
 * Invalidations kept:
 * - `invalidateQueries(issueCommentKeys.detail(newComment.id))` — canonical refetch so the next observer pulls the full `IssueCommentDto`.
 * - `invalidateQueries(issueKeys.detail(issueId))` — fallback only when the parent issue isn't in detail cache; otherwise the cache write above replaces this invalidation.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   a {@link CreateIssueCommentRequest}.
 */
export function useCreateIssueComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateIssueCommentRequest) =>
      issueCommentService.create(dto),
    onSuccess: (newComment, { issueId }) => {
      // POST /issues/comments/web → IssueCommentSimpleDto.
      // IssueComment is shallow (scalars only); no nested keys to preserve.
      // Append to the issue-scoped comment list if it's cached.
      queryClient.setQueryData<IssueComment[]>(
        issueCommentKeys.byIssue(issueId),
        (old) => (old ? [...old, newComment] : undefined)
      );
      // Append to the main comments list if it's cached.
      queryClient.setQueryData<IssueComment[]>(
        issueCommentKeys.lists(),
        (old) => (old ? [...old, newComment] : undefined)
      );
      // Seed detail; invalidate so the canonical IssueCommentDto refetches.
      queryClient.setQueryData<IssueComment>(
        issueCommentKeys.detail(newComment.id),
        newComment
      );
      queryClient.invalidateQueries({
        queryKey: issueCommentKeys.detail(newComment.id),
      });

      // Cross-namespace: the parent Issue caches `comments` as a nested array
      // (filled from `json.issueComments` by parseIssue). Patch the detail
      // entry to append the new comment so the issue view updates without a
      // refetch. Fall back to invalidation if detail isn't cached.
      const issueDetail = queryClient.getQueryData<Issue>(
        issueKeys.detail(issueId)
      );
      if (issueDetail) {
        queryClient.setQueryData<Issue>(issueKeys.detail(issueId), {
          ...issueDetail,
          comments: [...(issueDetail.comments ?? []), newComment],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: issueKeys.detail(issueId) });
      }
    },
    onError: (error) => {
      logger.error('Failed to create issue comment:', error);
    },
  });
}

/**
 * Updates an issue comment.
 *
 * Backend response: `(orphan endpoint)` — the backend has no PATCH route
 * for issue comments at present, so this mutation will 404/405 in
 * production. The hook is preserved with broad-invalidation behaviour so
 * the wiring is in place when the endpoint lands.
 *
 * On success (theoretical):
 * - `invalidateQueries(issueCommentKeys.detail(id))` — refetch the canonical comment.
 * - `invalidateQueries({ predicate: isIssueCommentListCache })` — refetch every comment list.
 * - `invalidateQueries(issueKeys.all)` — broad refresh since the parent issue's nested `comments` array would also be stale.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateIssueCommentRequest }`.
 *
 * @internal
 */
export function useUpdateIssueComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateIssueCommentRequest;
    }) => issueCommentService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: issueCommentKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isIssueCommentListCache });
      queryClient.invalidateQueries({ queryKey: issueKeys.all });
    },
    onError: (error) => {
      logger.error('Failed to update issue comment:', error);
    },
  });
}

/**
 * Deletes an issue comment with optimistic eviction and snapshot-based
 * rollback.
 *
 * The `mutationFn` accepts `{ id, issueId }` so the parent issue's
 * `comments` array and the `byIssue` cache can be patched without a
 * backend lookup.
 *
 * Backend response: `ApiResponse` (ack only).
 *
 * Optimistic update (`onMutate`):
 * - Cancels in-flight `detail(id)`, predicate-matched comment lists, and `issueKeys.detail(issueId)`.
 * - Snapshots: `previousDetail` (`IssueComment`), `previousListEntries` (`Array<[QueryKey, IssueComment[] | undefined]>`), `previousParentIssue` (`Issue`).
 * - Applies removal immediately: filters every comment list cache via predicate, evicts the comment detail with `removeQueries`, and filters the parent issue's `comments` array if it was cached.
 *
 * Rollback (`onError`):
 * - Restores comment list caches from `previousListEntries`.
 * - Re-seeds the comment detail from `previousDetail` if it was present.
 * - Restores the parent issue's `comments` array from `previousParentIssue` if it was present.
 *
 * Cache evictions:
 * - `removeQueries(issueCommentKeys.detail(id))` — entity no longer exists.
 *
 * Invalidations kept:
 * - `invalidateQueries(issueKeys.detail(issueId))` — fallback only when the parent issue wasn't cached at mutate time; otherwise the optimistic parent-array patch covers the UI update.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; issueId: number }`.
 */
export function useDeleteIssueComment() {
  const queryClient = useQueryClient();

  return useMutation({
    // Accept issueId in addition to id so we can patch the parent issue's
    // comments array and the byIssue list without a backend round-trip.
    mutationFn: ({ id }: { id: number; issueId: number }) =>
      issueCommentService.delete(id),
    onMutate: async ({ id, issueId }) => {
      await queryClient.cancelQueries({
        queryKey: issueCommentKeys.detail(id),
      });
      await queryClient.cancelQueries({ predicate: isIssueCommentListCache });
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(issueId) });

      const previousDetail = queryClient.getQueryData<IssueComment>(
        issueCommentKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<IssueComment[]>({
        predicate: isIssueCommentListCache,
      });
      const previousParentIssue = queryClient.getQueryData<Issue>(
        issueKeys.detail(issueId)
      );

      // Apply deletion immediately across all comment caches + parent issue.
      queryClient.setQueriesData<IssueComment[]>(
        { predicate: isIssueCommentListCache },
        (old) => old?.filter((c) => c.id !== id)
      );
      queryClient.removeQueries({ queryKey: issueCommentKeys.detail(id) });
      if (previousParentIssue) {
        queryClient.setQueryData<Issue>(issueKeys.detail(issueId), {
          ...previousParentIssue,
          comments: (previousParentIssue.comments ?? []).filter(
            (c) => c.id !== id
          ),
        });
      }

      return { previousDetail, previousListEntries, previousParentIssue };
    },
    onSuccess: (_data, { issueId }, context) => {
      // DELETE /issues/comments/web/{id} → ApiResponse (ack).
      // Cache already updated in onMutate. If the parent issue wasn't cached
      // at mutate time, fall back to invalidation so it'll refetch correctly.
      if (context?.previousParentIssue === undefined) {
        queryClient.invalidateQueries({ queryKey: issueKeys.detail(issueId) });
      }
    },
    onError: (error, { id, issueId }, context) => {
      // Restore comment list caches.
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<IssueComment[]>(key, value);
      }
      // Re-seed comment detail if it was present.
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<IssueComment>(
          issueCommentKeys.detail(id),
          context.previousDetail
        );
      }
      // Restore parent issue's comments array.
      if (context?.previousParentIssue !== undefined) {
        queryClient.setQueryData<Issue>(
          issueKeys.detail(issueId),
          context.previousParentIssue
        );
      }
      logger.error('Failed to delete issue comment:', error);
    },
  });
}
