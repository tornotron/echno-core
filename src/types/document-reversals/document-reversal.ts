/**
 * @module document-reversal
 *
 * Domain type and parser for a reversal request: the record that a site
 * transfer, purchase order or goods received note was asked to be undone,
 * and what became of the ask.
 *
 * Nothing is ever deleted. The person who raised a document asks for its
 * reversal (`POST /document-reversals/web`), an administrator or project
 * manager approves or rejects it with a reason, and on approval the server
 * writes one correcting ledger entry per balance row the document moved so
 * every affected store returns to what it held before. The document stays,
 * marked reversed, and the two link both ways: the document carries
 * `reversalId` and the reversal carries `documentType` + `documentId`.
 */
import { z } from 'zod';
import { parsePositiveInt } from '../../lib/utils/parse-id';
import {
  nullableString,
  opaque,
  optionalNumericId,
} from '../../lib/validation/backend-schema';
import { DocumentReversalStatus, ReversibleDocumentType } from './enums';

/**
 * Shape of the backend reversal payload at the parse boundary. Non-strict:
 * a field the server adds later parses through untouched.
 */
const DocumentReversalResponseSchema = z.object({
  id: opaque,
  organizationId: optionalNumericId,
  documentType: opaque,
  documentId: opaque,
  documentNumber: nullableString,
  status: opaque,
  reason: nullableString,
  requestedBy: optionalNumericId,
  requestedByName: nullableString,
  requestedAt: nullableString,
  decidedBy: optionalNumericId,
  decidedByName: nullableString,
  decidedAt: nullableString,
  decisionNote: nullableString,
  reversalReference: nullableString,
  createdAt: nullableString,
  updatedAt: nullableString,
});

/**
 * A request to reverse one document, with the decision taken on it.
 */
export interface DocumentReversal {
  /** Surrogate primary key. */
  id: number;

  /** Owning organization. */
  organizationId?: number;

  /** The kind of document the request names. */
  documentType: ReversibleDocumentType;

  /** Id of that document, within its own kind. */
  documentId: number;

  /** The document's number as it was when the request was raised. */
  documentNumber: string;

  /** Where the request stands. */
  status: DocumentReversalStatus;

  /** Why the reversal was asked for. */
  reason: string;

  /** User id of the requester, always the document's creator. */
  requestedBy?: number;

  /** Display name of the requester. */
  requestedByName?: string;

  /** ISO 8601 timestamp the request was raised. */
  requestedAt?: string;

  /** User id of whoever approved, rejected or cancelled it. Absent while pending. */
  decidedBy?: number;

  /** Display name of the decider. Absent while pending. */
  decidedByName?: string;

  /** ISO 8601 timestamp of the decision. Absent while pending. */
  decidedAt?: string;

  /** The approver's reason on a rejection, or a note on the other decisions. */
  decisionNote?: string;

  /**
   * Reference number the correcting ledger entries carry (`REV-<number>`).
   * Absent until approved, and absent on an approved purchase order
   * reversal, which moves no stock.
   */
  reversalReference?: string;

  /** ISO 8601 timestamp the row was created. */
  createdAt?: string;

  /** ISO 8601 timestamp the row was last written. */
  updatedAt?: string;
}

function asDocumentType(raw: unknown): ReversibleDocumentType {
  return Object.values(ReversibleDocumentType).includes(
    raw as ReversibleDocumentType
  )
    ? (raw as ReversibleDocumentType)
    : ReversibleDocumentType.siteTransfer;
}

function asStatus(raw: unknown): DocumentReversalStatus {
  return Object.values(DocumentReversalStatus).includes(
    raw as DocumentReversalStatus
  )
    ? (raw as DocumentReversalStatus)
    : DocumentReversalStatus.pending;
}

/**
 * Parses a raw reversal payload into a typed {@link DocumentReversal}.
 *
 * An unknown `status` falls back to {@link DocumentReversalStatus.pending}
 * and an unknown `documentType` to {@link ReversibleDocumentType.siteTransfer},
 * so an unexpected backend value does not break list rendering. Optional
 * fields resolve to `undefined`.
 *
 * @param json - The raw JSON object from the backend.
 * @returns The parsed {@link DocumentReversal}.
 * @throws {TypeError} When `id` or `documentId` is missing or non-positive.
 */
export function parseDocumentReversal(json: unknown): DocumentReversal {
  const raw = DocumentReversalResponseSchema.parse(json);
  return {
    id: parsePositiveInt(raw.id, 'parseDocumentReversal.id'),
    organizationId: raw.organizationId ?? undefined,
    documentType: asDocumentType(raw.documentType),
    documentId: parsePositiveInt(
      raw.documentId,
      'parseDocumentReversal.documentId'
    ),
    documentNumber: raw.documentNumber ?? '',
    status: asStatus(raw.status),
    reason: raw.reason ?? '',
    requestedBy: raw.requestedBy ?? undefined,
    requestedByName: raw.requestedByName ?? undefined,
    requestedAt: raw.requestedAt ?? undefined,
    decidedBy: raw.decidedBy ?? undefined,
    decidedByName: raw.decidedByName ?? undefined,
    decidedAt: raw.decidedAt ?? undefined,
    decisionNote: raw.decisionNote ?? undefined,
    reversalReference: raw.reversalReference ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}
