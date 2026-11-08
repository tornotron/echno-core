/**
 * @module document-ingestion-keys
 *
 * Query keys for the Document Ingestion domain. Everything sits under one prefix, so a mutation
 * can refresh the whole domain at once.
 */

import type { CandidateListParams, IngestPageParams } from '../../types/document-ingestion/document-ingestion';

export const documentIngestionKeys = {
  all: ['document-ingestion'] as const,
  status: () => [...documentIngestionKeys.all, 'status'] as const,
  packages: (params: IngestPageParams = {}) => [...documentIngestionKeys.all, 'packages', params] as const,
  package: (packageId: string) => [...documentIngestionKeys.all, 'package', packageId] as const,
  documents: (packageId: string, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'documents', packageId, params] as const,
  document: (documentId: string) => [...documentIngestionKeys.all, 'document', documentId] as const,
  boqSheets: (documentId: string) => [...documentIngestionKeys.all, 'boq-sheets', documentId] as const,
  candidates: (packageId: string, params: CandidateListParams = {}) =>
    [...documentIngestionKeys.all, 'candidates', packageId, params] as const,
  provenance: (targetType: string, targetId: string) =>
    [...documentIngestionKeys.all, 'provenance', targetType, targetId] as const,
};
