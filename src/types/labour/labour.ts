/**
 * @module labour
 *
 * Domain type and parser for the labour entity. {@link parseLabour}
 * normalises the two read shapes the backend exposes — `LabourDto` from
 * GET endpoints and `LabourSimpleDto` from the create response — into a
 * single canonical {@link Labour} object.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';
import { EmploymentType, SkillLevel, LabourStatus } from './enums';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * A labour worker record. Every field except `id` is optional because the
 * backend's `LabourSimpleDto` (returned from POST) omits several scalars that
 * `LabourDto` (returned from GET) populates.
 */
export interface Labour {
  /** Surrogate primary key. */
  id: number;

  /**
   * Human-facing worker code (e.g. payroll ID). Reconciles
   * `LabourDto.labourID` and `LabourSimpleDto.labourId` field-name drift
   * during parsing.
   */
  labourId?: string;

  /** Organisation that owns the labour record. */
  organizationId?: number;

  /** Denormalised organisation name for display. */
  organizationName?: string;

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

  /**
   * Phone number of the emergency contact. Reconciles
   * `LabourDto.emergencyContactNumber` and `LabourCreationDto.emergencyContactPhone`
   * field-name drift during parsing.
   */
  emergencyContactNumber?: string;

  /** Free-text specialisation (e.g. "mason", "electrician"). */
  specialization?: string;

  /** Engagement model — see {@link EmploymentType}. */
  employmentType?: EmploymentType;

  /** Trade-skill tier — see {@link SkillLevel}. */
  skillLevel?: SkillLevel;

  /** Employment lifecycle state — see {@link LabourStatus}. */
  status?: LabourStatus;

  /** Date the worker joined, ISO 8601 (`YYYY-MM-DD`). */
  joiningDate?: string;

  /** Denormalised name of the project the worker is currently assigned to. */
  currentProjectName?: string;

  /** Surrogate ID of the project the worker is currently assigned to. */
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

  /** Free-form notes attached to the labour record. */
  additionalNotes?: string;

  // UI-only fields — never populated by parseLabour

  /** UI-only convenience field; not parsed from any backend response. */
  monthlyRate?: number;

  /** UI-only convenience field; not parsed from any backend response. */
  contractorName?: string;

  /** UI-only convenience field; not parsed from any backend response. */
  contractorPhone?: string;

  /** UI-only convenience field; not parsed from any backend response. */
  totalDue?: number;

  /** UI-only convenience field; not parsed from any backend response. */
  totalPaid?: number;
}

const employmentTypeValues = new Set(Object.values(EmploymentType));
const skillLevelValues = new Set(Object.values(SkillLevel));
const labourStatusValues = new Set(Object.values(LabourStatus));

function parseEmploymentType(raw: unknown): EmploymentType | undefined {
  return typeof raw === 'string' &&
    employmentTypeValues.has(raw as EmploymentType)
    ? (raw as EmploymentType)
    : undefined;
}

function parseSkillLevel(raw: unknown): SkillLevel | undefined {
  return typeof raw === 'string' && skillLevelValues.has(raw as SkillLevel)
    ? (raw as SkillLevel)
    : undefined;
}

function parseLabourStatus(raw: unknown): LabourStatus | undefined {
  return typeof raw === 'string' && labourStatusValues.has(raw as LabourStatus)
    ? (raw as LabourStatus)
    : undefined;
}

/**
 * Parses a raw labour payload into a typed {@link Labour} domain object.
 *
 * Handles two distinct backend read shapes: `LabourDto` (full, returned by
 * GET endpoints) uses `labourID` and `emergencyContactNumber`;
 * `LabourSimpleDto` (partial, returned by POST) uses `labourId` and may
 * carry `emergencyContactPhone` from the create request shape. The parser
 * accepts either field-name variant so callers downstream see a single
 * canonical shape. Enum-valued fields fall back to `undefined` when the raw
 * value isn't a recognised member of {@link EmploymentType},
 * {@link SkillLevel}, or {@link LabourStatus}.
 *
 * @param raw - The untyped JSON object received from the backend.
 * @returns A canonical {@link Labour} domain object.
 * @throws {TypeError} If `raw.id` is missing or not a positive integer.
 */
export function parseLabour(raw: Raw): Labour {
  return {
    id: parsePositiveInt(raw.id, 'parseLabour.id'),
    // LabourDto uses "labourID" (uppercase); LabourSimpleDto uses "labourId"
    labourId: raw.labourId ?? raw.labourID,
    organizationId: raw.organizationId,
    organizationName: raw.organizationName,
    fullName: raw.fullName,
    email: raw.email,
    address: raw.address,
    phoneNumber: raw.phoneNumber,
    emergencyContactName: raw.emergencyContactName,
    // LabourDto uses "emergencyContactNumber"; LabourCreationDto uses "emergencyContactPhone"
    emergencyContactNumber:
      raw.emergencyContactNumber ?? raw.emergencyContactPhone,
    specialization: raw.specialization,
    employmentType: parseEmploymentType(raw.employmentType),
    skillLevel: parseSkillLevel(raw.skillLevel),
    status: parseLabourStatus(raw.status),
    joiningDate: raw.joiningDate,
    currentProjectName: raw.currentProjectName,
    currentProjectId:
      raw.currentProjectId == null ? undefined : Number(raw.currentProjectId),
    dailyRate: raw.dailyRate,
    overTimeRate: raw.overTimeRate,
    bankAccountNumber: raw.bankAccountNumber,
    bankName: raw.bankName,
    ifscCode: raw.ifscCode,
    additionalNotes: raw.additionalNotes,
  };
}
