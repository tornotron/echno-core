/**
 * @module types/finance/payment-create
 *
 * The {@link RecordPaymentRequest} payload, its {@link AllocationRequest} rows,
 * and serializer for recording an incoming customer payment.
 */

/** Applies part of a payment to a specific invoice. */
export interface AllocationRequest {
  /** Invoice to apply the amount to. Required. */
  invoiceId: string;
  /** Amount to apply (> 0). Required. */
  allocatedAmount: number;
}

/** Fields for recording a customer payment. */
export interface RecordPaymentRequest {
  /** Paying customer. Required. */
  customerId: string;
  /** Payment date (`YYYY-MM-DD`). Required. */
  paymentDate: string;
  /** Total amount received (> 0). Required. */
  amount: number;
  /** Company bank account the money landed in. Required. */
  companyBankAccountId: string;
  /** External reference (max 100). */
  externalReference?: string;
  /** Free-text notes (max 500). */
  notes?: string;
  /** Per-invoice allocations. At least one required; should sum to `amount`. */
  allocations: AllocationRequest[];
}

/**
 * Serializes a {@link RecordPaymentRequest} into the backend request body.
 *
 * @param dto - The record request to serialize.
 * @returns A plain object matching `RecordPaymentRequest`.
 */
export function recordPaymentToJson(
  dto: RecordPaymentRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    customerId: dto.customerId,
    paymentDate: dto.paymentDate,
    amount: dto.amount,
    companyBankAccountId: dto.companyBankAccountId,
    allocations: dto.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      allocatedAmount: a.allocatedAmount,
    })),
  };
  if (dto.externalReference !== undefined)
    json.externalReference = dto.externalReference;
  if (dto.notes !== undefined) json.notes = dto.notes;
  return json;
}
