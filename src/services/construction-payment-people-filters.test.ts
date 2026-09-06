/**
 * The three people filters on the construction-payment listing, and the two
 * different id sequences they draw on.
 *
 * `GET /finance/construction-payments/web` grew `employeeId`, `verifiedBy` and
 * `raisedBy` in echno-backend#655, which closed echno-backend#638. Until they
 * are reachable from here, echno-web#35 cannot turn the payee on a voucher into
 * a link, and the `verifier` filter that already ships on the payments screen
 * stays wrong: the listing returns a Spring `Page` whose default is twenty
 * rows, so narrowing the fetched array answers "everything verified by X" with
 * whichever of the first twenty vouchers X happened to verify. An empty or
 * short result then reads as a complete answer, which is worse than no filter.
 *
 * **The three are not interchangeable, and the wire is the only place that
 * says so.** `employeeId` is the payee on a salary or advance voucher and is an
 * employee id, set from the creation payload beside `vendorId`,
 * `subContractId` and `labourId`. `verifiedBy` and `raisedBy` are platform user
 * ids, stamped from the session, and are the same ids the response returns
 * beside `verifiedByName` and `raisedByName`. The controller's own description
 * spells this out. It matters more than it looks: on a fresh database the user
 * and employee sequences run in lockstep, so a caller that crosses two of these
 * gets the right rows under the right name by coincidence, until enough rows
 * exist on one side to push the sequences apart.
 *
 * Each test fails without the change. `getAll` builds its query key by key and
 * silently drops one it has no branch for, so an unforwarded filter is not an
 * error: the request goes out unfiltered, every voucher comes back, and the
 * screen looks like it is working.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { financeConstructionPaymentService } from './finance-construction-payment-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** The query object `getAll` handed the client on its single call. */
async function queryFor(
  params: Parameters<typeof financeConstructionPaymentService.getAll>[0]
) {
  const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
  await financeConstructionPaymentService.getAll(params);
  return get.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('the voucher listing can be narrowed to the people on a voucher', () => {
  test('employeeId reaches the query', async () => {
    expect(await queryFor({ employeeId: 8 })).toEqual({ employeeId: 8 });
  });

  test('verifiedBy reaches the query', async () => {
    expect(await queryFor({ verifiedBy: 12 })).toEqual({ verifiedBy: 12 });
  });

  test('raisedBy reaches the query', async () => {
    expect(await queryFor({ raisedBy: 5 })).toEqual({ raisedBy: 5 });
  });

  test('each one travels under its own name and not another', async () => {
    // The payee is an employee id and the other two are user ids. A parameter
    // wired to the wrong name would still return a plausible list of somebody
    // else's vouchers rather than failing, so pin all three together: sending
    // three distinct values and reading three distinct keys back is what
    // catches a transposition.
    expect(await queryFor({ employeeId: 8, verifiedBy: 12, raisedBy: 5 })).toEqual(
      { employeeId: 8, verifiedBy: 12, raisedBy: 5 }
    );
  });

  test('the three AND with the filters already there', async () => {
    // The whole reason for pushing these to the server. If one of the eight
    // were dropped here the request would still succeed and return a superset,
    // which no assertion on the rendered rows would catch.
    expect(
      await queryFor({
        projectId: 3,
        vendorId: 4,
        status: 'COMPLETED',
        type: 'SALARY',
        payeeType: 'EMPLOYEE',
        employeeId: 8,
        verifiedBy: 12,
        raisedBy: 5,
      })
    ).toEqual({
      projectId: 3,
      vendorId: 4,
      status: 'COMPLETED',
      type: 'SALARY',
      payeeType: 'EMPLOYEE',
      employeeId: 8,
      verifiedBy: 12,
      raisedBy: 5,
    });
  });

  test('an unset filter is omitted rather than sent empty', async () => {
    // A zero is a legal id and an omitted filter is not the same request as one
    // sent empty, so the branch has to test for undefined rather than for
    // truthiness.
    expect(await queryFor({})).toEqual({});
  });

  test('a payee id of zero is still sent', async () => {
    expect(await queryFor({ employeeId: 0 })).toEqual({ employeeId: 0 });
  });
});
