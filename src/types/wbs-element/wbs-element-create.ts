/**
 * @module wbs-element-create
 *
 * Request payloads and serializers for creating, bulk-creating, and
 * moving WBS elements. Single-create accepts an optional
 * `parentElementId`; bulk-create batches independent elements;
 * `move` is a separate endpoint because reparenting is structurally
 * distinct from a field update.
 */

/**
 * Inputs required to create a single WBS element. `name` is the only
 * required field; the server autogenerates `code` if omitted, and any
 * planning fields can be filled in later via
 * {@link UpdateWbsElementRequest}.
 */
export interface CreateWbsElementRequest {
  /** Human-readable element name. */
  name: string;

  /**
   * Surrogate ID of the parent element. Omit (or pass `undefined`) to
   * create a root node.
   */
  parentElementId?: number;

  /** Project-relative code (e.g. `1.2.3`). Server autogenerates when omitted. */
  code?: string;

  /** Free-form long description. */
  description?: string;

  /** Planned start date. Serialized as ISO 8601. */
  plannedStartDate?: Date;

  /** Planned end date. Serialized as ISO 8601. */
  plannedEndDate?: Date;

  /** Initial lifecycle state (free-form string per backend convention). */
  status?: string;

  /** Initial progress percentage (0-100). */
  progress?: number;

  /** Budget to allocate to the new element. */
  allocatedBudget?: number;

  /** Initial priority tag (free-form string per backend convention). */
  priority?: string;
}

/**
 * Serializes a {@link CreateWbsElementRequest} into the backend's
 * expected request body. Optional fields are omitted from the payload
 * when `undefined`; dates are converted to ISO 8601 strings.
 *
 * @param dto - The domain request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function createWbsElementToJson(
  dto: CreateWbsElementRequest
): Record<string, unknown> {
  return {
    name: dto.name,
    ...(dto.parentElementId !== undefined && {
      parentElementId: dto.parentElementId,
    }),
    ...(dto.code !== undefined && { code: dto.code }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.plannedStartDate !== undefined && {
      plannedStartDate: dto.plannedStartDate.toISOString(),
    }),
    ...(dto.plannedEndDate !== undefined && {
      plannedEndDate: dto.plannedEndDate.toISOString(),
    }),
    ...(dto.status !== undefined && { status: dto.status }),
    ...(dto.progress !== undefined && { progress: dto.progress }),
    ...(dto.allocatedBudget !== undefined && {
      allocatedBudget: dto.allocatedBudget,
    }),
    ...(dto.priority !== undefined && { priority: dto.priority }),
  };
}

/**
 * Batch payload for creating multiple WBS elements in a single
 * round-trip. Each entry uses the single-create shape; the backend
 * inserts them in array order.
 */
export interface BulkCreateWbsElementsRequest {
  /** The elements to create, in insertion order. */
  elements: CreateWbsElementRequest[];
}

/**
 * Serializes a {@link BulkCreateWbsElementsRequest} into the backend's
 * expected request body. Each element is serialized via
 * {@link createWbsElementToJson}.
 *
 * @param dto - The bulk request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function bulkCreateWbsElementsToJson(
  dto: BulkCreateWbsElementsRequest
): Record<string, unknown> {
  return {
    elements: dto.elements.map((el) => createWbsElementToJson(el)),
  };
}

/**
 * Inputs for the dedicated move endpoint. Reparents an element and/or
 * repositions it among its siblings; the standard update endpoint does
 * not accept these fields.
 */
export interface MoveWbsElementRequest {
  /**
   * Surrogate ID of the new parent. Pass `null` to promote the
   * element to a root node; pass `undefined` to leave the parent
   * unchanged.
   */
  newParentId?: number | null;

  /**
   * Zero-based position among the new parent's children. Omit to
   * append at the end.
   */
  newPosition?: number;
}

/**
 * Serializes a {@link MoveWbsElementRequest} into the backend's
 * expected request body. Both fields are emitted only when explicitly
 * set; `null` is preserved on `newParentId` to signal promotion to
 * root.
 *
 * @param dto - The move request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function moveWbsElementToJson(
  dto: MoveWbsElementRequest
): Record<string, unknown> {
  return {
    ...(dto.newParentId !== undefined && { newParentId: dto.newParentId }),
    ...(dto.newPosition !== undefined && { newPosition: dto.newPosition }),
  };
}
