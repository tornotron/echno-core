/**
 * hooks/attachment/use-attachment-mutations.ts
 *
 * React Query mutation hooks for attachments.
 *
 * Cache discipline (per Milestone 8 — attachment):
 *   - `useUploadAttachment` — POST returns `AttachmentDto` (Rule A, full).
 *     Backend doc currently labels it `ResponseDto`; the service parses it as
 *     a single `Attachment` so the actual shape is a single full DTO. No
 *     current external callers; cache writes seeded for future use.
 *   - `useDeleteAttachment` — DELETE returns `ApiResponse` (Rule C, void).
 *     Service returns `Promise<void>`. Discipline: predicate-scan every parent
 *     namespace that may embed `attachments: Attachment[]` (project, task,
 *     issue, user, organization, employee), and strip the deleted row from
 *     every cached parent shape (detail object, array of entities, paged
 *     container). Fall back to attachment-namespace invalidation only if
 *     nothing in any parent cache matched.
 *
 * Toast notifications are intentionally absent — callers supply onSuccess /
 * onError feedback appropriate to their UI context.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentService } from '@echno-core/services/attachment-service';
import { Attachment, UploadAttachmentRequest } from '@echno-core/types/attachment';
import {
  attachmentKeys,
  ATTACHMENT_PARENT_NAMESPACES,
} from './attachment-keys';

/**
 * Recursively strip the attachment with `id` from any value the cache might
 * hold. Handles three shapes:
 *   1. An entity object with an `attachments: Attachment[]` field.
 *   2. An array of such entities (list cache).
 *   3. A paged container `{ content: Entity[], … }` (Spring Page).
 *
 * Returns the same reference when nothing changed so React Query can keep its
 * structural-equality cache identity and avoid re-rendering unaffected
 * observers.
 */
function stripAttachmentById<T>(data: T, id: number): T {
  if (!data || typeof data !== 'object') return data;

  // Shape 1: entity with attachments array
  if (
    'attachments' in data &&
    Array.isArray((data as { attachments?: unknown }).attachments)
  ) {
    const arr = (data as { attachments: Attachment[] }).attachments;
    const filtered = arr.filter((a) => a.id !== id);
    if (filtered.length === arr.length) return data;
    return { ...(data as object), attachments: filtered } as T;
  }

  // Shape 2: array of entities
  if (Array.isArray(data)) {
    let mutated = false;
    const next = (data as unknown[]).map((item) => {
      const stripped = stripAttachmentById(item, id);
      if (stripped !== item) mutated = true;
      return stripped;
    });
    return (mutated ? next : data) as T;
  }

  // Shape 3: paged container { content: Entity[], … }
  if (
    'content' in data &&
    Array.isArray((data as { content?: unknown }).content)
  ) {
    const content = (data as { content: unknown[] }).content;
    const next = stripAttachmentById(content, id);
    if (next === content) return data;
    return { ...(data as object), content: next } as T;
  }

  return data;
}

/**
 * Predicate matching any cached query under a namespace whose entities may
 * embed `attachments`. Used for the delete-time strip pass and for the
 * fallback-detection bookkeeping below.
 */
function isAttachmentParentCache(query: {
  queryKey: ReadonlyArray<unknown>;
}): boolean {
  const key = query.queryKey;
  return (
    Array.isArray(key) &&
    typeof key[0] === 'string' &&
    ATTACHMENT_PARENT_NAMESPACES.has(key[0])
  );
}

/**
 * Hook to upload an attachment for an entity.
 *
 * @example
 * ```tsx
 * const uploadMutation = useUploadAttachment();
 *
 * const handleUpload = async (file: File) => {
 *   const attachment = await uploadMutation.mutateAsync({
 *     entityId: userId,
 *     entityType: 'USER_PROFILE_PICTURE',
 *     files: file,
 *   });
 * };
 * ```
 *
 * Note: no current external callers in this codebase. Uploads on
 * project/task/issue/user/organization edit forms happen through the
 * `useUpdate<X>WithFiles` mutations which bundle files into the entity PATCH.
 * Kept for future single-file upload flows (e.g. direct attachment manager).
 */
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UploadAttachmentRequest) =>
      attachmentService.upload(request),
    onSuccess: (attachment: Attachment, variables) => {
      // POST /attachment/web/entityId/{entityId}/entityType/{entityType}
      // → AttachmentDto (Rule A, full). Backend doc labels this `ResponseDto`
      // but the service parses a single Attachment — drift, not Rule B.
      //
      // Seed the single-attachment cache (`useAttachmentByEntity` consumers
      // like profile picture pages).
      queryClient.setQueryData<Attachment>(
        attachmentKeys.byEntity(variables.entityId, variables.entityType),
        attachment
      );
      // Append to the list-attachment cache (`useAttachmentsByEntity`
      // consumers like task/issue file lists). Functional updater returns
      // undefined when no cache exists so we don't seed an array with a
      // single entry as the source of truth.
      queryClient.setQueryData<Attachment[]>(
        attachmentKeys.listByEntity(variables.entityId, variables.entityType),
        (old) => (old ? [...old, attachment] : undefined)
      );
    },
  });
}

/**
 * Hook to delete an attachment.
 *
 * Removes the row from every parent cache that embeds an `attachments` array
 * (project, task, issue, user, organization, employee) by predicate-scanning
 * all six namespaces and patching the matching entries in place. If no parent
 * cache matched (e.g. the consumer is a standalone attachment manager that
 * never loaded the parent), falls back to attachment-namespace invalidation
 * so `useAttachmentByEntity` / `useAttachmentsByEntity` observers refetch.
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteAttachment();
 * await deleteMutation.mutateAsync(attachmentId);
 * ```
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => attachmentService.delete(id),
    onSuccess: (_void, id) => {
      // DELETE /attachment/web/attachmentId/{id} → ApiResponse (Rule C, void).
      //
      // Strip the attachment from every cached parent shape across all six
      // namespaces. `setQueriesData` calls the updater for each matched
      // query; the updater returns the same reference when nothing changed,
      // so unaffected caches retain identity and don't trigger re-renders.
      let matchedAnyParent = false;
      queryClient.setQueriesData(
        { predicate: isAttachmentParentCache },
        (old: unknown) => {
          const next = stripAttachmentById(old, id);
          if (next !== old) matchedAnyParent = true;
          return next;
        }
      );

      // Fallback: if no parent cache held this attachment (e.g. the caller
      // is a standalone attachment list with no parent loaded), invalidate
      // the attachment namespace so the entity-scoped queries refetch.
      if (!matchedAnyParent) {
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.all,
          refetchType: 'active',
        });
      }
    },
  });
}
