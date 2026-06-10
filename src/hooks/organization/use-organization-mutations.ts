/**
 * @module use-organization-mutations
 *
 * Mutation hooks for creating, updating, and deleting organizations.
 *
 * POST and PATCH both return `OrganizationSimpleDto` (partial), so updates
 * use {@link mergePreservingNested} with `ORGANIZATION_NESTED_KEYS` to
 * preserve cached nested arrays. Delete performs a 3-way cross-namespace
 * fan-out to keep user and employee caches consistent.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationService } from '../../services/organization-service';
import { Organization } from '../../types/organization';
import { CreateOrganizationRequest } from '../../types/organization/organization-create';
import { UpdateOrganizationRequest } from '../../types/organization/organization-update';
import { OrganizationFiles } from '../../types/organization/organization-files';
import { logger } from '../../lib/logger';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { organizationKeys } from './keys';
import { userKeys } from '../user/user-keys';
import { employeeKeys } from '../employee/keys';

const ORGANIZATION_NESTED_KEYS = [
  'employees',
  'projects',
  'attachments',
] as const satisfies ReadonlyArray<keyof Organization>;

/**
 * Creates a new organization.
 *
 * Backend response: `OrganizationSimpleDto` (partial — `employees`,
 * `projects`, and `attachments` may be absent).
 *
 * On success:
 * - `setQueryData(organizationKeys.detail(newOrg.id), newOrg)` — seeds the
 *   detail cache with the server-returned object.
 * - `setQueryData(organizationKeys.all, append)` — appends the new organization
 *   to the list cache.
 * - `invalidateQueries(organizationKeys.detail(newOrg.id))` — triggers a
 *   canonical refetch so server-computed fields (e.g. derived `logo`) are
 *   populated without a hard refresh.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ data: CreateOrganizationRequest; files?: OrganizationFiles }`.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      files,
    }: {
      data: CreateOrganizationRequest;
      files?: OrganizationFiles;
    }) => organizationService.create(data, files),
    onSuccess: (newOrg) => {
      // POST /organization/web → OrganizationSimpleDto (partial — nested
      // employees/projects/attachments may be absent).
      // Seed detail + append to list. Invalidate detail so the canonical
      // OrganizationDto refetches (filling derived `logo` and any other
      // server-computed fields).
      queryClient.setQueryData(organizationKeys.detail(newOrg.id), newOrg);
      queryClient.setQueryData<Organization[]>(organizationKeys.all, (old) =>
        old ? [...old, newOrg] : [newOrg]
      );
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(newOrg.id),
      });
    },
    onError: (error) => {
      logger.error('Failed to create organization:', error);
    },
  });
}

/**
 * Updates an existing organization, optionally replacing the logo.
 *
 * Backend response: `OrganizationSimpleDto` (partial — `employees`,
 * `projects`, and `attachments` may be absent).
 *
 * On success:
 * - `setQueryData(organizationKeys.detail(id), merge)` — uses
 *   {@link mergePreservingNested} with `ORGANIZATION_NESTED_KEYS`
 *   (`['employees', 'projects', 'attachments']`) to preserve cached nested arrays.
 * - `setQueryData(organizationKeys.all, merge map)` — mirrors the merge in
 *   the list cache.
 * - `invalidateQueries(organizationKeys.detail(id))` — canonical refetch so
 *   nested collections appear without a hard refresh.
 * - `invalidateQueries(organizationKeys.all)` — canonical refetch for the
 *   list; SimpleDto may omit nested data present in cached entries.
 * - `invalidateQueries(employeeKeys.lists())` — cross-namespace: Employee
 *   carries a denormalized `organizationName?` field that is stale after
 *   an organization name change.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: UpdateOrganizationRequest; files?: OrganizationFiles }`.
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      files,
    }: {
      id: number;
      data: UpdateOrganizationRequest;
      files?: OrganizationFiles;
    }) => organizationService.update(id, data, files),
    onSuccess: (updatedOrg, { id }) => {
      // PATCH /organization/web/{id} → OrganizationSimpleDto (partial).
      // Merge preserves cached employees/projects/attachments arrays;
      // invalidate triggers a canonical refetch on next observer.
      const merge = (old: Organization | undefined): Organization =>
        old
          ? mergePreservingNested(old, updatedOrg, ORGANIZATION_NESTED_KEYS)
          : updatedOrg;
      queryClient.setQueryData<Organization>(
        organizationKeys.detail(id),
        merge
      );
      queryClient.setQueryData<Organization[]>(organizationKeys.all, (old) =>
        old?.map((o) => (o.id === id ? merge(o) : o))
      );
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });

      // Cross-namespace: Employee has a denormalized `organizationName?`
      // field that may be stale after an organization name change. Invalidate
      // the employee list namespace so consumers refetch fresh denormalized data.
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
    onError: (error) => {
      logger.error('Failed to update organization:', error);
    },
  });
}

/**
 * Deletes an organization and evicts all related cache entries.
 *
 * Backend response: `ApiResponse` (ack — no entity payload).
 *
 * On success:
 * - `removeQueries(organizationKeys.detail(id))` — evicts the detail cache
 *   (entity deleted; refetch would 404).
 * - `setQueryData(organizationKeys.all, filter)` — removes the deleted entry
 *   from the list cache.
 * - `invalidateQueries(userKeys.all)` — cross-namespace: `user.defaultOrganizationId`
 *   may reference the deleted organization.
 * - `invalidateQueries(userKeys.employees())` — cross-namespace: the
 *   user-prefetched employee list may include records tied to this organization.
 * - `invalidateQueries(employeeKeys.lists())` — cross-namespace: denormalized
 *   `organizationName` / `organizationId` in employee records is now invalid.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   the organization `id` as a `number`.
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: organizationService.delete,
    onSuccess: (_data, id) => {
      // DELETE /organization/web/{id} → ApiResponse (ack).
      // Evict detail + filter from the list cache.
      queryClient.removeQueries({ queryKey: organizationKeys.detail(id) });
      queryClient.setQueryData<Organization[]>(organizationKeys.all, (old) =>
        old?.filter((o) => o.id !== id)
      );

      // Cross-namespace fan-out:
      //   - User: `user.defaultOrganizationId` may reference the deleted org.
      //   - User employees: the user-prefetched list may include employee
      //     records tied to this org.
      //   - Employees: denormalized organizationName / organizationId in
      //     employee records is now invalid.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.employees() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
    onError: (error) => {
      logger.error('Failed to delete organization:', error);
    },
  });
}
