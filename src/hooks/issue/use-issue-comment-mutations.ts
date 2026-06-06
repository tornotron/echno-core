import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issueCommentService } from '../../services/issue-comment-service';
import { Issue } from '../../types/issue';
import { IssueComment } from '../../types/issue/issue-comment';
import { CreateIssueCommentRequest } from '../../types/issue/issue-create';
import { UpdateIssueCommentRequest } from '../../types/issue/issue-update';
import { logger } from '../../lib/logger';
import { issueKeys, issueCommentKeys } from './issue-keys';

/**
 * Matches every IssueComment[] list cache under the 'issue-comments' namespace
 * while excluding detail entries (numeric second segment).
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
 * FIXME: The backend has no PATCH endpoint for issue comments per the live
 * OpenAPI spec (audited 2026-06-01). `issueCommentService.update` calls
 * `PATCH /issues/comments/web/{id}` which returns 404/405. This hook is
 * orphan — exported but never consumed. Either delete it in a follow-up PR or
 * coordinate with the backend team to add the endpoint. Kept here unchanged
 * to keep Milestone 4A scope strict.
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
