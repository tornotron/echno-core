import { parsePositiveInt } from '../../lib/utils/parse-id';
import { EmploymentType, SkillLevel, LabourStatus } from './enums';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export interface Labour {
  id: number;
  labourId?: string;
  organizationId?: number;
  organizationName?: string;
  fullName?: string;
  email?: string;
  address?: string;
  phoneNumber?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  specialization?: string;
  employmentType?: EmploymentType;
  skillLevel?: SkillLevel;
  status?: LabourStatus;
  joiningDate?: string;
  currentProjectName?: string;
  currentProjectId?: number;
  dailyRate?: number;
  overTimeRate?: number;
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  additionalNotes?: string;
  // UI-only fields — never populated by parseLabour
  monthlyRate?: number;
  contractorName?: string;
  contractorPhone?: string;
  totalDue?: number;
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
