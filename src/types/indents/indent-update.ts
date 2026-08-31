/**
 * @module indent-update
 *
 * Request payload and serializer for updating an existing {@link Indent}.
 * All fields are optional — only those present in the payload are
 * applied server-side. Line items are not part of this payload; they have
 * their own routes under {@link indentItemsService}.
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
   * Not sent. This PATCH binds `IndentUpdateDto`, which has no line-item
   * collection, so an array here was dropped and the doc comment promising
   * that the server took it as the new full set was a promise nothing
   * kept. Line items genuinely are editable, one at a time, through
   * {@link indentItemsService} against
   * `/indents/web/{indentId}/items/{itemId}`, which is the path the
   * product already uses.
   *
   * @deprecated The value is ignored. Stop passing it.
   */
  items?: CreateIndentItemRequest[];
}

/**
 * Serializes an {@link UpdateIndentRequest} into the backend's expected
 * request body. Remaining fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * `items` is deliberately left out: `IndentUpdateDto` has no line-item
 * collection, and each line is edited through {@link indentItemsService}.
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
  };
}
