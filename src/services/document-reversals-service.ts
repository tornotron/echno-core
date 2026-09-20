/**
 * @module document-reversals-service
 *
 * API client for reversal requests, against the `/document-reversals/web`
 * twin controller. Every read and write is scoped to the caller's tenant
 * by the server; approving and rejecting need the system-admin or
 * project-manager role, raising a request needs the caller to be the
 * document's creator, and the server answers 403 otherwise.
 */
import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  DocumentReversal,
  DocumentReversalEligibility,
  DocumentReversalStatus,
  ReversibleDocumentType,
  CreateDocumentReversalRequest,
  RejectDocumentReversalRequest,
  createDocumentReversalToJson,
  parseDocumentReversal,
  parseDocumentReversalEligibility,
  rejectDocumentReversalToJson,
} from '../types/document-reversals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** A parsed page of reversal requests, mirroring the Spring `Page<DocumentReversalDto>`. */
export interface PagedDocumentReversals {
  /** The requests on this page. */
  content: DocumentReversal[];
  /** Total requests across all pages. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
  /** Zero-based page index. */
  number: number;
  /** Page size. */
  size: number;
}

function safeParseDocumentReversal(data: Raw): DocumentReversal {
  try {
    return parseDocumentReversal(data);
  } catch (error) {
    logger.error('Failed to parse document reversal:', error);
    throw new ApiError('Failed to process reversal data.', 422);
  }
}

function safeParseDocumentReversals(data: Raw): DocumentReversal[] {
  const items: Raw[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : [];
  if (items.length === 0) return [];
  try {
    return items.map((item) => parseDocumentReversal(item));
  } catch (error) {
    logger.error('Failed to parse document reversals:', error);
    throw new ApiError('Failed to process reversals data.', 422);
  }
}

function safeParsePage(data: Raw, pageSize: number): PagedDocumentReversals {
  const content = safeParseDocumentReversals(data);
  if (Array.isArray(data)) {
    return {
      content,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
      number: 0,
      size: pageSize,
    };
  }
  return {
    content,
    totalElements:
      typeof data?.totalElements === 'number'
        ? data.totalElements
        : content.length,
    totalPages:
      typeof data?.totalPages === 'number'
        ? data.totalPages
        : content.length > 0
          ? 1
          : 0,
    number: typeof data?.number === 'number' ? data.number : 0,
    size: typeof data?.size === 'number' ? data.size : pageSize,
  };
}

export const documentReversalsService = {
  /**
   * Raises a reversal request. The server refuses anyone but the document's
   * creator (403), and refuses a document that cannot be reversed with a
   * message naming the blocker (400).
   */
  async request(dto: CreateDocumentReversalRequest): Promise<DocumentReversal> {
    const data = await api.post<Raw>(
      '/document-reversals/web',
      createDocumentReversalToJson(dto)
    );
    return safeParseDocumentReversal(data);
  },

  /** One page of requests, most recently raised first, optionally filtered to one status. */
  async getAllPaginated(
    pageNo = 0,
    pageSize = 10,
    status?: DocumentReversalStatus
  ): Promise<PagedDocumentReversals> {
    const params: Record<string, string | number> = { pageNo, pageSize };
    if (status) params.status = status;
    const data = await api.get<Raw>('/document-reversals/web', params);
    return safeParsePage(data, pageSize);
  },

  /** A single request by id. */
  async getById(id: number): Promise<DocumentReversal> {
    const data = await api.get<Raw>(`/document-reversals/web/${id}`);
    return safeParseDocumentReversal(data);
  },

  /** Every request ever raised on one document, most recent first. */
  async getByDocument(
    documentType: ReversibleDocumentType,
    documentId: number
  ): Promise<DocumentReversal[]> {
    const data = await api.get<Raw[]>('/document-reversals/web/by-document', {
      documentType,
      documentId,
    });
    return safeParseDocumentReversals(data);
  },

  /** Whether one document can be reversed right now, and whether the caller may ask. */
  async getEligibility(
    documentType: ReversibleDocumentType,
    documentId: number
  ): Promise<DocumentReversalEligibility> {
    const data = await api.get<Raw>('/document-reversals/web/eligibility', {
      documentType,
      documentId,
    });
    try {
      return parseDocumentReversalEligibility(data);
    } catch (error) {
      logger.error('Failed to parse reversal eligibility:', error);
      throw new ApiError('Failed to process reversal eligibility.', 422);
    }
  },

  /** Approves a pending request: undoes the document and tells the stores. */
  async approve(id: number): Promise<DocumentReversal> {
    const data = await api.post<Raw>(`/document-reversals/web/${id}/approve`);
    return safeParseDocumentReversal(data);
  },

  /** Rejects a pending request with a reason. Nothing moves. */
  async reject(
    id: number,
    dto: RejectDocumentReversalRequest
  ): Promise<DocumentReversal> {
    const data = await api.post<Raw>(
      `/document-reversals/web/${id}/reject`,
      rejectDocumentReversalToJson(dto)
    );
    return safeParseDocumentReversal(data);
  },

  /** Withdraws the caller's own pending request. */
  async cancel(id: number): Promise<DocumentReversal> {
    const data = await api.post<Raw>(`/document-reversals/web/${id}/cancel`);
    return safeParseDocumentReversal(data);
  },
};
