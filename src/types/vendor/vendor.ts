/**
 * @module vendor
 *
 * Domain type and parser for the vendor entity. {@link parseVendor}
 * normalises the backend's wire format (which uses `vendorName`,
 * `vendorEmail`, `vendorAddress`, `pinCode` field names) into the
 * canonical {@link Vendor} shape and denormalises selected fields from
 * the sub-resource arrays (contacts, tax identifiers, bank accounts,
 * payment terms) onto top-level scalar properties for UI convenience.
 */
import { Attachment } from '../attachment';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { VendorType, VendorStatus, PaymentTerms } from './enums';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { VendorContact } from './contacts';
import { VendorTaxIdentifier } from './tax-identifiers';
import { VendorBankAccount } from './bank-accounts';
import { VendorPaymentTermsDetails } from './payment-terms';
import { z } from 'zod';
import {
  backendDate,
  money,
  nullableNumber,
  nullableString,
  opaque,
} from '../../lib/validation/backend-schema';

const VendorResponseSchema = z.object({
  id: opaque,
  vendorName: nullableString,
  name: nullableString,
  vendorEmail: nullableString,
  email: nullableString,
  contacts: z.array(z.unknown()).nullish(),
  taxIdentifiers: z.array(z.unknown()).nullish(),
  bankAccounts: z.array(z.unknown()).nullish(),
  paymentTerms: opaque,
  vendorAddress: nullableString,
  address: nullableString,
  website: nullableString,
  city: nullableString,
  state: nullableString,
  pinCode: nullableString,
  pincode: nullableString,
  country: nullableString,
  type: nullableString,
  status: nullableString,
  notes: nullableString,
  contactPerson: nullableString,
  phone: nullableString,
  alternatePhone: nullableString,
  gstNumber: nullableString,
  panNumber: nullableString,
  bankName: nullableString,
  accountNumber: nullableString,
  ifscCode: nullableString,
  accountHolderName: nullableString,
  swift: nullableString,
  creditLimit: money,
  creditDays: nullableNumber,
  totalPurchaseValue: money,
  totalPaid: money,
  totalOutstanding: money,
  lastPaymentDate: backendDate,
  lastPaymentAmount: money,
  totalOrders: nullableNumber,
  pendingOrders: nullableNumber,
  completedOrders: nullableNumber,
  cancelledOrders: nullableNumber,
  attachments: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

/**
 * A supplier the organisation purchases from. The interface mixes scalar
 * vendor fields with denormalised fields drawn from the vendor's
 * sub-resources for UI convenience. Mutation hooks that change a
 * sub-resource invalidate `vendorKeys.detail(id)` so the next observer
 * picks up the recalculated derived fields.
 */
export interface Vendor {
  /** Surrogate primary key. */
  id: number;

  /** Vendor's display name. */
  name: string;

  /** Vendor's primary contact email. */
  email: string;

  /** Postal / billing address. */
  address?: string;

  /** Vendor website URL. */
  website?: string;

  /** City portion of the address. */
  city?: string;

  /** State / province portion of the address. */
  state?: string;

  /** PIN / postal / ZIP code. */
  pincode?: string;

  /** Country portion of the address. */
  country?: string;

  /** Trade category — see {@link VendorType}. */
  type?: VendorType;

  /** Trading relationship state — see {@link VendorStatus}. */
  status?: VendorStatus;

  /** Free-form internal notes about the vendor. */
  notes?: string;

  // Denormalised from contacts[] (primary, or first if no primary is flagged).

  /** Primary contact person's name. */
  contactPerson?: string;

  /** Primary contact phone. */
  phone?: string;

  /** Primary contact secondary phone. */
  alternatePhone?: string;

  // Denormalised from taxIdentifiers[] by `type`.

  /** GST registration number (looked up from `taxIdentifiers` where `type === 'GST'`). */
  gstNumber?: string;

  /** PAN number (looked up from `taxIdentifiers` where `type === 'PAN'`). */
  panNumber?: string;

  // Denormalised from bankAccounts[] (default, or first if no default is flagged).

  /** Default bank's name. */
  bankName?: string;

  /** Default bank account number. */
  accountNumber?: string;

  /** Default bank IFSC code (India) or local equivalent. */
  ifscCode?: string;

  /** Default account holder name. */
  accountHolderName?: string;

  /** Default account SWIFT / BIC code. */
  swift?: string;

  // Denormalised from paymentTerms object.

  /** Negotiated credit-period code — see {@link PaymentTerms}. */
  paymentTerms?: PaymentTerms;

  /** Maximum outstanding balance allowed for this vendor. */
  creditLimit?: number;

  /** Calendar days of credit on each invoice. */
  creditDays?: number;

  // Server-side computed financial rollups (mirror of VendorSummary fields).

  /** Cumulative monetary value of all purchase orders raised against this vendor. */
  totalPurchaseValue?: number;

  /** Cumulative amount paid to this vendor to date. */
  totalPaid?: number;

  /** Outstanding balance owed to this vendor. */
  totalOutstanding?: number;

  /** Date of the most recent payment to this vendor. */
  lastPaymentDate?: Date;

  /** Amount of the most recent payment. */
  lastPaymentAmount?: number;

  /** Total purchase orders ever raised against this vendor. */
  totalOrders?: number;

  /** Orders currently open or awaiting fulfilment. */
  pendingOrders?: number;

  /** Orders fully received and closed. */
  completedOrders?: number;

  /** Orders cancelled before or during fulfilment. */
  cancelledOrders?: number;

  /** Attachments uploaded against the vendor record (contracts, certificates, etc.). */
  attachments?: Attachment[];

  /** When the vendor was created. */
  createdAt?: Date;

  /** When the vendor was last updated. */
  updatedAt?: Date;
}

/**
 * Parses a raw vendor payload into a typed {@link Vendor} domain object.
 *
 * Accepts the backend's wire-format field names (`vendorName`,
 * `vendorEmail`, `vendorAddress`, `pinCode`) and falls back to the
 * canonical names if the wire-format key is absent — useful when a
 * mutation seeds the cache with a request-shaped object before the
 * canonical refetch lands. Denormalises selected fields from the
 * `contacts`, `taxIdentifiers`, `bankAccounts`, and `paymentTerms`
 * sub-resources onto top-level scalar properties; the same fields on
 * `raw` are honoured as a fallback when the sub-resource array is empty
 * or missing.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A canonical {@link Vendor} domain object.
 * @throws {Error} If `raw.id` is missing or not a positive integer.
 * @throws {Error} If the vendor has neither `vendorName` nor `name`.
 */
export function parseVendor(json: unknown): Vendor {
  const raw = VendorResponseSchema.parse(json);
  const id = parsePositiveInt(raw.id, 'parseVendor.id');
  const name = raw.vendorName ?? raw.name ?? '';
  const email = raw.vendorEmail ?? raw.email ?? '';
  if (!name) {
    throw new Error(`parseVendor: vendor id=${id} has no name`);
  }

  const contacts = (raw.contacts ?? []) as VendorContact[];
  const contact = contacts.find((c) => c.primary) ?? contacts[0];

  const taxIds = (raw.taxIdentifiers ?? []) as VendorTaxIdentifier[];
  const bankAccounts = (raw.bankAccounts ?? []) as VendorBankAccount[];
  const bank = bankAccounts.find((b) => b.default) ?? bankAccounts[0];

  const pt: VendorPaymentTermsDetails | null =
    raw.paymentTerms && typeof raw.paymentTerms === 'object'
      ? (raw.paymentTerms as VendorPaymentTermsDetails)
      : null;

  return {
    id,
    name,
    email,
    address: raw.vendorAddress ?? raw.address ?? undefined,
    website: raw.website ?? undefined,
    city: raw.city ?? undefined,
    state: raw.state ?? undefined,
    pincode: raw.pinCode ?? raw.pincode ?? undefined,
    country: raw.country ?? undefined,
    type: raw.type as VendorType | undefined,
    status: raw.status as VendorStatus | undefined,
    notes: raw.notes ?? undefined,

    contactPerson: contact?.contactPerson ?? raw.contactPerson ?? undefined,
    phone: contact?.phone ?? raw.phone ?? undefined,
    alternatePhone: contact?.alternatePhone ?? raw.alternatePhone ?? undefined,

    gstNumber:
      taxIds.find((t) => t.type === 'GST')?.value ?? raw.gstNumber ?? undefined,
    panNumber:
      taxIds.find((t) => t.type === 'PAN')?.value ?? raw.panNumber ?? undefined,

    bankName: bank?.bankName ?? raw.bankName ?? undefined,
    accountNumber: bank?.accountNumber ?? raw.accountNumber ?? undefined,
    ifscCode: bank?.ifscCode ?? raw.ifscCode ?? undefined,
    accountHolderName:
      bank?.accountHolderName ?? raw.accountHolderName ?? undefined,
    swift: bank?.swift ?? raw.swift ?? undefined,

    paymentTerms: pt?.paymentTerms as PaymentTerms | undefined,
    creditLimit: pt?.creditLimit ?? raw.creditLimit ?? undefined,
    creditDays: pt?.creditDays ?? raw.creditDays ?? undefined,

    totalPurchaseValue: raw.totalPurchaseValue ?? undefined,
    totalPaid: raw.totalPaid ?? undefined,
    totalOutstanding: raw.totalOutstanding ?? undefined,
    lastPaymentDate: parseUTCDate(raw.lastPaymentDate) ?? undefined,
    lastPaymentAmount: raw.lastPaymentAmount ?? undefined,
    totalOrders: raw.totalOrders ?? undefined,
    pendingOrders: raw.pendingOrders ?? undefined,
    completedOrders: raw.completedOrders ?? undefined,
    cancelledOrders: raw.cancelledOrders ?? undefined,
    attachments: raw.attachments as Attachment[] | undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
  };
}
