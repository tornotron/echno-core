/**
 * @module organization-service
 *
 * Typed client for organization backend endpoints.
 *
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link Organization} domain objects. All functions throw
 * {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Organization,
  parseOrganization,
} from '../types/organization/organization';
import {
  CreateOrganizationRequest,
  createOrganizationToJson,
} from '../types/organization/organization-create';
import {
  UpdateOrganizationRequest,
  updateOrganizationToJson,
} from '../types/organization/organization-update';
import { OrganizationFiles } from '../types/organization/organization-files';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseOrganization(data: ApiResponse): Organization {
  try {
    return parseOrganization(data);
  } catch (error) {
    logger.error('Failed to parse organization data:', error);
    throw new ApiError(
      'Failed to process organization data. Please try again.',
      422
    );
  }
}

function safeParseOrganizations(data: ApiResponse[]): Organization[] {
  if (!Array.isArray(data)) {
    return [];
  }
  try {
    return data.map((item) => parseOrganization(item));
  } catch (error) {
    logger.error('Failed to parse organizations data:', error);
    throw new ApiError(
      'Failed to process organizations data. Please try again.',
      422
    );
  }
}

export const organizationService = {
  /**
   * Fetches all organizations visible to the current user.
   *
   * `GET /organization/web`
   *
   * @returns Resolved array of {@link Organization} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async getAll(): Promise<Organization[]> {
    const data = await api.get<ApiResponse[]>('/organization/web');
    return safeParseOrganizations(data);
  },

  /**
   * Fetches a single organization by ID.
   *
   * `GET /organization/web/{id}`
   *
   * @param id - Surrogate ID of the organization.
   * @returns The resolved {@link Organization}.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async getById(id: number): Promise<Organization> {
    const data = await api.get<ApiResponse>(`/organization/web/${id}`);
    return safeParseOrganization(data);
  },

  /**
   * Creates a new organization, optionally with a logo attachment.
   *
   * `POST /organization/web` → `OrganizationSimpleDto` (partial — nested
   * `employees`, `projects`, and `attachments` may be absent).
   *
   * @param dto - Required organization fields.
   * @param files - Optional file attachments (e.g. logo).
   * @returns The created {@link Organization}. Note: nested arrays may be absent;
   *   callers should invalidate the detail cache for a canonical refetch.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async create(
    dto: CreateOrganizationRequest,
    files?: OrganizationFiles
  ): Promise<Organization> {
    const payload = createOrganizationToJson(dto);
    const fileMap = files?.logo ? { attachments: [files.logo] } : undefined;
    const data = await api.postMultipart<ApiResponse>(
      '/organization/web',
      payload,
      fileMap
    );
    return safeParseOrganization(data);
  },

  /**
   * Partially updates an organization, optionally replacing the logo.
   *
   * `PATCH /organization/web/{id}` → `OrganizationSimpleDto` (partial — nested
   * `employees`, `projects`, and `attachments` may be absent).
   *
   * @param id - Surrogate ID of the organization.
   * @param dto - Fields to update; only set fields are sent.
   * @param files - Optional replacement logo file.
   * @returns The updated {@link Organization}. Note: nested arrays may be absent;
   *   callers should merge with existing cached state or refetch via the query hook.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async update(
    id: number,
    dto: UpdateOrganizationRequest,
    files?: OrganizationFiles
  ): Promise<Organization> {
    const payload = updateOrganizationToJson(dto);
    const fileMap = files?.logo ? { attachments: [files.logo] } : undefined;
    const data = await api.patchMultipart<ApiResponse>(
      `/organization/web/${id}`,
      payload,
      fileMap
    );
    return safeParseOrganization(data);
  },

  /**
   * Deletes an organization by ID.
   *
   * `DELETE /organization/web/{id}`
   *
   * @param id - Surrogate ID of the organization to delete.
   * @throws {ApiError} On non-2xx HTTP responses.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/organization/web/${id}`);
  },
};
