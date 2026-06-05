import { useQuery } from '@tanstack/react-query';
import { attachmentService } from '@echno-core/services/attachment-service';
import { Attachment } from '@echno-core/types/attachment';
import { shouldRetry } from '@echno-core/lib/query/retry';
import { attachmentKeys } from './attachment-keys';

/**
 * Hook to fetch attachment by entity ID and type.
 * Useful for fetching profile pictures, CVs, organization logos, etc.
 *
 * @param entityId - ID of the entity (user, organization, etc.)
 * @param entityType - Type of attachment (e.g., 'USER_PROFILE_PICTURE', 'CV', 'LOGO')
 *
 * @example
 * ```tsx
 * const { data: profilePicture, isLoading } = useAttachmentByEntity(
 *   userId,
 *   'USER_PROFILE_PICTURE'
 * );
 * ```
 */
export function useAttachmentByEntity(entityId?: number, entityType?: string) {
  return useQuery({
    queryKey: attachmentKeys.byEntity(entityId ?? 0, entityType ?? ''),
    queryFn: () => {
      if (!entityId || !entityType) {
        throw new Error('Entity ID and attachment type are required');
      }
      return attachmentService.getByEntity(entityId, entityType);
    },
    enabled: !!entityId && !!entityType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Hook to fetch all attachments by entity ID and type.
 * Useful for fetching multiple attachments for tasks, issues, projects, etc.
 *
 * @param entityId - ID of the entity (task, issue, etc.)
 * @param entityType - Type of attachment (e.g., 'TASK_ATTACHMENT', 'ISSUE_ATTACHMENT')
 *
 * @example
 * ```tsx
 * const { data: attachments, isLoading } = useAttachmentsByEntity(
 *   taskId,
 *   'TASK_ATTACHMENT'
 * );
 * ```
 */
export function useAttachmentsByEntity(entityId?: number, entityType?: string) {
  return useQuery({
    queryKey: attachmentKeys.listByEntity(entityId ?? 0, entityType ?? ''),
    queryFn: () => {
      if (!entityId || !entityType) {
        throw new Error('Entity ID and attachment type are required');
      }
      return attachmentService.getAllByEntity(entityId, entityType);
    },
    enabled: !!entityId && !!entityType,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  });
}

/**
 * Hook to download an attachment.
 * Opens the file in a new window/tab.
 *
 * @example
 * ```tsx
 * const { download } = useDownloadAttachment();
 *
 * <button onClick={() => download(attachment)}>
 *   Download {attachment.fileName}
 * </button>
 * ```
 */
export function useDownloadAttachment() {
  return {
    download: (attachment: Attachment) => {
      attachmentService.download(attachment);
    },
  };
}
