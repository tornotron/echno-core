/**
 * @module document-ingestion
 *
 * Domain types for the Document Ingestion module (`MODULE_DOCUMENT_INGESTION`): tender files in a
 * package, read into candidate values a person accepts, edits or rejects, with a source reference on
 * each value and provenance on each value that reaches a live record. This version covers packages,
 * documents, BOQ sheets with their column mapping, review, apply and provenance; document classes
 * and page segments, extract jobs, the AI reading ledger, budgets and settings; the tender profile;
 * revisions of a file and the change candidates a corrigendum or a revised file gives. The registers
 * accepted values land in (contract terms, obligations, drawings, the quality plan, qualification
 * requirements and the company profile they are compared with) live in `document-ingestion-registers`.
 *
 * Each candidate kind's payload has a typed reader ({@link boqItemOf}, {@link projectFieldOf},
 * {@link milestoneOf}, {@link changeOf}, and the register kinds' readers beside their registers)
 * that never throws: a field of the wrong type reads as absent.
 *
 * Backend design note: `docs/specs/2026-11-08-document-ingestion-design.md` in
 * tornotron/echno-backend. The module is off for every organization until an operator opens it, and
 * then every endpoint answers 403 `MODULE_DISABLED` for an organization it is not open to.
 *
 * Every parser is non-strict, so a field the backend adds later never breaks this client. Numbers in
 * a BOQ candidate's payload travel as decimal strings and stay strings here, so no amount passes
 * through a binary floating point between the workbook and the contract.
 */

import { z } from 'zod';
import { PresignedUpload, parsePresignedUpload } from '../attachment';
import {
  backendDate,
  money,
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';
import { payloadFlag, payloadInt, payloadText } from './payload-values';

// ------------------------------------------------------------------------------------------ enums

export type PackageStage = 'TENDER' | 'AWARDED';
export type PackageStatus = 'OPEN' | 'ARCHIVED';
export type IngestFileType = 'PDF' | 'XLSX' | 'XLS' | 'DOCX' | 'DXF' | 'DWG' | 'ZIP';
export type IngestDocumentStatus = 'AWAITING_UPLOAD' | 'QUEUED' | 'PARSED' | 'FAILED' | 'STORED_ONLY';
export type ParseJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
export type ParseJobType = 'UNPACK' | 'PARSE';
export type CandidateKind =
  | 'BOQ_ITEM'
  | 'PROJECT_FIELD'
  | 'MILESTONE'
  | 'CONTRACT_TERM'
  | 'OBLIGATION'
  | 'QUALITY_REQUIREMENT'
  | 'DRAWING'
  | 'QUALIFICATION_REQUIREMENT'
  | 'CHANGE';
export type CandidateStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'APPLIED' | 'APPLY_FAILED' | 'SUPERSEDED';
export type ExtractionMethod = 'DETERMINISTIC' | 'LLM' | 'OCR_LLM';
export type DecisionAction = 'ACCEPT' | 'REJECT' | 'EDIT';
export type DecisionOutcome =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SKIPPED_FLAGGED'
  | 'REFUSED_NO_SOURCE'
  | 'REFUSED_STATE'
  | 'REFUSED_ROLE'
  | 'NOT_FOUND';
export type BoqSheetStatus = 'DETECTED' | 'NEEDS_MAPPING' | 'EXTRACTED';

/** The columns of a BOQ sheet a person maps; also the field names of a `BOQ_ITEM` payload. */
export type BoqField = 'itemCode' | 'description' | 'unit' | 'quantity' | 'rate' | 'amount';
export const BOQ_FIELDS: readonly BoqField[] = ['itemCode', 'description', 'unit', 'quantity', 'rate', 'amount'];

/** The `targetType` provenance carries for a row written to a contract BOQ. */
export const CONTRACT_BOQ_ITEM_TARGET = 'CONTRACT_BOQ_ITEM';

/**
 * Every `targetType` an applied candidate or a provenance row carries. A `CHANGE` to a value not yet
 * applied lands on a new candidate, so its target is `CANDIDATE`.
 */
export const INGEST_TARGET = {
  CONTRACT_BOQ_ITEM: CONTRACT_BOQ_ITEM_TARGET,
  PROJECT: 'PROJECT',
  TENDER_PROFILE: 'TENDER_PROFILE',
  WBS_ELEMENT: 'WBS_ELEMENT',
  CONTRACT_MILESTONE: 'CONTRACT_MILESTONE',
  CANDIDATE: 'CANDIDATE',
  CONTRACT_TERM: 'CONTRACT_TERM',
  OBLIGATION: 'OBLIGATION',
  DRAWING: 'DRAWING',
  QUALITY_REQUIREMENT: 'QUALITY_REQUIREMENT',
  QUALIFICATION_REQUIREMENT: 'QUALIFICATION_REQUIREMENT',
  /** A risk raised from a contract term or an obligation; its description carries the term's source. */
  PROJECT_RISK: 'PROJECT_RISK',
} as const;
export type IngestTargetType = (typeof INGEST_TARGET)[keyof typeof INGEST_TARGET];

/** What a document, or a page range of one, is. */
export type DocClass =
  | 'NIT'
  | 'ITB'
  | 'ELIGIBILITY'
  | 'GCC'
  | 'SCC'
  | 'CONTRACT_DATA'
  | 'SCOPE'
  | 'BOQ'
  | 'SPECIFICATION'
  | 'DRAWING'
  | 'MILESTONE_SCHEDULE'
  | 'CORRIGENDUM'
  | 'OTHER';
export const DOC_CLASSES: readonly DocClass[] = [
  'NIT',
  'ITB',
  'ELIGIBILITY',
  'GCC',
  'SCC',
  'CONTRACT_DATA',
  'SCOPE',
  'BOQ',
  'SPECIFICATION',
  'DRAWING',
  'MILESTONE_SCHEDULE',
  'CORRIGENDUM',
  'OTHER',
];
/** Who set a class: a rule, the AI service, or a person. */
export type ClassMethod = 'DETERMINISTIC' | 'LLM' | 'PERSON';
export type SegmentStatus = 'PROPOSED' | 'CONFIRMED' | 'EXTRACTING' | 'EXTRACTED' | 'PARTIAL' | 'FAILED';
/** `WAITING_LLM` and `PAUSED_BUDGET` keep what is done and resume by themselves; `PARTIAL` names the pages not read. */
export type ExtractJobStatus = 'QUEUED' | 'RUNNING' | 'WAITING_LLM' | 'PAUSED_BUDGET' | 'PARTIAL' | 'DONE' | 'FAILED';
export type LlmCallOutcome =
  | 'OK'
  | 'INVALID_ANSWER'
  | 'TRUNCATED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'CLIENT_ERROR'
  | 'MALFORMED_ENVELOPE';
/** A person's choice on a change whose target was edited by hand since the value was applied. */
export type ConflictChoice = 'APPLY_CHANGE' | 'KEEP_RECORD';
/** Where a change was read from: corrigendum prose, or a row-by-row comparison of a revised file. */
export type ChangeOrigin = 'CORRIGENDUM' | 'REVISED_FILE';

/** The natural key of a `PROJECT_FIELD` candidate. The first two land on the project, the rest on the tender profile. */
export type ProjectFieldKey =
  | 'project_name'
  | 'location'
  | 'client'
  | 'estimated_value'
  | 'emd'
  | 'tender_fee'
  | 'bid_due_date'
  | 'bid_validity'
  | 'duration'
  | 'consultant'
  | 'engineer'
  | 'scope';
export const PROJECT_FIELD_KEYS: readonly ProjectFieldKey[] = [
  'project_name',
  'location',
  'client',
  'estimated_value',
  'emd',
  'tender_fee',
  'bid_due_date',
  'bid_validity',
  'duration',
  'consultant',
  'engineer',
  'scope',
];
/** The project fields applied to the project itself; every other key goes to the tender profile. */
export const PROJECT_FIELD_KEYS_ON_PROJECT: readonly ProjectFieldKey[] = ['project_name', 'location'];

/**
 * Flag codes of the AI-read kinds and of changes. BOQ rows carry their own codes, such as
 * `AMOUNT_MISMATCH`; {@link CandidateFlag.code} stays a plain string so a new code never breaks a parse.
 */
export const INGEST_FLAG = {
  /** A value whose quote was not found on its page; never accepted in bulk. */
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  /** A value read from a page that was OCRed. */
  OCR_PAGE: 'OCR_PAGE',
  /** A milestone schedule whose payment percentages do not add up to 100. */
  PERCENT_TOTAL: 'PERCENT_TOTAL',
  /** A milestone that falls before the one above it. */
  DATE_ORDER: 'DATE_ORDER',
  /** A time such as "Month 4", counted from a start date the project may not have yet. */
  RELATIVE_TIME: 'RELATIVE_TIME',
  /** A change that matches no earlier value; it stays on the unmatched list. */
  UNMATCHED: 'UNMATCHED',
  /** A change whose stated old value is not the earlier value. */
  OLD_VALUE_DIFFERS: 'OLD_VALUE_DIFFERS',
  /** A change to a tender before award, which may affect bids already prepared. */
  TENDER_IMPACT: 'TENDER_IMPACT',
  /** An item only the revised file has. */
  ITEM_ADDED: 'ITEM_ADDED',
  /** An item only the replaced file has. */
  ITEM_REMOVED: 'ITEM_REMOVED',
  /**
   * A general-conditions term the special conditions or contract data restate. Their value is the
   * one proposed, pointing at this one through `supersedesCandidateId`; this one is passed by in bulk.
   */
  OVERRIDDEN_BY_SCC: 'OVERRIDDEN_BY_SCC',
  /** A drawing whose title block could not be read, such as a DWG; add a PDF or DXF copy. */
  NOT_READ: 'NOT_READ',
  /** A drawing number taken from the file name because the title block gave none. */
  NUMBER_FROM_FILE_NAME: 'NUMBER_FROM_FILE_NAME',
  /** A drawing sheet with no revision found. */
  NO_REVISION: 'NO_REVISION',
  /** A quality requirement whose specification states no frequency; the value stays empty. */
  FREQUENCY_NOT_STATED: 'FREQUENCY_NOT_STATED',
  /** A quality requirement whose specification states no acceptance criterion; the value stays empty. */
  ACCEPTANCE_NOT_STATED: 'ACCEPTANCE_NOT_STATED',
} as const;
export type IngestFlagCode = (typeof INGEST_FLAG)[keyof typeof INGEST_FLAG];

/** The key `POST /candidates/{id}/conflict` with `APPLY_CHANGE` sets on a change's accepted payload. */
export const OVERRIDE_RECORD_KEY = 'overrideRecord';

// ------------------------------------------------------------------------------------------ shapes

/** A package of tender files, optionally for an existing project. */
export interface IngestPackage {
  id: string;
  name: string;
  projectId?: number;
  /** The sub-contract its BOQ is written to; absent while the BOQ stays on the package. */
  subContractId?: number;
  stage: PackageStage;
  status: PackageStatus;
  documentCount: number;
  createdAt?: string;
  createdBy?: number;
}

export interface CreatePackageRequest {
  name: string;
  projectId?: number;
  stage?: PackageStage;
}

/** Body of `PUT /document-ingestion/packages/{id}/boq-target`. Null clears the target. */
export interface BoqTargetRequest {
  subContractId: number | null;
}

export interface ParseJob {
  id: string;
  jobType: ParseJobType;
  status: ParseJobStatus;
  attempt: number;
  maxAttempts: number;
  error?: string;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** A file in a package, with its latest reading job. */
export interface IngestDocument {
  id: string;
  packageId: string;
  parentDocumentId?: string;
  fileName: string;
  fileType?: IngestFileType;
  sizeBytes: number;
  status: IngestDocumentStatus;
  /** One plain sentence when reading failed or the file is only stored. */
  error?: string;
  sha256?: string;
  pageCount?: number;
  sheetCount?: number;
  rowCount?: number;
  pagesOcr?: number;
  pagesFailed?: number;
  docClass?: string;
  revisionLabel?: string;
  supersedesDocumentId?: string;
  createdAt?: string;
  latestJob?: ParseJob;
}

/** Body of `POST /document-ingestion/packages/{id}/documents/presign`. */
export interface PresignDocumentRequest {
  fileName: string;
  contentType?: string;
  fileSize: number;
}

/** Where to PUT the file, and the document to register once it is there. */
export interface DocumentUpload {
  documentId: string;
  upload: PresignedUpload;
}

export interface DownloadUrl {
  url: string;
  expiresInSeconds: number;
}

/** A check that failed on a candidate. A flagged candidate is accepted only with each code acknowledged. */
export interface CandidateFlag {
  code: string;
  message: string;
}

/** Where a value came from: sheet, row and cell for a workbook, or page and box for a PDF. */
export interface SourceRef {
  id: string;
  field: string;
  documentId?: string;
  documentSha256?: string;
  page?: number;
  /** Normalized `[x0, y0, x1, y1]`, 0 to 1. */
  box?: number[];
  sheet?: string;
  rowNumber?: number;
  cell?: string;
  paragraph?: number;
  quote?: string;
  quoteVerified: boolean;
}

/** A value an extractor proposes, with every source beside it. */
export interface Candidate {
  id: string;
  packageId: string;
  documentId?: string;
  segmentId?: string;
  kind: CandidateKind;
  /** For a BOQ row, `<sheet>!<row>`. */
  naturalKey?: string;
  /** What was extracted; never changes. */
  payload: Record<string, unknown>;
  /** What a person accepted, with their corrections. */
  acceptedPayload?: Record<string, unknown>;
  flags: CandidateFlag[];
  acknowledgedFlags: string[];
  method?: ExtractionMethod;
  status: CandidateStatus;
  supersedesCandidateId?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  appliedTargetType?: string;
  appliedTargetId?: string;
  applyError?: string;
  sources: SourceRef[];
}

/** A BOQ row's payload, read from a `BOQ_ITEM` candidate. Numbers are decimal strings, or absent. */
export interface BoqItemPayload {
  itemCode?: string;
  description?: string;
  unit?: string;
  quantity?: string;
  rate?: string;
  amount?: string;
  section?: string;
  sheet?: string;
  sheetIndex?: number;
  row?: number;
}

export interface CandidateListParams {
  kind?: CandidateKind;
  status?: CandidateStatus;
  /** One sheet's rows, by the segment its mapping created. */
  segmentId?: string;
  /** 0-based page index. */
  page?: number;
  /** At most 200. */
  size?: number;
}

/** One decision. EDIT accepts the candidate with the given fields changed. */
export interface CandidateDecision {
  candidateId: string;
  action: DecisionAction;
  edits?: Record<string, unknown>;
  acknowledgedFlags?: string[];
}

export interface DecisionResult {
  candidateId: string;
  outcome: DecisionOutcome;
  message?: string;
}

/** One apply call. `remaining` above zero means call again to carry on. */
export interface ApplyResult {
  applied: number;
  failed: number;
  remaining: number;
}

/** Where one field of a live record came from; `source` is absent when it was entered by hand. */
export interface Provenance {
  id: string;
  targetType: string;
  targetId: string;
  targetField: string;
  valueExtracted?: string;
  valueAccepted?: string;
  enteredByHand: boolean;
  candidateId?: string;
  acceptedBy?: number;
  acceptedAt?: string;
  appliedBy?: number;
  appliedAt?: string;
  source?: SourceRef;
}

export interface BoqPreviewCell {
  col: number;
  ref?: string;
  text: string;
}

/** One row of the top of a sheet, for the mapping screen. */
export interface BoqPreviewRow {
  row: number;
  hidden: boolean;
  cells: BoqPreviewCell[];
}

export interface BoqWarning {
  code: string;
  message: string;
  row?: number;
}

/** What reading one sheet found. Every non-empty row is an item, a section, a total or listed as ignored. */
export interface BoqSheetSummary {
  rowsRead: number;
  items: number;
  sections: number;
  totals: number;
  flaggedItems: number;
  ignoredRows: number[];
  warnings: BoqWarning[];
}

/** One sheet of a workbook read as a BOQ. */
export interface BoqSheet {
  id: string;
  documentId: string;
  /** Set once a person confirms the mapping; the sheet's candidates carry it. */
  segmentId?: string;
  sheetName: string;
  sheetIndex: number;
  hidden: boolean;
  status: BoqSheetStatus;
  /** Data starts below it; 0 when the sheet has no header row. */
  headerRow?: number;
  /** Field to 1-based column. */
  columns: Partial<Record<BoqField, number>>;
  codePrefix?: string;
  preview: BoqPreviewRow[];
  rowCount: number;
  summary?: BoqSheetSummary;
  confirmedBy?: number;
  confirmedAt?: string;
  extractedAt?: string;
}

/** Body of `POST /document-ingestion/documents/{id}/boq/sheets/{sheetId}/extract`. */
export interface BoqMappingRequest {
  headerRow: number;
  columns: Partial<Record<BoqField, number>>;
  codePrefix?: string;
}

/** What `GET /document-ingestion/status` answers when the module is open to the caller's organization. */
export interface DocumentIngestionStatus {
  moduleId: string;
  version: string;
}

export interface IngestPageParams {
  /** 0-based page index. */
  page?: number;
  size?: number;
}

/** A page, the backend's own envelope. */
export interface IngestPage<T> {
  content: T[];
  /** 0-based page index. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** A page that was not read, with why: shown as "not read". */
export interface UnreadPage {
  page: number;
  reason: string;
  detail?: string;
}

/** One part of a document under one class: a page range of a PDF, or a sheet of a workbook. */
export interface IngestSegment {
  id: string;
  docClass?: DocClass;
  method?: ClassMethod;
  pageFrom?: number;
  pageTo?: number;
  sheetName?: string;
  /** What the class was read from, in one sentence. */
  reason?: string;
  status?: SegmentStatus;
  confirmedBy?: number;
  confirmedAt?: string;
  unreadPages: UnreadPage[];
}

/** A backend reading job over a segment, or over a whole document for classification. */
export interface ExtractJob {
  id: string;
  documentId: string;
  /** Absent for a job over a whole document, such as classification. */
  segmentId?: string;
  extractorKey: string;
  extractorVersion: string;
  status: ExtractJobStatus;
  attempt: number;
  maxAttempts: number;
  chunksTotal: number;
  chunksDone: number;
  chunksFailed: number;
  /** Why the job waits, paused or failed, in one plain sentence. */
  message?: string;
  /** Pages whose chunk got no usable answer after the retries. */
  failedPages: UnreadPage[];
  /** Pages not sent: not in English, or not readable by the file reader. */
  unreadPages: UnreadPage[];
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** A document's class and segments, as proposed or as a person confirmed them. */
export interface DocumentClassification {
  documentId: string;
  fileName: string;
  fileType?: IngestFileType;
  status: IngestDocumentStatus;
  pageCount?: number;
  /** Absent while the document is not yet classified. */
  docClass?: DocClass;
  classMethod?: ClassMethod;
  classReason?: string;
  confirmed: boolean;
  confirmedBy?: number;
  confirmedAt?: string;
  segments: IngestSegment[];
  unreadPages: UnreadPage[];
  /** The latest classification job; absent if none ran. */
  classification?: ExtractJob;
}

/** A 1-based, inclusive page range under one class. */
export interface ClassRange {
  docClass: DocClass;
  pageFrom: number;
  pageTo: number;
}

/**
 * Body of `PUT /document-ingestion/documents/{id}/classification`: the class a person confirms, and
 * optionally the page ranges it splits into. Replaces what was proposed.
 */
export interface ClassificationRequest {
  docClass: DocClass;
  segments?: ClassRange[];
}

/** One confirm-all call. `remaining` above zero means call again. */
export interface ConfirmAllResult {
  documentsConfirmed: number;
  segmentsConfirmed: number;
  jobsQueued: number;
  remaining: number;
}

/** One call to the AI service. Holds no document text. */
export interface LlmCall {
  id: string;
  packageId: string;
  documentId: string;
  jobId: string;
  chunkKey: string;
  callNumber: number;
  calledAt?: string;
  extractorKey: string;
  promptVersion: string;
  model?: string;
  modelVersion?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  finishReason?: string;
  latencyMs: number;
  outcome: LlmCallOutcome;
  /** The pages this call sent. */
  pages: number[];
}

export interface LlmCallListParams extends IngestPageParams {
  /** Only calls for this package; the organization-wide ledger takes it as a filter. */
  packageId?: string;
  documentId?: string;
}

/** What reading a package with the AI service has used, against the package's and the month's limits. */
export interface LlmSpend {
  packageCalls: number;
  packageTokens: number;
  packageCostUsd: number;
  packageTokenLimit: number;
  packageUsdLimit: number;
  monthCalls: number;
  monthTokens: number;
  monthCostUsd: number;
  monthTokenLimit: number;
  monthUsdLimit: number;
  /** Whether every model used has a known price, so the dollar figures are complete. */
  pricesKnown: boolean;
  /** Why no further call fits; absent while there is room. */
  exceeded?: string;
}

/**
 * Body of `PUT /document-ingestion/packages/{id}/llm-budget` and `PUT /document-ingestion/settings/llm-budget`.
 * Each limit sent as null goes back to the configured default.
 */
export interface LlmBudgetRequest {
  /** Estimated dollars. */
  budgetUsd: number | null;
  /** Prompt and completion tokens together. */
  budgetTokens: number | null;
}

/** One recorded change to a setting. */
export interface IngestSettingChange {
  setting: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: number;
  changedAt?: string;
}

/** The organization's document ingestion settings. */
export interface IngestSettings {
  llmReadingEnabled: boolean;
  /** The sentence the screen shows beside the switch. */
  llmReadingDisclosure: string;
  monthlyBudgetUsd?: number;
  monthlyBudgetTokens?: number;
  changedBy?: number;
  changedAt?: string;
  recentChanges: IngestSettingChange[];
}

/**
 * The accepted facts of a tender that a project has no field for, each as printed (`...Text`), with
 * a typed value where the text reads plainly as an amount, a date or a number of days.
 */
export interface TenderProfile {
  id: string;
  packageId: string;
  projectId?: number;
  client?: string;
  estimatedValue?: number;
  estimatedValueText?: string;
  emdAmount?: number;
  emdText?: string;
  tenderFeeAmount?: number;
  tenderFeeText?: string;
  bidDueAt?: string;
  bidDueText?: string;
  bidValidityDays?: number;
  bidValidityText?: string;
  durationText?: string;
  consultant?: string;
  engineer?: string;
  scope?: string;
  updatedAt?: string;
}

/** Body of `PUT /document-ingestion/documents/{id}/revision`: this file replaces an earlier one of the package. */
export interface RevisionRequest {
  supersedesDocumentId: string;
  revisionLabel?: string;
}

/** What comparing a revised BOQ with the file it replaces proposed, each a `CHANGE` candidate. */
export interface RevisionDiff {
  itemsCompared: number;
  changesProposed: number;
  itemsAdded: number;
  itemsRemoved: number;
}

/** A `PROJECT_FIELD` candidate's payload: one fact, as printed, keyed by the candidate's natural key. */
export interface ProjectFieldPayload {
  /** The candidate's natural key; a key this client does not know is kept as it came. */
  key?: ProjectFieldKey | string;
  value?: string;
}

/** A `MILESTONE` candidate's payload. Every value is text as printed. */
export interface MilestonePayload {
  name?: string;
  /** A date, or a relative time such as "Month 4". */
  time?: string;
  percent?: string;
  amount?: string;
  /** Sort order within the package. */
  order?: number;
}

/**
 * A `CHANGE` candidate's payload. Numbers are decimal strings. `priorValue` is the earlier value the
 * change was matched to; `quantityVariance` and `moneyImpact` are worked out for a BOQ quantity or rate.
 */
export interface ChangePayload {
  /** The kind of the value changed, such as `BOQ_ITEM`. */
  targetKind?: string;
  /** The changed value's natural key, such as a BOQ item code or a milestone's name. */
  target?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  priorValue?: string;
  quantityVariance?: string;
  moneyImpact?: string;
  origin?: ChangeOrigin | string;
  /** Set once a person chose to write the change over a record edited by hand. */
  overrideRecord: boolean;
}

// ------------------------------------------------------------------------------------------ schemas

const id = z.union([z.string(), z.number()]).transform(String);
const optionalId = z.union([z.string(), z.number()]).nullish();
const stringList = z.array(z.string()).nullish();

const PackageSchema = z.object({
  id,
  name: nullableString,
  projectId: nullableNumber,
  subContractId: nullableNumber,
  stage: nullableString,
  status: nullableString,
  documentCount: nullableNumber,
  createdAt: backendDate,
  createdBy: nullableNumber,
});

const ParseJobSchema = z.object({
  id,
  jobType: nullableString,
  status: nullableString,
  attempt: nullableNumber,
  maxAttempts: nullableNumber,
  error: nullableString,
  queuedAt: backendDate,
  startedAt: backendDate,
  finishedAt: backendDate,
});

const DocumentSchema = z.object({
  id,
  packageId: optionalId,
  parentDocumentId: optionalId,
  fileName: nullableString,
  fileType: nullableString,
  sizeBytes: nullableNumber,
  status: nullableString,
  error: nullableString,
  sha256: nullableString,
  pageCount: nullableNumber,
  sheetCount: nullableNumber,
  rowCount: nullableNumber,
  pagesOcr: nullableNumber,
  pagesFailed: nullableNumber,
  docClass: nullableString,
  revisionLabel: nullableString,
  supersedesDocumentId: optionalId,
  createdAt: backendDate,
  latestJob: z.unknown().nullish(),
});

const FlagSchema = z.object({ code: nullableString, message: nullableString });

const SourceSchema = z.object({
  id: optionalId,
  field: nullableString,
  documentId: optionalId,
  documentSha256: nullableString,
  page: nullableNumber,
  box: z.array(z.number()).nullish(),
  sheet: nullableString,
  rowNumber: nullableNumber,
  cell: nullableString,
  paragraph: nullableNumber,
  quote: nullableString,
  quoteVerified: nullableBoolean,
});

const CandidateSchema = z.object({
  id,
  packageId: optionalId,
  documentId: optionalId,
  segmentId: optionalId,
  kind: nullableString,
  naturalKey: nullableString,
  payload: z.record(z.string(), z.unknown()).nullish(),
  acceptedPayload: z.record(z.string(), z.unknown()).nullish(),
  flags: z.array(z.unknown()).nullish(),
  acknowledgedFlags: stringList,
  method: nullableString,
  status: nullableString,
  supersedesCandidateId: optionalId,
  reviewedBy: nullableNumber,
  reviewedAt: backendDate,
  appliedTargetType: nullableString,
  appliedTargetId: nullableString,
  applyError: nullableString,
  sources: z.array(z.unknown()).nullish(),
});

const ProvenanceSchema = z.object({
  id,
  targetType: nullableString,
  targetId: nullableString,
  targetField: nullableString,
  valueExtracted: nullableString,
  valueAccepted: nullableString,
  enteredByHand: nullableBoolean,
  candidateId: optionalId,
  acceptedBy: nullableNumber,
  acceptedAt: backendDate,
  appliedBy: nullableNumber,
  appliedAt: backendDate,
  source: z.unknown().nullish(),
});

const SummarySchema = z.object({
  rowsRead: nullableNumber,
  items: nullableNumber,
  sections: nullableNumber,
  totals: nullableNumber,
  flaggedItems: nullableNumber,
  ignoredRows: z.array(z.number()).nullish(),
  warnings: z.array(z.object({ code: nullableString, message: nullableString, row: nullableNumber })).nullish(),
});

const PreviewRowSchema = z.object({
  row: nullableNumber,
  hidden: nullableBoolean,
  cells: z.array(z.object({ col: nullableNumber, ref: nullableString, text: nullableString })).nullish(),
});

const BoqSheetSchema = z.object({
  id,
  documentId: optionalId,
  segmentId: optionalId,
  sheetName: nullableString,
  sheetIndex: nullableNumber,
  hidden: nullableBoolean,
  status: nullableString,
  headerRow: nullableNumber,
  columns: z.record(z.string(), z.number()).nullish(),
  codePrefix: nullableString,
  preview: z.array(z.unknown()).nullish(),
  rowCount: nullableNumber,
  summary: z.unknown().nullish(),
  confirmedBy: nullableNumber,
  confirmedAt: backendDate,
  extractedAt: backendDate,
});

const PageSchema = z.object({
  content: z.array(z.unknown()).nullish(),
  page: nullableNumber,
  number: nullableNumber,
  size: nullableNumber,
  totalElements: nullableNumber,
  totalPages: nullableNumber,
});

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);
const optString = (value: string | number | null | undefined): string | undefined =>
  value === null || value === undefined ? undefined : String(value);

// ------------------------------------------------------------------------------------------ parsers

export function parseIngestPackage(json: unknown): IngestPackage {
  const raw = PackageSchema.parse(json);
  return {
    id: raw.id,
    name: raw.name ?? '',
    projectId: opt(raw.projectId),
    subContractId: opt(raw.subContractId),
    stage: (raw.stage as PackageStage) ?? 'TENDER',
    status: (raw.status as PackageStatus) ?? 'OPEN',
    documentCount: raw.documentCount ?? 0,
    createdAt: opt(raw.createdAt),
    createdBy: opt(raw.createdBy),
  };
}

export function parseParseJob(json: unknown): ParseJob {
  const raw = ParseJobSchema.parse(json);
  return {
    id: raw.id,
    jobType: (raw.jobType as ParseJobType) ?? 'PARSE',
    status: (raw.status as ParseJobStatus) ?? 'QUEUED',
    attempt: raw.attempt ?? 0,
    maxAttempts: raw.maxAttempts ?? 0,
    error: opt(raw.error),
    queuedAt: opt(raw.queuedAt),
    startedAt: opt(raw.startedAt),
    finishedAt: opt(raw.finishedAt),
  };
}

export function parseIngestDocument(json: unknown): IngestDocument {
  const raw = DocumentSchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    parentDocumentId: optString(raw.parentDocumentId),
    fileName: raw.fileName ?? '',
    fileType: opt(raw.fileType) as IngestFileType | undefined,
    sizeBytes: raw.sizeBytes ?? 0,
    // An unknown status reads as still being read, so the screen offers nothing that needs a parsed file.
    status: (raw.status as IngestDocumentStatus) ?? 'QUEUED',
    error: opt(raw.error),
    sha256: opt(raw.sha256),
    pageCount: opt(raw.pageCount),
    sheetCount: opt(raw.sheetCount),
    rowCount: opt(raw.rowCount),
    pagesOcr: opt(raw.pagesOcr),
    pagesFailed: opt(raw.pagesFailed),
    docClass: opt(raw.docClass),
    revisionLabel: opt(raw.revisionLabel),
    supersedesDocumentId: optString(raw.supersedesDocumentId),
    createdAt: opt(raw.createdAt),
    latestJob: raw.latestJob ? parseParseJob(raw.latestJob) : undefined,
  };
}

export function parseDocumentUpload(json: unknown): DocumentUpload {
  const raw = z.object({ documentId: id, upload: z.unknown() }).parse(json);
  return { documentId: raw.documentId, upload: parsePresignedUpload(raw.upload) };
}

export function parseDownloadUrl(json: unknown): DownloadUrl {
  const raw = z.object({ url: z.string(), expiresInSeconds: nullableNumber }).parse(json);
  return { url: raw.url, expiresInSeconds: raw.expiresInSeconds ?? 0 };
}

export function parseSourceRef(json: unknown): SourceRef {
  const raw = SourceSchema.parse(json);
  return {
    id: optString(raw.id) ?? '',
    field: raw.field ?? '',
    documentId: optString(raw.documentId),
    documentSha256: opt(raw.documentSha256),
    page: opt(raw.page),
    box: opt(raw.box),
    sheet: opt(raw.sheet),
    rowNumber: opt(raw.rowNumber),
    cell: opt(raw.cell),
    paragraph: opt(raw.paragraph),
    quote: opt(raw.quote),
    quoteVerified: raw.quoteVerified ?? false,
  };
}

export function parseCandidate(json: unknown): Candidate {
  const raw = CandidateSchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    documentId: optString(raw.documentId),
    segmentId: optString(raw.segmentId),
    kind: (raw.kind as CandidateKind) ?? 'BOQ_ITEM',
    naturalKey: opt(raw.naturalKey),
    payload: raw.payload ?? {},
    acceptedPayload: opt(raw.acceptedPayload),
    flags: (raw.flags ?? []).map((f) => {
      const flag = FlagSchema.parse(f);
      return { code: flag.code ?? '', message: flag.message ?? '' };
    }),
    acknowledgedFlags: raw.acknowledgedFlags ?? [],
    method: opt(raw.method) as ExtractionMethod | undefined,
    status: (raw.status as CandidateStatus) ?? 'PROPOSED',
    supersedesCandidateId: optString(raw.supersedesCandidateId),
    reviewedBy: opt(raw.reviewedBy),
    reviewedAt: opt(raw.reviewedAt),
    appliedTargetType: opt(raw.appliedTargetType),
    appliedTargetId: opt(raw.appliedTargetId),
    applyError: opt(raw.applyError),
    sources: (raw.sources ?? []).map(parseSourceRef),
  };
}

/** The BOQ fields of a candidate: the accepted payload when there is one, else what was extracted. */
export function boqItemOf(candidate: Candidate): BoqItemPayload {
  const p = candidate.acceptedPayload ?? candidate.payload;
  const text = (v: unknown): string | undefined =>
    v === null || v === undefined || v === '' ? undefined : String(v);
  const int = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  return {
    itemCode: text(p.itemCode),
    description: text(p.description),
    unit: text(p.unit),
    quantity: text(p.quantity),
    rate: text(p.rate),
    amount: text(p.amount),
    section: text(p.section),
    sheet: text(p.sheet),
    sheetIndex: int(p.sheetIndex),
    row: int(p.row),
  };
}

/** The source of one field of a candidate, if it has one. */
export function sourceOf(candidate: Candidate, field: string): SourceRef | undefined {
  return candidate.sources.find((s) => s.field === field);
}

export function parseDecisionResults(json: unknown): DecisionResult[] {
  const raw = z
    .array(z.object({ candidateId: id, outcome: nullableString, message: nullableString }))
    .parse(json);
  return raw.map((r) => ({
    candidateId: r.candidateId,
    outcome: (r.outcome as DecisionOutcome) ?? 'NOT_FOUND',
    message: opt(r.message),
  }));
}

export function parseApplyResult(json: unknown): ApplyResult {
  const raw = z.object({ applied: nullableNumber, failed: nullableNumber, remaining: nullableNumber }).parse(json);
  return { applied: raw.applied ?? 0, failed: raw.failed ?? 0, remaining: raw.remaining ?? 0 };
}

export function parseProvenance(json: unknown): Provenance {
  const raw = ProvenanceSchema.parse(json);
  return {
    id: raw.id,
    targetType: raw.targetType ?? '',
    targetId: raw.targetId ?? '',
    targetField: raw.targetField ?? '',
    valueExtracted: opt(raw.valueExtracted),
    valueAccepted: opt(raw.valueAccepted),
    enteredByHand: raw.enteredByHand ?? false,
    candidateId: optString(raw.candidateId),
    acceptedBy: opt(raw.acceptedBy),
    acceptedAt: opt(raw.acceptedAt),
    appliedBy: opt(raw.appliedBy),
    appliedAt: opt(raw.appliedAt),
    source: raw.source ? parseSourceRef(raw.source) : undefined,
  };
}

export function parseBoqSheetSummary(json: unknown): BoqSheetSummary {
  const raw = SummarySchema.parse(json);
  return {
    rowsRead: raw.rowsRead ?? 0,
    items: raw.items ?? 0,
    sections: raw.sections ?? 0,
    totals: raw.totals ?? 0,
    flaggedItems: raw.flaggedItems ?? 0,
    ignoredRows: raw.ignoredRows ?? [],
    warnings: (raw.warnings ?? []).map((w) => ({ code: w.code ?? '', message: w.message ?? '', row: opt(w.row) })),
  };
}

export function parseBoqSheet(json: unknown): BoqSheet {
  const raw = BoqSheetSchema.parse(json);
  const columns: Partial<Record<BoqField, number>> = {};
  for (const [key, col] of Object.entries(raw.columns ?? {})) {
    if ((BOQ_FIELDS as readonly string[]).includes(key)) {
      columns[key as BoqField] = col;
    }
  }
  return {
    id: raw.id,
    documentId: optString(raw.documentId) ?? '',
    segmentId: optString(raw.segmentId),
    sheetName: raw.sheetName ?? '',
    sheetIndex: raw.sheetIndex ?? 0,
    hidden: raw.hidden ?? false,
    status: (raw.status as BoqSheetStatus) ?? 'NEEDS_MAPPING',
    headerRow: opt(raw.headerRow),
    columns,
    codePrefix: opt(raw.codePrefix),
    preview: (raw.preview ?? []).map((r) => {
      const row = PreviewRowSchema.parse(r);
      return {
        row: row.row ?? 0,
        hidden: row.hidden ?? false,
        cells: (row.cells ?? []).map((c) => ({ col: c.col ?? 0, ref: opt(c.ref), text: c.text ?? '' })),
      };
    }),
    rowCount: raw.rowCount ?? 0,
    summary: raw.summary ? parseBoqSheetSummary(raw.summary) : undefined,
    confirmedBy: opt(raw.confirmedBy),
    confirmedAt: opt(raw.confirmedAt),
    extractedAt: opt(raw.extractedAt),
  };
}

export function parseDocumentIngestionStatus(json: unknown): DocumentIngestionStatus {
  const raw = z.object({ moduleId: nullableString, version: nullableString }).parse(json);
  return { moduleId: raw.moduleId ?? '', version: raw.version ?? '' };
}

/**
 * Parses a Spring page with the given item parser. Accepts `page` or `number` for the index, since
 * the backend has published both spellings.
 */
export function parseIngestPage<T>(json: unknown, parseItem: (raw: unknown) => T): IngestPage<T> {
  const raw = PageSchema.parse(json);
  const content = (raw.content ?? []).map(parseItem);
  return {
    content,
    page: raw.page ?? raw.number ?? 0,
    size: raw.size ?? content.length,
    totalElements: raw.totalElements ?? content.length,
    totalPages: raw.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}

// ------------------------------------------------- classification, extraction, ledger, settings

const UnreadPageSchema = z.object({ page: nullableNumber, reason: nullableString, detail: nullableString });
const unreadPages = z.array(z.unknown()).nullish();

const SegmentSchema = z.object({
  id,
  docClass: nullableString,
  method: nullableString,
  pageFrom: nullableNumber,
  pageTo: nullableNumber,
  sheetName: nullableString,
  reason: nullableString,
  status: nullableString,
  confirmedBy: nullableNumber,
  confirmedAt: backendDate,
  unreadPages,
});

const ExtractJobSchema = z.object({
  id,
  documentId: optionalId,
  segmentId: optionalId,
  extractorKey: nullableString,
  extractorVersion: nullableString,
  status: nullableString,
  attempt: nullableNumber,
  maxAttempts: nullableNumber,
  chunksTotal: nullableNumber,
  chunksDone: nullableNumber,
  chunksFailed: nullableNumber,
  message: nullableString,
  failedPages: unreadPages,
  unreadPages,
  queuedAt: backendDate,
  startedAt: backendDate,
  finishedAt: backendDate,
});

const ClassificationSchema = z.object({
  documentId: id,
  fileName: nullableString,
  fileType: nullableString,
  status: nullableString,
  pageCount: nullableNumber,
  docClass: nullableString,
  classMethod: nullableString,
  classReason: nullableString,
  confirmed: nullableBoolean,
  confirmedBy: nullableNumber,
  confirmedAt: backendDate,
  segments: z.array(z.unknown()).nullish(),
  unreadPages,
  classification: z.unknown().nullish(),
});

const LlmCallSchema = z.object({
  id,
  packageId: optionalId,
  documentId: optionalId,
  jobId: optionalId,
  chunkKey: nullableString,
  callNumber: nullableNumber,
  calledAt: backendDate,
  extractorKey: nullableString,
  promptVersion: nullableString,
  model: nullableString,
  modelVersion: nullableString,
  promptTokens: nullableNumber,
  completionTokens: nullableNumber,
  estimatedCostUsd: money,
  finishReason: nullableString,
  latencyMs: nullableNumber,
  outcome: nullableString,
  pages: z.array(z.number()).nullish(),
});

const LlmSpendSchema = z.object({
  packageCalls: nullableNumber,
  packageTokens: nullableNumber,
  packageCostUsd: money,
  packageTokenLimit: nullableNumber,
  packageUsdLimit: money,
  monthCalls: nullableNumber,
  monthTokens: nullableNumber,
  monthCostUsd: money,
  monthTokenLimit: nullableNumber,
  monthUsdLimit: money,
  pricesKnown: nullableBoolean,
  exceeded: nullableString,
});

const SettingChangeSchema = z.object({
  setting: nullableString,
  oldValue: nullableString,
  newValue: nullableString,
  changedBy: nullableNumber,
  changedAt: backendDate,
});

const SettingsSchema = z.object({
  llmReadingEnabled: nullableBoolean,
  llmReadingDisclosure: nullableString,
  monthlyBudgetUsd: money,
  monthlyBudgetTokens: nullableNumber,
  changedBy: nullableNumber,
  changedAt: backendDate,
  recentChanges: z.array(z.unknown()).nullish(),
});

const TenderProfileSchema = z.object({
  id,
  packageId: optionalId,
  projectId: nullableNumber,
  client: nullableString,
  estimatedValue: money,
  estimatedValueText: nullableString,
  emdAmount: money,
  emdText: nullableString,
  tenderFeeAmount: money,
  tenderFeeText: nullableString,
  bidDueAt: backendDate,
  bidDueText: nullableString,
  bidValidityDays: nullableNumber,
  bidValidityText: nullableString,
  durationText: nullableString,
  consultant: nullableString,
  engineer: nullableString,
  scope: nullableString,
  updatedAt: backendDate,
});

export function parseUnreadPage(json: unknown): UnreadPage {
  const raw = UnreadPageSchema.parse(json);
  return { page: raw.page ?? 0, reason: raw.reason ?? '', detail: opt(raw.detail) };
}

export function parseIngestSegment(json: unknown): IngestSegment {
  const raw = SegmentSchema.parse(json);
  return {
    id: raw.id,
    docClass: opt(raw.docClass) as DocClass | undefined,
    method: opt(raw.method) as ClassMethod | undefined,
    pageFrom: opt(raw.pageFrom),
    pageTo: opt(raw.pageTo),
    sheetName: opt(raw.sheetName),
    reason: opt(raw.reason),
    status: opt(raw.status) as SegmentStatus | undefined,
    confirmedBy: opt(raw.confirmedBy),
    confirmedAt: opt(raw.confirmedAt),
    unreadPages: (raw.unreadPages ?? []).map(parseUnreadPage),
  };
}

export function parseExtractJob(json: unknown): ExtractJob {
  const raw = ExtractJobSchema.parse(json);
  return {
    id: raw.id,
    documentId: optString(raw.documentId) ?? '',
    segmentId: optString(raw.segmentId),
    extractorKey: raw.extractorKey ?? '',
    extractorVersion: raw.extractorVersion ?? '',
    // An unknown status reads as queued, so a screen keeps waiting rather than offering a retry.
    status: (raw.status as ExtractJobStatus) ?? 'QUEUED',
    attempt: raw.attempt ?? 0,
    maxAttempts: raw.maxAttempts ?? 0,
    chunksTotal: raw.chunksTotal ?? 0,
    chunksDone: raw.chunksDone ?? 0,
    chunksFailed: raw.chunksFailed ?? 0,
    message: opt(raw.message),
    failedPages: (raw.failedPages ?? []).map(parseUnreadPage),
    unreadPages: (raw.unreadPages ?? []).map(parseUnreadPage),
    queuedAt: opt(raw.queuedAt),
    startedAt: opt(raw.startedAt),
    finishedAt: opt(raw.finishedAt),
  };
}

export function parseDocumentClassification(json: unknown): DocumentClassification {
  const raw = ClassificationSchema.parse(json);
  return {
    documentId: raw.documentId,
    fileName: raw.fileName ?? '',
    fileType: opt(raw.fileType) as IngestFileType | undefined,
    status: (raw.status as IngestDocumentStatus) ?? 'QUEUED',
    pageCount: opt(raw.pageCount),
    docClass: opt(raw.docClass) as DocClass | undefined,
    classMethod: opt(raw.classMethod) as ClassMethod | undefined,
    classReason: opt(raw.classReason),
    confirmed: raw.confirmed ?? false,
    confirmedBy: opt(raw.confirmedBy),
    confirmedAt: opt(raw.confirmedAt),
    segments: (raw.segments ?? []).map(parseIngestSegment),
    unreadPages: (raw.unreadPages ?? []).map(parseUnreadPage),
    classification: raw.classification ? parseExtractJob(raw.classification) : undefined,
  };
}

export function parseConfirmAllResult(json: unknown): ConfirmAllResult {
  const raw = z
    .object({
      documentsConfirmed: nullableNumber,
      segmentsConfirmed: nullableNumber,
      jobsQueued: nullableNumber,
      remaining: nullableNumber,
    })
    .parse(json);
  return {
    documentsConfirmed: raw.documentsConfirmed ?? 0,
    segmentsConfirmed: raw.segmentsConfirmed ?? 0,
    jobsQueued: raw.jobsQueued ?? 0,
    remaining: raw.remaining ?? 0,
  };
}

export function parseLlmCall(json: unknown): LlmCall {
  const raw = LlmCallSchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    documentId: optString(raw.documentId) ?? '',
    jobId: optString(raw.jobId) ?? '',
    chunkKey: raw.chunkKey ?? '',
    callNumber: raw.callNumber ?? 0,
    calledAt: opt(raw.calledAt),
    extractorKey: raw.extractorKey ?? '',
    promptVersion: raw.promptVersion ?? '',
    model: opt(raw.model),
    modelVersion: opt(raw.modelVersion),
    promptTokens: opt(raw.promptTokens),
    completionTokens: opt(raw.completionTokens),
    estimatedCostUsd: opt(raw.estimatedCostUsd),
    finishReason: opt(raw.finishReason),
    latencyMs: raw.latencyMs ?? 0,
    // An unknown outcome reads as a failed call, so nothing counts it as a good answer.
    outcome: (raw.outcome as LlmCallOutcome) ?? 'SERVER_ERROR',
    pages: raw.pages ?? [],
  };
}

export function parseLlmSpend(json: unknown): LlmSpend {
  const raw = LlmSpendSchema.parse(json);
  return {
    packageCalls: raw.packageCalls ?? 0,
    packageTokens: raw.packageTokens ?? 0,
    packageCostUsd: raw.packageCostUsd ?? 0,
    packageTokenLimit: raw.packageTokenLimit ?? 0,
    packageUsdLimit: raw.packageUsdLimit ?? 0,
    monthCalls: raw.monthCalls ?? 0,
    monthTokens: raw.monthTokens ?? 0,
    monthCostUsd: raw.monthCostUsd ?? 0,
    monthTokenLimit: raw.monthTokenLimit ?? 0,
    monthUsdLimit: raw.monthUsdLimit ?? 0,
    pricesKnown: raw.pricesKnown ?? false,
    exceeded: opt(raw.exceeded),
  };
}

export function parseIngestSettings(json: unknown): IngestSettings {
  const raw = SettingsSchema.parse(json);
  return {
    // A missing switch reads as on, as a missing settings row does on the backend.
    llmReadingEnabled: raw.llmReadingEnabled ?? true,
    llmReadingDisclosure: raw.llmReadingDisclosure ?? '',
    monthlyBudgetUsd: opt(raw.monthlyBudgetUsd),
    monthlyBudgetTokens: opt(raw.monthlyBudgetTokens),
    changedBy: opt(raw.changedBy),
    changedAt: opt(raw.changedAt),
    recentChanges: (raw.recentChanges ?? []).map((c) => {
      const change = SettingChangeSchema.parse(c);
      return {
        setting: change.setting ?? '',
        oldValue: opt(change.oldValue),
        newValue: opt(change.newValue),
        changedBy: opt(change.changedBy),
        changedAt: opt(change.changedAt),
      };
    }),
  };
}

export function parseTenderProfile(json: unknown): TenderProfile {
  const raw = TenderProfileSchema.parse(json);
  return {
    id: raw.id,
    packageId: optString(raw.packageId) ?? '',
    projectId: opt(raw.projectId),
    client: opt(raw.client),
    estimatedValue: opt(raw.estimatedValue),
    estimatedValueText: opt(raw.estimatedValueText),
    emdAmount: opt(raw.emdAmount),
    emdText: opt(raw.emdText),
    tenderFeeAmount: opt(raw.tenderFeeAmount),
    tenderFeeText: opt(raw.tenderFeeText),
    bidDueAt: opt(raw.bidDueAt),
    bidDueText: opt(raw.bidDueText),
    bidValidityDays: opt(raw.bidValidityDays),
    bidValidityText: opt(raw.bidValidityText),
    durationText: opt(raw.durationText),
    consultant: opt(raw.consultant),
    engineer: opt(raw.engineer),
    scope: opt(raw.scope),
    updatedAt: opt(raw.updatedAt),
  };
}

export function parseRevisionDiff(json: unknown): RevisionDiff {
  const raw = z
    .object({
      itemsCompared: nullableNumber,
      changesProposed: nullableNumber,
      itemsAdded: nullableNumber,
      itemsRemoved: nullableNumber,
    })
    .parse(json);
  return {
    itemsCompared: raw.itemsCompared ?? 0,
    changesProposed: raw.changesProposed ?? 0,
    itemsAdded: raw.itemsAdded ?? 0,
    itemsRemoved: raw.itemsRemoved ?? 0,
  };
}

// ------------------------------------------------------------------------------- payload readers

/** The `PROJECT_FIELD` payload, read leniently. */
export const ProjectFieldPayloadSchema = z.looseObject({ value: payloadText });
/** The `MILESTONE` payload, read leniently. */
export const MilestonePayloadSchema = z.looseObject({
  name: payloadText,
  time: payloadText,
  percent: payloadText,
  amount: payloadText,
  order: payloadInt,
});
/** The `CHANGE` payload, read leniently. */
export const ChangePayloadSchema = z.looseObject({
  targetKind: payloadText,
  target: payloadText,
  field: payloadText,
  oldValue: payloadText,
  newValue: payloadText,
  priorValue: payloadText,
  quantityVariance: payloadText,
  moneyImpact: payloadText,
  origin: payloadText,
  [OVERRIDE_RECORD_KEY]: payloadFlag,
});

const payloadOf = (candidate: Candidate): Record<string, unknown> => candidate.acceptedPayload ?? candidate.payload;

/** A project field candidate's fact: the accepted payload when there is one, else what was extracted. */
export function projectFieldOf(candidate: Candidate): ProjectFieldPayload {
  const p = ProjectFieldPayloadSchema.parse(payloadOf(candidate));
  return { key: candidate.naturalKey, value: p.value };
}

/** A milestone candidate's row: the accepted payload when there is one, else what was extracted. */
export function milestoneOf(candidate: Candidate): MilestonePayload {
  const p = MilestonePayloadSchema.parse(payloadOf(candidate));
  return { name: p.name, time: p.time, percent: p.percent, amount: p.amount, order: p.order };
}

/** A change candidate's change: the accepted payload when there is one, else what was extracted. */
export function changeOf(candidate: Candidate): ChangePayload {
  const p = ChangePayloadSchema.parse(payloadOf(candidate));
  return {
    targetKind: p.targetKind,
    target: p.target,
    field: p.field,
    oldValue: p.oldValue,
    newValue: p.newValue,
    priorValue: p.priorValue,
    quantityVariance: p.quantityVariance,
    moneyImpact: p.moneyImpact,
    origin: p.origin,
    overrideRecord: p[OVERRIDE_RECORD_KEY],
  };
}

/** Whether a candidate carries a flag with this code. */
export function hasFlag(candidate: Candidate, code: string): boolean {
  return candidate.flags.some((f) => f.code === code);
}

/** Whether a project field is written to the project itself rather than to the tender profile. */
export function isProjectFieldOnProject(key: string | undefined): boolean {
  return key !== undefined && (PROJECT_FIELD_KEYS_ON_PROJECT as readonly string[]).includes(key);
}
