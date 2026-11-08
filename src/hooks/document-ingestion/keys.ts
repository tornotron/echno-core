/**
 * @module document-ingestion-keys
 *
 * Query keys for the Document Ingestion domain. Everything sits under one prefix, so a mutation
 * can refresh the whole domain at once.
 */

import type { CandidateListParams, IngestPageParams, LlmCallListParams } from '../../types/document-ingestion/document-ingestion';

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
  classification: (packageId: string, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'classification', packageId, params] as const,
  extractJobs: (packageId: string, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'extract-jobs', packageId, params] as const,
  llmCalls: (params: LlmCallListParams = {}) => [...documentIngestionKeys.all, 'llm-calls', params] as const,
  packageLlmCalls: (packageId: string, params: LlmCallListParams = {}) =>
    [...documentIngestionKeys.all, 'package-llm-calls', packageId, params] as const,
  llmSpend: (packageId: string) => [...documentIngestionKeys.all, 'llm-spend', packageId] as const,
  settings: () => [...documentIngestionKeys.all, 'settings'] as const,
  tenderProfile: (packageId: string) => [...documentIngestionKeys.all, 'tender-profile', packageId] as const,
};
