/**
 * @module hooks/inspection/use-trades
 *
 * Query and mutation hooks for the inspection ontology: the organization's
 * trades and element types, their product catalogues, and checklist template
 * suggestions by applicability. Mutations invalidate the list they change.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checklistTemplateService } from '../../services/checklist-template-service';
import { elementTypeService, tradeService } from '../../services/trade-service';
import { shouldRetry } from '../../lib/query/retry';
import { standardQueryOptions } from '../../lib/query/options';
import type {
  CreateElementTypeRequest,
  CreateTradeRequest,
  UpdateElementTypeRequest,
  UpdateTradeRequest,
} from '../../types/inspection/trade';
import type { ProjectType } from '../../types/project/project-type';
import { checklistTemplateKeys, elementTypeKeys, tradeKeys } from './keys';

/** The organization's trades, for pickers and the management tab. */
export function useOrgTrades(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: tradeKeys.list(includeInactive),
    queryFn: () => tradeService.list(includeInactive),
    enabled,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** The product-shipped trade catalogue, for the restore-from-catalogue view. */
export function useTradeCatalogue(enabled = true) {
  return useQuery({
    queryKey: tradeKeys.catalogue(),
    queryFn: () => tradeService.catalogue(),
    enabled,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTradeRequest) => tradeService.create(req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTradeRequest }) =>
      tradeService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}

/** The organization's element types, for pickers and the management tab. */
export function useOrgElementTypes(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: elementTypeKeys.list(includeInactive),
    queryFn: () => elementTypeService.list(includeInactive),
    enabled,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

/** The product-shipped element type catalogue. */
export function useElementTypeCatalogue(enabled = true) {
  return useQuery({
    queryKey: elementTypeKeys.catalogue(),
    queryFn: () => elementTypeService.catalogue(),
    enabled,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}

export function useCreateElementType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateElementTypeRequest) =>
      elementTypeService.create(req),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: elementTypeKeys.all }),
  });
}

export function useUpdateElementType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateElementTypeRequest;
    }) => elementTypeService.update(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: elementTypeKeys.all }),
  });
}

/**
 * Checklist templates the backend suggests for an element type and / or
 * project type. Disabled until at least one of the two is given, since the
 * unfiltered answer is the plain template list.
 */
export function useApplicableChecklistTemplates(params: {
  elementType?: string;
  projectType?: ProjectType;
}) {
  return useQuery({
    queryKey: checklistTemplateKeys.applicable(params),
    queryFn: () => checklistTemplateService.getApplicable(params),
    enabled: params.elementType !== undefined || params.projectType !== undefined,
    ...standardQueryOptions,
    retry: shouldRetry,
  });
}
