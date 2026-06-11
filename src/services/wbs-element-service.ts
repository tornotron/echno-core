/**
 * @module wbs-element-service
 *
 * Typed client for the WBS-element backend endpoints under
 * `/project/{projectId}/wbs/web`. Wraps `api.*` calls and parses raw
 * JSON into strongly-typed {@link WbsElement} domain objects.
 *
 * The domain is project-scoped — every endpoint takes a `projectId`
 * path parameter; there is no cross-project list. Three read shapes
 * are exposed: a flat list ({@link wbsElementService.getAll}), a
 * hierarchical tree with embedded `children`
 * ({@link wbsElementService.getTree}), and a leaves-only filter
 * ({@link wbsElementService.getLeaves}).
 *
 * All exported functions throw {@link ApiError} on non-2xx responses
 * or when the response payload fails parsing.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  WbsElement,
  parseWbsElement,
  CreateWbsElementRequest,
  createWbsElementToJson,
  BulkCreateWbsElementsRequest,
  bulkCreateWbsElementsToJson,
  UpdateWbsElementRequest,
  updateWbsElementToJson,
  MoveWbsElementRequest,
  moveWbsElementToJson,
} from '../types/wbs-element';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * Backend response shape audit:
 *
 *   GET    /project/{projectId}/wbs/web                                  → WbsElementDto[]  (flat list)
 *   GET    /project/{projectId}/wbs/web/tree                             → WbsElementDto[]  (root-level array with nested `children`)
 *   GET    /project/{projectId}/wbs/web/leaves                           → WbsElementDto[]  (leaf nodes only)
 *   GET    /project/{projectId}/wbs/web/{elementId}                      → WbsElementDto    (full)
 *   POST   /project/{projectId}/wbs/web                                  → WbsElementDto    (full)
 *   POST   /project/{projectId}/wbs/web/bulk                             → WbsElementDto[]  (full — array of newly created elements, in submission order)
 *   PUT    /project/{projectId}/wbs/web/{elementId}                      → WbsElementDto    (full)
 *   POST   /project/{projectId}/wbs/web/{elementId}/move                 → WbsElementDto    (full — moved element with updated `parentElementId`)
 *   POST   /project/{projectId}/wbs/web/{elementId}/recalculate          → WbsElementDto    (full — element with recomputed roll-up fields)
 *   DELETE /project/{projectId}/wbs/web/{elementId}                      → ApiResponse      (ack)
 */

/**
 * Parses a single WBS-element payload, wrapping parser failures in
 * {@link ApiError} so callers receive a uniform error shape.
 *
 * @param data - The raw JSON object from the backend.
 * @returns The parsed {@link WbsElement}.
 * @throws {ApiError} When parsing fails (HTTP 422).
 */
function safeParseWbsElement(data: Raw): WbsElement {
  try {
    return parseWbsElement(data);
  } catch (error) {
    logger.error('Failed to parse WBS element:', error);
    throw new ApiError('Failed to process WBS element data.', 422);
  }
}

/**
 * Parses an array of WBS-element payloads. Returns `[]` for any
 * non-array input (defensive against backend shape drift).
 *
 * @param data - The raw JSON array from the backend.
 * @returns An array of parsed {@link WbsElement} objects.
 * @throws {ApiError} When any item fails parsing (HTTP 422).
 */
function safeParseWbsElements(data: Raw[]): WbsElement[] {
  if (!Array.isArray(data)) return [];
  try {
    return data.map((item) => parseWbsElement(item));
  } catch (error) {
    logger.error('Failed to parse WBS elements:', error);
    throw new ApiError('Failed to process WBS elements data.', 422);
  }
}

export const wbsElementService = {
  /**
   * Fetches every WBS element for a project as a flat list
   * (`GET /project/{projectId}/wbs/web`).
   *
   * @param projectId - Surrogate ID of the project.
   * @returns Every {@link WbsElement} in the project, unordered;
   *   `children` is `undefined` on each entry (flat shape).
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getAll(projectId: number): Promise<WbsElement[]> {
    const data = await api.get<Raw[]>(`/project/${projectId}/wbs/web`);
    return safeParseWbsElements(data);
  },

  /**
   * Fetches the project's WBS as a hierarchy
   * (`GET /project/{projectId}/wbs/web/tree`). Returns an array of
   * root nodes; each node carries nested `children` recursively.
   *
   * @param projectId - Surrogate ID of the project.
   * @returns The root {@link WbsElement}s, each with `children`
   *   populated.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getTree(projectId: number): Promise<WbsElement[]> {
    const data = await api.get<Raw[]>(`/project/${projectId}/wbs/web/tree`);
    return safeParseWbsElements(data);
  },

  /**
   * Fetches only the leaf elements of the project's WBS — nodes that
   * have no children themselves
   * (`GET /project/{projectId}/wbs/web/leaves`).
   *
   * @param projectId - Surrogate ID of the project.
   * @returns The leaf {@link WbsElement}s, as a flat list.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getLeaves(projectId: number): Promise<WbsElement[]> {
    const data = await api.get<Raw[]>(`/project/${projectId}/wbs/web/leaves`);
    return safeParseWbsElements(data);
  },

  /**
   * Fetches a single WBS element by ID
   * (`GET /project/{projectId}/wbs/web/{elementId}`).
   *
   * @param projectId - Surrogate ID of the project.
   * @param elementId - Surrogate ID of the element.
   * @returns The {@link WbsElement}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async getById(projectId: number, elementId: number): Promise<WbsElement> {
    const data = await api.get<Raw>(
      `/project/${projectId}/wbs/web/${elementId}`
    );
    return safeParseWbsElement(data);
  },

  /**
   * Creates a single WBS element under a project
   * (`POST /project/{projectId}/wbs/web`).
   *
   * @param projectId - Surrogate ID of the project.
   * @param dto - The {@link CreateWbsElementRequest} payload.
   * @returns The newly-created {@link WbsElement}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async create(
    projectId: number,
    dto: CreateWbsElementRequest
  ): Promise<WbsElement> {
    const data = await api.post<Raw>(
      `/project/${projectId}/wbs/web`,
      createWbsElementToJson(dto)
    );
    return safeParseWbsElement(data);
  },

  /**
   * Creates multiple WBS elements in one round-trip
   * (`POST /project/{projectId}/wbs/web/bulk`). The backend inserts
   * the elements in submission order and returns them as an array.
   *
   * @param projectId - Surrogate ID of the project.
   * @param dto - The {@link BulkCreateWbsElementsRequest} payload.
   * @returns The newly-created {@link WbsElement}s, in submission
   *   order.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async bulkCreate(
    projectId: number,
    dto: BulkCreateWbsElementsRequest
  ): Promise<WbsElement[]> {
    const data = await api.post<Raw[]>(
      `/project/${projectId}/wbs/web/bulk`,
      bulkCreateWbsElementsToJson(dto)
    );
    return safeParseWbsElements(data);
  },

  /**
   * Updates a WBS element's mutable fields
   * (`PUT /project/{projectId}/wbs/web/{elementId}`). This endpoint
   * does not reparent — use {@link wbsElementService.move} for
   * structural changes.
   *
   * @param projectId - Surrogate ID of the project.
   * @param elementId - Surrogate ID of the element to update.
   * @param dto - The {@link UpdateWbsElementRequest} payload.
   * @returns The updated {@link WbsElement}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async update(
    projectId: number,
    elementId: number,
    dto: UpdateWbsElementRequest
  ): Promise<WbsElement> {
    const data = await api.put<Raw>(
      `/project/${projectId}/wbs/web/${elementId}`,
      updateWbsElementToJson(dto)
    );
    return safeParseWbsElement(data);
  },

  /**
   * Reparents and/or repositions a WBS element via the dedicated move
   * endpoint
   * (`POST /project/{projectId}/wbs/web/{elementId}/move`). The
   * server returns the moved element with its updated
   * `parentElementId`.
   *
   * @param projectId - Surrogate ID of the project.
   * @param elementId - Surrogate ID of the element to move.
   * @param dto - The {@link MoveWbsElementRequest} payload.
   * @returns The moved {@link WbsElement}.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async move(
    projectId: number,
    elementId: number,
    dto: MoveWbsElementRequest
  ): Promise<WbsElement> {
    const data = await api.post<Raw>(
      `/project/${projectId}/wbs/web/${elementId}/move`,
      moveWbsElementToJson(dto)
    );
    return safeParseWbsElement(data);
  },

  /**
   * Triggers a server-side recalculation of the element's roll-up
   * fields (progress, budget, dates inherited from descendants)
   * (`POST /project/{projectId}/wbs/web/{elementId}/recalculate`).
   * The response carries the element with refreshed roll-up values.
   *
   * @param projectId - Surrogate ID of the project.
   * @param elementId - Surrogate ID of the element to recalculate.
   * @returns The {@link WbsElement} with recomputed roll-up fields.
   * @throws {ApiError} On a non-2xx response or parse failure.
   */
  async recalculate(projectId: number, elementId: number): Promise<WbsElement> {
    const data = await api.post<Raw>(
      `/project/${projectId}/wbs/web/${elementId}/recalculate`,
      {}
    );
    return safeParseWbsElement(data);
  },

  /**
   * Deletes a WBS element
   * (`DELETE /project/{projectId}/wbs/web/{elementId}`). Cascade
   * behaviour for internal nodes (whether descendants are deleted
   * server-side) is not documented; the matching hook
   * ({@link useDeleteWbsElement}) conservatively invalidates the
   * flat list rather than removing only the named ID.
   *
   * @param projectId - Surrogate ID of the project.
   * @param elementId - Surrogate ID of the element to delete.
   * @throws {ApiError} On a non-2xx response.
   */
  async delete(projectId: number, elementId: number): Promise<void> {
    await api.delete(`/project/${projectId}/wbs/web/${elementId}`);
  },
};
