/**
 * @module use-document-ingestion
 *
 * Query hooks for the Document Ingestion domain. {@link useDocumentIngestionStatus} never retries,
 * because its 403 `MODULE_DISABLED` is an answer, not a failure: a screen reads it to show nothing.
 */

import { useQuery } from '@tanstack/react-query';
import { documentIngestionService } from '../../services/document-ingestion-service';
import { shouldRetry } from '../../lib/query/retry';
import type {
  CandidateListParams,
  ExtractJob,
  IngestDocument,
  IngestPageParams,
  LlmCallListParams,
  PackageListParams,
} from '../../types/document-ingestion/document-ingestion';
import type { DrawingListParams } from '../../types/document-ingestion/document-ingestion-registers';
import { documentIngestionKeys } from './keys';

/** Whether the module is open to the organization; an error means it is not. */
export function useDocumentIngestionStatus(enabled = true) {
  return useQuery({
    queryKey: documentIngestionKeys.status(),
    queryFn: () => documentIngestionService.status(),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIngestPackages(params: PackageListParams = {}, enabled = true) {
  return useQuery({
    queryKey: documentIngestionKeys.packages(params),
    queryFn: () => documentIngestionService.listPackages(params),
    enabled,
    retry: shouldRetry,
  });
}

export function useIngestPackage(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.package(packageId ?? ''),
    queryFn: () => documentIngestionService.getPackage(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/** Whether a file is still waiting to be read, so a list keeps polling. */
export function isAwaitingReading(doc: IngestDocument): boolean {
  return doc.status === 'QUEUED' || doc.latestJob?.status === 'QUEUED' || doc.latestJob?.status === 'RUNNING';
}

/**
 * A package's files. While any file is still being read the list polls every `pollMs`, and stops
 * once every file is parsed, failed or stored.
 */
export function useIngestDocuments(packageId: string | undefined, params: IngestPageParams = {}, pollMs = 4000) {
  return useQuery({
    queryKey: documentIngestionKeys.documents(packageId ?? '', params),
    queryFn: () => documentIngestionService.listDocuments(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
    refetchInterval: (query) =>
      query.state.data?.content.some(isAwaitingReading) ? pollMs : false,
  });
}

export function useIngestDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.document(documentId ?? ''),
    queryFn: () => documentIngestionService.getDocument(documentId as string),
    enabled: Boolean(documentId),
    retry: shouldRetry,
  });
}

export function useBoqSheets(documentId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.boqSheets(documentId ?? ''),
    queryFn: () => documentIngestionService.listBoqSheets(documentId as string),
    enabled: Boolean(documentId),
    retry: shouldRetry,
  });
}

export function useIngestCandidates(packageId: string | undefined, params: CandidateListParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.candidates(packageId ?? '', params),
    queryFn: () => documentIngestionService.listCandidates(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/** Where each field of a live record came from; disabled until both ids are known. */
export function useProvenance(targetType: string | undefined, targetId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.provenance(targetType ?? '', targetId ?? ''),
    queryFn: () => documentIngestionService.provenance(targetType as string, targetId as string),
    enabled: Boolean(targetType && targetId),
    retry: shouldRetry,
  });
}

export function useIngestClassifications(packageId: string | undefined, params: IngestPageParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.classification(packageId ?? '', params),
    queryFn: () => documentIngestionService.listClassifications(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/**
 * Whether a reading job is still moving, so a list keeps polling. A job waiting on the AI service
 * or paused on the budget resumes by itself, so it counts as moving.
 */
export function isExtractJobActive(job: ExtractJob): boolean {
  return job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'WAITING_LLM' || job.status === 'PAUSED_BUDGET';
}

/** A package's reading jobs. Polls every `pollMs` while any job is still moving. */
export function useExtractJobs(packageId: string | undefined, params: IngestPageParams = {}, pollMs = 5000) {
  return useQuery({
    queryKey: documentIngestionKeys.extractJobs(packageId ?? '', params),
    queryFn: () => documentIngestionService.listExtractJobs(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
    refetchInterval: (query) => (query.state.data?.content.some(isExtractJobActive) ? pollMs : false),
  });
}

/** The organization's AI reading ledger. */
export function useLlmCalls(params: LlmCallListParams = {}, enabled = true) {
  return useQuery({
    queryKey: documentIngestionKeys.llmCalls(params),
    queryFn: () => documentIngestionService.listLlmCalls(params),
    enabled,
    retry: shouldRetry,
  });
}

/** One package's AI reading ledger. */
export function usePackageLlmCalls(packageId: string | undefined, params: LlmCallListParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.packageLlmCalls(packageId ?? '', params),
    queryFn: () => documentIngestionService.listPackageLlmCalls(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useLlmSpend(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.llmSpend(packageId ?? ''),
    queryFn: () => documentIngestionService.getLlmSpend(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useIngestSettings(enabled = true) {
  return useQuery({
    queryKey: documentIngestionKeys.settings(),
    queryFn: () => documentIngestionService.getSettings(),
    enabled,
    retry: shouldRetry,
  });
}

/** The package's tender profile; `data` is null while no project field has been applied. */
export function useTenderProfile(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.tenderProfile(packageId ?? ''),
    queryFn: () => documentIngestionService.getTenderProfile(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useContractTerms(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.contractTerms(packageId ?? ''),
    queryFn: () => documentIngestionService.listContractTerms(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/** Which of the 19 contract terms were found in the package, and the pages searched for each one not found. */
export function useContractTermCoverage(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.contractTermCoverage(packageId ?? ''),
    queryFn: () => documentIngestionService.getContractTermCoverage(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useObligations(packageId: string | undefined, params: IngestPageParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.obligations(packageId ?? '', params),
    queryFn: () => documentIngestionService.listObligations(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useDrawings(packageId: string | undefined, params: DrawingListParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.drawings(packageId ?? '', params),
    queryFn: () => documentIngestionService.listDrawings(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useDrawingRevisions(drawingId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.drawingRevisions(drawingId ?? ''),
    queryFn: () => documentIngestionService.listDrawingRevisions(drawingId as string),
    enabled: Boolean(drawingId),
    retry: shouldRetry,
  });
}

/**
 * A short-lived link to the image of one page of a document; `data` is null when there is none. Held
 * for a minute, as the title-block crop is, because the link is signed.
 */
export function usePageImage(documentId: string | undefined, page: number | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.pageImage(documentId ?? '', page ?? 0),
    queryFn: () => documentIngestionService.getPageImage(documentId as string, page as number),
    enabled: Boolean(documentId) && page !== undefined,
    retry: shouldRetry,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * A short-lived link to a sheet's title-block crop; `data` is null when there is none. The link is
 * signed, so it is held for a minute and fetched again after that rather than reused once expired.
 */
export function useTitleBlockImage(documentId: string | undefined, page: number | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.titleBlockImage(documentId ?? '', page ?? 0),
    queryFn: () => documentIngestionService.getTitleBlockImage(documentId as string, page as number),
    enabled: Boolean(documentId) && page !== undefined,
    retry: shouldRetry,
    staleTime: 60 * 1000,
    gcTime: 60 * 1000,
  });
}

/** The ITP rows read from one package. */
export function useQualityRequirements(packageId: string | undefined, params: IngestPageParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.qualityRequirements(packageId ?? '', params),
    queryFn: () => documentIngestionService.listQualityRequirements(packageId as string, params),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/** A project's inspection and test plan. */
export function useProjectQualityRequirements(projectId: number | undefined, params: IngestPageParams = {}) {
  return useQuery({
    queryKey: documentIngestionKeys.projectQualityRequirements(projectId ?? 0, params),
    queryFn: () => documentIngestionService.listProjectQualityRequirements(projectId as number, params),
    enabled: projectId !== undefined && projectId > 0,
    retry: shouldRetry,
  });
}

export function useQualificationRequirements(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.qualificationRequirements(packageId ?? ''),
    queryFn: () => documentIngestionService.listQualificationRequirements(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

/** The Tender Compliance Matrix; while `shown` is false its `notice` says why it has no rows. */
export function useComplianceMatrix(packageId: string | undefined) {
  return useQuery({
    queryKey: documentIngestionKeys.complianceMatrix(packageId ?? ''),
    queryFn: () => documentIngestionService.getComplianceMatrix(packageId as string),
    enabled: Boolean(packageId),
    retry: shouldRetry,
  });
}

export function useCompanyProfile(enabled = true) {
  return useQuery({
    queryKey: documentIngestionKeys.companyProfile(),
    queryFn: () => documentIngestionService.getCompanyProfile(),
    enabled,
    retry: shouldRetry,
  });
}
