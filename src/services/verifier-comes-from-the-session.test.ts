/**
 * Who the client is allowed to say verified something.
 *
 * Five backend changes closed one defect shape: the client telling the server
 * who did something. Leave (echno-backend#589), attendance (#599), four
 * attribution fields (#607), the payment voucher stamp (#631) and the movement
 * record (#635). The last two are the ones this package could still reach, and
 * this file is the client half of both.
 *
 * The reason a green `tsc` is not enough here, and the reason these are runtime
 * assertions on the outgoing call rather than type assertions alone: excess
 * property checking fires on a fresh object literal at the call site and
 * nowhere else. A payload assembled into a variable first, or a query object
 * built up key by key, passes a clean build while still putting the field on
 * the wire. So the request itself is what gets pinned.
 *
 * Each test fails without the change:
 *
 * - The verifier tests fail against the old two-argument `verifyMovement`,
 *   which appended `?verifiedBy=`; they assert the third argument the client
 *   was handed, and a request carrying a discarded verifier is not an error the
 *   backend reports, so nothing else would notice.
 * - `verify` on the payment service did not exist at all, so its tests fail to
 *   run rather than fail an assertion.
 * - The parse tests fail on a plain `z.object`, which strips a key it does not
 *   declare: `verifiedById`, `raisedBy`, `raisedByName` and `verifiedByName`
 *   arrive from the backend and come out `undefined`, which reads as "the
 *   server did not send one".
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { movementService } from './movement-service';
import { financeConstructionPaymentService } from './finance-construction-payment-service';
import { parseMovementRecord } from '../types/attendance/movement';
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

/** A movement payload complete enough for the service parser. */
const movementDto = {
  id: 3,
  attendanceId: 5,
  employeeId: 9,
  movementType: 'SITE_TRAVEL',
  startTime: '2026-08-31T09:00:00',
  createdAt: '2026-08-31T09:00:00Z',
  updatedAt: '2026-08-31T09:30:00Z',
};

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

describe('verifying a movement says nothing about the verifier', () => {
  test('the request carries no query parameters at all', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(movementDto);

    await movementService.verifyMovement(3);

    // Third argument is the query object. The old client passed
    // `{ verifiedBy }` here, so an undefined third argument is the assertion
    // that the parameter is gone rather than merely empty.
    expect(post.mock.calls[0]?.[2]).toBeUndefined();
  });

  test('the path is the verify action and the body is empty', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(movementDto);

    await movementService.verifyMovement(3);

    expect(post.mock.calls[0]?.[0]).toBe('/movement-records/web/3/verify');
    expect(post.mock.calls[0]?.[1]).toBeNull();
  });

  test('no argument can smuggle a verifier back in', () => {
    // The type-level half, asserted on the parameter list rather than by making
    // the call, so nothing here reaches `api`. `typecheck:tests` runs this
    // file, so if the second parameter ever comes back the directive stops
    // matching an error and the check fails on the unused directive. Without
    // it, re-adding an optional `verifiedBy` would compile silently and no
    // runtime test would catch a caller that never passes one.
    type VerifyArgs = Parameters<typeof movementService.verifyMovement>;

    const idOnly: VerifyArgs = [3];
    // @ts-expect-error verifyMovement takes the id and nothing else
    const withVerifier: VerifyArgs = [3, 'Anita Rao'];

    expect(idOnly).toHaveLength(1);
    expect(withVerifier).toHaveLength(2);
  });
});

describe('a verified movement carries the verifier the server resolved', () => {
  test('verifiedById survives the parse boundary', () => {
    const movement = parseMovementRecord({
      ...movementDto,
      isVerified: true,
      verifiedBy: 'Anita Rao',
      verifiedById: 42,
      verifiedAt: '2026-08-31T10:00:00Z',
    });

    expect(movement.verifiedById).toBe(42);
    expect(movement.verifiedBy).toBe('Anita Rao');
  });

  test('an unverified movement has no verifier id', () => {
    expect(parseMovementRecord(movementDto).verifiedById).toBeUndefined();
  });

  test('a verifier with no employee record leaves the id unset', () => {
    // The case that makes `verifiedBy` the field to render and `verifiedById`
    // the field to link on: the backend stamps a name it can always resolve and
    // an employee id it sometimes cannot.
    const movement = parseMovementRecord({
      ...movementDto,
      isVerified: true,
      verifiedBy: 'admin@echno.com',
      verifiedById: null,
      verifiedAt: '2026-08-31T10:00:00Z',
    });

    expect(movement.verifiedById).toBeUndefined();
    expect(movement.verifiedBy).toBe('admin@echno.com');
  });

  test('the service parser surfaces it too, not just the schema parser', async () => {
    // Two parsers exist for this DTO and only one of them runs on a response.
    // `movement-service.ts` builds the record field by field in its own
    // `parseMovement`; `types/attendance/movement.ts` parses through zod. A
    // field added to the schema alone still compiles, because the service
    // parser returns a `MovementRecord` and the new key is optional, and the
    // whole change would then be dead on every real response.
    spyOn(api, 'post').mockResolvedValue({
      ...movementDto,
      isVerified: true,
      verifiedBy: 'Anita Rao',
      verifiedById: 42,
      verifiedAt: '2026-08-31T10:00:00Z',
    });

    expect((await movementService.verifyMovement(3)).verifiedById).toBe(42);
  });
});

describe('a payment voucher is verified through an action', () => {
  test('the endpoint has a client', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(paymentDto);

    await financeConstructionPaymentService.verify(paymentDto.id);

    expect(post.mock.calls[0]?.[0]).toBe(
      `/finance/construction-payments/web/${paymentDto.id}/verify`
    );
  });

  test('it sends no body, so nothing about the verifier is caller-supplied', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(paymentDto);

    await financeConstructionPaymentService.verify(paymentDto.id);

    expect(post.mock.calls[0]?.[1]).toBeNull();
    expect(post.mock.calls[0]?.[2]).toBeUndefined();
  });

  test('it returns the voucher the action stamped', async () => {
    spyOn(api, 'post').mockResolvedValue({
      ...paymentDto,
      verifiedBy: 7,
      verifiedByName: 'Anita Rao',
      verifiedAt: '2026-08-31T10:00:00Z',
    });

    const payment = await financeConstructionPaymentService.verify(
      paymentDto.id
    );

    expect(payment.verifiedBy).toBe(7);
    expect(payment.verifiedByName).toBe('Anita Rao');
  });
});

describe('a voucher says who raised it as well as who verified it', () => {
  test('raisedBy and raisedByName survive the parse boundary', () => {
    const payment = parseConstructionPayment({
      ...paymentDto,
      raisedBy: 4,
      raisedByName: 'Hrishi K',
    });

    expect(payment.raisedBy).toBe(4);
    expect(payment.raisedByName).toBe('Hrishi K');
  });

  test('verifiedByName survives it too', () => {
    // Missing from the schema before this change, which is why the payment
    // detail screen renders the verifier as `User #7`: the name was on the DTO
    // and the parser dropped it.
    const payment = parseConstructionPayment({
      ...paymentDto,
      verifiedBy: 7,
      verifiedByName: 'Anita Rao',
    });

    expect(payment.verifiedByName).toBe('Anita Rao');
  });

  test('a voucher recording no raiser leaves both unset', () => {
    const payment = parseConstructionPayment(paymentDto);

    expect(payment.raisedBy).toBeUndefined();
    expect(payment.raisedByName).toBeUndefined();
  });

  test('the raiser and the verifier are distinct people on the same voucher', () => {
    // The pair the backend's segregation-of-duties refusal compares. Reading
    // one where the other is meant would make that refusal look like a bug.
    const payment = parseConstructionPayment({
      ...paymentDto,
      raisedBy: 4,
      raisedByName: 'Hrishi K',
      verifiedBy: 7,
      verifiedByName: 'Anita Rao',
    });

    expect(payment.raisedBy).toBe(4);
    expect(payment.verifiedBy).toBe(7);
    expect(payment.raisedByName).toBe('Hrishi K');
    expect(payment.verifiedByName).toBe('Anita Rao');
  });
});
