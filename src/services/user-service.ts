/**
 * @module services/user-service
 *
 * Typed client for the backend user endpoints (base path `/user/web`).
 *
 * Wraps `api.*` calls and parses raw JSON into strongly-typed {@link User}
 * domain objects via {@link parseUser}. Parse failures are converted into a
 * 422 {@link ApiError} so the React Query layer surfaces them through the
 * same error path as transport failures.
 *
 * `getUserEmployees` is intentionally absent — it returns `Employee[]` which
 * depends on types not yet migrated. It lives in echno-web until the employee
 * module ships.
 *
 * @see {@link User} domain shape
 * @see {@link userKeys} React Query key factory for these endpoints
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { User, parseUser } from '../types/user/user';
import { UserFiles } from '../types/user/user-files';
import { UpdateUserRequest, updateUserToJson } from '../types/user/user-update';

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

export const userService = {
  /**
   * Fetches the current authenticated user's profile.
   *
   * `GET /user/web` → `UserDto` (full).
   *
   * @returns The current user as a parsed {@link User} object.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async getCurrentUser(): Promise<User> {
    const data = await api.get<ApiResponse>('/user/web');
    return safeParseUser(data);
  },

  /**
   * Updates the current user's profile (JSON-only, no attachments).
   *
   * `PATCH /user/web/{id}` → `UserDto` (full).
   *
   * @param id - Surrogate ID of the user being updated.
   * @param dto - Partial update payload; only set fields are sent.
   * @returns The updated user. Cache writers can patch directly with this value.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async updateCurrentUser(id: number, dto: UpdateUserRequest): Promise<User> {
    const data = await api.patch<ApiResponse>(
      `/user/web/${id}`,
      updateUserToJson(dto)
    );
    return safeParseUser(data);
  },

  /**
   * Updates the current user's profile and uploads attachment files in a
   * single multipart request.
   *
   * `PATCH multipart /user/web/{id}` → `UserDto` (full, with refreshed
   * `profilePicture` / `cv` attachments).
   *
   * @param id - Surrogate ID of the user being updated.
   * @param dto - Partial update payload; only set fields are sent.
   * @param files - Optional binary attachments (profile picture, CV).
   * @returns The updated user including newly-created attachments.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
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
   * Updates only the user's `defaultOrganizationId` preference.
   *
   * `PATCH multipart /user/web/{id}` → `UserDto` (full).
   *
   * @param id - Surrogate ID of the user being updated.
   * @param organizationId - Target organization ID, or `null` to clear.
   * @returns The updated user with the new preference applied.
   * @throws {ApiError} On non-2xx transport responses or parse failures (status 422).
   */
  async updateUserOrganization(
    id: number,
    organizationId: number | null
  ): Promise<User> {
    const payload = { defaultOrganizationId: organizationId };
    const data = await api.patchMultipart<ApiResponse>(
      `/user/web/${id}`,
      payload
    );
    return safeParseUser(data);
  },
};

export { type UserFiles } from '../types/user/user-files';
