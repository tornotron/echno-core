import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationService } from '../../services/organization-service';
import { Organization } from '../../types/organization';
import { CreateOrganizationRequest } from '../../types/organization/organization-create';
import { UpdateOrganizationRequest } from '../../types/organization/organization-update';
import { OrganizationFiles } from '../../types/organization/organization-files';
import { logger } from '../../lib/logger';
import { mergePreservingNested } from '../../lib/query/cache-merge';
import { organizationKeys } from './organization-keys';
import { userKeys } from '../user/user-keys';
import { employeeKeys } from '../employee/employee-keys';

const ORGANIZATION_NESTED_KEYS = [
  'employees',
  'projects',
  'attachments',
] as const satisfies ReadonlyArray<keyof Organization>;

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
