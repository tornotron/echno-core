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
 * `designation` and `department` are required; all other fields are optional.
 */
export interface GenerateInviteCodeRequest {
  designation: string;
  department: string;
  employeeId?: string;
  employeeName?: string;
  email?: string;
  phone?: string;
  joiningDate?: Date;
  salary?: number;
  managerId?: number;
  shiftTiming?: string;
  status?: string;
  validityDays?: number;
  maxUses?: number;
}

/**
 * Serializes a {@link GenerateInviteCodeRequest} for transmission to the backend.
 *
 * Optional fields are omitted when unset. `status` defaults to `'active'`.
 * `joiningDate` is serialized to an ISO 8601 string.
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
  if (request.joiningDate)
    payload.joiningDate = request.joiningDate.toISOString();
  if (request.salary !== undefined) payload.salary = request.salary;
  if (request.managerId !== undefined) payload.managerId = request.managerId;
  if (request.shiftTiming) payload.shiftTiming = request.shiftTiming;
  if (request.validityDays !== undefined)
    payload.validityDays = request.validityDays;
  if (request.maxUses !== undefined) payload.maxUses = request.maxUses;

  return payload;
}
