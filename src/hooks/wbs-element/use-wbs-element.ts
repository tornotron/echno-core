/**
 * @module use-wbs-element
 *
 * TanStack Query hooks for reading project-scoped WBS elements.
 * Mutations live in {@link useCreateWbsElement},
 * {@link useBulkCreateWbsElements}, {@link useUpdateWbsElement},
 * {@link useMoveWbsElement}, and {@link useDeleteWbsElement}.
 *
 * None of the query hooks below spread a profile from
 * `lib/query/options`; they inherit the host `QueryClient`'s defaults
 * (mirroring the **standard** profile of `staleTime` 60 s / `gcTime`
 * 5 min when the host uses the recommended setup).
 */
import { useQuery } from '@tanstack/react-query';
import { wbsElementService } from '../../services/wbs-element-service';
import { wbsElementKeys } from './keys';

/**
 * Fetches the flat list of every WBS element in a project. The
 * query is disabled until `projectId` is truthy.
 *
 * @param projectId - Surrogate ID of the project. Pass `0` (or any
 *   falsy value) to defer the query until the ID is available.
 * @returns A TanStack `UseQueryResult` wrapping `WbsElement[]`;
 *   `children` is `undefined` on each entry (flat shape).
 */
export const useWbsElements = (projectId: number) =>
  useQuery({
    queryKey: wbsElementKeys.byProject(projectId),
    queryFn: () => wbsElementService.getAll(projectId),
    enabled: !!projectId,
  });

/**
 * Fetches the project's WBS as a hierarchy. The query is disabled
 * until `projectId` is truthy.
 *
 * @param projectId - Surrogate ID of the project.
 * @returns A TanStack `UseQueryResult` wrapping the root
 *   `WbsElement[]`, each with `children` populated.
 */
export const useWbsTree = (projectId: number) =>
  useQuery({
    queryKey: wbsElementKeys.tree(projectId),
    queryFn: () => wbsElementService.getTree(projectId),
    enabled: !!projectId,
  });

/**
 * Fetches only the leaf elements of the project's WBS. The query is
 * disabled until `projectId` is truthy.
 *
 * @param projectId - Surrogate ID of the project.
 * @returns A TanStack `UseQueryResult` wrapping the leaf
 *   `WbsElement[]`, as a flat list.
 */
export const useWbsLeaves = (projectId: number) =>
  useQuery({
    queryKey: wbsElementKeys.leaves(projectId),
    queryFn: () => wbsElementService.getLeaves(projectId),
    enabled: !!projectId,
  });

/**
 * Fetches a single WBS element by ID, scoped to its project. The
 * query is disabled until both `projectId` and `elementId` are
 * truthy.
 *
 * @param projectId - Surrogate ID of the project.
 * @param elementId - Surrogate ID of the element.
 * @returns A TanStack `UseQueryResult` wrapping a single
 *   `WbsElement`.
 */
export const useWbsElement = (projectId: number, elementId: number) =>
  useQuery({
    queryKey: wbsElementKeys.detail(projectId, elementId),
    queryFn: () => wbsElementService.getById(projectId, elementId),
    enabled: !!projectId && !!elementId,
  });
