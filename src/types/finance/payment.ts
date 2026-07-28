/**
 * @module types/finance/payment
 *
 * The {@link Payment} entity (an incoming customer receipt, backend
 * `PaymentDto`) and its {@link Allocation} rows, plus parsers. The record
 * payload lives in `payment-create.ts` (re-exported).
 */

import { parseUuid } from '../../lib/utils/parse-id';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** How much of a payment was applied to a specific invoice. */
export interface Allocation {
  /** UUID primary key. */
  id: string;
  /** Invoice the amount was applied to. */
  invoiceId?: string;
  /** Invoice number (denormalized). */
  invoiceNumber?: string;
  /** Amount applied to the invoice. */
  allocatedAmount: number;
}

/** An incoming customer payment (receipt), allocated across invoices. */
export interface Payment {
  /** UUID primary key. */
  id: string;
  /** Human-facing payment number. */
  paymentNumber: string;
  /** Paying customer. */
  customerId?: string;
  /** Customer name (denormalized). */
  customerName?: string;
  /** Payment date (`YYYY-MM-DD`). */
  paymentDate?: string;
  /** Total amount received. */
  amount: number;
  /** Company bank account the money landed in. */
  companyBankAccountId?: string;
  /** Bank name (denormalized). */
  bankName?: string;
  /** Bank account number (denormalized). */
  bankAccountNumber?: string;
  /** External reference (e.g. UTR / cheque number). */
  externalReference?: string;
  /** Journal entry posted for the receipt. */
  journalEntryId?: string;
  /** Free-text notes. */
  notes?: string;
  /** Per-invoice allocations. */
  allocations: Allocation[];
}

/** Parses a raw allocation payload into a typed {@link Allocation}. */
export function parseAllocation(json: any): Allocation {
  return {
    id: parseUuid(json.id, 'parseAllocation.id'),
    invoiceId: json.invoiceId ?? undefined,
    invoiceNumber: json.invoiceNumber ?? undefined,
    allocatedAmount: json.allocatedAmount ?? 0,
  };
}

/**
 * Parses a raw payment payload into a typed {@link Payment}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Payment`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parsePayment(json: any): Payment {
  return {
    id: parseUuid(json.id, 'parsePayment.id'),
    paymentNumber: json.paymentNumber ?? '',
    customerId: json.customerId ?? undefined,
    customerName: json.customerName ?? undefined,
    paymentDate: json.paymentDate ?? undefined,
    amount: json.amount ?? 0,
    companyBankAccountId: json.companyBankAccountId ?? undefined,
    bankName: json.bankName ?? undefined,
    bankAccountNumber: json.bankAccountNumber ?? undefined,
    externalReference: json.externalReference ?? undefined,
    journalEntryId: json.journalEntryId ?? undefined,
    notes: json.notes ?? undefined,
    allocations: Array.isArray(json.allocations)
      ? json.allocations.map((a: any) => parseAllocation(a))
      : [],
  };
}

export {
  type RecordPaymentRequest,
  type AllocationRequest,
  recordPaymentToJson,
} from './payment-create';
