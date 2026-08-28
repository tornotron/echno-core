/**
 * @module types/employee/employee-create
 *
 * Request payload type and serializer for the (currently fictional) employee
 * create endpoint.
 *
 * @remarks
 * The backend exposes no plain employee POST today — employees are created
 * via `joinOrganization`. This shape is preserved against the day a direct
 * create endpoint lands; until then, the consuming
 * `useCreateEmployee` hook fails fast.
 */

import { toLocalDateAtMidnight } from '../../lib/utils/date-helpers';
import { Department } from './departments';

/**
 * Payload for creating a new {@link Employee}.
 *
 * Required fields mirror the minimum the backend would need to provision
 * an employee record once the endpoint exists. Optional scalars
 * (`salary`, `managerId`, etc.) may be omitted.
 */
export interface CreateEmployeeRequest {
  /** Full display name; serialised as `employeeName`. */
  name: string;

  /** Primary email; serialised as `emailAddress`. */
  email: string;

  /** Primary phone; serialised as `phoneNumber`. */
  phone: string;

  /** Reported gender. */
  gender: string;

  /** Date of birth. */
  dateOfBirth: Date;

  /** Postal address. */
  address: string;

  /** Highest qualification. */
  qualification: string;

  /** Externally-managed employee code (e.g. `EMP-0042`). */
  employeeId: string;

  /** Job title. */
  designation: string;

  /** Owning {@link Department}. */
  department: Department;

  /** Date the employee joined the organization. */
  joiningDate: Date;

  /** Owning organization ID. */
  organizationId: number;

  /** Annual salary; rounded to one decimal in the wire payload. */
  salary?: number;

  /** Surrogate ID of the reporting manager, if any. */
  managerId?: number;

  /** Surrogate ID of the assigned {@link ShiftTiming}; `null` to leave unassigned. */
  shiftTimingId?: number | null;

  /** Self-reported skills. */
  skills?: string[];

  /** Years of professional experience. */
  experience?: number;
}

/**
 * Serializes a {@link CreateEmployeeRequest} into the backend's wire format.
 *
 * Performs the user-side ↔ backend field renames (`name → employeeName`,
 * `email → emailAddress`, `phone → phoneNumber`) and coerces `salary` to a
 * one-decimal float so the Java backend deserialises it as `Double`.
 *
 * @param dto - The create request to serialize.
 * @returns A plain object matching the backend's expected request body.
 */
export function createEmployeeToJson(
  dto: CreateEmployeeRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    employeeName: dto.name,
    emailAddress: dto.email,
    phoneNumber: dto.phone,
    gender: dto.gender,
    dateOfBirth: toLocalDateAtMidnight(dto.dateOfBirth),
    address: dto.address,
    qualification: dto.qualification,
    employeeId: dto.employeeId,
    designation: dto.designation,
    department: dto.department,
    joiningDate: toLocalDateAtMidnight(dto.joiningDate),
    organizationId: dto.organizationId,
  };

  if (dto.salary !== undefined)
    payload.salary = Number.parseFloat(Number(dto.salary).toFixed(1));
  if (dto.managerId !== undefined) payload.managerId = dto.managerId;
  if (dto.shiftTimingId !== undefined) payload.shiftTimingId = dto.shiftTimingId;
  if (dto.skills !== undefined) payload.skills = dto.skills;
  if (dto.experience !== undefined) payload.experience = dto.experience;

  return payload;
}
