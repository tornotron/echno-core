/**
 * @module types/issue/issue-files
 *
 * Browser `File` payload bundled with create/update issue requests so the
 * service layer can upload attachments via `multipart/form-data` in the
 * same round-trip as the JSON metadata.
 */

/**
 * File payload for issue create/update requests.
 *
 * Pass to `issueService.create(dto, files)` / `issueService.update(id, dto, files)`.
 */
export interface IssueFiles {
  /** Attachments to upload alongside the issue. Empty/undefined means no files. */
  attachments?: File[];
}
