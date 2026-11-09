/**
 * @module use-document-ingestion-mutations
 *
 * Mutation hooks for the Document Ingestion domain. Each refreshes the whole domain on success, so
 * a package, its files, its sheets and its candidates read again together. Upload is presign, a PUT
 * of the file to the returned URL (the app's own uploader), then register.
 */

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentIngestionService } from '../../services/document-ingestion-service';
import type {
  BoqMappingRequest,
  CandidateDecision,
  CandidateKind,
  ClassificationRequest,
  ConflictChoice,
  CreatePackageRequest,
  LlmBudgetRequest,
  PresignDocumentRequest,
  RevisionRequest,
} from '../../types/document-ingestion/document-ingestion';
import type {
  CompanyProfileRequest,
  CopyToTemplateRequest,
  PresignEvidenceRequest,
  RaiseRiskRequest,
  RequirementStatusRequest,
} from '../../types/document-ingestion/document-ingestion-registers';
import { checklistTemplateKeys } from '../inspection/keys';
import { riskKeys } from '../risk/keys';
import { documentIngestionKeys } from './keys';

/** Refreshes the whole domain, and any other domain the write reaches, such as the risk register. */
function useInvalidateDocumentIngestion(also: readonly QueryKey[] = []) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: documentIngestionKeys.all });
    await Promise.all(also.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
}

export function useCreateIngestPackage() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (req: CreatePackageRequest) => documentIngestionService.createPackage(req),
    onSuccess: invalidate,
  });
}

export function useArchiveIngestPackage() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (packageId: string) => documentIngestionService.archivePackage(packageId),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ packageId, subContractId }`; a null contract clears the target. */
export function useSetBoqTarget() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ packageId, subContractId }: { packageId: string; subContractId: number | null }) =>
      documentIngestionService.setBoqTarget(packageId, { subContractId }),
    onSuccess: invalidate,
  });
}

/** Step 1 of upload. Nothing to refresh until the file is registered. */
export function usePresignIngestDocument() {
  return useMutation({
    mutationFn: ({ packageId, req }: { packageId: string; req: PresignDocumentRequest }) =>
      documentIngestionService.presignDocument(packageId, req),
  });
}

/** Step 3 of upload. Mutate with `{ packageId, documentId, key }`. */
export function useRegisterIngestDocument() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ packageId, documentId, key }: { packageId: string; documentId: string; key: string }) =>
      documentIngestionService.registerDocument(packageId, documentId, key),
    onSuccess: invalidate,
  });
}

export function useReparseIngestDocument() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (documentId: string) => documentIngestionService.reparseDocument(documentId),
    onSuccess: invalidate,
  });
}

export function useDetectBoqSheets() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (documentId: string) => documentIngestionService.detectBoqSheets(documentId),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ documentId, sheetId, mapping }`. */
export function useExtractBoqSheet() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ documentId, sheetId, mapping }: { documentId: string; sheetId: string; mapping: BoqMappingRequest }) =>
      documentIngestionService.extractBoqSheet(documentId, sheetId, mapping),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ packageId, decisions }`. Each decision reports its own outcome. */
export function useDecideCandidates() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ packageId, decisions }: { packageId: string; decisions: CandidateDecision[] }) =>
      documentIngestionService.decide(packageId, decisions),
    onSuccess: invalidate,
  });
}

/** Writes every accepted value of one kind. Mutate with `{ packageId, kind }`. */
export function useApplyCandidates() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ packageId, kind }: { packageId: string; kind: CandidateKind }) =>
      documentIngestionService.applyAll(packageId, kind),
    onSuccess: invalidate,
    onError: invalidate,
  });
}

/** Mutate with `{ documentId, req }` to confirm a file's class and page ranges. */
export function useClassifyIngestDocument() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ documentId, req }: { documentId: string; req: ClassificationRequest }) =>
      documentIngestionService.classifyDocument(documentId, req),
    onSuccess: invalidate,
  });
}

/** Confirms every proposed class of a package, however many calls it takes. Mutate with the package id. */
export function useConfirmAllClassifications() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (packageId: string) => documentIngestionService.confirmAllClassificationsFully(packageId),
    onSuccess: invalidate,
    onError: invalidate,
  });
}

/** Mutate with the job id to send its failed chunks again. */
export function useRetryExtractJob() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (jobId: string) => documentIngestionService.retryFailedChunks(jobId),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ packageId, budget }`. */
export function useSetPackageLlmBudget() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ packageId, budget }: { packageId: string; budget: LlmBudgetRequest }) =>
      documentIngestionService.setPackageLlmBudget(packageId, budget),
    onSuccess: invalidate,
  });
}

export function useSetMonthlyLlmBudget() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (budget: LlmBudgetRequest) => documentIngestionService.setMonthlyLlmBudget(budget),
    onSuccess: invalidate,
  });
}

/** Mutate with whether AI reading should be on. */
export function useSetLlmReading() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (enabled: boolean) => documentIngestionService.setLlmReading(enabled),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ documentId, req }`: this file replaces `req.supersedesDocumentId`. */
export function useSetIngestRevision() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ documentId, req }: { documentId: string; req: RevisionRequest }) =>
      documentIngestionService.setRevision(documentId, req),
    onSuccess: invalidate,
  });
}

/** Mutate with the revised file's id to propose its changes against the file it replaces. */
export function useDiffIngestRevision() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (documentId: string) => documentIngestionService.diffRevision(documentId),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ candidateId, choice }` on a change that could not be applied over a hand edit. */
export function useResolveChangeConflict() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ candidateId, choice }: { candidateId: string; choice: ConflictChoice }) =>
      documentIngestionService.resolveConflict(candidateId, choice),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ termId, req }` to raise a project risk from a contract term; the risk register is refreshed too. */
export function useRaiseContractTermRisk() {
  const invalidate = useInvalidateDocumentIngestion([riskKeys.all]);
  return useMutation({
    mutationFn: ({ termId, req }: { termId: string; req?: RaiseRiskRequest }) =>
      documentIngestionService.raiseContractTermRisk(termId, req),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ obligationId, req }` to raise a project risk from an obligation; the risk register is refreshed too. */
export function useRaiseObligationRisk() {
  const invalidate = useInvalidateDocumentIngestion([riskKeys.all]);
  return useMutation({
    mutationFn: ({ obligationId, req }: { obligationId: string; req?: RaiseRiskRequest }) =>
      documentIngestionService.raiseObligationRisk(obligationId, req),
    onSuccess: invalidate,
  });
}

/** Copies ITP rows into checklist templates; the templates are refreshed too. */
export function useCopyQualityRequirementsToTemplate() {
  const invalidate = useInvalidateDocumentIngestion([checklistTemplateKeys.all]);
  return useMutation({
    mutationFn: (req: CopyToTemplateRequest) => documentIngestionService.copyQualityRequirementsToTemplate(req),
    onSuccess: invalidate,
  });
}

/** Mutate with `{ requirementId, req }` to set or clear a person's status on a text requirement. */
export function useSetQualificationStatus() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ requirementId, req }: { requirementId: string; req: RequirementStatusRequest }) =>
      documentIngestionService.setQualificationStatus(requirementId, req),
    onSuccess: invalidate,
  });
}

/** Replaces the company profile; every compliance matrix reads again. */
export function useSaveCompanyProfile() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (req: CompanyProfileRequest) => documentIngestionService.saveCompanyProfile(req),
    onSuccess: invalidate,
  });
}

/** Step 1 of an evidence upload. Nothing to refresh until the file is registered. */
export function usePresignCompanyEvidence() {
  return useMutation({
    mutationFn: (req: PresignEvidenceRequest) => documentIngestionService.presignCompanyEvidence(req),
  });
}

/** Step 3 of an evidence upload. Mutate with `{ evidenceId, key }`. */
export function useRegisterCompanyEvidence() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: ({ evidenceId, key }: { evidenceId: string; key: string }) =>
      documentIngestionService.registerCompanyEvidence(evidenceId, key),
    onSuccess: invalidate,
  });
}

export function useDeleteCompanyEvidence() {
  const invalidate = useInvalidateDocumentIngestion();
  return useMutation({
    mutationFn: (evidenceId: string) => documentIngestionService.deleteCompanyEvidence(evidenceId),
    onSuccess: invalidate,
  });
}
