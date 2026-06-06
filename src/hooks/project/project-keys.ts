export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: number) => [...projectKeys.details(), id] as const,
  byOrganization: (orgId: number) =>
    [...projectKeys.all, 'organization', orgId] as const,
  byEmployee: (employeeId: number) =>
    [...projectKeys.all, 'employee', employeeId] as const,
  members: (projectId: number) =>
    [...projectKeys.all, 'members', projectId] as const,
};
