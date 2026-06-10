/**
 * @module labour-create
 *
 * Request payload for `POST /labour/web`. Field names match the backend's
 * `LabourCreationDto` exactly, including the legacy spellings
 * (`labourID` uppercase, `emergencyContactPhone`) that {@link parseLabour}
 * later normalises on the read side.
 */
import { EmploymentType, SkillLevel } from './enums';

/**
 * Payload shape accepted by the create-labour endpoint. Every field other
 * than `joiningDate` is optional — the backend assigns sensible defaults
 * for fields the client omits.
 */
export interface LabourCreateRequest {
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

  /** Initial lifecycle state as a raw string. */
  status?: string;

  /** Joining date in ISO 8601 (`YYYY-MM-DD`). Required by the backend. */
  joiningDate: string;

  /** Surrogate ID of the project to assign the worker to on creation. */
  currentProjectId?: number;

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

  /** Free-form notes to attach to the new labour record. */
  additionalNotes?: string;
}
