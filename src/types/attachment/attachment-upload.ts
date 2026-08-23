/**
 * Payload for uploading one or more files against a domain entity. `entityType`
 * names the target (for example `'USER_PROFILE_PICTURE'` or a document
 * category) and `entityId` identifies the specific record; `files` accepts a
 * single `File` or an array for multi-file uploads.
 */
export interface UploadAttachmentRequest {
  entityId: number;
  entityType: string;
  files: File | File[];
}
