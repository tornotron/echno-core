/**
 * @module types/finance/payment
 *
 * The {@link Payment} entity (an incoming customer receipt, backend
 * `PaymentDto`) and its {@link Allocation} rows, plus parsers. The record
 * payload lives in `payment-create.ts` (re-exported).
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableString,
} from '../../lib/validation/backend-schema';

const AllocationSchema = z.object({
  id: z.string().nullish(),
  invoiceId: nullableString,
  invoiceNumber: nullableString,
  allocatedAmount: money,
});

const PaymentSchema = z.object({
  id: z.string().nullish(),
  paymentNumber: nullableString,
  customerId: nullableString,
  customerName: nullableString,
  paymentDate: backendDate,
  amount: money,
  companyBankAccountId: nullableString,
  bankName: nullableString,
  bankAccountNumber: nullableString,
  externalReference: nullableString,
  journalEntryId: nullableString,
  notes: nullableString,
  allocations: z.array(z.unknown()).nullish(),
});

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
export function parseAllocation(json: unknown): Allocation {
  const raw = AllocationSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseAllocation.id'),
    invoiceId: raw.invoiceId ?? undefined,
    invoiceNumber: raw.invoiceNumber ?? undefined,
    allocatedAmount: raw.allocatedAmount ?? 0,
  };
}

/**
 * Parses a raw payment payload into a typed {@link Payment}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `Payment`.
 * @throws {TypeError} If `id` is missing or not a non-empty string.
 */
export function parsePayment(json: unknown): Payment {
  const raw = PaymentSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parsePayment.id'),
    paymentNumber: raw.paymentNumber ?? '',
    customerId: raw.customerId ?? undefined,
    customerName: raw.customerName ?? undefined,
    paymentDate: raw.paymentDate ?? undefined,
    amount: raw.amount ?? 0,
    companyBankAccountId: raw.companyBankAccountId ?? undefined,
    bankName: raw.bankName ?? undefined,
    bankAccountNumber: raw.bankAccountNumber ?? undefined,
    externalReference: raw.externalReference ?? undefined,
    journalEntryId: raw.journalEntryId ?? undefined,
    notes: raw.notes ?? undefined,
    allocations: Array.isArray(raw.allocations)
      ? raw.allocations.map((a) => parseAllocation(a))
      : [],
  };
}

export {
  type RecordPaymentRequest,
  type AllocationRequest,
  recordPaymentToJson,
} from './payment-create';
