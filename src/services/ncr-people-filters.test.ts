/**
 * The three people filters on the NCR register, and the id type they take.
 *
 * `GET /ncrs/web` grew `raisedById`, `verifiedById` and `closedById` in
 * echno-backend#626 beside the `siteEngineerId` it already had. Until they were
 * reachable from here, echno-web#35 could not turn "raised by" on an NCR into a
 * link: the register is server-paged, so narrowing the fetched page in the
 * browser would hide every match that fell outside it while still reading as a
 * complete answer. The NCR detail screen says exactly that in a comment where
 * the link is missing.
 *
 * **All three are employee ids.** The backend writes the columns from
 * `NcrService.currentEmployeeId()`, which resolves the session user through
 * `findByUserIdAndOrganizationId`, so they take the same value `siteEngineerId`
 * does and the same value the employee directory hands out. This matters more
 * than it looks: on a fresh database the user and employee sequences run in
 * lockstep, so a caller passing a user id gets the right answer by coincidence
 * until the two diverge, and then names somebody else without failing.
 *
 * Each test fails without the change. `toQuery` drops a key it has no branch
 * for, so an unforwarded filter is not an error: the request goes out
 * unfiltered and every row comes back, which is the failure that reads as a
 * working screen.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { ncrService } from './ncr-service';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** The query object `getAll` handed the client on its single call. */
async function queryFor(params: Parameters<typeof ncrService.getAll>[0]) {
  const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
  await ncrService.getAll(params);
  return get.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('the register can be narrowed to the people on a report', () => {
  test('raisedById reaches the query', async () => {
    expect(await queryFor({ raisedById: 8 })).toEqual({ raisedById: 8 });
  });

  test('verifiedById reaches the query', async () => {
    expect(await queryFor({ verifiedById: 12 })).toEqual({ verifiedById: 12 });
  });

  test('closedById reaches the query', async () => {
    expect(await queryFor({ closedById: 5 })).toEqual({ closedById: 5 });
  });

  test('the three AND with each other and with the filters already there', async () => {
    // The whole reason for pushing these to the server rather than filtering
    // the fetched page. If one of the four were dropped here the request would
    // still succeed and return a superset, which no assertion on the rendered
    // rows would catch.
    expect(
      await queryFor({
        raisedById: 8,
        verifiedById: 12,
        closedById: 5,
        siteEngineerId: 3,
        status: 'reopened',
        open: true,
      })
    ).toEqual({
      raisedById: 8,
      verifiedById: 12,
      closedById: 5,
      siteEngineerId: 3,
      status: 'reopened',
      open: true,
    });
  });

  test('an unset filter is omitted rather than sent empty', async () => {
    expect(await queryFor({})).toEqual({});
  });
});
