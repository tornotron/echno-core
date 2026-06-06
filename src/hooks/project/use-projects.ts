import { useQuery } from '@tanstack/react-query';
import { projectService } from '../../services/project-service';
import { shouldRetry } from '../../lib/query/retry';
import { projectKeys } from './project-keys';
export { projectKeys } from './project-keys';

/**
 * Hook to fetch all projects.
 * Includes retry logic for transient errors and caches data for 5 minutes.
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
 * Hook to fetch a single project by ID.
 * Includes retry logic for transient errors and caches data for 5 minutes.
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
 * Hook to fetch projects by organization ID.
 * Includes retry logic for transient errors and caches data for 5 minutes.
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
 * Hook to fetch projects assigned to a specific employee.
 * Includes retry logic for transient errors and caches data for 5 minutes.
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
 * Hook to fetch member employees of a specific project.
 * Includes retry logic for transient errors and caches data for 5 minutes.
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
