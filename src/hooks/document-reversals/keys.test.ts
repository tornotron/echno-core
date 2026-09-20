import { describe, expect, test } from 'bun:test';
import { documentReversalKeys } from './keys';
import {
  DocumentReversalStatus,
  ReversibleDocumentType,
} from '../../types/document-reversals/enums';

describe('documentReversalKeys', () => {
  test('every key sits under the namespace root', () => {
    expect(documentReversalKeys.detail(3)[0]).toBe('document-reversals');
    expect(documentReversalKeys.paginated(0, 10)[0]).toBe('document-reversals');
    expect(
      documentReversalKeys.byDocument(ReversibleDocumentType.siteTransfer, 3)[0]
    ).toBe('document-reversals');
    expect(
      documentReversalKeys.eligibility(ReversibleDocumentType.siteTransfer, 3)[0]
    ).toBe('document-reversals');
  });

  test('the queue and the unfiltered page are different keys', () => {
    expect(documentReversalKeys.paginated(0, 10)).not.toEqual(
      documentReversalKeys.paginated(0, 10, DocumentReversalStatus.pending)
    );
  });

  test('eligibility and history of one document are different keys', () => {
    expect(
      documentReversalKeys.eligibility(ReversibleDocumentType.goodsReceivedNote, 4)
    ).not.toEqual(
      documentReversalKeys.byDocument(ReversibleDocumentType.goodsReceivedNote, 4)
    );
  });
});
