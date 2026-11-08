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
 *
 * Upload is three steps, as for bill documents: presign, PUT the file to `upload.url` with
 * `upload.contentType`, then register with `upload.key`.
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
  CandidateDecision,
  CandidateKind,
  CandidateListParams,
  CreatePackageRequest,
  DecisionResult,
  DocumentIngestionStatus,
  DocumentUpload,
  DownloadUrl,
  IngestDocument,
  IngestPackage,
  IngestPage,
  IngestPageParams,
  PresignDocumentRequest,
  Provenance,
  parseApplyResult,
  parseBoqSheet,
  parseCandidate,
  parseDecisionResults,
  parseDocumentIngestionStatus,
  parseDocumentUpload,
  parseDownloadUrl,
  parseIngestDocument,
  parseIngestPackage,
  parseIngestPage,
  parseProvenance,
} from '../types/document-ingestion/document-ingestion';

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

  async listPackages(params: IngestPageParams = {}): Promise<IngestPage<IngestPackage>> {
    const data = await api.get<ApiResponse>(`${BASE}/packages`, pageQuery(params));
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
};
