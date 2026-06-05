/**
 * @module services/user-service
 *
 * Typed client for the backend user endpoints (base path `/user/web`).
 *
 * Wraps `api.*` calls and parses raw JSON into strongly-typed {@link User}
 * and {@link Employee} domain objects. Parse failures are converted into a
 * 422 {@link ApiError} so the React Query layer surfaces them through the
 * same error path as transport failures.
 *
 * @see {@link User} domain shape
 * @see {@link userKeys} React Query key factory for these endpoints
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { User, parseUser } from '../types/user/user';
import { UserFiles } from '../types/user/user-files';
import { UpdateUserRequest, updateUserToJson } from '../types/user/user-update';
import { Employee, parseEmployee } from '../types/employee';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseUser(data: ApiResponse): User {
  try {
    return parseUser(data);
  } catch (error) {
    logger.error('Failed to parse user data:', error);
    throw new ApiError('Failed to process user data. Please try again.', 422);
  }
}

function safeParseEmployees(data: ApiResponse[]): Employee[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseEmployee(item));
  } catch (error) {
    logger.error('Failed to parse employees data:', error);
    throw new ApiError('Failed to process employees data. Please try again.', 422);
  }
}

export const userService = {
  /**
   * Fetches the current authenticated user's profile.
   *
   * `GET /user/web` → `UserDto` (full).
   *
   * @returns The current {@link User} domain object.
   * @throws {ApiError} On non-2xx HTTP responses, or 422 if the response
   *   payload fails {@link parseUser} validation.
   */
  async getCurrentUser(): Promise<User> {
    const data = await api.get<ApiResponse>('/user/web');
    return safeParseUser(data);
  },

  /**
   * Updates the current user's profile with a JSON-only payload.
   *
   * `PATCH /user/web/{id}` → `UserDto` (full).
   *
   * @param id - Surrogate ID of the user to update (must match the
   *   authenticated user).
   * @param dto - Partial update; only set fields are sent.
   * @returns The updated {@link User} domain object.
   * @throws {ApiError} On non-2xx HTTP responses, or 422 on parse failure.
   */
  async updateCurrentUser(id: number, dto: UpdateUserRequest): Promise<User> {
    const data = await api.patch<ApiResponse>(
      `/user/web/${id}`,
      updateUserToJson(dto)
    );
    return safeParseUser(data);
  },

  /**
   * Updates the current user's profile and uploads attachments
   * (profile picture, CV) in a single multipart request.
   *
   * `PATCH /user/web/{id}` (multipart) → `UserDto` (full — includes
   * newly-created attachments).
   *
   * @param id - Surrogate ID of the user to update.
   * @param dto - Partial update; only set fields are sent in the JSON part.
   * @param files - Optional binary attachments; each present file is sent
   *   as a multipart part keyed by its field name.
   * @returns The updated {@link User} with derived `cv` / `profilePicture`
   *   fields reflecting the new uploads.
   * @throws {ApiError} On non-2xx HTTP responses, or 422 on parse failure.
   */
  async updateCurrentUserWithFiles(
    id: number,
    dto: UpdateUserRequest,
    files: UserFiles
  ): Promise<User> {
    const payload = updateUserToJson(dto);
    const fileMap: Record<string, File[]> = {};
    if (files.profilePicture) fileMap['profilePicture'] = [files.profilePicture];
    if (files.cv) fileMap['cv'] = [files.cv];
    const data = await api.patchMultipart<ApiResponse>(
      `/user/web/${id}`,
      payload,
      Object.keys(fileMap).length > 0 ? fileMap : undefined
    );
    return safeParseUser(data);
  },

  /**
   * Updates only the current user's `defaultOrganizationId`. Used by the
   * organization switcher; sent as multipart for backend compatibility
   * with the file-aware endpoint variant.
   *
   * `PATCH /user/web/{id}` (multipart, single field) → `UserDto` (full).
   *
   * @param id - Surrogate ID of the user to update.
   * @param organizationId - New default organization, or `null` to clear
   *   the preference.
   * @returns The updated {@link User} with the new active organization.
   * @throws {ApiError} On non-2xx HTTP responses, or 422 on parse failure.
   */
  async updateUserOrganization(
    id: number,
    organizationId: number | null
  ): Promise<User> {
    const payload = { defaultOrganizationId: organizationId };
    const data = await api.patchMultipart<ApiResponse>(`/user/web/${id}`, payload);
    return safeParseUser(data);
  },

  /**
   * Fetches every {@link Employee} membership the current user holds
   * across organizations.
   *
   * `GET /user/web/employees` → `EmployeeDto[]` (full).
   *
   * @returns Resolved array of {@link Employee} objects; empty if the
   *   payload is not an array.
   * @throws {ApiError} On non-2xx HTTP responses, or 422 on parse failure.
   */
  async getUserEmployees(): Promise<Employee[]> {
    const data = await api.get<ApiResponse[]>('/user/web/employees');
    return safeParseEmployees(data);
  },
};

export { type UserFiles } from '../types/user/user-files';
