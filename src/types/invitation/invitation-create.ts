/**
 * @module invitation-create
 *
 * Request shape and serializer for generating an employee invite code via the
 * `project-invite-code-controller` (`POST /invitation/web/generateCode/organizationId/{organizationId}`).
 *
 * The `organizationId` travels in the URL path (see `invitationService.generateCode`);
 * this DTO carries only the request body fields.
 */

/**
 * Payload for generating a new employee invite code.
 *
 * `designation`, `department` and `managerId` are required; all other fields
 * are optional.
 */
export interface GenerateInviteCodeRequest {
  designation: string;
  department: string;
  employeeId?: string;
  employeeName?: string;
  email?: string;
  phone?: string;

  /**
   * @deprecated Not sent, and not settable through this endpoint.
   *
   * `InviteCodeGenerationDto` has no such field, and Spring is configured to
   * ignore unknown properties, so a value passed here was accepted and
   * discarded. The joining date is not the caller's to choose: the service
   * hardcodes `employeeDetails.put("joiningDate", LocalDateTime.now())` when
   * the code is generated, and reads that back when it is redeemed. So the
   * stored date is the moment the invite was created, whatever the form said.
   *
   * Kept on the interface rather than removed because `echno-web`'s invitation
   * form passes it, and dropping the property would fail its build rather than
   * its request. Removing it needs the form field to go first, or the backend
   * to start honouring it. See the follow-up issue.
   */
  joiningDate?: Date;

  salary?: number;

  /**
   * Reporting manager the invited person will report to once they redeem the
   * code. A newly created employee must have one (ClickUp 14zdkkvrf25,
   * backend #823), so the field is required. `null` is accepted for exactly
   * one case, the first employee of an organization that has no active
   * employee yet; the backend refuses `null` for any other organization with
   * a 400 that names `managerId`.
   */
  managerId: number | null;
  shiftTimingId?: number | null;
  status?: string;
  validityDays?: number;
  maxUses?: number;
}

/**
 * Serializes a {@link GenerateInviteCodeRequest} for transmission to the backend.
 *
 * Optional fields are omitted when unset. `status` defaults to `'active'`.
 *
 * @param request - The request to serialize.
 * @returns A plain object matching the backend's request body shape.
 */
export function generateInviteCodeToJson(
  request: GenerateInviteCodeRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    designation: request.designation,
    department: request.department,
    status: request.status || 'active',
  };

  if (request.employeeId) payload.employeeId = request.employeeId;
  if (request.employeeName) payload.employeeName = request.employeeName;
  if (request.email) payload.email = request.email;
  if (request.phone) payload.phone = request.phone;
  if (request.salary !== undefined) payload.salary = request.salary;
  if (request.managerId !== null) payload.managerId = request.managerId;
  if (request.shiftTimingId !== undefined)
    payload.shiftTimingId = request.shiftTimingId;
  if (request.validityDays !== undefined)
    payload.validityDays = request.validityDays;
  if (request.maxUses !== undefined) payload.maxUses = request.maxUses;

  return payload;
}
