/**
 * @module types/employee/employee
 *
 * Domain model and JSON (de)serialization helpers for the {@link Employee}
 * entity.
 *
 * The backend `EmployeeDto` denormalises user-side fields onto the employee
 * row (name, email, phone, etc.) so the frontend receives the full profile
 * in one shot — there is no separate user join. The parser handles the
 * field renames that come with this (`employeeName → name`,
 * `phoneNumber → phone`, `emailAddress → email`) and derives the
 * {@link Employee.cv} and {@link Employee.profilePicture} convenience
 * fields from {@link Employee.attachments}.
 *
 * Conventions:
 * - Date fields are normalised to `Date` instances.
 * - Numeric fields are coerced where the backend may send strings.
 * - Unknown or missing fields receive safe defaults so partial responses
 *   don't crash the UI.
 */

import { z } from 'zod';
import { Attachment, parseAttachment } from '../attachment';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { Project, parseProject, projectToJson } from '../project';
import { EmployeeStatus, employeeStatusFromString } from './employee-status';
import { Department } from './departments';
import { OrgRole, orgRoleFromString } from './org-role';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  backendDate,
  money,
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';

/**
 * Shape of the backend `EmployeeDto` at the parse boundary. Validates field types
 * so a malformed payload fails fast instead of becoming fabricated values. Ids
 * stay `opaque` and are validated by `parsePositiveInt`; polymorphic blobs
 * (attachments, projects) are handed to their own parsers.
 */
const EmployeeResponseSchema = z.object({
  id: opaque,
  employeeName: nullableString,
  address: nullableString,
  bloodGroup: nullableString,
  emailAddress: nullableString,
  phoneNumber: nullableString,
  gender: nullableString,
  dateOfBirth: backendDate,
  qualification: nullableString,
  skills: z.array(z.string()).nullish(),
  experience: money,
  emergencyContact: nullableString,
  orgRoles: z.array(z.string()).nullish(),
  attachments: z.array(z.unknown()).nullish(),
  employeeId: nullableString,
  organizationId: opaque,
  organizationName: nullableString,
  designation: nullableString,
  department: nullableString,
  joiningDate: backendDate,
  salary: money,
  managerId: optionalNumericId,
  managerName: nullableString,
  shiftTiming: nullableString,
  status: nullableString,
  certifications: z.array(z.string()).nullish(),
  currentProjects: z.array(z.unknown()).nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

/**
 * Authenticated user's employee record within a single organization.
 *
 * Combines the user-side identity fields (returned denormalised by the
 * backend) with employee-specific fields (designation, manager, status,
 * etc.). Multiple `Employee` rows exist per `User` — one per organization
 * the user belongs to.
 */
export interface Employee {
  // ── User-side fields (denormalised onto the employee row) ──

  /** Surrogate primary key. */
  id: number;

  /** Full display name. Parsed from `employeeName`. */
  name: string;

  /** Postal address. */
  address: string;

  /** Blood group. */
  bloodGroup?: string;

  /** Primary email. Parsed from `emailAddress`. */
  email: string;

  /** Primary phone. Parsed from `phoneNumber`. */
  phone: string;

  /** Reported gender. */
  gender: string;

  /** Date of birth. Defaults to "now" when missing — caller must validate. */
  dateOfBirth: Date;

  /** Highest qualification. */
  qualification: string;

  /** Self-reported skills. */
  skills?: string[];

  /** Years of professional experience. */
  experience?: number;

  /** Free-text emergency contact. */
  emergencyContact?: string;

  /**
   * Authorisation roles assigned to this employee. Unknown values are
   * silently dropped during parse (see {@link orgRoleFromString}).
   */
  orgRoles: OrgRole[];

  /** Full attachment list returned by the backend. */
  attachments?: Attachment[];

  /**
   * Most recent attachment of type `USER_CV`, derived from
   * {@link Employee.attachments} by {@link parseEmployee}.
   */
  cv?: Attachment;

  /**
   * Most recent attachment of type `USER_PROFILE_PICTURE`, derived from
   * {@link Employee.attachments} by {@link parseEmployee}.
   */
  profilePicture?: Attachment;

  // ── Employee-specific fields ──

  /** Externally-managed employee code (e.g. `EMP-0042`). */
  employeeId: string;

  /** Owning organization ID. */
  organizationId: number;

  /** Denormalised organization name; refreshed on org rename. */
  organizationName?: string;

  /** Job title. */
  designation: string;

  /** Owning {@link Department}, if assigned. */
  department?: Department;

  /** Annual salary; `null` when intentionally cleared. */
  salary?: number | null;

  /** Surrogate ID of the reporting manager. */
  managerId?: number;

  /** Denormalised manager display name. */
  managerName?: string;

  /** Default shift code (e.g. `'morning'`); `null` when cleared. */
  shiftTiming?: string | null;

  /** Current employment {@link EmployeeStatus}. */
  status: EmployeeStatus;

  /** Certification labels. */
  certifications?: string[];

  /** Date the employee joined the organization; `null` when cleared. */
  joiningDate?: Date | null;

  /** Projects the employee is currently assigned to. */
  currentProjects?: Project[];

  /** Record creation timestamp. */
  createdAt?: Date;

  /** Record last-modification timestamp. */
  updatedAt?: Date;
}

// Note: employeeFromUser removed - backend returns complete employee data
// No need to merge user and employee data separately

/**
 * Parses a raw `EmployeeDto` payload into a typed {@link Employee} domain
 * object.
 *
 * Applies the user-side ↔ backend field renames (`employeeName → name`,
 * `phoneNumber → phone`, `emailAddress → email`), narrows `orgRoles`
 * strings to known {@link OrgRole} values (silently dropping unknown
 * tokens), and derives the {@link Employee.cv} /
 * {@link Employee.profilePicture} convenience references from the
 * attachment list (latest by `createdAt` when multiple of the same type
 * exist).
 *
 * @param json - Raw JSON object received from the backend.
 * @returns A validated {@link Employee} domain object.
 * @throws {TypeError} If `json.id` or `json.organizationId` is missing or
 *   not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEmployee(json: unknown): Employee {
  const raw = EmployeeResponseSchema.parse(json);

  // Parse attachments array from backend
  const attachments: Attachment[] | undefined = raw.attachments
    ? raw.attachments.map((att) => parseAttachment(att))
    : undefined;

  // Extract profile picture — use latest by createdAt if multiple exist
  const profilePictureAttachments = attachments?.filter(
    (att) => att.entityType === 'USER_PROFILE_PICTURE'
  );
  const profilePicture =
    profilePictureAttachments && profilePictureAttachments.length > 0
      ? profilePictureAttachments.toSorted(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
      : undefined;

  // Extract CV — use latest by createdAt if multiple exist
  const cvAttachments = attachments?.filter(
    (att) => att.entityType === 'USER_CV'
  );
  const cv =
    cvAttachments && cvAttachments.length > 0
      ? cvAttachments.toSorted(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
      : undefined;

  const id = parsePositiveInt(raw.id, 'parseEmployee.id');

  return {
    id,
    name: raw.employeeName ?? '',
    address: raw.address ?? '',
    bloodGroup: raw.bloodGroup ?? undefined,
    email: raw.emailAddress ?? '',
    phone: raw.phoneNumber ?? '',
    gender: raw.gender ?? '',
    dateOfBirth: parseUTCDate(raw.dateOfBirth) ?? new Date(),
    qualification: raw.qualification ?? '',
    skills: raw.skills ? [...raw.skills] : undefined,
    experience: raw.experience ?? undefined,
    emergencyContact: raw.emergencyContact ?? undefined,
    orgRoles: raw.orgRoles
      ? raw.orgRoles
          .map((role) => orgRoleFromString(role))
          .filter((r): r is OrgRole => r !== undefined)
      : [],
    attachments,
    cv,
    profilePicture,
    employeeId: raw.employeeId ?? String(id),
    organizationId: parsePositiveInt(
      raw.organizationId,
      'parseEmployee.organizationId'
    ),
    organizationName: raw.organizationName ?? undefined,
    designation: raw.designation ?? '',
    department:
      raw.department && raw.department in Department
        ? Department[raw.department as keyof typeof Department]
        : undefined,
    joiningDate: parseUTCDate(raw.joiningDate) ?? undefined,
    salary: raw.salary ?? undefined,
    managerId: raw.managerId ?? undefined,
    managerName: raw.managerName ?? undefined,
    shiftTiming: raw.shiftTiming ?? undefined,
    status: employeeStatusFromString(raw.status ?? 'active'),
    certifications: raw.certifications ? [...raw.certifications] : undefined,
    currentProjects: raw.currentProjects
      ? raw.currentProjects.map((p) => parseProject(p))
      : undefined,
    createdAt: parseUTCDate(raw.createdAt) ?? undefined,
    updatedAt: parseUTCDate(raw.updatedAt) ?? undefined,
  };
}

/**
 * Serializes a full or partial {@link Employee} into the backend's wire
 * format.
 *
 * Performs the inverse of {@link parseEmployee}'s field renames
 * (`name → employeeName`, etc.) and rounds `salary` to a one-decimal float
 * so the Java backend deserialises it as `Double`. Only fields that are
 * not `undefined` are emitted; `null` is preserved as an explicit clear.
 *
 * @param emp - The employee (or partial employee) to serialize.
 * @returns A plain object matching the backend's expected request body.
 */
export function employeeToJson(
  emp: Employee | Partial<Employee>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Only include fields that are defined
  if (emp.name !== undefined) result.employeeName = emp.name;
  if (emp.phone !== undefined) result.phoneNumber = emp.phone;
  if (emp.email !== undefined) result.emailAddress = emp.email;
  if (emp.address !== undefined) result.address = emp.address;
  if (emp.bloodGroup !== undefined) result.bloodGroup = emp.bloodGroup;
  if (emp.gender !== undefined) result.gender = emp.gender;
  if (emp.dateOfBirth !== undefined)
    result.dateOfBirth = emp.dateOfBirth.toISOString();
  if (emp.qualification !== undefined) result.qualification = emp.qualification;
  if (emp.skills !== undefined) result.skills = emp.skills;
  if (emp.experience !== undefined) result.experience = emp.experience;
  if (emp.emergencyContact !== undefined)
    result.emergencyContact = emp.emergencyContact;
  if (emp.orgRoles !== undefined) result.orgRoles = emp.orgRoles;
  if (emp.employeeId !== undefined) result.employeeId = emp.employeeId;
  if (emp.organizationId !== undefined)
    result.organizationId = emp.organizationId;
  if (emp.organizationName !== undefined)
    result.organizationName = emp.organizationName;
  if (emp.designation !== undefined) result.designation = emp.designation;
  if (emp.department !== undefined) result.department = emp.department;
  if (emp.joiningDate !== undefined) {
    result.joiningDate =
      emp.joiningDate === null ? null : emp.joiningDate.toISOString();
  }
  // Ensure salary is treated as a floating-point number by the backend
  if (emp.salary !== undefined) {
    // Parse as float with fixed precision to ensure Java backend treats it as Double
    result.salary =
      emp.salary === null
        ? null
        : Number.parseFloat(Number(emp.salary).toFixed(1));
  }
  if (emp.managerId !== undefined) result.managerId = emp.managerId;
  if (emp.managerName !== undefined) result.managerName = emp.managerName;
  if (emp.shiftTiming !== undefined) result.shiftTiming = emp.shiftTiming;
  if (emp.status !== undefined) result.status = emp.status;
  if (emp.certifications !== undefined)
    result.certifications = emp.certifications;
  if (emp.currentProjects !== undefined) {
    result.currentProjects = emp.currentProjects.map((p) => projectToJson(p));
  }
  if (emp.createdAt !== undefined)
    result.createdAt = emp.createdAt.toISOString();
  if (emp.updatedAt !== undefined)
    result.updatedAt = emp.updatedAt.toISOString();

  return result;
}

/**
 * Returns whether the employee is currently {@link EmployeeStatus.active}.
 *
 * @param emp - The employee to check.
 * @returns `true` when the employee is in the `active` state.
 */
export function isActive(emp: Employee): boolean {
  return emp.status === EmployeeStatus.active;
}
