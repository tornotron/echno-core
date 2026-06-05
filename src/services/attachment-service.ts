import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Attachment,
  parseAttachment,
  UploadAttachmentRequest,
} from '../types/attachment';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/**
 * Safely parse attachment data with error handling.
 * @throws {ApiError} when parsing fails
 */
function safeParseAttachment(data: ApiResponse): Attachment {
  try {
    return parseAttachment(data);
  } catch (error) {
    logger.error('Failed to parse attachment data:', error);
    throw new ApiError(
      'Failed to process attachment data. Please try again.',
      422
    );
  }
}

/**
 * attachmentService
 *
 * Thin wrapper around the backend attachment REST endpoints. Provides
 * typed, parse-safe convenience methods for attachment operations.
 *
 * Expected backend structure:
 * - GET /attachment/web/entityId/{entityId}/entityType/{entityType} - Fetch attachment
 * - POST /attachment/web/entityId/{entityId}/entityType/{entityType} - Upload attachment
 * - DELETE /attachment/web/attachmentId/{id} - Delete attachment by ID
 */
export const attachmentService = {
  /**
   * Get single attachment by entity ID and attachment type.
   * Use this for cases where only one attachment is expected (profile picture, CV, logo).
   *
   * Endpoint: GET /attachment/web/entityId/{entityId}/entityType/{entityType}
   * Returns an array of attachments, we take the first one.
   *
   * @param {number} entityId - ID of the entity (user, organization, etc.)
   * @param {string} entityType - Type of attachment (e.g., 'USER_PROFILE_PICTURE', 'CV', 'LOGO')
   * @returns {Promise<Attachment>} Parsed attachment object
   * @throws {ApiError} on network, server, or parsing errors
   */
  async getByEntity(entityId: number, entityType: string): Promise<Attachment> {
    const data = await api.get<ApiResponse[]>(
      `/attachment/web/entityId/${entityId}/entityType/${entityType}`
    );

    // API returns an array, take the first attachment
    if (!Array.isArray(data) || data.length === 0) {
      throw new ApiError('No attachment found', 404);
    }

    return safeParseAttachment(data[0]);
  },

  /**
   * Get all attachments by entity ID and attachment type.
   * Use this for cases where multiple attachments are expected (task files, issue attachments).
   *
   * Endpoint: GET /attachment/web/entityId/{entityId}/entityType/{entityType}
   *
   * @param {number} entityId - ID of the entity (task, issue, etc.)
   * @param {string} entityType - Type of attachment (e.g., 'TASK_ATTACHMENT', 'ISSUE_ATTACHMENT')
   * @returns {Promise<Attachment[]>} Array of parsed attachment objects
   * @throws {ApiError} on network, server, or parsing errors
   */
  async getAllByEntity(
    entityId: number,
    entityType: string
  ): Promise<Attachment[]> {
    const data = await api.get<ApiResponse[]>(
      `/attachment/web/entityId/${entityId}/entityType/${entityType}`
    );

    // API returns an array
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => safeParseAttachment(item));
  },

  /**
   * Upload a new attachment file for an entity.
   *
   * Endpoint: POST /v1/attachment/web/entityId/{entityId}/entityType/{entityType}
   */
  async upload(request: UploadAttachmentRequest): Promise<Attachment> {
    const formData = new FormData();
    const fileArray = Array.isArray(request.files)
      ? request.files
      : [request.files];
    for (const file of fileArray) {
      formData.append('file', file);
    }
    const data = await api.postFormData<ApiResponse>(
      `/attachment/web/entityId/${request.entityId}/entityType/${request.entityType}`,
      formData
    );
    return safeParseAttachment(data);
  },

  /**
   * Delete an attachment by ID.
   * Endpoint: DELETE /attachment/web/attachmentId/{id}
   *
   * @param {number} id - Attachment ID to delete
   * @returns {Promise<void>} Resolves when delete completes
   * @throws {ApiError} on network or server errors
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/attachment/web/attachmentId/${id}`);
  },

  /**
   * Download an attachment file.
   * Opens the file URL in a new window/tab for download.
   *
   * @param {Attachment} attachment - Attachment object with file URL
   */
  download(attachment: Attachment): void {
    if (!attachment.file) {
      logger.error('Attachment has no file URL');
      throw new Error('Cannot download attachment: no file URL');
    }

    // Open file URL in new window/tab
    window.open(attachment.file, '_blank');
  },
};
