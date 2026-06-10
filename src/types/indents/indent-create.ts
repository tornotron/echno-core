/**
 * @module indent-create
 *
 * Request payload and serializer for creating a new {@link Indent}.
 * Line items are embedded inline via {@link CreateIndentItemRequest};
 * the server creates the parent indent and its items in one round-trip.
 */
import type { IndentStatus } from './enums';
import type { CreateIndentItemRequest } from './indent-item-create';

/**
 * Inputs required to create a new {@link Indent} together with its line
 * items.
 */
export interface CreateIndentRequest {
  /** Human-readable indent number; must be unique within the organisation. */
  indentNumber: string;

  /** Surrogate ID of the {@link Employee} creating the indent. */
  createdByEmployeeId: number;

  /** Initial lifecycle state — typically {@link IndentStatus.pending}. */
  status: IndentStatus;

  /** ISO 8601 date the materials are expected on site. */
  expectedOn?: string;

  /** Free-form notes attached to the indent. */
  remarks?: string;

  /** Surrogate ID of the project the indent is raised against. */
  projectId?: number;

  /** Line items to create alongside the indent. */
  items: CreateIndentItemRequest[];
}

/**
 * Serializes a {@link CreateIndentRequest} into the backend's expected
 * request body. All fields are forwarded verbatim — the backend
 * tolerates `undefined` on optional fields.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createIndentToJson(
  dto: CreateIndentRequest
): Record<string, unknown> {
  return {
    indentNumber: dto.indentNumber,
    createdByEmployeeId: dto.createdByEmployeeId,
    status: dto.status,
    expectedOn: dto.expectedOn,
    remarks: dto.remarks,
    projectId: dto.projectId,
    items: dto.items,
  };
}
