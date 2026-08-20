import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Attachment,
  DirectUploadError,
  DirectUploadResult,
  parseAttachment,
  parsePresignedUpload,
  PresignedUpload,
  RegisterUploadRequest,
  UploadAttachmentRequest,
  UploadProgress,
  UploadProgressCallback,
  UploadRequest,
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
   * Step 1 of the direct-to-storage flow: declare the files and receive a
   * short-lived signed PUT url per file.
   *
   * Endpoint: POST /attachment/web/presign/entityId/{entityId}/entityType/{entityType}
   * Body: UploadRequest[] → returns PresignedUpload[] (15-minute expiry).
   *
   * The returned array aligns index-for-index with the request array (the
   * backend preserves order), which is how {@link uploadDirect} pairs each
   * file with its slot.
   *
   * @throws {ApiError} on network/server errors; {@link TypeError} if a slot is
   *   missing its `key`/`url`.
   */
  async presignUploads(
    entityId: number,
    entityType: string,
    requests: UploadRequest[]
  ): Promise<PresignedUpload[]> {
    const data = await api.post<ApiResponse[]>(
      `/attachment/web/presign/entityId/${entityId}/entityType/${entityType}`,
      requests
    );
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((item) => parsePresignedUpload(item));
  },

  /**
   * Step 3 of the direct-to-storage flow: confirm the uploaded keys. The
   * server HEAD-checks each key exists in storage before recording it, so only
   * keys whose PUT actually succeeded may be passed here.
   *
   * Endpoint: POST /attachment/web/register/entityId/{entityId}/entityType/{entityType}
   * Body: RegisterUploadRequest[] → returns AttachmentDto[] (201).
   */
  async registerUploads(
    entityId: number,
    entityType: string,
    requests: RegisterUploadRequest[]
  ): Promise<Attachment[]> {
    const data = await api.post<ApiResponse[]>(
      `/attachment/web/register/entityId/${entityId}/entityType/${entityType}`,
      requests
    );
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((item) => safeParseAttachment(item));
  },

  /**
   * Step 2 of the direct-to-storage flow: PUT the raw file bytes straight to
   * object storage at the presigned `url`.
   *
   * Implemented with a raw {@link XMLHttpRequest} rather than the `api` client
   * on purpose:
   *   - the url is an absolute object-storage url, so it must NOT carry the api
   *     client's baseURL prefix, auth headers, or cookies (`withCredentials`
   *     stays false);
   *   - `Content-Type` MUST equal exactly the `contentType` returned by presign
   *     — it is part of the signature, so a mismatch fails the PUT;
   *   - upload progress is required, and XHR's `upload.onprogress` is the only
   *     portable way to observe it (fetch has no upload-progress event).
   *
   * @param url - Absolute presigned storage url (PUT target).
   * @param file - The file bytes to upload.
   * @param contentType - The exact signed content type (from the presign slot).
   * @param onProgress - Optional progress callback.
   * @throws {ApiError} on non-2xx storage responses, network error, or timeout.
   */
  async putToStorage(
    url: string,
    file: File | Blob,
    contentType: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      // No cookies/credentials to the storage origin — the signed url is the
      // only authorization it needs, and sending cookies can trip CORS.
      xhr.withCredentials = false;
      // Must match the signed content type byte-for-byte.
      xhr.setRequestHeader('Content-Type', contentType);
      // The presigner also signs a canned `private` ACL. Most S3-compatible
      // presigners fold that into the signature without the client resending
      // it, so this header is intentionally left off by default. If a bucket
      // rejects the PUT with 403/SignatureDoesNotMatch for a missing ACL,
      // uncomment the next line (it must then also be an allowed CORS header):
      // xhr.setRequestHeader('x-amz-acl', 'private');

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event: ProgressEvent) => {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: event.lengthComputable
              ? Math.round((event.loaded / event.total) * 100)
              : undefined,
          });
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(
            new ApiError(
              `Storage upload failed (${xhr.status})`,
              xhr.status,
              xhr.responseText || undefined
            )
          );
        }
      });
      xhr.addEventListener('error', () => {
        reject(ApiError.network('Storage upload failed (network error)'));
      });
      xhr.addEventListener('timeout', () => {
        reject(ApiError.timeout('Storage upload timed out'));
      });
      xhr.addEventListener('abort', () => {
        reject(ApiError.network('Storage upload aborted'));
      });

      xhr.send(file);
    });
  },

  /**
   * Orchestrates the full direct-to-storage upload for one or more files:
   * presign → PUT each → register only the keys whose PUT succeeded.
   *
   * Files are independent. A presign failure fails the whole batch (no slots
   * were issued), but once presigned, each file's PUT is tried on its own and
   * only the successes are registered — so a single bad file never blocks the
   * rest. Every failure is collected into {@link DirectUploadResult.errors}
   * with the stage it failed at, so the UI can show which files landed and
   * which need a retry.
   *
   * @param request - `{ entityId, entityType, files }`.
   * @param onProgress - Optional per-file progress callback; the file's index
   *   in the (normalised) files array is passed as the second argument.
   * @returns Registered attachments plus any per-file errors.
   */
  async uploadDirect(
    request: UploadAttachmentRequest,
    onProgress?: UploadProgressCallback
  ): Promise<DirectUploadResult> {
    const { entityId, entityType } = request;
    const files = Array.isArray(request.files)
      ? request.files
      : [request.files];
    const errors: DirectUploadError[] = [];

    if (files.length === 0) {
      return { attachments: [], errors };
    }

    // Empty File.type is legal; fall back to a generic binary type so the
    // presign (and the later PUT, which reuses the signed slot's contentType)
    // always has a value.
    const uploadRequests: UploadRequest[] = files.map((file) => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }));

    // Step 1 — presign. A failure here means no slots were issued: fail the
    // whole batch with a per-file presign error.
    let presigned: PresignedUpload[];
    try {
      presigned = await this.presignUploads(
        entityId,
        entityType,
        uploadRequests
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to presign uploads';
      logger.error('Direct upload: presign failed', error);
      return {
        attachments: [],
        errors: files.map((file) => ({
          filename: file.name,
          stage: 'presign' as const,
          message,
        })),
      };
    }

    // Step 2 — PUT each file to storage. Slots align index-for-index with the
    // files (backend preserves request order). Collect the register payloads
    // for the PUTs that succeed; record a `put` error for the rest.
    const toRegister: RegisterUploadRequest[] = [];
    await Promise.all(
      files.map(async (file, index) => {
        const slot = presigned[index];
        if (!slot) {
          errors.push({
            filename: file.name,
            stage: 'presign',
            message: 'No presigned slot returned for this file',
          });
          return;
        }
        try {
          await this.putToStorage(
            slot.url,
            file,
            slot.contentType,
            onProgress ? (progress) => onProgress(progress, index) : undefined
          );
          toRegister.push({
            key: slot.key,
            filename: file.name,
            contentType: slot.contentType,
            fileSize: file.size,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Upload to storage failed';
          errors.push({ filename: file.name, stage: 'put', message });
        }
      })
    );

    // Step 3 — register only the keys whose PUT succeeded. A failed PUT is
    // never registered, so the server's HEAD check always passes here.
    let attachments: Attachment[] = [];
    if (toRegister.length > 0) {
      try {
        attachments = await this.registerUploads(
          entityId,
          entityType,
          toRegister
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to register uploads';
        logger.error('Direct upload: register failed', error);
        for (const reg of toRegister) {
          errors.push({ filename: reg.filename, stage: 'register', message });
        }
      }
    }

    return { attachments, errors };
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
