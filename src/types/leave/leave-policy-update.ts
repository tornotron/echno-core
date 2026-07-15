/**
 * @module types/leave/leave-policy-update
 *
 * The {@link UpdateLeavePolicyRequest} patch payload and its serializer
 * {@link updateLeavePolicyToJson}. Every field is optional; only set fields are
 * sent. `organizationId` and `leaveTypeCode` are immutable and absent here.
 */

/** Patch fields for a leave policy; an omitted field is left unchanged. */
export interface UpdateLeavePolicyRequest {
  /** New leave-type display name. */
  leaveTypeName?: string;
  /** New description. */
  description?: string;
  /** New annual quota. */
  annualQuota?: number;
  /** New monthly accrual rate. */
  accrualRatePerMonth?: number;
  /** New carry-forward limit. */
  carryForwardLimit?: number;
  /** New carry-forward expiry (months). */
  carryForwardExpiryMonths?: number;
  /** New minimum days per request. */
  minDaysPerRequest?: number;
  /** New maximum days per request. */
  maxDaysPerRequest?: number;
  /** New advance-notice requirement (days). */
  advanceNoticeDays?: number;
  /** New attachment-required toggle. */
  requiresAttachment?: boolean;
  /** New attachment-required threshold (days). */
  attachmentRequiredAfterDays?: number;
  /** New applicable-genders value. */
  applicableGenders?: string;
  /** New minimum-service requirement (months). */
  minServiceMonths?: number;
  /** New half-day-allowed toggle. */
  allowHalfDay?: boolean;
  /** New paid/unpaid toggle. */
  isPaid?: boolean;
  /** New display sort order. */
  displayOrder?: number;
  /** New active/inactive state. */
  isActive?: boolean;
}

/**
 * Serializes an {@link UpdateLeavePolicyRequest} into the backend patch body.
 *
 * Emits only the fields that are set (sparse patch).
 *
 * @param dto - The patch request to serialize.
 * @returns A plain object containing only the provided fields.
 */
export function updateLeavePolicyToJson(
  dto: UpdateLeavePolicyRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (dto.leaveTypeName !== undefined) json.leaveTypeName = dto.leaveTypeName;
  if (dto.description !== undefined) json.description = dto.description;
  if (dto.annualQuota !== undefined) json.annualQuota = dto.annualQuota;
  if (dto.accrualRatePerMonth !== undefined)
    json.accrualRatePerMonth = dto.accrualRatePerMonth;
  if (dto.carryForwardLimit !== undefined)
    json.carryForwardLimit = dto.carryForwardLimit;
  if (dto.carryForwardExpiryMonths !== undefined)
    json.carryForwardExpiryMonths = dto.carryForwardExpiryMonths;
  if (dto.minDaysPerRequest !== undefined)
    json.minDaysPerRequest = dto.minDaysPerRequest;
  if (dto.maxDaysPerRequest !== undefined)
    json.maxDaysPerRequest = dto.maxDaysPerRequest;
  if (dto.advanceNoticeDays !== undefined)
    json.advanceNoticeDays = dto.advanceNoticeDays;
  if (dto.requiresAttachment !== undefined)
    json.requiresAttachment = dto.requiresAttachment;
  if (dto.attachmentRequiredAfterDays !== undefined)
    json.attachmentRequiredAfterDays = dto.attachmentRequiredAfterDays;
  if (dto.applicableGenders !== undefined)
    json.applicableGenders = dto.applicableGenders;
  if (dto.minServiceMonths !== undefined)
    json.minServiceMonths = dto.minServiceMonths;
  if (dto.allowHalfDay !== undefined) json.allowHalfDay = dto.allowHalfDay;
  if (dto.isPaid !== undefined) json.isPaid = dto.isPaid;
  if (dto.displayOrder !== undefined) json.displayOrder = dto.displayOrder;
  if (dto.isActive !== undefined) json.isActive = dto.isActive;
  return json;
}
