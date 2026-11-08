/**
 * @module use-document-ingestion-mutations
 *
 * Mutation hooks for the Document Ingestion domain. Each refreshes the whole domain on success, so
 * a package, its files, its sheets and its candidates read again together. Upload is presign, a PUT
 * of the file to the returned URL (the app's own uploader), then register.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentIngestionService } from '../../services/document-ingestion-service';
import type {
  BoqMappingRequest,
  CandidateDecision,
  CandidateKind,
  CreatePackageRequest,
  PresignDocumentRequest,
} from '../../types/document-ingestion/document-ingestion';
import { documentIngestionKeys } from './keys';

function useInvalidateDocumentIngestion() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: documentIngestionKeys.all });
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
