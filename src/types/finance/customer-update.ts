/**
 * @module types/finance/customer-update
 *
 * The {@link UpdateCustomerRequest} patch payload and serializer for updating
 * an AR customer. Mirrors `CreateCustomerRequest` minus the immutable `code`.
 */

import { Address, addressToJson } from './address';

/** Patch fields for updating a customer. `code` is immutable and not included. */
export interface UpdateCustomerRequest {
  /** Customer name (max 200). */
  name?: string;
  /** GSTIN (max 15). */
  gstin?: string;
  /** PAN (max 10). */
  pan?: string;
  /** Email (max 200). */
  email?: string;
  /** Phone (max 20). */
  phone?: string;
  /** Billing address. */
  billingAddress?: Address;
  /** Credit limit (>= 0). */
  creditLimit?: number;
  /** Payment terms in days (0–365). */
  paymentTermsDays?: number;
}

/**
 * Serializes an {@link UpdateCustomerRequest} into the backend request body,
 * emitting only the fields that are set.
 *
 * @param dto - The update request to serialize.
 * @returns A plain object matching `UpdateCustomerRequest`.
 */
export function updateCustomerToJson(
  dto: UpdateCustomerRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.name !== undefined) json.name = dto.name;
  if (dto.gstin !== undefined) json.gstin = dto.gstin;
  if (dto.pan !== undefined) json.pan = dto.pan;
  if (dto.email !== undefined) json.email = dto.email;
  if (dto.phone !== undefined) json.phone = dto.phone;
  const address = addressToJson(dto.billingAddress);
  if (address !== undefined) json.billingAddress = address;
  if (dto.creditLimit !== undefined) json.creditLimit = dto.creditLimit;
  if (dto.paymentTermsDays !== undefined)
    json.paymentTermsDays = dto.paymentTermsDays;
  return json;
}
