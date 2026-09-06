/**
 * The figures behind a materials dashboard strip.
 *
 * The console used to add them up in the browser, over the material list
 * it had already fetched. That list is one page of at most 500 rows, so
 * past the cap the stock value it printed was the value of 500 materials
 * however large the catalogue was, and the unit count was the units those
 * 500 happened to be held in. The backend now totals all of it in the
 * database, at organization scope or within one project.
 *
 * Every test here fails without the change, because
 * `materialsService.getStockSummary` does not exist.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { materialsService } from './materials-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A MaterialStockSummaryDto as the backend serialises it. */
const summary = (extra: Raw = {}): Raw => ({
  projectId: null,
  materialCount: 743,
  distinctUnits: 9,
  totalStockValue: 50148300.0,
  unvaluedHoldingCount: 0,
  ...extra,
});

describe('reading the materials stock summary', () => {
  test('reports the totals the server computed', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(summary());

    const result = await materialsService.getStockSummary();

    expect(result.materialCount).toBe(743);
    expect(result.distinctUnits).toBe(9);
    expect(result.totalStockValue).toBe(50148300);
    expect(result.unvaluedHoldingCount).toBe(0);
    expect(result.projectId).toBeUndefined();
    expect(get).toHaveBeenCalledWith('/materials/web/summary', {});
  });

  test('passes the project scope through, since the answer differs at each', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(
      summary({ projectId: 5, materialCount: 12, totalStockValue: 4200 })
    );

    const result = await materialsService.getStockSummary({ projectId: 5 });

    expect(get).toHaveBeenCalledWith('/materials/web/summary', {
      projectId: 5,
    });
    expect(result.projectId).toBe(5);
    expect(result.materialCount).toBe(12);
  });

  test('carries the count of holdings the total could not price', async () => {
    spyOn(api, 'get').mockResolvedValue(summary({ unvaluedHoldingCount: 4 }));

    const result = await materialsService.getStockSummary();

    expect(result.unvaluedHoldingCount).toBe(4);
  });

  test('refuses a payload with no value rather than reporting nothing held', async () => {
    spyOn(api, 'get').mockResolvedValue(summary({ totalStockValue: null }));

    await expect(materialsService.getStockSummary()).rejects.toThrow();
  });

  test('refuses a payload with no counts rather than reporting an empty catalogue', async () => {
    spyOn(api, 'get').mockResolvedValue({ totalStockValue: 50148300.0 });

    await expect(materialsService.getStockSummary()).rejects.toThrow();
  });

  test('lets a 404 surface as an error, not as a summary of zeroes', async () => {
    // The endpoint answers 404 for a project this tenant does not own.
    // Swallowing it would put "₹0" on screen for a project whose stock the
    // caller was never entitled to read.
    spyOn(api, 'get').mockRejectedValue(
      new ApiError('No project with the given id', 404)
    );

    await expect(
      materialsService.getStockSummary({ projectId: 99 })
    ).rejects.toThrow(/No project with the given id/);
  });
});
