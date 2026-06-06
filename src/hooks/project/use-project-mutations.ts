import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../../services/project-service';
import {
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectFiles,
  Project,
} from '../../types/project';
import { Employee } from '../../types/employee';
import { logger } from '../../lib/logger';
import { getErrorMessage, getErrorTitle } from '../../lib/utils/error-helpers';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { projectKeys } from './project-keys';
import { employeeKeys } from '../employee/employee-keys';

const PROJECT_NESTED_KEYS = [
  'attachments',
  'members',
  'tasks',
] as const satisfies ReadonlyArray<keyof Project>;

/**
 * Matches every Project[] list cache under the 'projects' namespace while
 * excluding detail (Project) and members (Employee[]) entries, which live
 * under the same root key but carry a different data shape.
 */
function isProjectListCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    key[0] === 'projects' &&
    key[1] !== 'detail' &&
    key[1] !== 'members'
  );
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProjectRequest) => projectService.create(dto),
    onSuccess: (newProject) => {
      // Append to main list — safe because we have the authoritative server object.
      queryClient.setQueryData<Project[]>(projectKeys.lists(), (old) =>
        old ? [...old, newProject] : [newProject]
      );
      // Seed detail cache so navigating to the new project page is instant.
      queryClient.setQueryData<Project>(
        projectKeys.detail(newProject.id),
        newProject
      );
    },
    onError: (error) => {
      logger.error('Failed to create project:', error);
    },
  });
}

export function useCreateProjectWithFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      files,
    }: {
      data: CreateProjectRequest;
      files: ProjectFiles;
    }) => projectService.createWithFiles(data, files),
    onSuccess: (newProject) => {
      queryClient.setQueryData<Project[]>(projectKeys.lists(), (old) =>
        old ? [...old, newProject] : [newProject]
      );
      queryClient.setQueryData<Project>(
        projectKeys.detail(newProject.id),
        newProject
      );
    },
    onError: (error) => {
      logger.error('Failed to create project with files:', error);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
      projectService.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isProjectListCache });

      const previousDetail = queryClient.getQueryData<Project>(
        projectKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Project[]>({
        predicate: isProjectListCache,
      });

      // Build an optimistic snapshot from the detail cache, falling back to any
      // list entry. memberIds is intentionally excluded — resolving ids to
      // Employee[] objects would require a separate cache lookup.
      const base =
        previousDetail ??
        previousListEntries
          .flatMap(([, items]) => items ?? [])
          .find((p) => p.id === id);

      if (base) {
        const optimisticProject: Project = {
          ...base,
          ...(data.projectName !== undefined && {
            projectName: data.projectName,
          }),
          ...(data.projectAddress !== undefined && {
            projectAddress: data.projectAddress,
          }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.projectLongitude !== undefined && {
            projectLongitude: data.projectLongitude,
          }),
          ...(data.projectLatitude !== undefined && {
            projectLatitude: data.projectLatitude,
          }),
          ...(data.organizationId !== undefined && {
            organizationId: data.organizationId,
          }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
        };
        queryClient.setQueryData<Project>(
          projectKeys.detail(id),
          optimisticProject
        );
        queryClient.setQueriesData<Project[]>(
          { predicate: isProjectListCache },
          (old) => old?.map((p) => (p.id === id ? optimisticProject : p))
        );
      }

      return { previousDetail, previousListEntries };
    },
    onError: (error, { id }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(id),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Project[]>(key, value);
      }
      logger.error('Failed to update project:', error);
    },
    onSuccess: (updatedProject, { id }) => {
      // PATCH /project/web/{id} returns ProjectSimpleDto — nested arrays absent.
      // Merge preserves cached attachments/members/tasks; invalidate triggers a
      // canonical refetch on next observer.
      const merge = (old: Project | undefined): Project =>
        old
          ? mergePreservingNested(old, updatedProject, PROJECT_NESTED_KEYS)
          : updatedProject;
      queryClient.setQueryData<Project>(projectKeys.detail(id), merge);
      queryClient.setQueriesData<Project[]>(
        { predicate: isProjectListCache },
        (old) => old?.map((p) => (p.id === id ? merge(p) : p))
      );
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isProjectListCache });
    },
  });
}

export function useUpdateProjectWithFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      files,
    }: {
      id: number;
      data: UpdateProjectRequest;
      files: ProjectFiles;
    }) => projectService.updateWithFiles(id, data, files),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });
      await queryClient.cancelQueries({ predicate: isProjectListCache });

      const previousDetail = queryClient.getQueryData<Project>(
        projectKeys.detail(id)
      );
      const previousListEntries = queryClient.getQueriesData<Project[]>({
        predicate: isProjectListCache,
      });

      const base =
        previousDetail ??
        previousListEntries
          .flatMap(([, items]) => items ?? [])
          .find((p) => p.id === id);

      if (base) {
        const optimisticProject: Project = {
          ...base,
          ...(data.projectName !== undefined && {
            projectName: data.projectName,
          }),
          ...(data.projectAddress !== undefined && {
            projectAddress: data.projectAddress,
          }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.projectLongitude !== undefined && {
            projectLongitude: data.projectLongitude,
          }),
          ...(data.projectLatitude !== undefined && {
            projectLatitude: data.projectLatitude,
          }),
          ...(data.organizationId !== undefined && {
            organizationId: data.organizationId,
          }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.endDate !== undefined && { endDate: data.endDate }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
        };
        queryClient.setQueryData<Project>(
          projectKeys.detail(id),
          optimisticProject
        );
        queryClient.setQueriesData<Project[]>(
          { predicate: isProjectListCache },
          (old) => old?.map((p) => (p.id === id ? optimisticProject : p))
        );
      }

      return { previousDetail, previousListEntries };
    },
    onError: (error, { id }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(id),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Project[]>(key, value);
      }
      logger.error('Failed to update project with files:', error);
    },
    onSuccess: (updatedProject, { id }) => {
      // PATCH multipart /project/web/{id} returns ProjectSimpleDto — nested
      // arrays absent. Merge preserves cached attachments/members/tasks;
      // invalidate triggers a canonical refetch so newly uploaded attachments
      // appear on the detail page without a hard refresh.
      const merge = (old: Project | undefined): Project =>
        old
          ? mergePreservingNested(old, updatedProject, PROJECT_NESTED_KEYS)
          : updatedProject;
      queryClient.setQueryData<Project>(projectKeys.detail(id), merge);
      queryClient.setQueriesData<Project[]>(
        { predicate: isProjectListCache },
        (old) => old?.map((p) => (p.id === id ? merge(p) : p))
      );
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ predicate: isProjectListCache });
    },
  });
}

export function useAddEmployeeToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      employeeId,
    }: {
      projectId: number;
      employeeId: number;
    }) => projectService.addEmployee(projectId, employeeId),
    onMutate: async ({ projectId, employeeId }) => {
      await queryClient.cancelQueries({
        queryKey: projectKeys.detail(projectId),
      });
      await queryClient.cancelQueries({ predicate: isProjectListCache });
      await queryClient.cancelQueries({
        queryKey: projectKeys.members(projectId),
      });

      const previousDetail = queryClient.getQueryData<Project>(
        projectKeys.detail(projectId)
      );
      const previousListEntries = queryClient.getQueriesData<Project[]>({
        predicate: isProjectListCache,
      });
      const previousMembers = queryClient.getQueryData<Employee[]>(
        projectKeys.members(projectId)
      );

      // Look up the employee object from the employee module cache so the
      // optimistic member entry has the correct shape. If not cached,
      // onSuccess will reconcile with the full server response.
      const allEmployees = queryClient.getQueryData<Employee[]>(
        employeeKeys.all
      );
      const employeeToAdd = allEmployees?.find((e) => e.id === employeeId);

      if (employeeToAdd) {
        if (
          previousDetail &&
          !previousDetail.members.some((e) => e.id === employeeId)
        ) {
          const optimisticProject: Project = {
            ...previousDetail,
            members: [...previousDetail.members, employeeToAdd],
          };
          queryClient.setQueryData<Project>(
            projectKeys.detail(projectId),
            optimisticProject
          );
          queryClient.setQueriesData<Project[]>(
            { predicate: isProjectListCache },
            (old) =>
              old?.map((p) => (p.id === projectId ? optimisticProject : p))
          );
        }
        if (
          previousMembers &&
          !previousMembers.some((e) => e.id === employeeId)
        ) {
          queryClient.setQueryData<Employee[]>(projectKeys.members(projectId), [
            ...previousMembers,
            employeeToAdd,
          ]);
        }
      }

      return { previousDetail, previousListEntries, previousMembers };
    },
    onError: (error, { projectId }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(projectId),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Project[]>(key, value);
      }
      if (context?.previousMembers !== undefined) {
        queryClient.setQueryData<Employee[]>(
          projectKeys.members(projectId),
          context.previousMembers
        );
      }
      logger.error('Failed to add employee to project:', error);
    },
    onSuccess: (_data, { projectId }) => {
      // Backend returns a generic ack (ResponseDto), not the updated Project.
      // Optimistic update from onMutate already shows the new member; refetch
      // canonical state in the background to reconcile.
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      queryClient.invalidateQueries({ predicate: isProjectListCache });
      queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      });
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useRemoveEmployeeFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      employeeId,
    }: {
      projectId: number;
      employeeId: number;
    }) => projectService.removeEmployee(projectId, employeeId),
    onMutate: async ({ projectId, employeeId }) => {
      await queryClient.cancelQueries({
        queryKey: projectKeys.detail(projectId),
      });
      await queryClient.cancelQueries({ predicate: isProjectListCache });
      await queryClient.cancelQueries({
        queryKey: projectKeys.members(projectId),
      });

      const previousDetail = queryClient.getQueryData<Project>(
        projectKeys.detail(projectId)
      );
      const previousListEntries = queryClient.getQueriesData<Project[]>({
        predicate: isProjectListCache,
      });
      const previousMembers = queryClient.getQueryData<Employee[]>(
        projectKeys.members(projectId)
      );

      if (previousDetail) {
        const optimisticProject: Project = {
          ...previousDetail,
          members: previousDetail.members.filter((e) => e.id !== employeeId),
        };
        queryClient.setQueryData<Project>(
          projectKeys.detail(projectId),
          optimisticProject
        );
        queryClient.setQueriesData<Project[]>(
          { predicate: isProjectListCache },
          (old) => old?.map((p) => (p.id === projectId ? optimisticProject : p))
        );
      }
      if (previousMembers) {
        queryClient.setQueryData<Employee[]>(
          projectKeys.members(projectId),
          previousMembers.filter((e) => e.id !== employeeId)
        );
      }

      return { previousDetail, previousListEntries, previousMembers };
    },
    onError: (error, { projectId }, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData<Project>(
          projectKeys.detail(projectId),
          context.previousDetail
        );
      }
      for (const [key, value] of context?.previousListEntries ?? []) {
        queryClient.setQueryData<Project[]>(key, value);
      }
      if (context?.previousMembers !== undefined) {
        queryClient.setQueryData<Employee[]>(
          projectKeys.members(projectId),
          context.previousMembers
        );
      }
      logger.error('Failed to remove employee from project:', error);
    },
    onSuccess: (_data, { projectId, employeeId }) => {
      // API returns void; compute the removal locally from current cache state.
      queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
        old
          ? { ...old, members: old.members.filter((e) => e.id !== employeeId) }
          : old
      );
      queryClient.setQueriesData<Project[]>(
        { predicate: isProjectListCache },
        (old) =>
          old?.map((p) =>
            p.id === projectId
              ? { ...p, members: p.members.filter((e) => e.id !== employeeId) }
              : p
          )
      );
      // Sync the standalone members list.
      queryClient.setQueryData<Employee[]>(
        projectKeys.members(projectId),
        (old) => old?.filter((e) => e.id !== employeeId)
      );
      // Invalidate employee module caches — same reason as addEmployee above.
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectService.delete,
    onSuccess: (_data, id) => {
      // Remove the deleted project from every Project[] list cache.
      queryClient.setQueriesData<Project[]>(
        { predicate: isProjectListCache },
        (old) => old?.filter((p) => p.id !== id)
      );
      // Evict the detail entry — the project no longer exists on the server.
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
    },
    onError: (error) => {
      logger.error('Failed to delete project:', error);
    },
  });
}
