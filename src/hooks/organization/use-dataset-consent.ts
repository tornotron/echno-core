/**
 * @module use-dataset-consent
 *
 * Query and mutation hooks for the organization's dataset-consent flag
 * (system-admin only on the backend; other callers receive a 403).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationService } from '../../services/organization-service';
import { DatasetConsentUpdateRequest } from '../../types/organization/organization-dataset-consent';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import { organizationKeys } from './keys';

/**
 * Reads the organization's dataset-consent flag.
 *
 * Uses the **standard** query profile. Disabled until `id` is truthy and
 * while `enabled` is false, so a screen can skip the request for callers
 * the backend would refuse.
 *
 * @param id - Surrogate ID of the organization.
 * @param enabled - Extra gate, defaults to true.
 * @returns A TanStack `UseQueryResult` wrapping {@link DatasetConsent}.
 */
export function useDatasetConsent(id: number, enabled = true) {
  return useQuery({
    queryKey: organizationKeys.datasetConsent(id),
    queryFn: () => organizationService.getDatasetConsent(id),
    enabled: !!id && enabled,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/**
 * Records or withdraws the organization's dataset consent.
 *
 * On success the returned flag is written straight into the query cache, so
 * the toggle reflects the stored value without a refetch.
 *
 * @returns A TanStack `UseMutationResult` where the mutate function accepts
 *   `{ id: number; data: DatasetConsentUpdateRequest }`.
 */
export function useSetDatasetConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DatasetConsentUpdateRequest }) =>
      organizationService.setDatasetConsent(id, data),
    onSuccess: (stored) => {
      queryClient.setQueryData(
        organizationKeys.datasetConsent(stored.organizationId),
        stored
      );
    },
  });
}
