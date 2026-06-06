/**
 * @module use-projects
 *
 * Read-side TanStack Query hooks for the project domain. Each hook wraps
 * a {@link projectService} call with a 5-minute `staleTime`, the shared
 * {@link shouldRetry} predicate, and an exponential retry-delay cap at
 * 30 s. Hooks that depend on an ID stay disabled until the ID is truthy.
 */
import { useQuery } from '@tanstack/react-query';
import { projectService } from '../../services/project-service';
import { shouldRetry } from '../../lib/query/retry';
import { projectKeys } from './project-keys';
export { projectKeys } from './project-keys';

/**
 * Fetches every project visible to the current user.
 *
 * `staleTime` is 5 minutes; retries follow {@link shouldRetry} with
 * exponential backoff capped at 30 s.
 *
 * @returns A TanStack `UseQueryResult` wrapping `Project[]`.
 */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () => projectService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches a single project by ID.
 *
 * Disabled until `id` is truthy; `staleTime` is 5 minutes; retries follow
 * {@link shouldRetry} with exponential backoff capped at 30 s.
 *
 * @param id - Surrogate ID of the project. Pass `undefined` to defer the
 *   query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `Project`.
 */
export function useProject(id?: number) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? 0),
    queryFn: () => {
      if (!id) {
        throw new Error('Project ID is required');
      }
      return projectService.getById(id);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches every project under one organization.
 *
 * Disabled until `organizationId` is truthy; `staleTime` is 5 minutes;
 * retries follow {@link shouldRetry} with exponential backoff capped at
 * 30 s.
 *
 * @param organizationId - Surrogate ID of the organization. Pass
 *   `undefined` to defer the query.
 * @returns A TanStack `UseQueryResult` wrapping `Project[]`.
 */
export function useProjectsByOrganization(organizationId?: number) {
  return useQuery({
    queryKey: projectKeys.byOrganization(organizationId ?? 0),
    queryFn: () => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      return projectService.getByOrganization(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches every project the given employee is a member of.
 *
 * Disabled until `employeeId` is truthy; `staleTime` is 5 minutes;
 * retries follow {@link shouldRetry} with exponential backoff capped at
 * 30 s.
 *
 * @param employeeId - Surrogate ID of the employee. Pass `undefined` to
 *   defer the query.
 * @returns A TanStack `UseQueryResult` wrapping `Project[]`.
 */
export function useProjectsByEmployee(employeeId?: number) {
  return useQuery({
    queryKey: projectKeys.byEmployee(employeeId ?? 0),
    queryFn: () => {
      if (!employeeId) {
        throw new Error('Employee ID is required');
      }
      return projectService.getProjectsByEmployee(employeeId);
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Fetches the standalone member list for one project.
 *
 * Cache key lives under the `projects` namespace
 * (`projectKeys.members(projectId)`) because the data is owned by the
 * project module even though it carries `Employee[]`. Disabled until
 * `projectId` is truthy; `staleTime` is 5 minutes; retries follow
 * {@link shouldRetry} with exponential backoff capped at 30 s.
 *
 * @param projectId - Surrogate ID of the project. Pass `undefined` to
 *   defer the query.
 * @returns A TanStack `UseQueryResult` wrapping `Employee[]`.
 */
export function useEmployeesByProject(projectId?: number) {
  return useQuery({
    queryKey: projectKeys.members(projectId ?? 0),
    queryFn: () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return projectService.getEmployeesByProject(projectId);
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}
