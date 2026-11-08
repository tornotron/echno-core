/**
 * @module document-ingestion
 *
 * Domain types for the Document Ingestion module (`MODULE_DOCUMENT_INGESTION`): tender files in a
 * package, read into candidate values a person accepts, edits or rejects, with a source reference on
 * each value and provenance on each value that reaches a live record. This version covers packages,
 * documents, BOQ sheets with their column mapping, review, apply and provenance.
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
  nullableBoolean,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

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
