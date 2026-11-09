/**
 * @module document-ingestion-keys
 *
 * Query keys for the Document Ingestion domain. Everything sits under one prefix, so a mutation
 * can refresh the whole domain at once.
 */

import type {
  CandidateListParams,
  IngestPageParams,
  LlmCallListParams,
  PackageListParams,
} from '../../types/document-ingestion/document-ingestion';
import type { DrawingListParams } from '../../types/document-ingestion/document-ingestion-registers';

export const documentIngestionKeys = {
  all: ['document-ingestion'] as const,
  status: () => [...documentIngestionKeys.all, 'status'] as const,
  packages: (params: PackageListParams = {}) => [...documentIngestionKeys.all, 'packages', params] as const,
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
  contractTerms: (packageId: string) => [...documentIngestionKeys.all, 'contract-terms', packageId] as const,
  contractTermCoverage: (packageId: string) =>
    [...documentIngestionKeys.all, 'contract-term-coverage', packageId] as const,
  obligations: (packageId: string, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'obligations', packageId, params] as const,
  drawings: (packageId: string, params: DrawingListParams = {}) =>
    [...documentIngestionKeys.all, 'drawings', packageId, params] as const,
  drawingRevisions: (drawingId: string) => [...documentIngestionKeys.all, 'drawing-revisions', drawingId] as const,
  pageImage: (documentId: string, page: number) =>
    [...documentIngestionKeys.all, 'page-image', documentId, page] as const,
  titleBlockImage: (documentId: string, page: number) =>
    [...documentIngestionKeys.all, 'title-block-image', documentId, page] as const,
  qualityRequirements: (packageId: string, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'quality-requirements', packageId, params] as const,
  projectQualityRequirements: (projectId: number, params: IngestPageParams = {}) =>
    [...documentIngestionKeys.all, 'project-quality-requirements', projectId, params] as const,
  qualificationRequirements: (packageId: string) =>
    [...documentIngestionKeys.all, 'qualification-requirements', packageId] as const,
  complianceMatrix: (packageId: string) => [...documentIngestionKeys.all, 'compliance-matrix', packageId] as const,
  companyProfile: () => [...documentIngestionKeys.all, 'company-profile'] as const,
};
