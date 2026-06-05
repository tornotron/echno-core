export interface UploadAttachmentRequest {
  entityId: number;
  entityType: string;
  files: File | File[];
}
