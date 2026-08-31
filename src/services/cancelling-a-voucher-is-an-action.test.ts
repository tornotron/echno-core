/**
 * The route back out of a frozen payment voucher.
 *
 * echno-backend#636 froze a verified voucher against editing, and that freeze
 * needed a way out: the sole route to `CANCELLED` was the `PUT` the freeze now
 * blocks. So cancelling became an action of its own, with a required reason,
 * and this file is its client half.
 *
 * A green `tsc` proves little here for the same reason it proved little on the
 * verifier change. Excess property checking fires on a fresh object literal at
 * the call site and nowhere else, so what the client actually puts on the wire
 * is asserted on the request rather than on the types.
 *
 * Each test fails without the change:
 *
 * - the request tests fail to run at all against the old service, where
 *   `cancel` did not exist;
 * - the parse tests fail on a schema that does not declare
 *   `cancellationReason`, because a plain `z.object` strips a key it does not
 *   know, so the reason arrives from the backend and comes out `undefined` —
 *   which reads as "the voucher was voided and nobody said why".
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { financeConstructionPaymentService } from './finance-construction-payment-service';
import { parseConstructionPayment } from '../types/finance/construction-payment';
import {
  ConstructionPaymentType,
  ConstructionPaymentMethod,
  ConstructionPayeeType,
  ConstructionPaymentVoucherStatus,
} from '../types/finance/construction-payment';

afterEach(() => {
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A voucher payload complete enough for the schema parser. */
const paymentDto = {
  id: '11111111-1111-4111-8111-111111111111',
  paymentNumber: 'PAY-2026-0004',
  type: ConstructionPaymentType.INVOICE,
  status: ConstructionPaymentVoucherStatus.COMPLETED,
  method: ConstructionPaymentMethod.BANK_TRANSFER,
  payeeType: ConstructionPayeeType.VENDOR,
  projectId: 3,
  amount: 118_000,
  paymentDate: '2026-08-30',
};

const REASON = 'Duplicate of CPMT-000118, raised twice for the same invoice';

describe('a payment voucher is cancelled through an action', () => {
  test('the endpoint has a client', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(paymentDto);

    await financeConstructionPaymentService.cancel(paymentDto.id, REASON);

    expect(post.mock.calls[0]?.[0]).toBe(
      `/finance/construction-payments/web/${paymentDto.id}/cancel`
    );
  });

  test('the reason travels in the body, not as a query parameter', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(paymentDto);

    await financeConstructionPaymentService.cancel(paymentDto.id, REASON);

    // Third argument is the query object. The reason is `@NotBlank` on the
    // request body, so a client that put it in the query string would be
    // refused for a missing reason while appearing to send one.
    expect(post.mock.calls[0]?.[1]).toEqual({ reason: REASON });
    expect(post.mock.calls[0]?.[2]).toBeUndefined();
  });

  test('the body carries the reason and nothing else', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(paymentDto);

    await financeConstructionPaymentService.cancel(paymentDto.id, REASON);

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['reason']);
  });

  test('it returns the voucher the action voided, reason and all', async () => {
    spyOn(api, 'post').mockResolvedValue({
      ...paymentDto,
      status: ConstructionPaymentVoucherStatus.CANCELLED,
      cancellationReason: REASON,
    });

    const payment = await financeConstructionPaymentService.cancel(
      paymentDto.id,
      REASON
    );

    expect(payment.status).toBe(ConstructionPaymentVoucherStatus.CANCELLED);
    expect(payment.cancellationReason).toBe(REASON);
  });
});

describe('a cancelled voucher says why it was voided', () => {
  test('cancellationReason survives the parse boundary', () => {
    const payment = parseConstructionPayment({
      ...paymentDto,
      status: ConstructionPaymentVoucherStatus.CANCELLED,
      cancellationReason: REASON,
    });

    expect(payment.cancellationReason).toBe(REASON);
  });

  test('a voucher that has not been cancelled leaves it unset', () => {
    // Not the empty string: a screen decides whether to render the reason line
    // at all on this field, and an empty string is truthy enough to get the
    // label drawn under a voucher nobody cancelled.
    expect(parseConstructionPayment(paymentDto).cancellationReason).toBeUndefined();
  });

  test('a null from the backend reads as unset rather than as a blank reason', () => {
    const payment = parseConstructionPayment({
      ...paymentDto,
      cancellationReason: null,
    });

    expect(payment.cancellationReason).toBeUndefined();
  });

  test('the verification stamp stays on a cancelled voucher', () => {
    // Deliberate, not a contradiction: echno-backend#636 voids the document
    // rather than retracting the check, so the record still shows who checked
    // what and that it was later thrown out. A parser that cleared the stamp
    // when the status went cancelled would erase exactly that.
    const payment = parseConstructionPayment({
      ...paymentDto,
      status: ConstructionPaymentVoucherStatus.CANCELLED,
      cancellationReason: REASON,
      verifiedBy: 7,
      verifiedByName: 'Anita Rao',
      verifiedAt: '2026-08-31T10:00:00Z',
    });

    expect(payment.status).toBe(ConstructionPaymentVoucherStatus.CANCELLED);
    expect(payment.verifiedBy).toBe(7);
    expect(payment.verifiedByName).toBe('Anita Rao');
    expect(payment.cancellationReason).toBe(REASON);
  });
});
