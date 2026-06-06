/**
 * @module use-project-mutations
 *
 * Write-side TanStack Query hooks for the project domain. Each mutation
 * patches the project module's own caches (`projectKeys.lists()`,
 * `projectKeys.detail(id)`, `projectKeys.members(projectId)`) directly
 * from the server response or from a local computation, and invalidates
 * only what cannot be patched locally (cross-namespace caches such as
 * the employee module).
 *
 * Update mutations use {@link mergePreservingNested} with
 * {@link PROJECT_NESTED_KEYS} so that `attachments`, `members`, and
 * `tasks` cached from a prior full-DTO fetch survive a partial
 * `ProjectSimpleDto` response.
 */
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

/**
 * Nested keys on {@link Project} that update mutations preserve when
 * merging a partial `ProjectSimpleDto` response into the cached detail.
 * Passed to {@link mergePreservingNested}.
 */
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

/**
 * Creates a new project.
 *
 * Backend response: `ProjectSimpleDto` (partial — `attachments`,
 * `members`, and `tasks` absent).
 *
 * On success:
 * - `setQueryData(projectKeys.lists(), append)` — appends the returned
 *   project to the main list cache. Safe because list rows do not render
 *   nested arrays.
 * - `setQueryData(projectKeys.detail(newProject.id), newProject)` — seeds
 *   the detail cache so navigating to the new project page is instant.
 *   The seed is intentionally minimal; the detail page's next refetch
 *   resolves the full `ProjectDto`.
 * - Zero invalidations. `byOrganization` / `byEmployee` lists self-heal
 *   on next mount when stale (5 min).
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateProjectRequest}.
 */
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

/**
 * Creates a new project together with attachment uploads in a single
 * multipart request.
 *
 * Backend response: `ProjectSimpleDto` (partial — `attachments`,
 * `members`, and `tasks` absent).
 *
 * On success:
 * - `setQueryData(projectKeys.lists(), append)` — appends the returned
 *   project to the main list cache.
 * - `setQueryData(projectKeys.detail(newProject.id), newProject)` — seeds
 *   the detail cache so navigating to the new project page is instant.
 * - Zero invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ data: CreateProjectRequest; files: ProjectFiles }`.
 */
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

/**
 * Updates an existing project.
 *
 * Backend response: `ProjectSimpleDto` (partial — `attachments`,
 * `members`, and `tasks` absent).
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries on `projectKeys.detail(id)` and
 *   every cache matched by {@link isProjectListCache}, snapshots
 *   `previousDetail` and `previousListEntries`, then applies the scalar
 *   fields from `data` over the cached base. If the detail cache is
 *   absent, the base is recovered by scanning the snapshotted list
 *   entries for an entry with the same `id`.
 * - `memberIds` is intentionally excluded from the optimistic patch —
 *   resolving the ID array to `Employee[]` would require a separate
 *   cache lookup; the reconciliation step handles it.
 *
 * Rollback:
 * - `onError` restores `previousDetail` to `projectKeys.detail(id)` and
 *   iterates `previousListEntries` to restore each list key individually.
 *
 * On success:
 * - `setQueryData(projectKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with {@link PROJECT_NESTED_KEYS} to
 *   preserve cached `attachments`, `members`, and `tasks` across the
 *   partial response.
 * - `setQueriesData({ predicate: isProjectListCache }, replace-with-merge)`
 *   — mirrors the merge across every `Project[]` list cache (main,
 *   `byOrganization`, `byEmployee`).
 * - `invalidateQueries(projectKeys.detail(id))` — kept: SimpleDto omits
 *   nested fields; canonical refetch ensures the full `ProjectDto` is
 *   available on next observer.
 * - `invalidateQueries({ predicate: isProjectListCache })` — kept: list
 *   entries are also partial after merge.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateProjectRequest }`.
 */
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

/**
 * Updates an existing project together with attachment uploads in a
 * single multipart request.
 *
 * Backend response: `ProjectSimpleDto` (partial — `attachments`,
 * `members`, and `tasks` absent).
 *
 * Optimistic update:
 * - Identical to {@link useUpdateProject} — cancels detail and list
 *   caches, snapshots `previousDetail` + `previousListEntries`, then
 *   patches scalar fields from `data` over the cached base. `files` is
 *   not reflected optimistically (file IDs and URLs are only known after
 *   the server processes the upload).
 *
 * Rollback:
 * - `onError` restores `previousDetail` to `projectKeys.detail(id)` and
 *   iterates `previousListEntries` to restore each list key individually.
 *
 * On success:
 * - `setQueryData(projectKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with {@link PROJECT_NESTED_KEYS}.
 * - `setQueriesData({ predicate: isProjectListCache }, replace-with-merge)`.
 * - `invalidateQueries(projectKeys.detail(id))` — kept: canonical refetch
 *   so newly uploaded attachments appear on the detail page without a
 *   hard refresh.
 * - `invalidateQueries({ predicate: isProjectListCache })` — kept for
 *   the same reason.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateProjectRequest; files: ProjectFiles }`.
 */
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

/**
 * Adds an employee to a project's member list.
 *
 * Backend response: `ApiResponse` (ack). The service discards the
 * sibling-domain `EmployeeDto` payload returned by the backend and
 * resolves with `void`; reconciliation happens via the invalidations
 * listed below.
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries on `projectKeys.detail(projectId)`,
 *   every cache matched by {@link isProjectListCache}, and
 *   `projectKeys.members(projectId)`. Snapshots `previousDetail`,
 *   `previousListEntries`, and `previousMembers`.
 * - Looks up the target `Employee` object from the `employeeKeys.all`
 *   cache. If the employee is not cached, the optimistic update is
 *   skipped — the post-success invalidations still reconcile state.
 * - Guards against double-add: only patches caches if the employee is
 *   not already present in `previousDetail.members` / `previousMembers`.
 *
 * Rollback:
 * - `onError` restores `previousDetail`, every entry in
 *   `previousListEntries`, and `previousMembers`.
 *
 * On success:
 * - `invalidateQueries(projectKeys.detail(projectId))` — kept: service
 *   returned `void`, so the canonical project must be refetched to
 *   confirm member resolution.
 * - `invalidateQueries({ predicate: isProjectListCache })` — kept: same
 *   reason; list entries' `members` arrays must reconcile with the server.
 * - `invalidateQueries(projectKeys.members(projectId))` — kept: refetches
 *   the standalone member list.
 * - `invalidateQueries(employeeKeys.all)` — kept (cross-namespace):
 *   employee module caches may surface project-membership data that the
 *   project module cannot patch without owning the employee cache shape.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ projectId: number; employeeId: number }`.
 */
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

/**
 * Removes an employee from a project's member list.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * Optimistic update:
 * - `onMutate` cancels in-flight queries on `projectKeys.detail(projectId)`,
 *   every cache matched by {@link isProjectListCache}, and
 *   `projectKeys.members(projectId)`. Snapshots `previousDetail`,
 *   `previousListEntries`, and `previousMembers`.
 * - Applies the removal via `Array.filter` on all three caches.
 *
 * Rollback:
 * - `onError` restores `previousDetail`, every entry in
 *   `previousListEntries`, and `previousMembers`.
 *
 * On success:
 * - `setQueryData(projectKeys.detail(projectId), filter)` — re-applies
 *   the removal idempotently from current cache state.
 * - `setQueriesData({ predicate: isProjectListCache }, map+filter)` —
 *   mirrors the removal across every `Project[]` list cache.
 * - `setQueryData(projectKeys.members(projectId), filter)` — syncs the
 *   standalone members list.
 * - `invalidateQueries(employeeKeys.all)` — kept (cross-namespace): same
 *   reason as `useAddEmployeeToProject`. Employee detail caches may
 *   surface project-membership data the project module cannot patch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ projectId: number; employeeId: number }`.
 */
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

/**
 * Deletes a project.
 *
 * Backend response: `ApiResponse` (ack).
 *
 * On success:
 * - `setQueriesData({ predicate: isProjectListCache }, filter)` — removes
 *   the deleted project from every `Project[]` list cache (main,
 *   `byOrganization`, `byEmployee`) in one pass.
 * - `removeQueries(projectKeys.detail(id))` — evicts the detail entry;
 *   `removeQueries` (not `invalidateQueries`) because the project no
 *   longer exists on the server.
 * - Zero invalidations.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the project's `id` directly (not wrapped in an object).
 */
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
