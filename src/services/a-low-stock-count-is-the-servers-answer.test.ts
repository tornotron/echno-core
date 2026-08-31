/**
 * The count behind a "Low Stock Alert".
 *
 * The console used to work it out by filtering the material list it had
 * already fetched. That list is one page of at most 500 rows, it carries
 * only the organization-wide aggregate stock, and it cannot see a
 * per-location threshold override, so past the cap the alert quietly
 * counted the first page and read as the whole catalogue. It failed short,
 * which is the direction nobody checks.
 *
 * Every test here fails without the change: the first three because
 * `materialsService.getLowStock` does not exist, and the envelope test
 * because a service that flattened the page away would have nothing left
 * to report a total from.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { materialsService } from './materials-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A LowStockMaterialDto as the backend serialises it. */
const row: Raw = {
  materialId: 12,
  sku: 'TNT-STEEL-001',
  materialName: 'TNT Steel',
  unit: 'kg',
  currentStock: 1,
  reorderLevel: 30,
  shortfall: 29,
  moq: 100,
  projectId: null,
  storageLocationId: null,
};

const page = (rows: Raw[], extra: Raw = {}): Raw => ({
  content: rows,
  totalElements: 9,
  totalPages: 9,
  number: 0,
  size: 1,
  ...extra,
});

describe('reading the low-stock materials', () => {
  test('reports the server total, not the number of rows it was sent', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([row]));

    const result = await materialsService.getLowStock({ pageSize: 1 });

    expect(result.content.length).toBe(1);
    expect(result.totalElements).toBe(9);
    expect(get).toHaveBeenCalledWith('/materials/web/low-stock', {
      pageSize: 1,
    });
  });

  test('parses a row into the two numbers that were compared', async () => {
    spyOn(api, 'get').mockResolvedValue(page([row]));

    const [first] = (await materialsService.getLowStock()).content;

    expect(first.materialId).toBe(12);
    expect(first.materialName).toBe('TNT Steel');
    expect(first.currentStock).toBe(1);
    expect(first.reorderLevel).toBe(30);
    expect(first.shortfall).toBe(29);
    expect(first.moq).toBe(100);
    expect(first.projectId).toBeUndefined();
    expect(first.storageLocationId).toBeUndefined();
  });

  test('passes the scope through, since the answer differs at each', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await materialsService.getLowStock({
      projectId: 5,
      storageLocationId: 2,
      pageNo: 1,
      pageSize: 20,
    });

    expect(get).toHaveBeenCalledWith('/materials/web/low-stock', {
      projectId: 5,
      storageLocationId: 2,
      pageNo: 1,
      pageSize: 20,
    });
  });

  test('sends no scope parameters when none were asked for', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await materialsService.getLowStock();

    expect(get).toHaveBeenCalledWith('/materials/web/low-stock', {});
  });

  test('refuses a storage location that names no project', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await expect(
      materialsService.getLowStock({ storageLocationId: 2 })
    ).rejects.toThrow(/within its project/);
    expect(get).not.toHaveBeenCalled();
  });

  test('refuses a payload with no total rather than counting the rows', async () => {
    spyOn(api, 'get').mockResolvedValue([row, row]);

    await expect(materialsService.getLowStock()).rejects.toThrow(
      /total count is missing/
    );
  });

  test('refuses a page whose total is not a number', async () => {
    spyOn(api, 'get').mockResolvedValue({
      content: [row],
      totalElements: null,
    });

    await expect(materialsService.getLowStock()).rejects.toThrow(
      /total count is missing/
    );
  });

  test('keeps a zero total as zero, not as an absent one', async () => {
    spyOn(api, 'get').mockResolvedValue(
      page([], { totalElements: 0, totalPages: 0 })
    );

    const result = await materialsService.getLowStock();

    expect(result.totalElements).toBe(0);
    expect(result.content).toEqual([]);
  });
});
