/**
 * @module types/finance/customer
 *
 * The {@link Customer} entity (backend `CustomerDto`) and its parser. Write
 * payloads live in `customer-create.ts` / `customer-update.ts` (re-exported).
 */

import { parseUuid } from '../../lib/utils/parse-id';
import { Address, parseAddress } from './address';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
export function parseCustomer(json: any): Customer {
  return {
    id: parseUuid(json.id, 'parseCustomer.id'),
    code: json.code ?? '',
    name: json.name ?? '',
    gstin: json.gstin ?? undefined,
    pan: json.pan ?? undefined,
    email: json.email ?? undefined,
    phone: json.phone ?? undefined,
    billingAddress: parseAddress(json.billingAddress),
    creditLimit: json.creditLimit ?? undefined,
    paymentTermsDays: json.paymentTermsDays ?? undefined,
    active: json.active ?? true,
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
