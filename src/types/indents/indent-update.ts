/**
 * @module indent-update
 *
 * Request payload and serializer for updating an existing {@link Indent}.
 * All fields are optional — only those present in the payload are
 * applied server-side. Passing `items` replaces the line-item set.
 */
import type { IndentStatus } from './enums';
import type { CreateIndentItemRequest } from './indent-item-create';

/**
 * Partial update payload for an {@link Indent}. Surrogate ID is supplied
 * separately as a path parameter, not in the body.
 */
export interface UpdateIndentRequest {
  /** New human-readable indent number. */
  indentNumber?: string;

  /** New lifecycle state — see {@link IndentStatus}. */
  status?: IndentStatus;

  /** New expected delivery date (ISO 8601). */
  expectedOn?: string;

  /** Replacement free-form notes. */
  remarks?: string;

  /** Reassign to a different project. */
  projectId?: number;

  /**
   * Replacement line-item set. Each entry uses the create shape;
   * the server treats the array as the new full set of items.
   */
  items?: CreateIndentItemRequest[];
}

/**
 * Serializes an {@link UpdateIndentRequest} into the backend's expected
 * request body. All fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * @param dto - The domain update to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateIndentToJson(
  dto: UpdateIndentRequest
): Record<string, unknown> {
  return {
    indentNumber: dto.indentNumber,
    status: dto.status,
    expectedOn: dto.expectedOn,
    remarks: dto.remarks,
    projectId: dto.projectId,
    items: dto.items,
  };
}
