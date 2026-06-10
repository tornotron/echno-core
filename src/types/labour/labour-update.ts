import { EmploymentType, LabourStatus, SkillLevel } from './enums';

export interface LabourUpdateRequest {
  labourID?: string;
  fullName?: string;
  email?: string;
  address?: string;
  phoneNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialization?: string;
  employmentType?: EmploymentType;
  skillLevel?: SkillLevel;
  status?: LabourStatus;
  joiningDate?: string;
  currentProjectId?: number | null;
  dailyRate?: number;
  overTimeRate?: number;
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  additionalNotes?: string;
}
