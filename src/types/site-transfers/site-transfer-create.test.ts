import { describe, expect, test } from 'bun:test';
import { SiteTransferStatus } from './enums';
import type { CreateSiteTransferRequest } from './site-transfer-create';
import { createSiteTransferToJson } from './site-transfer-create';

/** A complete create payload with no status, so each test adds one or not. */
function request(
  over: Partial<CreateSiteTransferRequest> = {}
): CreateSiteTransferRequest {
  return {
    transferNumber: 'ST-2026-0001',
    issueDate: '2026-08-30',
    sendingPerson: 7,
    sendingProjectId: 4,
    sendingStorageLocationId: 11,
    receivingProjectId: 5,
    receivingStorageLocationId: 12,
    items: [],
    ...over,
  };
}

describe('createSiteTransferToJson', () => {
  test('leaves status out of the body when the caller names none', () => {
    const body = createSiteTransferToJson(request());

    // Absent, not present-and-undefined: the server applies its own PENDING
    // default, and a key carrying undefined is a different message.
    expect(Object.hasOwn(body, 'status')).toBe(false);
  });

  test('sends the pending status when the caller names it', () => {
    const body = createSiteTransferToJson(
      request({ status: SiteTransferStatus.pending })
    );

    expect(body.status).toBe(SiteTransferStatus.pending);
  });

  test('carries the rest of the header through unchanged', () => {
    const body = createSiteTransferToJson(request());

    // transferNumber is not among them: the server allocates it, and this test used to assert the
    // opposite. See types/document-number-allocation.test.ts.
    expect(Object.hasOwn(body, 'transferNumber')).toBe(false);
    expect(body.sendingStorageLocationId).toBe(11);
    expect(body.receivingStorageLocationId).toBe(12);
  });

  test('serializes whatever status it is handed, so the type is the guard', () => {
    // The serializer does not police the value; narrowing the field to
    // SiteTransferStatus.pending is what stops PARTIALLY_TRANSFERRED and
    // COMPLETED reaching an endpoint that answers them with a 400.
    const body = createSiteTransferToJson({
      ...request(),
      status: SiteTransferStatus.completed as SiteTransferStatus.pending,
    });

    expect(body.status).toBe(SiteTransferStatus.completed);
  });
});
