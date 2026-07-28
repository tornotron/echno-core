/**
 * @module types/finance/invoice-create
 *
 * The {@link CreateInvoiceRequest} payload, its {@link InvoiceLineRequest} rows
 * (backend `LineRequest`), and serializer for creating a draft AR invoice.
 */

/** A single line on a create-invoice request. All listed fields are required. */
export interface InvoiceLineRequest {
  /** Line description (max 500). */
  description?: string;
  /** Quantity (> 0). */
  quantity: number;
  /** Unit price (>= 0). */
  unitPrice: number;
  /** Tax rate as a percentage (0–100). */
  taxRate: number;
  /** GL revenue account to credit. */
  revenueAccountId: string;
}

/** Fields for creating a draft invoice. */
export interface CreateInvoiceRequest {
  /** Customer id. Required. */
  customerId: string;
  /** Invoice date (`YYYY-MM-DD`). Required. */
  invoiceDate: string;
  /** Due date (`YYYY-MM-DD`). Required. */
  dueDate: string;
  /** Free-text notes (max 500). */
  notes?: string;
  /** Invoice lines. At least one required. */
  lines: InvoiceLineRequest[];
}

/**
 * Serializes an {@link InvoiceLineRequest} into a backend line object. Required
 * fields are always emitted; `description` only when set.
 */
function invoiceLineToJson(line: InvoiceLineRequest): Record<string, unknown> {
  const json: Record<string, unknown> = {
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    revenueAccountId: line.revenueAccountId,
  };
  if (line.description !== undefined) json.description = line.description;
  return json;
}

/**
 * Serializes a {@link CreateInvoiceRequest} into the backend request body.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching `CreateInvoiceRequest`.
 */
export function createInvoiceToJson(
  dto: CreateInvoiceRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    customerId: dto.customerId,
    invoiceDate: dto.invoiceDate,
    dueDate: dto.dueDate,
    lines: dto.lines.map((line) => invoiceLineToJson(line)),
  };
  if (dto.notes !== undefined) json.notes = dto.notes;
  return json;
}
