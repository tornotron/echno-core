/**
 * @module issue-keys
 *
 * TanStack Query key factories for the issue domain and the issue-comment
 * sub-domain.
 *
 * `issueKeys` shapes:
 * - `['issues']` — namespace root, invalidation prefix only; never used as a query key directly.
 * - `['issues', 'list']` — the main collection (consumed by {@link useIssues}).
 * - `['issues', id]` — a single issue by ID (consumed by {@link useIssue}).
 * - `['issues', 'project', projectId]` — issues scoped to a project (consumed by {@link useIssuesByProject}).
 * - `['issues', 'task', taskId]` — issues scoped to a task (consumed by {@link useIssuesByTask}).
 *
 * `issueCommentKeys` shapes:
 * - `['issue-comments']` — namespace root, invalidation prefix only.
 * - `['issue-comments', 'list']` — the main collection (consumed by {@link useIssueComments}).
 * - `['issue-comments', id]` — a single comment by ID (consumed by {@link useIssueComment}).
 * - `['issue-comments', 'issue', issueId]` — comments scoped to an issue (consumed by {@link useIssueCommentsByIssue}).
 *
 * The `detail(id)` shape uses a numeric second segment (no `'detail'`
 * discriminator); the `isIssueListCache` / `isIssueCommentListCache`
 * predicates rely on this to distinguish detail entries from list entries
 * during predicate-based cache patching.
 */
export const issueKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['issues'] as const,

  /** Query key for the full issue list. */
  lists: () => [...issueKeys.all, 'list'] as const,

  /** Query key for a single issue by ID. */
  detail: (id: number) => [...issueKeys.all, id] as const,

  /** Query key for issues scoped to a project. */
  byProject: (projectId: number) =>
    [...issueKeys.all, 'project', projectId] as const,

  /** Query key for issues scoped to a task. */
  byTask: (taskId: number) => [...issueKeys.all, 'task', taskId] as const,
};

export const issueCommentKeys = {
  /** Invalidation prefix only — pass to `invalidateQueries` to wipe every cache entry under the namespace. */
  all: ['issue-comments'] as const,

  /** Query key for the full issue-comment list. */
  lists: () => [...issueCommentKeys.all, 'list'] as const,

  /** Query key for a single comment by ID. */
  detail: (id: number) => [...issueCommentKeys.all, id] as const,

  /** Query key for comments scoped to a parent issue. */
  byIssue: (issueId: number) =>
    [...issueCommentKeys.all, 'issue', issueId] as const,
};
