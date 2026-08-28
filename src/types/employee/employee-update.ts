/**
 * @module types/employee/employee-update
 *
 * Request payload type and serializer for `PATCH /employee/web/{id}`.
 *
 * Every field is optional; only set fields are serialised, so the same
 * shape powers narrow patches (status flip, manager change) and broad
 * profile edits.
 */

import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { Department } from './departments';
import { EmployeeStatus } from './employee-status';

/**
 * Partial update payload for an existing {@link Employee}.
 *
 * `joiningDate`, `salary`, and `shiftTimingId` accept `null` to explicitly
 * clear the field; `undefined` leaves it untouched.
 */
export interface UpdateEmployeeRequest {
  /** New display name; serialised as `employeeName`. */
  name?: string;

  /** New email; serialised as `emailAddress`. */
  email?: string;

  /** New phone; serialised as `phoneNumber`. */
  phone?: string;

  /** Updated gender. */
  gender?: string;

  /** New date of birth. */
  dateOfBirth?: Date;

  /** New postal address. */
  address?: string;

  /** New qualification. */
  qualification?: string;

  /** Updated employee code. */
  employeeId?: string;

  /** New designation. */
  designation?: string;

  /** New {@link Department}. */
  department?: Department;

  /**
   * New joining date. Pass `null` to clear; `undefined` to leave unchanged.
   */
  joiningDate?: Date | null;

  /** Reassigned owning organization ID. */
  organizationId?: number;

  /**
   * New annual salary; rounded to one decimal in the wire payload. Pass
   * `null` to clear.
   */
  salary?: number | null;

  /** New reporting manager ID. */
  managerId?: number;

  /**
   * Surrogate ID of the newly-assigned {@link ShiftTiming}. Pass `null` to
   * clear; `undefined` to leave unchanged.
   */
  shiftTimingId?: number | null;

  /** New employment {@link EmployeeStatus}. */
  status?: EmployeeStatus;

  /** Updated skills list. */
  skills?: string[];

  /** Updated years of experience. */
  experience?: number;
}

/**
 * Serializes an {@link UpdateEmployeeRequest} into the backend's wire
 * format.
 *
 * Only fields that are not `undefined` are emitted, preserving partial-update
 * semantics. Field renames (`name → employeeName`, etc.) and
 * salary-as-`Double` coercion mirror {@link createEmployeeToJson}.
 *
 * @param dto - The partial update payload.
 * @returns A plain object containing only the explicitly set fields.
 */
export function updateEmployeeToJson(
  dto: UpdateEmployeeRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (dto.name !== undefined) payload.employeeName = dto.name;
  if (dto.email !== undefined) payload.emailAddress = dto.email;
  if (dto.phone !== undefined) payload.phoneNumber = dto.phone;
  if (dto.gender !== undefined) payload.gender = dto.gender;
  if (dto.dateOfBirth !== undefined)
    payload.dateOfBirth = toLocalDateAtMidnight(dto.dateOfBirth);
  if (dto.address !== undefined) payload.address = dto.address;
  if (dto.qualification !== undefined)
    payload.qualification = dto.qualification;
  if (dto.employeeId !== undefined) payload.employeeId = dto.employeeId;
  if (dto.designation !== undefined) payload.designation = dto.designation;
  if (dto.department !== undefined) payload.department = dto.department;
  if (dto.joiningDate !== undefined) {
    payload.joiningDate =
      dto.joiningDate === null ? null : toLocalDateAtMidnight(dto.joiningDate);
  }
  if (dto.organizationId !== undefined)
    payload.organizationId = dto.organizationId;
  if (dto.salary !== undefined) {
    payload.salary =
      dto.salary === null
        ? null
        : Number.parseFloat(Number(dto.salary).toFixed(1));
  }
  if (dto.managerId !== undefined) payload.managerId = dto.managerId;
  if (dto.shiftTimingId !== undefined) payload.shiftTimingId = dto.shiftTimingId;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.skills !== undefined) payload.skills = dto.skills;
  if (dto.experience !== undefined) payload.experience = dto.experience;

  return payload;
}
