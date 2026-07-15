/**
 * @module types/leave/leave-policy-create
 *
 * The {@link CreateLeavePolicyRequest} payload and its serializer
 * {@link createLeavePolicyToJson} for creating a leave policy. See
 * `leave-policy-update.ts` for the patch counterpart.
 */

/** Fields required to create a leave policy. Optional fields fall back to backend defaults. */
export interface CreateLeavePolicyRequest {
  /** Owning organization. */
  organizationId: number;
  /** Short code for the leave type. */
  leaveTypeCode: string;
  /** Display name of the leave type. */
  leaveTypeName: string;
  /** Optional longer description. */
  description?: string;
  /** Days granted per year. */
  annualQuota: number;
  /** Days accrued per month. */
  accrualRatePerMonth?: number;
  /** Maximum days that may carry forward. */
  carryForwardLimit?: number;
  /** Months after which carried-forward balance expires. */
  carryForwardExpiryMonths?: number;
  /** Minimum days per single request. */
  minDaysPerRequest?: number;
  /** Maximum days per single request. */
  maxDaysPerRequest?: number;
  /** Required advance-notice days. */
  advanceNoticeDays?: number;
  /** Whether attachments are required. */
  requiresAttachment?: boolean;
  /** Days-per-request threshold above which an attachment is required. */
  attachmentRequiredAfterDays?: number;
  /** Genders the policy applies to. */
  applicableGenders?: string;
  /** Minimum months of service before eligibility. */
  minServiceMonths?: number;
  /** Whether half-day requests are allowed. */
  allowHalfDay?: boolean;
  /** Whether leave under this policy is paid. */
  isPaid?: boolean;
  /** Sort order for display. */
  displayOrder?: number;
}

/**
 * Serializes a {@link CreateLeavePolicyRequest} into the backend request body.
 *
 * The four required fields are always emitted; each optional field is included
 * only when set.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected body shape.
 */
export function createLeavePolicyToJson(
  dto: CreateLeavePolicyRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    organizationId: dto.organizationId,
    leaveTypeCode: dto.leaveTypeCode,
    leaveTypeName: dto.leaveTypeName,
    annualQuota: dto.annualQuota,
  };
  if (dto.description !== undefined) json.description = dto.description;
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
  return json;
}
