/**
 * @module project-files
 *
 * File payload shape used by `createWithFiles` and `updateWithFiles` in
 * the project service. Kept as a separate interface so call sites can
 * compose the binary payload independently of the JSON request body.
 */

/**
 * Files uploaded alongside a project create or update request.
 *
 * Field names mirror the multipart form-field names accepted by the
 * backend (`/project/web`).
 */
export interface ProjectFiles {
  /**
   * Attachments to upload with the project. Omit or pass an empty array
   * to leave existing attachments untouched on update.
   */
  attachments?: File[];
}
