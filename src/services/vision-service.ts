/**
 * @module vision-service
 *
 * Typed client for the Computer Vision endpoints (`MODULE_VISION`).
 *
 * Endpoints:
 * - `GET  /vision/models`                          model families with their versions
 * - `GET  /vision/models/{key}/versions/{version}` one version
 * - `GET  /vision/web/settings`                    the organization's inference settings
 * - `PUT  /vision/web/settings`                    replace them (org admins)
 * - `POST /vision/web/runs`                        queue inference on a set of images
 *
 * The registry read has no `/web` twin: it is one platform-wide catalogue.
 *
 * Every endpoint answers 404 while the module is switched off, and 402 or
 * 403 to an organization or caller without it. Those surface as
 * {@link ApiError} like any other module's, and `shouldRetry` does not retry
 * them; gate the queries on the enabled module list rather than on the
 * error. Every function throws {@link ApiError} on a non-2xx response or a
 * parse failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  CvModel,
  CvModelVersion,
  QueueVisionRunRequest,
  QueueVisionRunResult,
  UpdateVisionSettingsRequest,
  VisionSettings,
  parseCvModel,
  parseCvModelVersion,
  parseQueueVisionRunResult,
  parseVisionSettings,
  queueVisionRunToJson,
  updateVisionSettingsToJson,
} from '../types/vision/vision';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const MODELS = '/vision/models';
const BASE = '/vision/web';

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

export const visionService = {
  /**
   * Every model family with its versions, oldest first.
   *
   * `GET /vision/models` → `CvModelDto[]`. Needs `vision:read`.
   *
   * @returns The families.
   * @throws {ApiError} On a non-2xx response, a body that is not an array,
   *   or a family that fails to parse.
   */
  async listModels(): Promise<CvModel[]> {
    const data = await api.get<ApiResponse>(MODELS);
    return parseWith('vision model', data, (raw) => {
      if (!Array.isArray(raw)) throw new TypeError('Expected an array of model families');
      return raw.map((item) => parseCvModel(item));
    });
  },

  /**
   * One version of a model family.
   *
   * `GET /vision/models/{key}/versions/{version}` → `CvModelVersionDto`.
   * Answers 404 for an unknown family or version.
   *
   * @param key - The family's key.
   * @param version - The version string.
   * @returns The version.
   */
  async getModelVersion(key: string, version: string): Promise<CvModelVersion> {
    const data = await api.get<ApiResponse>(
      `${MODELS}/${encodeURIComponent(key)}/versions/${encodeURIComponent(version)}`
    );
    return parseWith('vision model version', data, parseCvModelVersion);
  },

  /**
   * The organization's inference settings. An organization that has never
   * saved any reads as auto-inference off and no model keys.
   *
   * `GET /vision/web/settings` → `VisionSettings`. Needs `vision:read`.
   *
   * @returns The settings.
   */
  async getSettings(): Promise<VisionSettings> {
    const data = await api.get<ApiResponse>(`${BASE}/settings`);
    return parseWith('vision settings', data, parseVisionSettings);
  },

  /**
   * Replaces the organization's inference settings. Org admins only.
   *
   * `PUT /vision/web/settings` → `VisionSettings`.
   *
   * @param req - The whole settings.
   * @returns The saved settings.
   */
  async updateSettings(req: UpdateVisionSettingsRequest): Promise<VisionSettings> {
    const data = await api.put<ApiResponse>(
      `${BASE}/settings`,
      updateVisionSettingsToJson(req)
    );
    return parseWith('vision settings', data, parseVisionSettings);
  },

  /**
   * Queues inference on the images of an inspection, of an observation, or
   * on a list of attachments. The detections arrive later as pending
   * observations.
   *
   * `POST /vision/web/runs` → `{ queued, skippedDuplicate, skippedNotImage }`.
   * Needs `vision:run`.
   *
   * @param req - Exactly one source, and optionally the families and `rerun`.
   * @returns How many images were queued and skipped.
   * @throws {TypeError} When not exactly one source is set, or the
   *   attachment list is empty or over 200, before any request is sent.
   */
  async queueRun(req: QueueVisionRunRequest): Promise<QueueVisionRunResult> {
    const data = await api.post<ApiResponse>(`${BASE}/runs`, queueVisionRunToJson(req));
    return parseWith('vision run', data, parseQueueVisionRunResult);
  },
};
