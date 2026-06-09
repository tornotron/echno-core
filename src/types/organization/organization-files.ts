/**
 * @module organization-files
 *
 * File attachment shape for organization create and update operations.
 */

/**
 * File attachments for organization create/update requests.
 *
 * Passed alongside the JSON payload in multipart form requests.
 */
export interface OrganizationFiles {
  /** Logo image to upload and associate with the organization. */
  logo?: File;
}
