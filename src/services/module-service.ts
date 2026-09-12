/**
 * @module module-service
 *
 * Typed client for the module registry backend endpoints
 * (tornotron/echno-backend#747, spec section 8).
 *
 * Wraps `api.*` calls and parses raw JSON into strongly-typed
 * {@link ModuleDescriptor} domain objects. All functions throw
 * {@link ApiError} on non-2xx responses or parse failures.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import { ModuleDescriptor, parseModuleDescriptor } from '../types/module/module';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

function safeParseModuleDescriptors(data: ApiResponse[]): ModuleDescriptor[] {
  if (!Array.isArray(data)) {
    return [];
  }
  try {
    return data.map((item) => parseModuleDescriptor(item));
  } catch (error) {
    logger.error('Failed to parse module descriptors:', error);
    throw new ApiError(
      'Failed to process module data. Please try again.',
      422
    );
  }
}

export const moduleService = {
  /**
   * Fetches every module the backend knows about, regardless of whether it
   * is enabled or entitled.
   *
   * `GET /modules/web`
   *
   * @returns Resolved array of {@link ModuleDescriptor} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async listInstalled(): Promise<ModuleDescriptor[]> {
    const data = await api.get<ApiResponse[]>('/modules/web');
    return safeParseModuleDescriptors(data);
  },

  /**
   * Fetches the modules enabled and entitled for the current org.
   *
   * `GET /modules/web/enabled`
   *
   * @returns Resolved array of {@link ModuleDescriptor} objects.
   * @throws {ApiError} On non-2xx HTTP responses or parse failure.
   */
  async listEnabled(): Promise<ModuleDescriptor[]> {
    const data = await api.get<ApiResponse[]>('/modules/web/enabled');
    return safeParseModuleDescriptors(data);
  },
};
