/**
 * The client half of the goods-receipt reconciliation in echno-backend#659.
 *
 * A receipt that would take a material past the quantity its purchase order
 * asked for is now refused with a 400 unless the payload says the excess was
 * meant. The refusal names the figures, and the way past it is one optional
 * field on the create payload, which the created note then carries back so the
 * document says a person let the delivery through.
 *
 * A green `tsc` proves nothing about either half. Excess property checking
 * fires on a fresh object literal at the call site and nowhere else, and this
 * package builds its GRN body in a hand-written serializer that names every
 * field it sends, so a field added to the interface alone reaches the type and
 * never the wire. The read half has the mirror problem: a plain `z.object`
 * strips a key it does not declare, so the backend's answer would arrive and
 * come out `undefined` whatever the interface promised.
 *
 * Each test fails without the change:
 *
 * - the request tests fail on a serializer that has no `allowOverReceipt`
 *   branch, which drops the field and leaves the caller with the same 400 they
 *   were trying to answer;
 * - the parse tests fail on a schema that does not declare
 *   `overReceiptAcknowledged`, which reads an acknowledged over-receipt as an
 *   ordinary receipt.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { grnService } from './grn-service';
import { parseGoodsReceivedNote } from '../types/grn/grn';
import type { CreateGrnRequest } from '../types/grn/grn-create';

afterEach(() => {
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A note payload complete enough for the schema parser. */
const noteDto = {
  id: 12,
  grnNumber: 'GRN-2026-000006',
  receivedOn: '2026-08-31',
  receivedBy: { id: 3, employeeName: 'Asha' },
  vendorId: 9,
  purchaseOrderId: 4,
  purchaseOrderNumber: 'PO-2026-000001',
};

/** The receipt as it is filed the first time, before anybody has been asked. */
const receipt: CreateGrnRequest = {
  receivedOn: '2026-08-31T00:00:00.000Z',
  receivedByEmployeeId: 3,
  vendorId: 9,
  purchaseOrderId: 4,
  items: [{ materialId: 7, orderedQuantity: 100, receivedQuantity: 105 }],
};

/** The body the service actually posted, whatever the types say it built. */
function postedBody(
  post: ReturnType<typeof spyOn<typeof api, 'post'>>
): Record<string, unknown> {
  return post.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('the acknowledgement reaches the wire', () => {
  test('an acknowledged over-receipt sends the field the backend reads', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(noteDto);

    await grnService.create({ ...receipt, allowOverReceipt: true });

    expect(postedBody(post).allowOverReceipt).toBe(true);
  });

  test('a receipt nobody acknowledged sends no such field', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(noteDto);

    await grnService.create(receipt);

    expect('allowOverReceipt' in postedBody(post)).toBe(false);
  });

  test('an explicit refusal is sent rather than dropped', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(noteDto);

    await grnService.create({ ...receipt, allowOverReceipt: false });

    expect(postedBody(post).allowOverReceipt).toBe(false);
  });
});

describe('the note says whether somebody let the excess through', () => {
  test('an acknowledged over-receipt is read back as one', () => {
    const note = parseGoodsReceivedNote({
      ...noteDto,
      overReceiptAcknowledged: true,
    });

    expect(note.overReceiptAcknowledged).toBe(true);
  });

  test('a receipt within its order is not marked', () => {
    const note = parseGoodsReceivedNote({
      ...noteDto,
      overReceiptAcknowledged: false,
    });

    expect(note.overReceiptAcknowledged).toBe(false);
  });

  test('a note from before the field existed reads as unacknowledged', () => {
    const note = parseGoodsReceivedNote(noteDto);

    expect(note.overReceiptAcknowledged).toBe(false);
  });
});
