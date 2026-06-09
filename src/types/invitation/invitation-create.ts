/**
 * @module invitation-create
 *
 * Request shape and serializer for generating a new project invite code.
 */

/**
 * Payload for generating a new invite code.
 */
export interface GenerateInviteCodeRequest {
  /** ID of the project (or organization per spec) to scope the invite to. */
  projectId: number;
  /** Role to assign to users who accept the invite. */
  role: string;
  /** Optional expiry date for the code. */
  expiryDate?: Date;
  /** Maximum number of times the code can be used. `undefined` means unlimited. */
  maxUsageCount?: number;
}

/**
 * Serializes a {@link GenerateInviteCodeRequest} for transmission to the backend.
 *
 * Optional fields are omitted when `undefined`. `expiryDate` is serialized
 * to an ISO 8601 string.
 *
 * @param dto - The request to serialize.
 * @returns A plain object matching the backend's request body shape.
 */
export function generateInviteCodeToJson(
  dto: GenerateInviteCodeRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    projectId: dto.projectId,
    role: dto.role,
  };
  if (dto.expiryDate !== undefined)
    payload.expiryDate = dto.expiryDate.toISOString();
  if (dto.maxUsageCount !== undefined)
    payload.maxUsageCount = dto.maxUsageCount;
  return payload;
}
