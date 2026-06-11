/**
 * @module use-wbs-element-mutations
 *
 * TanStack mutation hooks for project-scoped WBS-element writes —
 * single create, bulk create, update, move, and delete. Read-side
 * hooks live in {@link useWbsElements}, {@link useWbsTree},
 * {@link useWbsLeaves}, and {@link useWbsElement}.
 *
 * Cache discipline:
 *
 * - Backend returns the full `WbsElementDto` (or `WbsElementDto[]`
 *   for bulk-create) on every write except `delete`, which is an
 *   ack. The mutations therefore patch the flat list
 *   (`wbsElementKeys.byProject(projectId)`) and the per-element
 *   detail caches (`wbsElementKeys.detail(projectId, id)`) directly
 *   from the response.
 *
 * - The tree (`wbsElementKeys.tree`) and leaves
 *   (`wbsElementKeys.leaves`) views are derived: they embed copies of
 *   element fields and/or carry hierarchy invariants that aren't
 *   safe to patch in place. Every mutation invalidates both via
 *   {@link invalidateDerivedViews}.
 *
 * Key-shape note: `wbsElementKeys.byProject(pid)` =
 * `['wbs-elements', 'project', pid]` is a **prefix** of `tree`,
 * `leaves`, and `detail(pid, eid)`. `setQueryData` is exact-match
 * (writes only to the precise key) so direct patches on `byProject`
 * are safe. Invalidations against `byProject` are always called with
 * `exact: true` to avoid prefix-blasting the tree, leaves, and
 * detail caches; tree and leaves get explicit invalidations through
 * their own dedicated keys instead.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wbsElementService } from '../../services/wbs-element-service';
import { wbsElementKeys } from './keys';
import type {
  WbsElement,
  CreateWbsElementRequest,
  BulkCreateWbsElementsRequest,
  UpdateWbsElementRequest,
  MoveWbsElementRequest,
} from '../../types/wbs-element';
import { logger } from '../../lib/logger';

/**
 * Invalidates the two project-scoped derived views (`tree` +
 * `leaves`) without touching the flat list or detail caches. Used
 * by every structural mutation (create, bulk-create, move, delete)
 * and by update — tree and leaves entries embed copies of an
 * element's fields, so they need a refetch whenever those fields
 * change. Both invalidations are exact-match against their own
 * dedicated keys.
 *
 * @param queryClient - The TanStack `QueryClient` from the hook
 *   scope.
 * @param projectId - Surrogate ID of the project whose derived views
 *   should be refreshed.
 */
function invalidateDerivedViews(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: number
) {
  queryClient.invalidateQueries({
    queryKey: wbsElementKeys.tree(projectId),
    exact: true,
  });
  queryClient.invalidateQueries({
    queryKey: wbsElementKeys.leaves(projectId),
    exact: true,
  });
}

/**
 * Creates a single WBS element under the bound project.
 *
 * Backend response: `WbsElementDto` (full).
 *
 * On success:
 * - `setQueryData(wbsElementKeys.detail(projectId, created.id), created)` —
 *   seeds the per-element detail cache so an immediate navigation
 *   renders without a refetch.
 * - `setQueryData(wbsElementKeys.byProject(projectId), append)` —
 *   appends the new element to the flat list (only when the list is
 *   already cached; never seeds a new cache entry).
 * - `invalidateQueries(wbsElementKeys.tree(projectId), exact)` and
 *   `invalidateQueries(wbsElementKeys.leaves(projectId), exact)` via
 *   {@link invalidateDerivedViews} — kept: tree carries the
 *   hierarchy that the new node alters; leaves changes whenever a
 *   new childless node is inserted (or a previously-leaf parent
 *   becomes internal — see {@link useBulkCreateWbsElements}).
 *
 * @param projectId - Surrogate ID of the parent project. Bound at
 *   hook construction so `onSuccess` can address the correct caches.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link CreateWbsElementRequest}.
 */
export const useCreateWbsElement = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWbsElementRequest) =>
      wbsElementService.create(projectId, dto),
    onSuccess: (created) => {
      // POST /project/{projectId}/wbs/web → WbsElementDto (full).
      queryClient.setQueryData<WbsElement>(
        wbsElementKeys.detail(projectId, created.id),
        created
      );
      queryClient.setQueryData<WbsElement[]>(
        wbsElementKeys.byProject(projectId),
        (old) => (old ? [...old, created] : undefined)
      );
      invalidateDerivedViews(queryClient, projectId);
    },
    onError: (error) =>
      logger.error('Failed to create WBS element:', error),
  });
};

/**
 * Creates multiple WBS elements under the bound project in one
 * round-trip.
 *
 * Backend response: `WbsElementDto[]` (full — array of newly created
 * elements, in submission order).
 *
 * On success:
 * - For each created element:
 *   `setQueryData(wbsElementKeys.detail(projectId, created.id), created)` —
 *   seeds the per-element detail cache.
 * - `setQueryData(wbsElementKeys.byProject(projectId), append-all)` —
 *   appends every new element to the flat list (only when the list
 *   is already cached).
 * - `invalidateQueries(wbsElementKeys.tree(projectId), exact)` and
 *   `invalidateQueries(wbsElementKeys.leaves(projectId), exact)` via
 *   {@link invalidateDerivedViews} — kept: tree and leaves both
 *   change for the same reasons as single-create, magnified across
 *   the batch.
 *
 * @param projectId - Surrogate ID of the parent project.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts a {@link BulkCreateWbsElementsRequest}.
 */
export const useBulkCreateWbsElements = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: BulkCreateWbsElementsRequest) =>
      wbsElementService.bulkCreate(projectId, dto),
    onSuccess: (createdList) => {
      // POST /project/{projectId}/wbs/web/bulk → WbsElementDto[] (full).
      for (const created of createdList) {
        queryClient.setQueryData<WbsElement>(
          wbsElementKeys.detail(projectId, created.id),
          created
        );
      }
      queryClient.setQueryData<WbsElement[]>(
        wbsElementKeys.byProject(projectId),
        (old) => (old ? [...old, ...createdList] : undefined)
      );
      invalidateDerivedViews(queryClient, projectId);
    },
    onError: (error) =>
      logger.error('Failed to bulk create WBS elements:', error),
  });
};

/**
 * Updates a WBS element's mutable fields under the bound project.
 *
 * Backend response: `WbsElementDto` (full).
 *
 * Note: {@link UpdateWbsElementRequest} cannot reparent the element
 * (no `parentElementId` field) — reparenting goes through
 * {@link useMoveWbsElement}. This is therefore a non-structural
 * mutation; the flat list still contains the same set of elements,
 * so a map-replace is sufficient.
 *
 * On success:
 * - `setQueryData(wbsElementKeys.detail(projectId, updated.id), updated)` —
 *   direct patch of the detail cache.
 * - `setQueryData(wbsElementKeys.byProject(projectId), map-replace)` —
 *   replaces the matching entry in the flat list.
 * - `invalidateQueries(wbsElementKeys.tree(projectId), exact)` and
 *   `invalidateQueries(wbsElementKeys.leaves(projectId), exact)` via
 *   {@link invalidateDerivedViews} — kept: tree and leaves embed
 *   copies of the changed fields and need a refetch to surface them.
 *
 * @param projectId - Surrogate ID of the parent project.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: UpdateWbsElementRequest }`.
 */
export const useUpdateWbsElement = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWbsElementRequest }) =>
      wbsElementService.update(projectId, id, data),
    onSuccess: (updated) => {
      // PUT /project/{projectId}/wbs/web/{elementId} → WbsElementDto (full).
      // Non-structural — UpdateWbsElementRequest has no parentElementId field;
      // reparenting goes through useMoveWbsElement. Flat list still holds the
      // same set of elements, so map-replace is sufficient; tree and leaves
      // embed field copies and get invalidated.
      queryClient.setQueryData<WbsElement>(
        wbsElementKeys.detail(projectId, updated.id),
        updated
      );
      queryClient.setQueryData<WbsElement[]>(
        wbsElementKeys.byProject(projectId),
        (old) => old?.map((el) => (el.id === updated.id ? updated : el))
      );
      invalidateDerivedViews(queryClient, projectId);
    },
    onError: (error) =>
      logger.error('Failed to update WBS element:', error),
  });
};

/**
 * Reparents and/or repositions a WBS element under the bound
 * project.
 *
 * Backend response: `WbsElementDto` (full — moved element with
 * updated `parentElementId`).
 *
 * This is a structural mutation, but only the moved node's
 * `parentElementId` / position fields change — the flat list still
 * contains the same set of elements, so a map-replace in place is
 * still sufficient. The tree and leaves views, however, must
 * refetch to reflect the new parent-child relationship.
 *
 * On success:
 * - `setQueryData(wbsElementKeys.detail(projectId, moved.id), moved)` —
 *   direct patch of the detail cache.
 * - `setQueryData(wbsElementKeys.byProject(projectId), map-replace)` —
 *   replaces the moved entry in the flat list.
 * - `invalidateQueries(wbsElementKeys.tree(projectId), exact)` and
 *   `invalidateQueries(wbsElementKeys.leaves(projectId), exact)` via
 *   {@link invalidateDerivedViews} — kept: hierarchy and leaf
 *   classification both depend on the parent edge that just changed.
 *
 * @param projectId - Surrogate ID of the parent project.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts `{ id: number; data: MoveWbsElementRequest }`.
 */
export const useMoveWbsElement = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MoveWbsElementRequest }) =>
      wbsElementService.move(projectId, id, data),
    onSuccess: (moved) => {
      // POST /project/{projectId}/wbs/web/{elementId}/move → WbsElementDto (full).
      // Structural mutation — only the moved node's parentElementId / position
      // fields change; the flat list still contains the same set of elements,
      // so map-replace the moved element in place. Tree + leaves are
      // hierarchical/filtered views that need a refetch to reflect the new
      // parent-child relationship.
      queryClient.setQueryData<WbsElement>(
        wbsElementKeys.detail(projectId, moved.id),
        moved
      );
      queryClient.setQueryData<WbsElement[]>(
        wbsElementKeys.byProject(projectId),
        (old) => old?.map((el) => (el.id === moved.id ? moved : el))
      );
      invalidateDerivedViews(queryClient, projectId);
    },
    onError: (error) =>
      logger.error('Failed to move WBS element:', error),
  });
};

/**
 * Deletes a WBS element from the bound project.
 *
 * Backend response: `ApiResponse` (ack only — no entity payload).
 *
 * Cascade behaviour for internal nodes (whether deleting a parent
 * also removes its descendants server-side) is not documented, so
 * this mutation conservatively invalidates the flat list rather
 * than filtering by the deleted ID alone — a single-ID filter would
 * leave orphaned descendants pointing to a deleted parent in the
 * cache.
 *
 * On success:
 * - `removeQueries(wbsElementKeys.detail(projectId, elementId))` —
 *   evicts the per-element detail cache; the entity is gone, no
 *   refetch is possible.
 * - `invalidateQueries(wbsElementKeys.byProject(projectId), exact)` —
 *   kept: forces the flat list to refetch so any cascade-deleted
 *   descendants disappear too. `exact: true` is mandatory here so
 *   the prefix doesn't blast the (already-removed) detail cache or
 *   the derived views — those are handled separately just below.
 * - `invalidateQueries(wbsElementKeys.tree(projectId), exact)` and
 *   `invalidateQueries(wbsElementKeys.leaves(projectId), exact)` via
 *   {@link invalidateDerivedViews} — kept: the hierarchy and the
 *   leaves classification both shift on a deletion.
 *
 * @param projectId - Surrogate ID of the parent project.
 * @returns A TanStack `UseMutationResult` where the mutate function
 *   accepts the element ID.
 */
export const useDeleteWbsElement = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (elementId: number) =>
      wbsElementService.delete(projectId, elementId),
    onSuccess: (_void, elementId) => {
      // DELETE /project/{projectId}/wbs/web/{elementId} → ApiResponse (ack).
      // Cascade behaviour (whether deleting an internal node also removes its
      // descendants server-side) is not documented in the service or backend
      // docs, so conservatively invalidate the flat list rather than
      // filtering by ID alone — a single-ID filter would leave orphaned
      // descendants pointing to a deleted parent in the cache.
      queryClient.removeQueries({
        queryKey: wbsElementKeys.detail(projectId, elementId),
      });
      queryClient.invalidateQueries({
        queryKey: wbsElementKeys.byProject(projectId),
        // exact=true so this doesn't prefix-blast tree/leaves/detail caches;
        // those are invalidated separately just below.
        exact: true,
      });
      invalidateDerivedViews(queryClient, projectId);
    },
    onError: (error) =>
      logger.error('Failed to delete WBS element:', error),
  });
};
