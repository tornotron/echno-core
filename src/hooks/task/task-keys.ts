export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  detail: (id: number) => [...taskKeys.all, id] as const,
  byProject: (projectId: number) =>
    [...taskKeys.all, 'project', projectId] as const,
};
