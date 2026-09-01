/**
 * The client half of the two-step site transfer in echno-backend#660.
 *
 * A transfer that crosses a project boundary no longer arrives when it is
 * created. Creation posts the outbound leg only; the receiving project's stock
 * moves when somebody there records what turned up, and a transfer abandoned
 * in transit is cancelled rather than left to strand the sender's balance.
 *
 * A green `tsc` proves none of this. Excess property checking fires on a fresh
 * object literal at the call site and nowhere else, and this package builds
 * every request body in a hand-written serializer that names each field it
 * sends, so a field added to an interface alone reaches the type and never the
 * wire. The read side has the mirror problem: a plain `z.object` strips a key
 * it does not declare, so the backend's `receivedQuantity` would arrive and
 * come out `undefined` whatever the interface promised.
 *
 * What each test pins, and what deleting the code under it would do:
 *
 * - the receipt and cancellation request tests fail on a serializer that does
 *   not name the field, which is a request the server answers with a 400 the
 *   caller cannot act on, or worse a cancellation with no reason;
 * - the `allowOverReceipt` omission test fails if the serializer sends the
 *   field unconditionally: an explicit `false` is a caller who has been asked
 *   and said no, which is not what a first attempt means;
 * - the parse tests fail on a schema missing the new fields, which reads a
 *   transfer with nothing confirmed as one that arrived complete;
 * - the null test fails on a parser that folds an absent `receivedQuantity` to
 *   `0`, which turns "nobody has looked at this line" into "the lorry came
 *   empty" — the one distinction the nullable column exists to carry.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { siteTransfersService } from './site-transfers-service';
import { parseSiteTransferItem } from '../types/site-transfers/site-transfer-item';
import { SiteTransferStatus } from '../types/site-transfers/enums';
import { StatusTransitionSource } from '../types/history/status-transition';

afterEach(() => {
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A transfer payload complete enough for the schema parser. */
const transferDto = {
  id: 7,
  transferNumber: 'TRF-2026-000001',
  issueDate: '2026-01-17',
  sendingPerson: { id: 3, employeeName: 'Hrishi' },
  sendingProjectId: 2,
  receivingProjectId: 6,
  status: 'PARTIALLY_TRANSFERRED',
  items: [
    {
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
      receivedQuantity: 8,
      inTransitQuantity: 2,
    },
  ],
};

/** Captures the body a service method actually put on the wire. */
function capturePost() {
  const bodies: unknown[] = [];
  spyOn(api, 'post').mockImplementation(
    async (_path: string, body?: unknown) => {
      bodies.push(body);
      return transferDto as never;
    }
  );
  return bodies;
}

describe('what a receipt puts on the wire', () => {
  test('names each line by its own id and the quantity that arrived', async () => {
    const bodies = capturePost();

    await siteTransfersService.receive(7, {
      items: [
        { itemId: 84, receivedQuantity: 8 },
        { itemId: 85, receivedQuantity: 0 },
      ],
    });

    const body = bodies[0] as { items: Array<Record<string, unknown>> };
    expect(body.items).toEqual([
      { itemId: 84, receivedQuantity: 8 },
      { itemId: 85, receivedQuantity: 0 },
    ]);
  });

  test('carries no acknowledgement at all on a first attempt', async () => {
    const bodies = capturePost();

    await siteTransfersService.receive(7, {
      items: [{ itemId: 84, receivedQuantity: 8 }],
    });

    // Not `false`. An explicit false is a caller who was shown the figures and
    // declined; a first attempt has been shown nothing.
    expect('allowOverReceipt' in (bodies[0] as object)).toBe(false);
  });

  test('carries the acknowledgement when it is deliberately given', async () => {
    const bodies = capturePost();

    await siteTransfersService.receive(7, {
      allowOverReceipt: true,
      items: [{ itemId: 84, receivedQuantity: 12 }],
    });

    expect((bodies[0] as { allowOverReceipt?: boolean }).allowOverReceipt).toBe(
      true
    );
  });

  test('carries the delivery date and the note when they are given', async () => {
    const bodies = capturePost();

    await siteTransfersService.receive(7, {
      receivedOn: '2026-01-17T14:05:00',
      remarks: 'Two bags split in transit',
      items: [{ itemId: 84, receivedQuantity: 8 }],
    });

    const body = bodies[0] as Record<string, unknown>;
    expect(body.receivedOn).toBe('2026-01-17T14:05:00');
    expect(body.remarks).toBe('Two bags split in transit');
  });

  test('posts to the receive endpoint, not the refused status one', async () => {
    const paths: string[] = [];
    spyOn(api, 'post').mockImplementation(async (path: string) => {
      paths.push(path);
      return transferDto as never;
    });

    await siteTransfersService.receive(7, {
      items: [{ itemId: 84, receivedQuantity: 8 }],
    });

    expect(paths[0]).toBe('/site-transfers/web/7/receive');
  });
});

describe('what a cancellation puts on the wire', () => {
  test('sends the reason, because a reversal with no stated cause is unreadable later', async () => {
    const bodies = capturePost();

    await siteTransfersService.cancel(7, {
      reason: 'Lorry turned back at the gate',
    });

    expect((bodies[0] as { reason?: string }).reason).toBe(
      'Lorry turned back at the gate'
    );
  });

  test('posts to the cancel endpoint', async () => {
    const paths: string[] = [];
    spyOn(api, 'post').mockImplementation(async (path: string) => {
      paths.push(path);
      return transferDto as never;
    });

    await siteTransfersService.cancel(7, { reason: 'Never left the yard' });

    expect(paths[0]).toBe('/site-transfers/web/7/cancel');
  });
});

describe('what a transfer reports about its lines', () => {
  test('reads the received and in-transit figures back off the wire', () => {
    const item = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
      receivedQuantity: 8,
      inTransitQuantity: 2,
    });

    expect(item.receivedQuantity).toBe(8);
    expect(item.inTransitQuantity).toBe(2);
  });

  test('a line nobody has confirmed reports null, not zero', () => {
    const item = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
      receivedQuantity: null,
      inTransitQuantity: 10,
    });

    // The whole point of the nullable column. Zero would say a person looked
    // at the lorry and found nothing on it.
    expect(item.receivedQuantity).toBeNull();
    expect(item.inTransitQuantity).toBe(10);
  });

  test('a line confirmed as receiving nothing reports zero, not null', () => {
    const item = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
      receivedQuantity: 0,
      inTransitQuantity: 10,
    });

    expect(item.receivedQuantity).toBe(0);
  });

  test('a shortfall is reported as an open figure and nothing is written off', () => {
    const item = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
      receivedQuantity: 8,
      inTransitQuantity: 2,
    });

    // Eight arrived against ten sent. The two are neither received nor lost:
    // they are an open variance, and no field on the line claims otherwise.
    expect(item.sentQuantity - (item.receivedQuantity ?? 0)).toBe(
      item.inTransitQuantity
    );
  });

  test('an old payload with no in-transit field still reports the stock as in transit', () => {
    const item = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'TNT Steel',
      sentQuantity: 10,
    });

    // Falling back to 0 would say a pending transfer's stock is accounted for
    // at both ends at once.
    expect(item.inTransitQuantity).toBe(10);
    expect(item.receivedQuantity).toBeNull();
  });
});

describe('the status the client can no longer choose', () => {
  test('CANCELLED is a status a transfer can come back holding', () => {
    // Asserted as a string: the wire value is the contract, and comparing two
    // enum members to each other would pass whatever the value were renamed to.
    expect(SiteTransferStatus.cancelled as string).toBe('CANCELLED');
  });

  test('a cancelled transfer parses as cancelled rather than falling back to pending', async () => {
    spyOn(api, 'post').mockImplementation(
      async () => ({ ...transferDto, status: 'CANCELLED' }) as never
    );

    const transfer = await siteTransfersService.cancel(7, {
      reason: 'Never left the yard',
    });

    // The parser falls back to PENDING on an unknown status, so an enum
    // missing CANCELLED reads a cancelled transfer as one still in transit
    // and puts the cancel button back on the screen.
    expect(transfer.status).toBe(SiteTransferStatus.cancelled);
  });
});

describe('the status trail', () => {
  const page = {
    content: [
      {
        id: 2,
        fromStatus: 'PENDING',
        toStatus: 'PARTIALLY_TRANSFERRED',
        source: 'UPDATE',
        occurredAt: '2026-01-17T14:05:00',
        changedBy: 3,
        changedByName: 'Hrishi',
        note: 'Two bags split in transit',
      },
      {
        id: 1,
        fromStatus: null,
        toStatus: 'PENDING',
        source: 'BASELINE',
        occurredAt: '2026-01-16T09:00:00',
        changedBy: null,
        changedByName: null,
      },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 20,
  };

  test('reads the page and keeps how each entry came about', async () => {
    spyOn(api, 'get').mockImplementation(async () => page as never);

    const history = await siteTransfersService.getStatusHistory(7);

    expect(history.totalElements).toBe(2);
    expect(history.content.map((e) => e.source)).toEqual([
      StatusTransitionSource.update,
      StatusTransitionSource.baseline,
    ]);
    expect(history.content[0].changedByName).toBe('Hrishi');
    // A baseline entry has nobody to name, and inventing one would attribute
    // the start of the trail to whoever happened to be nearby.
    expect(history.content[1].changedBy).toBeNull();
    expect(history.content[1].changedByName).toBe('');
  });

  test('asks the status-history endpoint for the page it was given', async () => {
    const calls: Array<[string, unknown]> = [];
    spyOn(api, 'get').mockImplementation(
      async (path: string, params?: unknown) => {
        calls.push([path, params]);
        return page as never;
      }
    );

    await siteTransfersService.getStatusHistory(7, 1, 5);

    expect(calls[0][0]).toBe('/site-transfers/web/7/status-history');
    expect(calls[0][1]).toEqual({ pageNo: 1, pageSize: 5 });
  });
});
