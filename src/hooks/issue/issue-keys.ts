export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  detail: (id: number) => [...issueKeys.all, id] as const,
  byProject: (projectId: number) =>
    [...issueKeys.all, 'project', projectId] as const,
  byTask: (taskId: number) => [...issueKeys.all, 'task', taskId] as const,
};

export const issueCommentKeys = {
  all: ['issue-comments'] as const,
  lists: () => [...issueCommentKeys.all, 'list'] as const,
  detail: (id: number) => [...issueCommentKeys.all, id] as const,
  byIssue: (issueId: number) =>
    [...issueCommentKeys.all, 'issue', issueId] as const,
};
