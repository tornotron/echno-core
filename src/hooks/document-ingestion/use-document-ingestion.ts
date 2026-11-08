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
  IngestDocument,
  IngestPageParams,
} from '../../types/document-ingestion/document-ingestion';
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

export function useIngestPackages(params: IngestPageParams = {}, enabled = true) {
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
