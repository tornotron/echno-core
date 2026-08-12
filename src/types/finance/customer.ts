/**
 * @module types/finance/customer
 *
 * The {@link Customer} entity (backend `CustomerDto`) and its parser. Write
 * payloads live in `customer-create.ts` / `customer-update.ts` (re-exported).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { Address, parseAddress } from './address';
import {
  money,
  nullableBoolean,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';

const CustomerResponseSchema = z.object({
  id: z.string().nullish(),
  code: nullableString,
  name: nullableString,
  gstin: nullableString,
  pan: nullableString,
  email: nullableString,
  phone: nullableString,
  billingAddress: opaque,
  creditLimit: money,
  paymentTermsDays: nullableNumber,
  active: nullableBoolean,
});

/** An accounts-receivable customer. */
export interface Customer {
  /** UUID primary key. */
  id: string;
  /** Customer code (immutable after creation). */
  code: string;
  /** Customer name. */
  name: string;
  /** GST identification number (India). */
  gstin?: string;
  /** PAN (India). */
  pan?: string;
  /** Email. */
  email?: string;
  /** Phone. */
  phone?: string;
  /** Billing address. */
  billingAddress?: Address;
  /** Credit limit. */
  creditLimit?: number;
  /** Payment terms in days. */
  paymentTermsDays?: number;
  /** Whether the customer is active. */
  active: boolean;
}

/**
 * Parses a raw customer payload into a typed {@link Customer}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Customer`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parseCustomer(json: unknown): Customer {
  const raw = CustomerResponseSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseCustomer.id'),
    code: raw.code ?? '',
    name: raw.name ?? '',
    gstin: raw.gstin ?? undefined,
    pan: raw.pan ?? undefined,
    email: raw.email ?? undefined,
    phone: raw.phone ?? undefined,
    billingAddress: parseAddress(raw.billingAddress),
    creditLimit: raw.creditLimit ?? undefined,
    paymentTermsDays: raw.paymentTermsDays ?? undefined,
    active: raw.active ?? true,
  };
}

export {
  type CreateCustomerRequest,
  createCustomerToJson,
} from './customer-create';
export {
  type UpdateCustomerRequest,
  updateCustomerToJson,
} from './customer-update';
