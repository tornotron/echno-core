/**
 * @module types/finance/account-create
 *
 * The {@link CreateAccountRequest} payload and serializer
 * {@link createAccountToJson} for creating a chart-of-accounts ledger account.
 */

/** Fields for creating a ledger account. */
export interface CreateAccountRequest {
  /** Account code (max 20). */
  code?: string;
  /** Account name (max 200). */
  name?: string;
  /** Ledger type — `ASSET | LIABILITY | EQUITY | INCOME | EXPENSE` (max 20). */
  type?: string;
  /** Parent account id for hierarchy. */
  parentId?: string;
  /** Optional description (max 500). */
  description?: string;
}

/**
 * Serializes a {@link CreateAccountRequest} into the backend request body,
 * emitting only the fields that are set.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateAccountRequest`.
 */
export function createAccountToJson(
  dto: CreateAccountRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.code !== undefined) json.code = dto.code;
  if (dto.name !== undefined) json.name = dto.name;
  if (dto.type !== undefined) json.type = dto.type;
  if (dto.parentId !== undefined) json.parentId = dto.parentId;
  if (dto.description !== undefined) json.description = dto.description;
  return json;
}
