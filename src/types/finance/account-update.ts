/**
 * @module types/finance/account-update
 *
 * The {@link UpdateAccountRequest} payload and serializer
 * {@link updateAccountToJson} for editing a chart-of-accounts ledger account
 * (`PUT /finance/accounts/web/{id}`).
 */

/** Fields for updating a ledger account. */
export interface UpdateAccountRequest {
  /** Account code (max 20). Required. */
  code: string;
  /** Account name (max 200). Required. */
  name: string;
  /** Whether the account is active. Required. */
  active: boolean;
  /** Optional description (max 500); `null` clears it. */
  description?: string | null;
  /** Parent account id for hierarchy; `null` detaches from any parent. */
  parentId?: string | null;
}

/**
 * Serializes an {@link UpdateAccountRequest} into the backend request body.
 *
 * `code`, `name`, and `active` are always emitted (a full-replace update).
 * `description` and `parentId` are emitted only when present on the DTO, so an
 * explicit `null` clears the field while an omitted key is left untouched.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching the backend's expected JSON shape.
 */
export function updateAccountToJson(
  dto: UpdateAccountRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    code: dto.code,
    name: dto.name,
    active: dto.active,
  };
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.parentId !== undefined) json.parentId = dto.parentId;
  return json;
}
