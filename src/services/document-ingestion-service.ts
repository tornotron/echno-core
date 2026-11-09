/**
 * @module document-ingestion-service
 *
 * Typed client for the Document Ingestion module (`/document-ingestion`; the module has one
 * controller set, with no `/web` twin). Off for every organization until an operator opens it:
 * while it is off every call fails with 403 and the code `MODULE_DISABLED`, which
 * {@link isModuleDisabled} recognises.
 *
 * Endpoints:
 * - `GET  /document-ingestion/status`                                         is the module open to me
 * - `POST /document-ingestion/packages`                                       start a package
 * - `GET  /document-ingestion/packages`                                       packages, newest first
 * - `GET  /document-ingestion/packages/{id}`                                  one package
 * - `POST /document-ingestion/packages/{id}/archive`                          archive it
 * - `PUT  /document-ingestion/packages/{id}/boq-target`                       the sub-contract its BOQ goes to
 * - `GET  /document-ingestion/packages/{id}/documents`                        its files
 * - `POST /document-ingestion/packages/{id}/documents/presign`                step 1 of upload
 * - `POST /document-ingestion/packages/{id}/documents/{docId}/register`       step 3: queue it for reading
 * - `GET  /document-ingestion/documents/{id}`                                 one file
 * - `POST /document-ingestion/documents/{id}/parse`                           read it again after a failure
 * - `GET  /document-ingestion/documents/{id}/download-url`                    a short-lived download link
 * - `POST /document-ingestion/documents/{id}/boq/sheets/detect`               find each sheet's header
 * - `GET  /document-ingestion/documents/{id}/boq/sheets`                      the sheets and their mapping
 * - `POST /document-ingestion/documents/{id}/boq/sheets/{sheetId}/extract`    confirm a mapping, read the rows
 * - `GET  /document-ingestion/packages/{id}/candidates`                       candidate values, paged
 * - `POST /document-ingestion/packages/{id}/candidates/decisions`             accept, edit or reject
 * - `POST /document-ingestion/packages/{id}/apply?kind=`                      write accepted values
 * - `GET  /document-ingestion/provenance?targetType=&targetId=`               where a record's fields came from
 * - `GET  /document-ingestion/packages/{id}/classification`                   each file's class and segments
 * - `PUT  /document-ingestion/documents/{id}/classification`                  confirm a file's class and page ranges
 * - `POST /document-ingestion/packages/{id}/classification/confirm-all`       confirm every proposed class
 * - `GET  /document-ingestion/packages/{id}/extract-jobs`                     the package's reading jobs
 * - `POST /document-ingestion/extract-jobs/{id}/retry-failed`                 send only the failed chunks again
 * - `GET  /document-ingestion/llm-calls?packageId=&documentId=`               the organization's AI reading ledger
 * - `GET  /document-ingestion/packages/{id}/llm-calls?documentId=`            one package's ledger
 * - `GET  /document-ingestion/packages/{id}/llm-spend`                        use against the limits
 * - `PUT  /document-ingestion/packages/{id}/llm-budget`                       the package's limit
 * - `GET  /document-ingestion/settings`                                       the organization's settings
 * - `PUT  /document-ingestion/settings/llm-budget`                            the monthly limit
 * - `PUT  /document-ingestion/settings/llm-reading`                           AI reading on or off
 * - `GET  /document-ingestion/packages/{id}/tender-profile`                   accepted tender facts with no project field
 * - `PUT  /document-ingestion/documents/{id}/revision`                        this file replaces an earlier one
 * - `POST /document-ingestion/documents/{id}/revision-diff`                   compare a revised BOQ with the one it replaces
 * - `POST /document-ingestion/candidates/{id}/conflict`                       apply a change over a hand edit, or keep the record
 * - `GET  /document-ingestion/packages/{id}/contract-terms`                   the contract term register
 * - `GET  /document-ingestion/packages/{id}/contract-terms/coverage`          which terms were found, and the pages searched
 * - `GET  /document-ingestion/packages/{id}/obligations`                      the obligation register, paged
 * - `POST /document-ingestion/contract-terms/{id}/risk`                       raise a project risk from a term
 * - `POST /document-ingestion/obligations/{id}/risk`                          raise a project risk from an obligation
 * - `GET  /document-ingestion/packages/{id}/drawings?currentOnly=`            the drawing register, paged
 * - `GET  /document-ingestion/drawings/{id}/revisions`                        a drawing number's revision chain
 * - `GET  /document-ingestion/documents/{id}/title-blocks/{page}/image`       a short-lived link to a sheet's title-block crop
 * - `GET  /document-ingestion/packages/{id}/quality-requirements`             the package's ITP rows, paged
 * - `GET  /document-ingestion/projects/{id}/quality-requirements`             the project's ITP, paged
 * - `POST /document-ingestion/quality-requirements/copy-to-template`          copy ITP rows into checklist templates
 * - `GET  /document-ingestion/packages/{id}/qualification-requirements`       the qualification register
 * - `PUT  /document-ingestion/qualification-requirements/{id}/status`         a person's status for a text requirement
 * - `GET  /document-ingestion/packages/{id}/compliance-matrix`                the Tender Compliance Matrix
 * - `GET  /document-ingestion/company-profile`                                the organization's company profile
 * - `PUT  /document-ingestion/company-profile`                                replace it (evidence is kept)
 * - `POST /document-ingestion/company-profile/evidence/presign`               step 1 of an evidence upload
 * - `POST /document-ingestion/company-profile/evidence/{id}/register`         step 3: confirm it
 * - `GET  /document-ingestion/company-profile/evidence/{id}/download`         a short-lived download link
 * - `DELETE /document-ingestion/company-profile/evidence/{id}`                remove an evidence file
 *
 * Upload is three steps, as for bill documents: presign, PUT the file to `upload.url` with
 * `upload.contentType`, then register with `upload.key`. Company evidence files upload the same way.
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse failure.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  ApplyResult,
  BoqMappingRequest,
  BoqSheet,
  BoqTargetRequest,
  Candidate,
  ClassificationRequest,
  ConfirmAllResult,
  ConflictChoice,
  CandidateDecision,
  CandidateKind,
  CandidateListParams,
  CreatePackageRequest,
  DecisionResult,
  DocumentClassification,
  DocumentIngestionStatus,
  DocumentUpload,
  DownloadUrl,
  ExtractJob,
  IngestDocument,
  IngestPackage,
  IngestPage,
  IngestPageParams,
  IngestSettings,
  LlmBudgetRequest,
  LlmCall,
  LlmCallListParams,
  LlmSpend,
  PackageListParams,
  PresignDocumentRequest,
  Provenance,
  RevisionDiff,
  RevisionRequest,
  TenderProfile,
  parseApplyResult,
  parseBoqSheet,
  parseCandidate,
  parseConfirmAllResult,
  parseDecisionResults,
  parseDocumentClassification,
  parseDocumentIngestionStatus,
  parseDocumentUpload,
  parseDownloadUrl,
  parseExtractJob,
  parseIngestDocument,
  parseIngestPackage,
  parseIngestPage,
  parseIngestSettings,
  parseLlmCall,
  parseLlmSpend,
  parseProvenance,
  parseRevisionDiff,
  parseTenderProfile,
} from '../types/document-ingestion/document-ingestion';
import {
  CompanyEvidence,
  CompanyProfile,
  CompanyProfileRequest,
  ComplianceMatrix,
  ContractTermCoverage,
  ContractTermEntry,
  CopyToTemplateRequest,
  CopyToTemplateResult,
  DrawingEntry,
  DrawingListParams,
  EvidenceUpload,
  ObligationEntry,
  PresignEvidenceRequest,
  QualificationRequirementEntry,
  QualityRequirementEntry,
  RaiseRiskRequest,
  RaisedRisk,
  RequirementStatusRequest,
  parseCompanyEvidence,
  parseCompanyProfile,
  parseComplianceMatrix,
  parseContractTermCoverage,
  parseContractTermEntry,
  parseCopyToTemplateResult,
  parseDrawingEntry,
  parseEvidenceUpload,
  parseObligationEntry,
  parseQualificationRequirementEntry,
  parseQualityRequirementEntry,
  parseRaisedRisk,
} from '../types/document-ingestion/document-ingestion-registers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/document-ingestion';

/** The error code every module endpoint answers with while the module is off for the organization. */
export const MODULE_DISABLED = 'MODULE_DISABLED';

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

function pageQuery(params: IngestPageParams): Record<string, number> {
  const query: Record<string, number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.size !== undefined) query.size = params.size;
  return query;
}

function listOf<T>(what: string, data: unknown, parse: (raw: unknown) => T): T[] {
  return parseWith(what, data, (raw) => (Array.isArray(raw) ? raw : []).map(parse));
}

function riskPayload(req: RaiseRiskRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (req.title !== undefined) payload.title = req.title;
  if (req.category !== undefined) payload.category = req.category;
  if (req.probability !== undefined) payload.probability = req.probability;
  if (req.impact !== undefined) payload.impact = req.impact;
  if (req.responseType !== undefined) payload.responseType = req.responseType;
  if (req.owner !== undefined) payload.owner = req.owner;
  return payload;
}

/**
 * Whether an error is the module being off for the caller's organization, so a screen can show
 * nothing rather than an error.
 */
export function isModuleDisabled(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 403) {
    return false;
  }
  return error.body?.code === MODULE_DISABLED;
}

export const documentIngestionService = {
  /** `GET /document-ingestion/status`: answers only when the module is open to the organization. */
  async status(): Promise<DocumentIngestionStatus> {
    const data = await api.get<ApiResponse>(`${BASE}/status`);
    return parseWith('document ingestion status', data, parseDocumentIngestionStatus);
  },

  // ------------------------------------------------------------------------------------ packages

  async listPackages(params: PackageListParams = {}): Promise<IngestPage<IngestPackage>> {
    const query: Record<string, number> = pageQuery(params);
    if (params.projectId !== undefined) query.projectId = params.projectId;
    const data = await api.get<ApiResponse>(`${BASE}/packages`, query);
    return parseWith('document package list', data, (raw) => parseIngestPage(raw, parseIngestPackage));
  },

  async getPackage(packageId: string): Promise<IngestPackage> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}`);
    return parseWith('document package', data, parseIngestPackage);
  },

  async createPackage(req: CreatePackageRequest): Promise<IngestPackage> {
    const payload: Record<string, unknown> = { name: req.name };
    if (req.projectId !== undefined) payload.projectId = req.projectId;
    if (req.stage !== undefined) payload.stage = req.stage;
    const data = await api.post<ApiResponse>(`${BASE}/packages`, payload);
    return parseWith('document package', data, parseIngestPackage);
  },

  async archivePackage(packageId: string): Promise<IngestPackage> {
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/archive`);
    return parseWith('document package', data, parseIngestPackage);
  },

  /** Chooses the sub-contract the package's BOQ is written to; null clears it. */
  async setBoqTarget(packageId: string, req: BoqTargetRequest): Promise<IngestPackage> {
    const payload: Record<string, unknown> = { subContractId: req.subContractId };
    const data = await api.put<ApiResponse>(`${BASE}/packages/${packageId}/boq-target`, payload);
    return parseWith('document package', data, parseIngestPackage);
  },

  // ----------------------------------------------------------------------------------- documents

  async listDocuments(packageId: string, params: IngestPageParams = {}): Promise<IngestPage<IngestDocument>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/documents`, pageQuery(params));
    return parseWith('document list', data, (raw) => parseIngestPage(raw, parseIngestDocument));
  },

  async getDocument(documentId: string): Promise<IngestDocument> {
    const data = await api.get<ApiResponse>(`${BASE}/documents/${documentId}`);
    return parseWith('document', data, parseIngestDocument);
  },

  /** Step 1 of upload: declares the file and returns where to PUT it. */
  async presignDocument(packageId: string, req: PresignDocumentRequest): Promise<DocumentUpload> {
    const payload: Record<string, unknown> = { fileName: req.fileName, fileSize: req.fileSize };
    if (req.contentType !== undefined) payload.contentType = req.contentType;
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/documents/presign`, payload);
    return parseWith('document upload', data, parseDocumentUpload);
  },

  /** Step 3 of upload: confirms the PUT and queues the file for reading. */
  async registerDocument(packageId: string, documentId: string, key: string): Promise<IngestDocument> {
    const payload: Record<string, unknown> = { key };
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/documents/${documentId}/register`, payload);
    return parseWith('document', data, parseIngestDocument);
  },

  async reparseDocument(documentId: string): Promise<IngestDocument> {
    const data = await api.post<ApiResponse>(`${BASE}/documents/${documentId}/parse`);
    return parseWith('document', data, parseIngestDocument);
  },

  async getDownloadUrl(documentId: string): Promise<DownloadUrl> {
    const data = await api.get<ApiResponse>(`${BASE}/documents/${documentId}/download-url`);
    return parseWith('download link', data, parseDownloadUrl);
  },

  // ---------------------------------------------------------------------------------- BOQ sheets

  /** Finds each sheet's header and proposes a mapping. Sheets already found keep theirs. */
  async detectBoqSheets(documentId: string): Promise<BoqSheet[]> {
    const data = await api.post<ApiResponse>(`${BASE}/documents/${documentId}/boq/sheets/detect`);
    return parseWith('BOQ sheets', data, (raw) => (Array.isArray(raw) ? raw : []).map(parseBoqSheet));
  },

  async listBoqSheets(documentId: string): Promise<BoqSheet[]> {
    const data = await api.get<ApiResponse>(`${BASE}/documents/${documentId}/boq/sheets`);
    return parseWith('BOQ sheets', data, (raw) => (Array.isArray(raw) ? raw : []).map(parseBoqSheet));
  },

  /** Confirms a sheet's mapping and reads its rows; reading again replaces its unapplied rows. */
  async extractBoqSheet(documentId: string, sheetId: string, req: BoqMappingRequest): Promise<BoqSheet> {
    const payload: Record<string, unknown> = { headerRow: req.headerRow, columns: req.columns };
    if (req.codePrefix !== undefined) payload.codePrefix = req.codePrefix;
    const data = await api.post<ApiResponse>(`${BASE}/documents/${documentId}/boq/sheets/${sheetId}/extract`, payload);
    return parseWith('BOQ sheet', data, parseBoqSheet);
  },

  // ------------------------------------------------------------------------------ review, apply

  async listCandidates(packageId: string, params: CandidateListParams = {}): Promise<IngestPage<Candidate>> {
    const query: Record<string, string | number> = pageQuery(params);
    if (params.kind !== undefined) query.kind = params.kind;
    if (params.status !== undefined) query.status = params.status;
    if (params.segmentId !== undefined) query.segmentId = params.segmentId;
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/candidates`, query);
    return parseWith('candidate list', data, (raw) => parseIngestPage(raw, parseCandidate));
  },

  /** Accept, edit or reject, one or many. Each decision reports its own outcome. */
  async decide(packageId: string, decisions: CandidateDecision[]): Promise<DecisionResult[]> {
    const payload: Record<string, unknown> = {
      decisions: decisions.map((d) => {
        const decision: Record<string, unknown> = { candidateId: d.candidateId, action: d.action };
        if (d.edits !== undefined) decision.edits = d.edits;
        if (d.acknowledgedFlags !== undefined) decision.acknowledgedFlags = d.acknowledgedFlags;
        return decision;
      }),
    };
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/candidates/decisions`, payload);
    return parseWith('review decisions', data, parseDecisionResults);
  },

  /** Writes accepted values of one kind. Call again while `remaining` is above zero. */
  async apply(packageId: string, kind: CandidateKind): Promise<ApplyResult> {
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/apply`, undefined, { kind });
    return parseWith('apply result', data, parseApplyResult);
  },

  /** Writes every accepted value of one kind, calling again while rows remain, and adds the results up. */
  async applyAll(packageId: string, kind: CandidateKind, maxCalls = 20): Promise<ApplyResult> {
    const total: ApplyResult = { applied: 0, failed: 0, remaining: 0 };
    for (let call = 0; call < maxCalls; call++) {
      const result = await documentIngestionService.apply(packageId, kind);
      total.applied += result.applied;
      total.failed += result.failed;
      total.remaining = result.remaining;
      if (result.remaining === 0 || result.applied + result.failed === 0) break;
    }
    return total;
  },

  async provenance(targetType: string, targetId: string): Promise<Provenance[]> {
    const data = await api.get<ApiResponse>(`${BASE}/provenance`, { targetType, targetId });
    return parseWith('provenance', data, (raw) => (Array.isArray(raw) ? raw : []).map(parseProvenance));
  },

  // ------------------------------------------------------------------------------ classification

  async listClassifications(
    packageId: string,
    params: IngestPageParams = {}
  ): Promise<IngestPage<DocumentClassification>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/classification`, pageQuery(params));
    return parseWith('classification list', data, (raw) => parseIngestPage(raw, parseDocumentClassification));
  },

  /** Confirms a file's class, and optionally its page ranges, replacing what was proposed. */
  async classifyDocument(documentId: string, req: ClassificationRequest): Promise<DocumentClassification> {
    const payload: Record<string, unknown> = { docClass: req.docClass };
    if (req.segments !== undefined) payload.segments = req.segments;
    const data = await api.put<ApiResponse>(`${BASE}/documents/${documentId}/classification`, payload);
    return parseWith('classification', data, parseDocumentClassification);
  },

  /** Confirms every proposed class in one batch. Call again while `remaining` is above zero. */
  async confirmAllClassifications(packageId: string): Promise<ConfirmAllResult> {
    const data = await api.post<ApiResponse>(`${BASE}/packages/${packageId}/classification/confirm-all`);
    return parseWith('confirm-all result', data, parseConfirmAllResult);
  },

  /** Confirms every proposed class, calling again while some remain, and adds the results up. */
  async confirmAllClassificationsFully(packageId: string, maxCalls = 20): Promise<ConfirmAllResult> {
    const total: ConfirmAllResult = { documentsConfirmed: 0, segmentsConfirmed: 0, jobsQueued: 0, remaining: 0 };
    for (let call = 0; call < maxCalls; call++) {
      const result = await documentIngestionService.confirmAllClassifications(packageId);
      total.documentsConfirmed += result.documentsConfirmed;
      total.segmentsConfirmed += result.segmentsConfirmed;
      total.jobsQueued += result.jobsQueued;
      total.remaining = result.remaining;
      if (result.remaining === 0 || result.documentsConfirmed === 0) break;
    }
    return total;
  },

  // --------------------------------------------------------------------------------- extract jobs

  async listExtractJobs(packageId: string, params: IngestPageParams = {}): Promise<IngestPage<ExtractJob>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/extract-jobs`, pageQuery(params));
    return parseWith('extract job list', data, (raw) => parseIngestPage(raw, parseExtractJob));
  },

  /** Sends only the chunks that failed again; parts already read are skipped. */
  async retryFailedChunks(jobId: string): Promise<ExtractJob> {
    const data = await api.post<ApiResponse>(`${BASE}/extract-jobs/${jobId}/retry-failed`);
    return parseWith('extract job', data, parseExtractJob);
  },

  // ------------------------------------------------------------------------------ ledger, budget

  /** The organization's AI reading ledger, newest first; filter by package or file. */
  async listLlmCalls(params: LlmCallListParams = {}): Promise<IngestPage<LlmCall>> {
    const query: Record<string, string | number> = pageQuery(params);
    if (params.packageId !== undefined) query.packageId = params.packageId;
    if (params.documentId !== undefined) query.documentId = params.documentId;
    const data = await api.get<ApiResponse>(`${BASE}/llm-calls`, query);
    return parseWith('AI call list', data, (raw) => parseIngestPage(raw, parseLlmCall));
  },

  /** One package's AI reading ledger; `packageId` in the params is ignored. */
  async listPackageLlmCalls(packageId: string, params: LlmCallListParams = {}): Promise<IngestPage<LlmCall>> {
    const query: Record<string, string | number> = pageQuery(params);
    if (params.documentId !== undefined) query.documentId = params.documentId;
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/llm-calls`, query);
    return parseWith('AI call list', data, (raw) => parseIngestPage(raw, parseLlmCall));
  },

  async getLlmSpend(packageId: string): Promise<LlmSpend> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/llm-spend`);
    return parseWith('AI spend', data, parseLlmSpend);
  },

  /** Sets the package's limit; a null limit goes back to the default. A job paused on the budget resumes once it has room. */
  async setPackageLlmBudget(packageId: string, req: LlmBudgetRequest): Promise<LlmSpend> {
    const payload: Record<string, unknown> = { budgetUsd: req.budgetUsd, budgetTokens: req.budgetTokens };
    const data = await api.put<ApiResponse>(`${BASE}/packages/${packageId}/llm-budget`, payload);
    return parseWith('AI spend', data, parseLlmSpend);
  },

  // ------------------------------------------------------------------------------------- settings

  async getSettings(): Promise<IngestSettings> {
    const data = await api.get<ApiResponse>(`${BASE}/settings`);
    return parseWith('document ingestion settings', data, parseIngestSettings);
  },

  /** Sets the organization's monthly limit; a null limit goes back to the default. Each change is recorded. */
  async setMonthlyLlmBudget(req: LlmBudgetRequest): Promise<IngestSettings> {
    const payload: Record<string, unknown> = { budgetUsd: req.budgetUsd, budgetTokens: req.budgetTokens };
    const data = await api.put<ApiResponse>(`${BASE}/settings/llm-budget`, payload);
    return parseWith('document ingestion settings', data, parseIngestSettings);
  },

  /** Turns AI reading on or off for the organization. */
  async setLlmReading(enabled: boolean): Promise<IngestSettings> {
    const payload: Record<string, unknown> = { enabled };
    const data = await api.put<ApiResponse>(`${BASE}/settings/llm-reading`, payload);
    return parseWith('document ingestion settings', data, parseIngestSettings);
  },

  // ------------------------------------------------------------------------------ tender profile

  /** The accepted tender facts with no project field, or null while none has been applied (the backend's 404). */
  async getTenderProfile(packageId: string): Promise<TenderProfile | null> {
    let data: ApiResponse;
    try {
      data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/tender-profile`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && !isModuleDisabled(error)) return null;
      throw error;
    }
    return parseWith('tender profile', data, parseTenderProfile);
  },

  // ------------------------------------------------------------------------- revisions, changes

  /** Records that a file replaces an earlier file of the same package. A chain that would loop is refused. */
  async setRevision(documentId: string, req: RevisionRequest): Promise<IngestDocument> {
    const payload: Record<string, unknown> = { supersedesDocumentId: req.supersedesDocumentId };
    if (req.revisionLabel !== undefined) payload.revisionLabel = req.revisionLabel;
    const data = await api.put<ApiResponse>(`${BASE}/documents/${documentId}/revision`, payload);
    return parseWith('document', data, parseIngestDocument);
  },

  /** Compares a revised BOQ with the file it replaces, row by row, proposing a `CHANGE` per difference. Run again, it adds nothing. */
  async diffRevision(documentId: string): Promise<RevisionDiff> {
    const data = await api.post<ApiResponse>(`${BASE}/documents/${documentId}/revision-diff`);
    return parseWith('revision comparison', data, parseRevisionDiff);
  },

  /**
   * A person's choice on a change refused because its target was edited by hand since it was
   * applied: `APPLY_CHANGE` writes it over the record on the next apply, `KEEP_RECORD` rejects it.
   */
  async resolveConflict(candidateId: string, choice: ConflictChoice): Promise<Candidate> {
    const payload: Record<string, unknown> = { choice };
    const data = await api.post<ApiResponse>(`${BASE}/candidates/${candidateId}/conflict`, payload);
    return parseWith('candidate', data, parseCandidate);
  },

  // ---------------------------------------------------------------------- contract terms, obligations

  /** The package's accepted contract terms. */
  async listContractTerms(packageId: string): Promise<ContractTermEntry[]> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/contract-terms`);
    return listOf('contract terms', data, parseContractTermEntry);
  },

  /** Which of the 19 terms were found, every value found for each, and the pages searched for each term not found. */
  async getContractTermCoverage(packageId: string): Promise<ContractTermCoverage> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/contract-terms/coverage`);
    return parseWith('contract term coverage', data, parseContractTermCoverage);
  },

  async listObligations(packageId: string, params: IngestPageParams = {}): Promise<IngestPage<ObligationEntry>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/obligations`, pageQuery(params));
    return parseWith('obligation list', data, (raw) => parseIngestPage(raw, parseObligationEntry));
  },

  /** Raises one project risk from a contract term. Raised again, it answers with the same risk and `created` false. */
  async raiseContractTermRisk(termId: string, req: RaiseRiskRequest = {}): Promise<RaisedRisk> {
    const payload = riskPayload(req);
    const data = await api.post<ApiResponse>(`${BASE}/contract-terms/${termId}/risk`, payload);
    return parseWith('raised risk', data, parseRaisedRisk);
  },

  /** Raises one project risk from an obligation. Raised again, it answers with the same risk and `created` false. */
  async raiseObligationRisk(obligationId: string, req: RaiseRiskRequest = {}): Promise<RaisedRisk> {
    const payload = riskPayload(req);
    const data = await api.post<ApiResponse>(`${BASE}/obligations/${obligationId}/risk`, payload);
    return parseWith('raised risk', data, parseRaisedRisk);
  },

  // ------------------------------------------------------------------------------------- drawings

  /** The drawing register by number and revision; `currentOnly` keeps the current revision of each number. */
  async listDrawings(packageId: string, params: DrawingListParams = {}): Promise<IngestPage<DrawingEntry>> {
    const query: Record<string, number | boolean> = pageQuery(params);
    if (params.currentOnly !== undefined) query.currentOnly = params.currentOnly;
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/drawings`, query);
    return parseWith('drawing list', data, (raw) => parseIngestPage(raw, parseDrawingEntry));
  },

  /** Every revision of the drawing's number, in revision order. */
  async listDrawingRevisions(drawingId: string): Promise<DrawingEntry[]> {
    const data = await api.get<ApiResponse>(`${BASE}/drawings/${drawingId}/revisions`);
    return listOf('drawing revisions', data, parseDrawingEntry);
  },

  /**
   * A short-lived link to the file reader's image of one page of a PDF (pages from 1), for drawing a
   * source box over, or null when there is none for that page (the backend's 404).
   */
  async getPageImage(documentId: string, page: number): Promise<DownloadUrl | null> {
    let data: ApiResponse;
    try {
      data = await api.get<ApiResponse>(`${BASE}/documents/${documentId}/pages/${page}/image`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && !isModuleDisabled(error)) return null;
      throw error;
    }
    return parseWith('page image link', data, parseDownloadUrl);
  },

  /** A short-lived link to a sheet's title-block crop, or null when the worker cropped none for that page (the backend's 404). */
  async getTitleBlockImage(documentId: string, page: number): Promise<DownloadUrl | null> {
    let data: ApiResponse;
    try {
      data = await api.get<ApiResponse>(`${BASE}/documents/${documentId}/title-blocks/${page}/image`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && !isModuleDisabled(error)) return null;
      throw error;
    }
    return parseWith('title-block image link', data, parseDownloadUrl);
  },

  // -------------------------------------------------------------------------- quality requirements

  /** The ITP rows read from one package. */
  async listQualityRequirements(
    packageId: string,
    params: IngestPageParams = {}
  ): Promise<IngestPage<QualityRequirementEntry>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/quality-requirements`, pageQuery(params));
    return parseWith('quality requirement list', data, (raw) => parseIngestPage(raw, parseQualityRequirementEntry));
  },

  /** A project's inspection and test plan, across its packages. */
  async listProjectQualityRequirements(
    projectId: number,
    params: IngestPageParams = {}
  ): Promise<IngestPage<QualityRequirementEntry>> {
    const data = await api.get<ApiResponse>(`${BASE}/projects/${projectId}/quality-requirements`, pageQuery(params));
    return parseWith('quality requirement list', data, (raw) => parseIngestPage(raw, parseQualityRequirementEntry));
  },

  /**
   * Copies ITP rows as check points into the checklist template of their trade, or of `tradeId` for
   * every row. Each row reports its own outcome; a row copied before answers `ALREADY_COPIED`.
   */
  async copyQualityRequirementsToTemplate(req: CopyToTemplateRequest): Promise<CopyToTemplateResult> {
    const payload: Record<string, unknown> = { requirementIds: req.requirementIds };
    if (req.tradeId !== undefined) payload.tradeId = req.tradeId;
    const data = await api.post<ApiResponse>(`${BASE}/quality-requirements/copy-to-template`, payload);
    return parseWith('copy-to-template result', data, parseCopyToTemplateResult);
  },

  // ------------------------------------------------------------------ qualification, compliance

  async listQualificationRequirements(packageId: string): Promise<QualificationRequirementEntry[]> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/qualification-requirements`);
    return listOf('qualification requirements', data, parseQualificationRequirementEntry);
  },

  /** A person's status for an equipment or personnel requirement; a null status clears it. */
  async setQualificationStatus(
    requirementId: string,
    req: RequirementStatusRequest
  ): Promise<QualificationRequirementEntry> {
    const payload: Record<string, unknown> = { status: req.status };
    if (req.note !== undefined) payload.note = req.note;
    const data = await api.put<ApiResponse>(`${BASE}/qualification-requirements/${requirementId}/status`, payload);
    return parseWith('qualification requirement', data, parseQualificationRequirementEntry);
  },

  /** The package's requirements against the company profile, each `MATCH`, `GAP` or `UNKNOWN`. */
  async getComplianceMatrix(packageId: string): Promise<ComplianceMatrix> {
    const data = await api.get<ApiResponse>(`${BASE}/packages/${packageId}/compliance-matrix`);
    return parseWith('compliance matrix', data, parseComplianceMatrix);
  },

  // ------------------------------------------------------------------------------ company profile

  async getCompanyProfile(): Promise<CompanyProfile> {
    const data = await api.get<ApiResponse>(`${BASE}/company-profile`);
    return parseWith('company profile', data, parseCompanyProfile);
  },

  /** Replaces the whole profile. Evidence files are kept; a list left out is saved empty. */
  async saveCompanyProfile(req: CompanyProfileRequest): Promise<CompanyProfile> {
    const payload: Record<string, unknown> = {
      yearsInBusiness: req.yearsInBusiness ?? null,
      turnover: req.turnover ?? [],
      similarProjects: req.similarProjects ?? [],
      equipment: req.equipment ?? [],
      personnel: req.personnel ?? [],
    };
    const data = await api.put<ApiResponse>(`${BASE}/company-profile`, payload);
    return parseWith('company profile', data, parseCompanyProfile);
  },

  /** Step 1 of an evidence upload: declares the file and returns where to PUT it. */
  async presignCompanyEvidence(req: PresignEvidenceRequest): Promise<EvidenceUpload> {
    const payload: Record<string, unknown> = { section: req.section, fileName: req.fileName, fileSize: req.fileSize };
    if (req.contentType !== undefined) payload.contentType = req.contentType;
    if (req.label !== undefined) payload.label = req.label;
    const data = await api.post<ApiResponse>(`${BASE}/company-profile/evidence/presign`, payload);
    return parseWith('evidence upload', data, parseEvidenceUpload);
  },

  /** Step 3 of an evidence upload: confirms the PUT. */
  async registerCompanyEvidence(evidenceId: string, key: string): Promise<CompanyEvidence> {
    const payload: Record<string, unknown> = { key };
    const data = await api.post<ApiResponse>(`${BASE}/company-profile/evidence/${evidenceId}/register`, payload);
    return parseWith('company evidence', data, parseCompanyEvidence);
  },

  async getCompanyEvidenceDownloadUrl(evidenceId: string): Promise<DownloadUrl> {
    const data = await api.get<ApiResponse>(`${BASE}/company-profile/evidence/${evidenceId}/download`);
    return parseWith('download link', data, parseDownloadUrl);
  },

  async deleteCompanyEvidence(evidenceId: string): Promise<void> {
    await api.delete(`${BASE}/company-profile/evidence/${evidenceId}`);
  },
};
