/**
 * @module labour-update
 *
 * Request payload for `PATCH /labour/web/{id}`. Field names match the
 * backend's `LabourUpdateDto`; like {@link LabourCreateRequest} this carries
 * the wire-format spellings (`labourID`, `emergencyContactPhone`) which
 * {@link parseLabour} normalises on the read side.
 */
import { EmploymentType, LabourStatus, SkillLevel } from './enums';

/**
 * Payload shape accepted by the update-labour endpoint. Every field is
 * optional — only set fields are sent and applied. Pass `null` for
 * `currentProjectId` to detach the worker from the assigned project.
 */
export interface LabourUpdateRequest {
  /** Worker code (matches the wire-format `labourID` casing). */
  labourID?: string;

  /** Full legal name. */
  fullName?: string;

  /** Primary contact email. */
  email?: string;

  /** Postal address. */
  address?: string;

  /** Primary contact phone number. */
  phoneNumber?: string;

  /** Name of the emergency contact. */
  emergencyContactName?: string;

  /** Phone number of the emergency contact (wire-format spelling). */
  emergencyContactPhone?: string;

  /** Free-text specialisation. */
  specialization?: string;

  /** Engagement model — see {@link EmploymentType}. */
  employmentType?: EmploymentType;

  /** Trade-skill tier — see {@link SkillLevel}. */
  skillLevel?: SkillLevel;

  /** Employment lifecycle state — see {@link LabourStatus}. */
  status?: LabourStatus;

  /** Joining date in ISO 8601 (`YYYY-MM-DD`). */
  joiningDate?: string;

  /**
   * Surrogate ID of the project to assign the worker to. Pass `null`
   * explicitly to detach the worker from the current project; omit the
   * field to leave the assignment unchanged.
   */
  currentProjectId?: number | null;

  /** Daily wage rate in the organisation's base currency. */
  dailyRate?: number;

  /** Overtime hourly rate in the organisation's base currency. */
  overTimeRate?: number;

  /** Bank account number for payroll. */
  bankAccountNumber?: string;

  /** Bank name for payroll. */
  bankName?: string;

  /** IFSC code (or equivalent) of the payroll bank branch. */
  ifscCode?: string;

  /** Free-form notes attached to the labour record. */
  additionalNotes?: string;
}
