/**
 * @module document-ingestion-registers
 *
 * The registers accepted Document Ingestion values are applied to, and the typed payload readers of
 * the kinds that feed them:
 *
 * - `CONTRACT_TERM` and `OBLIGATION` go to the contract registers, with a coverage read naming the
 *   pages searched for each term not found. Either can raise one project risk.
 * - `DRAWING` goes to the drawing register, one row per number and revision, linked in revision
 *   order with the newest read revision current.
 * - `QUALITY_REQUIREMENT` goes to the per-project inspection and test plan (ITP), whose rows can be
 *   copied into the checklist template of their trade.
 * - `QUALIFICATION_REQUIREMENT` goes to the qualification register and is compared with the
 *   organization's company profile in the Tender Compliance Matrix (`MATCH`, `GAP` or `UNKNOWN`).
 *
 * Every parser is non-strict and every payload reader never throws, as in `document-ingestion`.
 */

import { z } from 'zod';
import { PresignedUpload, parsePresignedUpload } from '../attachment';
import type { RiskImpact, RiskProbability, RiskResponseType } from '../risk';
import {
  backendDate,
  money,
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';
import { type Candidate, type PackageStage, type SourceRef, parseSourceRef } from './document-ingestion';
import { payloadInt, payloadText, payloadTextList } from './payload-values';

// ------------------------------------------------------------------------------------------ enums

/** The natural key of a `CONTRACT_TERM` candidate: the 19 terms read from the conditions of contract. */
export type ContractTermKey =
  | 'duration'
  | 'mobilization'
  | 'emd'
  | 'performance_security'
  | 'retention'
  | 'advance'
  | 'payment_cycle'
  | 'payment_period'
  | 'ld_rate'
  | 'ld_cap'
  | 'dlp'
  | 'insurance'
  | 'escalation'
  | 'subcontracting'
  | 'extension_of_time'
  | 'variation'
  | 'dispute_resolution'
  | 'applicable_law'
  | 'termination';
export const CONTRACT_TERM_KEYS: readonly ContractTermKey[] = [
  'duration',
  'mobilization',
  'emd',
  'performance_security',
  'retention',
  'advance',
  'payment_cycle',
  'payment_period',
  'ld_rate',
  'ld_cap',
  'dlp',
  'insurance',
  'escalation',
  'subcontracting',
  'extension_of_time',
  'variation',
  'dispute_resolution',
  'applicable_law',
  'termination',
];

/** Whether a term was found in the parts read, found nowhere, or sits in a part not read. */
export type TermCoverageStatus = 'FOUND' | 'NOT_FOUND' | 'NOT_READ';

/** `NOT_READ` is a sheet whose title block could not be read, such as a DWG. */
export type DrawingStatus = 'READ' | 'NOT_READ';
export type DrawingSourceFormat = 'PDF' | 'DXF' | 'DWG';

/** What copying one ITP row into a checklist template did. */
export type CopyRowOutcomeCode = 'COPIED' | 'ALREADY_COPIED' | 'NO_TRADE' | 'NOT_FOUND';

/**
 * The type of a `QUALIFICATION_REQUIREMENT`, the part of its natural key before the first `|`. The
 * first three are compared with the company profile automatically; equipment and personnel are text,
 * so a person sets their status.
 */
export type QualificationRequirementKey = 'turnover' | 'similar_projects' | 'experience' | 'equipment' | 'personnel';
export const QUALIFICATION_REQUIREMENT_KEYS: readonly QualificationRequirementKey[] = [
  'turnover',
  'similar_projects',
  'experience',
  'equipment',
  'personnel',
];
/** The qualification requirements a person sets the status of. */
export const QUALIFICATION_KEYS_SET_BY_PERSON: readonly QualificationRequirementKey[] = ['equipment', 'personnel'];

/** A row of the Tender Compliance Matrix. */
export type MatrixStatus = 'MATCH' | 'GAP' | 'UNKNOWN';
export const MATRIX_STATUSES: readonly MatrixStatus[] = ['MATCH', 'GAP', 'UNKNOWN'];

/** How a matrix row's status was reached. */
export type MatrixBasis = 'COMPARED' | 'SET_BY_PERSON' | 'AWAITING_PERSON' | 'PROFILE_BLANK' | 'NOT_READABLE';

/** The part of the company profile an evidence file supports. */
export type EvidenceSection = 'TURNOVER' | 'SIMILAR_PROJECTS' | 'EXPERIENCE' | 'EQUIPMENT' | 'PERSONNEL' | 'OTHER';
export const EVIDENCE_SECTIONS: readonly EvidenceSection[] = [
  'TURNOVER',
  'SIMILAR_PROJECTS',
  'EXPERIENCE',
  'EQUIPMENT',
  'PERSONNEL',
  'OTHER',
];

// ------------------------------------------------------------------------------------------ shapes

/** One accepted contract term in the package's register. */
export interface ContractTermEntry {
  id: string;
  packageId: string;
  projectId?: number;
  candidateId: string;
  documentId: string;
  /** The term's key; a key this client does not know is kept as it came. */
  term: ContractTermKey | string;
  label: string;
  /** The value as printed. */
  value: string;
  clause?: string;
  /** The class of the part it was read from: `GCC`, `SCC` or `CONTRACT_DATA`. */
  sourceClass?: string;
  /** The project risk raised from it, once one is. */
  riskId?: string;
  updatedAt?: string;
}

/** One confirmed part of a package searched for contract terms. */
export interface ContractReadPart {
  documentId: string;
  segmentId: string;
  fileName: string;
  docClass: string;
  status: string;
  /** The pages searched, as a range such as "12-48". */
  pagesSearched?: string;
  pagesNotRead: number[];
}

/** One value found for a term, from one part of the package. */
export interface FoundTermValue {
  candidateId: string;
  value: string;
  clause?: string;
  docClass: string;
  status: string;
  /** A general-conditions value the special conditions or contract data restate. */
  overridden: boolean;
  supersedesCandidateId?: string;
}

/** One term's coverage: every value found for it, or why none was. */
export interface TermCoverage {
  term: ContractTermKey | string;
  label: string;
  status: TermCoverageStatus;
  message?: string;
  /** The candidate proposed for the term when values from more than one part were found. */
  proposedCandidateId?: string;
  found: FoundTermValue[];
}

/** Which of the 19 contract terms were found in a package, and the parts searched. */
export interface ContractTermCoverage {
  notice?: string;
  read: ContractReadPart[];
  terms: TermCoverage[];
}

/** One accepted obligation with a stated deadline. */
export interface ObligationEntry {
  id: string;
  packageId: string;
  projectId?: number;
  candidateId: string;
  documentId: string;
  clause?: string;
  /** The time limit as printed, such as "21 days". */
  deadline: string;
  /** The time limit in calendar days, when it reads plainly as days or weeks. */
  deadlineDays?: number;
  responsibleParty?: string;
  trigger?: string;
  requiredDocument?: string;
  financialImpact?: string;
  topic?: string;
  sourceClass?: string;
  riskId?: string;
  updatedAt?: string;
}

/**
 * Body of `POST /contract-terms/{id}/risk` and `POST /obligations/{id}/risk`. Every field may be left
 * out: the title then names the term or obligation and its clause, the category is
 * `contractual-legal`, probability `medium`, impact `moderate` and response `mitigate`.
 */
export interface RaiseRiskRequest {
  title?: string;
  category?: string;
  probability?: RiskProbability;
  impact?: RiskImpact;
  responseType?: RiskResponseType;
  owner?: string;
}

/** The risk raised from a term or an obligation. `created` is false when it had one already. */
export interface RaisedRisk {
  riskId: string;
  riskNumber: string;
  projectId: number;
  created: boolean;
}

/** One line of a drawing's printed revision history, oldest first. */
export interface DrawingRevisionNote {
  revision?: string;
  date?: string;
  description?: string;
}

/** One drawing at one revision in the package's register. */
export interface DrawingEntry {
  id: string;
  packageId: string;
  projectId?: number;
  candidateId: string;
  documentId: string;
  drawingNumber: string;
  title?: string;
  discipline?: string;
  revision?: string;
  /** The revision date when the printed text reads plainly as one (`YYYY-MM-DD`). */
  revisionDate?: string;
  revisionDateText?: string;
  scale?: string;
  /** The PDF page the sheet is on; absent for a DXF or DWG. */
  sheetPage?: number;
  /** The DXF layout the title block sits in. */
  layout?: string;
  sourceFormat: DrawingSourceFormat | string;
  status: DrawingStatus;
  /** The newest read revision of its number. */
  current: boolean;
  supersedesId?: string;
  supersededById?: string;
  /** Whether a title-block image can be fetched for it. */
  cropAvailable: boolean;
  revisionHistory: DrawingRevisionNote[];
  note?: string;
  updatedAt?: string;
}

export interface DrawingListParams {
  /** Only the current revision of each number. */
  currentOnly?: boolean;
  page?: number;
  size?: number;
}

/** One row of a project's inspection and test plan (ITP). */
export interface QualityRequirementEntry {
  id: string;
  packageId: string;
  projectId?: number;
  candidateId: string;
  documentId?: string;
  /** The material or subject as printed; the candidate's natural key. */
  subject: string;
  activity?: string;
  material?: string;
  grade?: string;
  standards: string[];
  test?: string;
  frequency?: string;
  acceptanceCriterion?: string;
  holdOrWitnessPoint?: string;
  requiredDocuments: string[];
  /** The fields the specification states nothing for, such as `frequency`. */
  notStated: string[];
  sourceClass?: string;
  /** The organization's trade it was matched to when applied. */
  tradeId?: string;
  tradeCode?: string;
  tradeName?: string;
  /** Set once the row was copied into a checklist template. */
  templateId?: string;
  templateItemId?: string;
  templateVersion?: number;
  copiedAt?: string;
  citations: SourceRef[];
  updatedAt?: string;
}

/**
 * Body of `POST /quality-requirements/copy-to-template`. `requirementIds` are ITP row ids (not candidate
 * ids), at most 200. Without `tradeId` each row goes into the template of its matched trade and a row
 * with no trade is skipped; with it, every row goes into that trade's template.
 */
export interface CopyToTemplateRequest {
  requirementIds: string[];
  tradeId?: string | null;
}

/** What copying one ITP row did. */
export interface CopyRowOutcome {
  requirementId: string;
  outcome: CopyRowOutcomeCode;
  message?: string;
  templateId?: string;
  templateItemId?: string;
}

/** One checklist template a copy wrote to. */
export interface TemplateCopy {
  templateId: string;
  templateName: string;
  tradeId: string;
  tradeName: string;
  version: number;
  active: boolean;
  /** Whether the template was made by this copy. */
  created: boolean;
  itemsAdded: number;
}

export interface CopyToTemplateResult {
  rows: CopyRowOutcome[];
  templates: TemplateCopy[];
}

/** One accepted bidder qualification requirement. */
export interface QualificationRequirementEntry {
  id: string;
  packageId: string;
  candidateId: string;
  documentId: string;
  requirement: QualificationRequirementKey | string;
  label: string;
  /** The amount, count, years or list as printed. */
  value: string;
  /** Similar projects only: the value each work must reach, as printed. */
  minValue?: string;
  /** Turnover and similar projects: the years counted over, as printed. */
  period?: string;
  sourceClass?: string;
  /** Turnover, similar projects and experience are compared with the profile; the others are set by a person. */
  comparedAutomatically: boolean;
  personStatus?: MatrixStatus;
  personNote?: string;
  statusSetBy?: number;
  statusSetAt?: string;
  updatedAt?: string;
}

/** Body of `PUT /qualification-requirements/{id}/status`. A null status clears it. */
export interface RequirementStatusRequest {
  status: MatrixStatus | null;
  note?: string | null;
}

/** An evidence file named on a matrix row. */
export interface ComplianceEvidenceRef {
  id: string;
  fileName: string;
  label?: string;
}

/** One requirement of the tender against what the company profile holds. */
export interface ComplianceMatrixRow {
  requirementId: string;
  candidateId: string;
  documentId: string;
  requirement: QualificationRequirementKey | string;
  label: string;
  tenderValue: string;
  companyValue?: string;
  status: MatrixStatus;
  basis: MatrixBasis | string;
  reason?: string;
  statusNote?: string;
  statusSetBy?: number;
  statusSetAt?: string;
  evidence: ComplianceEvidenceRef[];
}

/** The Tender Compliance Matrix of a package. While `shown` is false, `notice` says why there are no rows. */
export interface ComplianceMatrix {
  packageId: string;
  stage?: PackageStage;
  shown: boolean;
  notice?: string;
  rows: ComplianceMatrixRow[];
}

export interface TurnoverYear {
  /** As the company writes it, such as "2025-26". */
  financialYear: string;
  amount: number;
}

export interface SimilarProject {
  name: string;
  client?: string;
  value?: number;
  completedYear?: number;
  description?: string;
}

export interface EquipmentItem {
  name: string;
  quantity?: number;
  details?: string;
}

export interface PersonnelEntry {
  role: string;
  name?: string;
  qualification?: string;
  experienceYears?: number;
}

/** A file kept as evidence for one section of the company profile. */
export interface CompanyEvidence {
  id: string;
  section: EvidenceSection;
  label?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** False until the file is registered after its PUT. */
  uploaded: boolean;
  createdAt?: string;
}

/** The organization's company profile. `id` is absent while nothing has been saved. */
export interface CompanyProfile {
  id?: string;
  yearsInBusiness?: number;
  turnover: TurnoverYear[];
  similarProjects: SimilarProject[];
  equipment: EquipmentItem[];
  personnel: PersonnelEntry[];
  evidence: CompanyEvidence[];
  updatedBy?: number;
  updatedAt?: string;
}

/**
 * Body of `PUT /document-ingestion/company-profile`: the whole profile, replacing what was saved.
 * Evidence files are added and removed through their own calls and are kept. A field left empty
 * shows as `UNKNOWN` in the matrix.
 */
export interface CompanyProfileRequest {
  yearsInBusiness?: number | null;
  turnover?: TurnoverYear[];
  similarProjects?: SimilarProject[];
  equipment?: EquipmentItem[];
  personnel?: PersonnelEntry[];
}

/** Body of `POST /document-ingestion/company-profile/evidence/presign`. */
export interface PresignEvidenceRequest {
  section: EvidenceSection;
  fileName: string;
  fileSize: number;
  contentType?: string;
  label?: string;
}

/** Where to PUT an evidence file, and the evidence to register once it is there. */
export interface EvidenceUpload {
  evidenceId: string;
  upload: PresignedUpload;
}

/** A `CONTRACT_TERM` candidate's payload. */
export interface ContractTermPayload {
  /** The candidate's natural key. */
  term?: ContractTermKey | string;
  value?: string;
  clause?: string;
}

/** An `OBLIGATION` candidate's payload. Every value is text as printed. */
export interface ObligationPayload {
  clause?: string;
  deadline?: string;
  responsibleParty?: string;
  topic?: string;
  trigger?: string;
  requiredDocument?: string;
  financialImpact?: string;
}

/** A `DRAWING` candidate's payload: the title-block fields as printed, and where the sheet came from. */
export interface DrawingPayload {
  drawingNumber?: string;
  title?: string;
  discipline?: string;
  revision?: string;
  date?: string;
  scale?: string;
  revisionHistory: DrawingRevisionNote[];
  sheetPage?: number;
  layout?: string;
  sourceFormat?: DrawingSourceFormat | string;
}

/** A `QUALITY_REQUIREMENT` candidate's payload. `standards` and `requiredDocuments` are lists. */
export interface QualityRequirementPayload {
  /** The candidate's natural key: the material or subject as printed. */
  subject?: string;
  activity?: string;
  material?: string;
  grade?: string;
  standards: string[];
  test?: string;
  frequency?: string;
  acceptanceCriterion?: string;
  holdOrWitnessPoint?: string;
  requiredDocuments: string[];
}

/** A `QUALIFICATION_REQUIREMENT` candidate's payload. */
export interface QualificationRequirementPayload {
  /** The type, from the natural key before its first `|`. */
  requirement?: QualificationRequirementKey | string;
  value?: string;
  minValue?: string;
  period?: string;
}

// ------------------------------------------------------------------------------------------ schemas

const id = z.union([z.string(), z.number()]).transform(String);
const optionalId = z.union([z.string(), z.number()]).nullish();
const textList = z.array(z.unknown()).nullish();

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);
const optString = (value: string | number | null | undefined): string | undefined =>
  value === null || value === undefined ? undefined : String(value);
const strings = (values: unknown[] | null | undefined): string[] =>
  (values ?? []).filter((v): v is string => typeof v === 'string');

const ContractTermEntrySchema = z.object({
  id,
  packageId: optionalId,
  projectId: nullableNumber,
  candidateId: optionalId,
  documentId: optionalId,
  term: nullableString,
  label: nullableString,
  value: nullableString,
  clause: nullableString,
  sourceClass: nullableString,
  riskId: optionalId,
  updatedAt: backendDate,
});

const ReadPartSchema = z.object({
  documentId: optionalId,
  segmentId: optionalId,
  fileName: nullableString,
  docClass: nullableString,
  status: nullableString,
  pagesSearched: nullableString,
  pagesNotRead: z.array(z.number()).nullish(),
});

const FoundValueSchema = z.object({
  candidateId: optionalId,
  value: nullableString,
  clause: nullableString,
  docClass: nullableString,
  status: nullableString,
  overridden: nullableBoolean,
  supersedesCandidateId: optionalId,
});

const TermCoverageSchema = z.object({
  term: nullableString,
  label: nullableString,
  status: nullableString,
  message: nullableString,
  proposedCandidateId: optionalId,
  found: z.array(z.unknown()).nullish(),
});

const CoverageSchema = z.object({
  notice: nullableString,
  read: z.array(z.unknown()).nullish(),
  terms: z.array(z.unknown()).nullish(),
});

const ObligationEntrySchema = z.object({
  id,
  packageId: optionalId,
  projectId: nullableNumber,
  candidateId: optionalId,
  documentId: optionalId,
  clause: nullableString,
  deadline: nullableString,
  deadlineDays: nullableNumber,
  responsibleParty: nullableString,
  trigger: nullableString,
  requiredDocument: nullableString,
  financialImpact: nullableString,
  topic: nullableString,
  sourceClass: nullableString,
  riskId: optionalId,
  updatedAt: backendDate,
});

const RaisedRiskSchema = z.object({
  riskId: id,
  riskNumber: z.union([z.string(), z.number()]).nullish(),
  projectId: nullableNumber,
  created: nullableBoolean,
});

const RevisionNoteSchema = z.looseObject({ revision: payloadText, date: payloadText, description: payloadText });

const DrawingEntrySchema = z.object({
  id,
  packageId: optionalId,
  projectId: nullableNumber,
  candidateId: optionalId,
  documentId: optionalId,
  drawingNumber: nullableString,
  title: nullableString,
  discipline: nullableString,
  revision: nullableString,
  revisionDate: backendDate,
  revisionDateText: nullableString,
  scale: nullableString,
  sheetPage: nullableNumber,
  layout: nullableString,
  sourceFormat: nullableString,
  status: nullableString,
  current: nullableBoolean,
  supersedesId: optionalId,
  supersededById: optionalId,
  cropAvailable: nullableBoolean,
  revisionHistory: z.array(z.unknown()).nullish(),
  note: nullableString,
  updatedAt: backendDate,
});

const QualityRequirementEntrySchema = z.object({
  id,
  packageId: optionalId,
  projectId: nullableNumber,
  candidateId: optionalId,
  documentId: optionalId,
  subject: nullableString,
  activity: nullableString,
  material: nullableString,
  grade: nullableString,
  standards: textList,
  test: nullableString,
  frequency: nullableString,
  acceptanceCriterion: nullableString,
  holdOrWitnessPoint: nullableString,
  requiredDocuments: textList,
  notStated: textList,
  sourceClass: nullableString,
  tradeId: optionalId,
  tradeCode: nullableString,
  tradeName: nullableString,
  templateId: optionalId,
  templateItemId: optionalId,
  templateVersion: nullableNumber,
  copiedAt: backendDate,
  citations: z.array(z.unknown()).nullish(),
  updatedAt: backendDate,
});

const RowOutcomeSchema = z.object({
  requirementId: id,
  outcome: nullableString,
  message: nullableString,
  templateId: optionalId,
  templateItemId: optionalId,
});

const TemplateCopySchema = z.object({
  templateId: id,
  templateName: nullableString,
  tradeId: optionalId,
  tradeName: nullableString,
  version: nullableNumber,
  active: nullableBoolean,
  created: nullableBoolean,
  itemsAdded: nullableNumber,
});

const QualificationEntrySchema = z.object({
  id,
  packageId: optionalId,
  candidateId: optionalId,
  documentId: optionalId,
  requirement: nullableString,
  label: nullableString,
  value: nullableString,
  minValue: nullableString,
  period: nullableString,
  sourceClass: nullableString,
  comparedAutomatically: nullableBoolean,
  personStatus: nullableString,
  personNote: nullableString,
  statusSetBy: nullableNumber,
  statusSetAt: backendDate,
  updatedAt: backendDate,
});

const MatrixEvidenceSchema = z.object({ id, fileName: nullableString, label: nullableString });

const MatrixRowSchema = z.object({
  requirementId: id,
  candidateId: optionalId,
  documentId: optionalId,
  requirement: nullableString,
  label: nullableString,
  tenderValue: nullableString,
  companyValue: nullableString,
  status: nullableString,
  basis: nullableString,
  reason: nullableString,
  statusNote: nullableString,
  statusSetBy: nullableNumber,
  statusSetAt: backendDate,
  evidence: z.array(z.unknown()).nullish(),
});

const MatrixSchema = z.object({
  packageId: optionalId,
  stage: nullableString,
  shown: nullableBoolean,
  notice: nullableString,
  rows: z.array(z.unknown()).nullish(),
});

const TurnoverYearSchema = z.object({ financialYear: nullableString, amount: money });
const SimilarProjectSchema = z.object({
  name: nullableString,
  client: nullableString,
  value: money,
  completedYear: nullableNumber,
  description: nullableString,
});
const EquipmentItemSchema = z.object({ name: nullableString, quantity: nullableNumber, details: nullableString });
const PersonnelEntrySchema = z.object({
  role: nullableString,
  name: nullableString,
  qualification: nullableString,
  experienceYears: nullableNumber,
});

const EvidenceSchema = z.object({
  id,
  section: nullableString,
  label: nullableString,
  fileName: nullableString,
  contentType: nullableString,
  sizeBytes: nullableNumber,
  uploaded: nullableBoolean,
  createdAt: backendDate,
});

const CompanyProfileSchema = z.object({
  id: optionalId,
  yearsInBusiness: nullableNumber,
  turnover: z.array(z.unknown()).nullish(),
  similarProjects: z.array(z.unknown()).nullish(),
  equipment: z.array(z.unknown()).nullish(),
  personnel: z.array(z.unknown()).nullish(),
  evidence: z.array(z.unknown()).nullish(),
  updatedBy: nullableNumber,
  updatedAt: backendDate,
});

// ------------------------------------------------------------------------------------------ parsers

export function parseContractTermEntry(json: unknown): ContractTermEntry {
  const raw = ContractTermEntrySchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    projectId: opt(raw.projectId),
    candidateId: optString(raw.candidateId) ?? '',
    documentId: optString(raw.documentId) ?? '',
    term: raw.term ?? '',
    label: raw.label ?? raw.term ?? '',
    value: raw.value ?? '',
    clause: opt(raw.clause),
    sourceClass: opt(raw.sourceClass),
    riskId: optString(raw.riskId),
    updatedAt: opt(raw.updatedAt),
  };
}

function parseFoundTermValue(json: unknown): FoundTermValue {
  const raw = FoundValueSchema.parse(json);
  return {
    candidateId: optString(raw.candidateId) ?? '',
    value: raw.value ?? '',
    clause: opt(raw.clause),
    docClass: raw.docClass ?? '',
    status: raw.status ?? '',
    overridden: raw.overridden ?? false,
    supersedesCandidateId: optString(raw.supersedesCandidateId),
  };
}

export function parseContractTermCoverage(json: unknown): ContractTermCoverage {
  const raw = CoverageSchema.parse(json);
  return {
    notice: opt(raw.notice),
    read: (raw.read ?? []).map((r) => {
      const part = ReadPartSchema.parse(r);
      return {
        documentId: optString(part.documentId) ?? '',
        segmentId: optString(part.segmentId) ?? '',
        fileName: part.fileName ?? '',
        docClass: part.docClass ?? '',
        status: part.status ?? '',
        pagesSearched: opt(part.pagesSearched),
        pagesNotRead: part.pagesNotRead ?? [],
      };
    }),
    terms: (raw.terms ?? []).map((t) => {
      const term = TermCoverageSchema.parse(t);
      return {
        term: term.term ?? '',
        label: term.label ?? term.term ?? '',
        // An unknown status reads as not found, so a screen still names the term as missing.
        status: (term.status as TermCoverageStatus) ?? 'NOT_FOUND',
        message: opt(term.message),
        proposedCandidateId: optString(term.proposedCandidateId),
        found: (term.found ?? []).map(parseFoundTermValue),
      };
    }),
  };
}

export function parseObligationEntry(json: unknown): ObligationEntry {
  const raw = ObligationEntrySchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    projectId: opt(raw.projectId),
    candidateId: optString(raw.candidateId) ?? '',
    documentId: optString(raw.documentId) ?? '',
    clause: opt(raw.clause),
    deadline: raw.deadline ?? '',
    deadlineDays: opt(raw.deadlineDays),
    responsibleParty: opt(raw.responsibleParty),
    trigger: opt(raw.trigger),
    requiredDocument: opt(raw.requiredDocument),
    financialImpact: opt(raw.financialImpact),
    topic: opt(raw.topic),
    sourceClass: opt(raw.sourceClass),
    riskId: optString(raw.riskId),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseRaisedRisk(json: unknown): RaisedRisk {
  const raw = RaisedRiskSchema.parse(json);
  return {
    riskId: raw.riskId,
    riskNumber: optString(raw.riskNumber) ?? '',
    projectId: raw.projectId ?? 0,
    created: raw.created ?? false,
  };
}

function parseRevisionNote(json: unknown): DrawingRevisionNote {
  const raw = RevisionNoteSchema.safeParse(json);
  if (!raw.success) return {};
  return { revision: raw.data.revision, date: raw.data.date, description: raw.data.description };
}

export function parseDrawingEntry(json: unknown): DrawingEntry {
  const raw = DrawingEntrySchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    projectId: opt(raw.projectId),
    candidateId: optString(raw.candidateId) ?? '',
    documentId: optString(raw.documentId) ?? '',
    drawingNumber: raw.drawingNumber ?? '',
    title: opt(raw.title),
    discipline: opt(raw.discipline),
    revision: opt(raw.revision),
    revisionDate: opt(raw.revisionDate),
    revisionDateText: opt(raw.revisionDateText),
    scale: opt(raw.scale),
    sheetPage: opt(raw.sheetPage),
    layout: opt(raw.layout),
    sourceFormat: raw.sourceFormat ?? '',
    // An unknown status reads as not read, so a screen offers the fix rather than trusting the row.
    status: raw.status === 'READ' ? 'READ' : 'NOT_READ',
    current: raw.current ?? false,
    supersedesId: optString(raw.supersedesId),
    supersededById: optString(raw.supersededById),
    cropAvailable: raw.cropAvailable ?? false,
    revisionHistory: (raw.revisionHistory ?? []).map(parseRevisionNote),
    note: opt(raw.note),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseQualityRequirementEntry(json: unknown): QualityRequirementEntry {
  const raw = QualityRequirementEntrySchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    projectId: opt(raw.projectId),
    candidateId: optString(raw.candidateId) ?? '',
    documentId: optString(raw.documentId),
    subject: raw.subject ?? raw.material ?? '',
    activity: opt(raw.activity),
    material: opt(raw.material),
    grade: opt(raw.grade),
    standards: strings(raw.standards),
    test: opt(raw.test),
    frequency: opt(raw.frequency),
    acceptanceCriterion: opt(raw.acceptanceCriterion),
    holdOrWitnessPoint: opt(raw.holdOrWitnessPoint),
    requiredDocuments: strings(raw.requiredDocuments),
    notStated: strings(raw.notStated),
    sourceClass: opt(raw.sourceClass),
    tradeId: optString(raw.tradeId),
    tradeCode: opt(raw.tradeCode),
    tradeName: opt(raw.tradeName),
    templateId: optString(raw.templateId),
    templateItemId: optString(raw.templateItemId),
    templateVersion: opt(raw.templateVersion),
    copiedAt: opt(raw.copiedAt),
    citations: (raw.citations ?? []).map(parseSourceRef),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseCopyToTemplateResult(json: unknown): CopyToTemplateResult {
  const raw = z.object({ rows: z.array(z.unknown()).nullish(), templates: z.array(z.unknown()).nullish() }).parse(json);
  return {
    rows: (raw.rows ?? []).map((r) => {
      const row = RowOutcomeSchema.parse(r);
      return {
        requirementId: row.requirementId,
        // An unknown outcome reads as not found, so nothing counts the row as copied.
        outcome: (row.outcome as CopyRowOutcomeCode) ?? 'NOT_FOUND',
        message: opt(row.message),
        templateId: optString(row.templateId),
        templateItemId: optString(row.templateItemId),
      };
    }),
    templates: (raw.templates ?? []).map((t) => {
      const template = TemplateCopySchema.parse(t);
      return {
        templateId: template.templateId,
        templateName: template.templateName ?? '',
        tradeId: optString(template.tradeId) ?? '',
        tradeName: template.tradeName ?? '',
        version: template.version ?? 0,
        active: template.active ?? false,
        created: template.created ?? false,
        itemsAdded: template.itemsAdded ?? 0,
      };
    }),
  };
}

const matrixStatus = (value: string | null | undefined): MatrixStatus | undefined =>
  value === 'MATCH' || value === 'GAP' || value === 'UNKNOWN' ? value : undefined;

export function parseQualificationRequirementEntry(json: unknown): QualificationRequirementEntry {
  const raw = QualificationEntrySchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    candidateId: optString(raw.candidateId) ?? '',
    documentId: optString(raw.documentId) ?? '',
    requirement: raw.requirement ?? '',
    label: raw.label ?? raw.requirement ?? '',
    value: raw.value ?? '',
    minValue: opt(raw.minValue),
    period: opt(raw.period),
    sourceClass: opt(raw.sourceClass),
    comparedAutomatically: raw.comparedAutomatically ?? false,
    personStatus: matrixStatus(raw.personStatus),
    personNote: opt(raw.personNote),
    statusSetBy: opt(raw.statusSetBy),
    statusSetAt: opt(raw.statusSetAt),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseComplianceMatrix(json: unknown): ComplianceMatrix {
  const raw = MatrixSchema.parse(json);
  return {
    packageId: optString(raw.packageId) ?? '',
    stage: opt(raw.stage) as PackageStage | undefined,
    shown: raw.shown ?? false,
    notice: opt(raw.notice),
    rows: (raw.rows ?? []).map((r) => {
      const row = MatrixRowSchema.parse(r);
      return {
        requirementId: row.requirementId,
        candidateId: optString(row.candidateId) ?? '',
        documentId: optString(row.documentId) ?? '',
        requirement: row.requirement ?? '',
        label: row.label ?? row.requirement ?? '',
        tenderValue: row.tenderValue ?? '',
        companyValue: opt(row.companyValue),
        // An unknown status reads as UNKNOWN, so a row never shows a match it was not given.
        status: matrixStatus(row.status) ?? 'UNKNOWN',
        basis: row.basis ?? '',
        reason: opt(row.reason),
        statusNote: opt(row.statusNote),
        statusSetBy: opt(row.statusSetBy),
        statusSetAt: opt(row.statusSetAt),
        evidence: (row.evidence ?? []).map((e) => {
          const ev = MatrixEvidenceSchema.parse(e);
          return { id: ev.id, fileName: ev.fileName ?? '', label: opt(ev.label) };
        }),
      };
    }),
  };
}

export function parseCompanyEvidence(json: unknown): CompanyEvidence {
  const raw = EvidenceSchema.parse(json);
  return {
    id: raw.id,
    section: (raw.section as EvidenceSection) ?? 'OTHER',
    label: opt(raw.label),
    fileName: raw.fileName ?? '',
    contentType: raw.contentType ?? '',
    sizeBytes: raw.sizeBytes ?? 0,
    uploaded: raw.uploaded ?? false,
    createdAt: opt(raw.createdAt),
  };
}

export function parseCompanyProfile(json: unknown): CompanyProfile {
  const raw = CompanyProfileSchema.parse(json);
  return {
    id: optString(raw.id),
    yearsInBusiness: opt(raw.yearsInBusiness),
    turnover: (raw.turnover ?? []).map((t) => {
      const year = TurnoverYearSchema.parse(t);
      return { financialYear: year.financialYear ?? '', amount: year.amount ?? 0 };
    }),
    similarProjects: (raw.similarProjects ?? []).map((p) => {
      const project = SimilarProjectSchema.parse(p);
      return {
        name: project.name ?? '',
        client: opt(project.client),
        value: opt(project.value),
        completedYear: opt(project.completedYear),
        description: opt(project.description),
      };
    }),
    equipment: (raw.equipment ?? []).map((e) => {
      const item = EquipmentItemSchema.parse(e);
      return { name: item.name ?? '', quantity: opt(item.quantity), details: opt(item.details) };
    }),
    personnel: (raw.personnel ?? []).map((p) => {
      const person = PersonnelEntrySchema.parse(p);
      return {
        role: person.role ?? '',
        name: opt(person.name),
        qualification: opt(person.qualification),
        experienceYears: opt(person.experienceYears),
      };
    }),
    evidence: (raw.evidence ?? []).map(parseCompanyEvidence),
    updatedBy: opt(raw.updatedBy),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseEvidenceUpload(json: unknown): EvidenceUpload {
  const raw = z.object({ evidenceId: id, upload: z.unknown() }).parse(json);
  return { evidenceId: raw.evidenceId, upload: parsePresignedUpload(raw.upload) };
}

// ------------------------------------------------------------------------------- payload readers

/** The `CONTRACT_TERM` payload, read leniently. */
export const ContractTermPayloadSchema = z.looseObject({ value: payloadText, clause: payloadText });
/** The `OBLIGATION` payload, read leniently. */
export const ObligationPayloadSchema = z.looseObject({
  clause: payloadText,
  deadline: payloadText,
  responsible_party: payloadText,
  topic: payloadText,
  trigger: payloadText,
  required_document: payloadText,
  financial_impact: payloadText,
});
/** The `DRAWING` payload, read leniently. */
export const DrawingPayloadSchema = z.looseObject({
  drawing_number: payloadText,
  title: payloadText,
  discipline: payloadText,
  revision: payloadText,
  date: payloadText,
  scale: payloadText,
  revision_history: z.unknown().optional(),
  sheet_page: payloadInt,
  layout: payloadText,
  source_format: payloadText,
});
/** The `QUALITY_REQUIREMENT` payload, read leniently. */
export const QualityRequirementPayloadSchema = z.looseObject({
  activity: payloadText,
  material: payloadText,
  grade: payloadText,
  standards: payloadTextList,
  test: payloadText,
  frequency: payloadText,
  acceptance_criterion: payloadText,
  hold_or_witness_point: payloadText,
  required_documents: payloadTextList,
});
/** The `QUALIFICATION_REQUIREMENT` payload, read leniently. */
export const QualificationRequirementPayloadSchema = z.looseObject({
  value: payloadText,
  min_value: payloadText,
  period: payloadText,
});

const payloadOf = (candidate: Candidate): Record<string, unknown> => candidate.acceptedPayload ?? candidate.payload;

/** A contract term candidate's value: the accepted payload when there is one, else what was extracted. */
export function contractTermOf(candidate: Candidate): ContractTermPayload {
  const p = ContractTermPayloadSchema.parse(payloadOf(candidate));
  return { term: candidate.naturalKey, value: p.value, clause: p.clause };
}

/** An obligation candidate's fields: the accepted payload when there is one, else what was extracted. */
export function obligationOf(candidate: Candidate): ObligationPayload {
  const p = ObligationPayloadSchema.parse(payloadOf(candidate));
  return {
    clause: p.clause,
    deadline: p.deadline,
    responsibleParty: p.responsible_party,
    topic: p.topic,
    trigger: p.trigger,
    requiredDocument: p.required_document,
    financialImpact: p.financial_impact,
  };
}

/** A drawing candidate's title block: the accepted payload when there is one, else what was extracted. */
export function drawingOf(candidate: Candidate): DrawingPayload {
  const p = DrawingPayloadSchema.parse(payloadOf(candidate));
  return {
    drawingNumber: p.drawing_number ?? candidate.naturalKey,
    title: p.title,
    discipline: p.discipline,
    revision: p.revision,
    date: p.date,
    scale: p.scale,
    revisionHistory: (Array.isArray(p.revision_history) ? p.revision_history : []).map(parseRevisionNote),
    sheetPage: p.sheet_page,
    layout: p.layout,
    sourceFormat: p.source_format,
  };
}

/** A quality requirement candidate's row: the accepted payload when there is one, else what was extracted. */
export function qualityRequirementOf(candidate: Candidate): QualityRequirementPayload {
  const p = QualityRequirementPayloadSchema.parse(payloadOf(candidate));
  return {
    subject: candidate.naturalKey,
    activity: p.activity,
    material: p.material,
    grade: p.grade,
    standards: p.standards,
    test: p.test,
    frequency: p.frequency,
    acceptanceCriterion: p.acceptance_criterion,
    holdOrWitnessPoint: p.hold_or_witness_point,
    requiredDocuments: p.required_documents,
  };
}

/** The qualification requirement type a natural key names, from its part before the first `|`. */
export function qualificationRequirementKeyOf(naturalKey: string | undefined): string | undefined {
  if (naturalKey === undefined) return undefined;
  const bar = naturalKey.indexOf('|');
  const key = (bar < 0 ? naturalKey : naturalKey.slice(0, bar)).trim().toLowerCase();
  return key === '' ? undefined : key;
}

/** A qualification requirement candidate's value: the accepted payload when there is one, else what was extracted. */
export function qualificationRequirementOf(candidate: Candidate): QualificationRequirementPayload {
  const p = QualificationRequirementPayloadSchema.parse(payloadOf(candidate));
  return {
    requirement: qualificationRequirementKeyOf(candidate.naturalKey),
    value: p.value,
    minValue: p.min_value,
    period: p.period,
  };
}

/** Whether a person, rather than the comparison with the profile, sets this requirement's status. */
export function isQualificationSetByPerson(requirement: string | undefined): boolean {
  return requirement !== undefined && (QUALIFICATION_KEYS_SET_BY_PERSON as readonly string[]).includes(requirement);
}
