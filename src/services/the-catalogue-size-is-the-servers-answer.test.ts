/**
 * How many materials the catalogue holds.
 *
 * `GET /materials/web` serves at most 500 rows and reports the cut in an
 * `X-Result-Capped` response header, which the console's API proxy does
 * not forward. So a screen that counts the array it fetched is counting
 * one page, and from the 501st material it says 500 and reads as the whole
 * catalogue: no error, no visible change.
 *
 * `GET /materials/web/all` answers with a Spring page, and `totalElements`
 * on that envelope is the number. {@link materialsService.getPage} keeps
 * the envelope for exactly that reason, and refuses a payload that has
 * none rather than falling back to the rows.
 *
 * Every test here fails without the change: `getPage` does not exist, and
 * `getAllPaginated`, the only other reader of this endpoint, flattens the
 * envelope away and so has no total left to report.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { materialsService } from './materials-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A MaterialDto as the backend serialises it. */
const row: Raw = {
  id: 12,
  sku: 'TNT-CEM-001',
  materialName: 'OPC 53 Cement',
  unit: 'bag',
  description: null,
  hsn: null,
  gstRate: null,
  currentStock: '40',
  stockValue: '18000.00',
  openingStock: '0',
  storageLocationId: null,
  projectId: null,
  moq: null,
  minStock: null,
  maxStock: null,
  safetyStock: null,
  reorderLevel: 30,
  createdBy: null,
  category: null,
  status: null,
  trend: null,
  ltc: null,
};

const page = (rows: Raw[], extra: Raw = {}): Raw => ({
  content: rows,
  totalElements: 743,
  totalPages: 743,
  number: 0,
  size: 1,
  ...extra,
});

describe('reading a page of the material catalogue', () => {
  test('reports the server total, not the number of rows it was sent', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([row]));

    const result = await materialsService.getPage({ pageSize: 1 });

    expect(result.content.length).toBe(1);
    expect(result.totalElements).toBe(743);
    expect(get).toHaveBeenCalledWith('/materials/web/all', { pageSize: 1 });
  });

  test('parses the rows on the page rather than handing back raw JSON', async () => {
    spyOn(api, 'get').mockResolvedValue(page([row]));

    const [first] = (await materialsService.getPage()).content;

    expect(first.id).toBe(12);
    expect(first.materialName).toBe('OPC 53 Cement');
    expect(first.unit).toBe('bag');
    expect(first.stockValue).toBe(18000);
  });

  test('passes the paging through, since the total is asked for cheaply', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await materialsService.getPage({ pageNo: 2, pageSize: 50 });

    expect(get).toHaveBeenCalledWith('/materials/web/all', {
      pageNo: 2,
      pageSize: 50,
    });
  });

  test('sends no paging parameters when none were asked for', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await materialsService.getPage();

    expect(get).toHaveBeenCalledWith('/materials/web/all', {});
  });

  test('refuses a payload with no total rather than counting the rows', async () => {
    spyOn(api, 'get').mockResolvedValue([row, row]);

    await expect(materialsService.getPage()).rejects.toThrow(
      /total count is missing/
    );
  });

  test('refuses a page whose total is not a number', async () => {
    spyOn(api, 'get').mockResolvedValue({
      content: [row],
      totalElements: '743',
    });

    await expect(materialsService.getPage()).rejects.toThrow(
      /total count is missing/
    );
  });

  test('keeps an empty catalogue as zero, not as an absent total', async () => {
    spyOn(api, 'get').mockResolvedValue(
      page([], { totalElements: 0, totalPages: 0 })
    );

    const result = await materialsService.getPage();

    expect(result.totalElements).toBe(0);
    expect(result.content).toEqual([]);
  });

  test('the flattening reader still drops the total, which is why this one exists', async () => {
    spyOn(api, 'get').mockResolvedValue(page([row]));

    const flattened = await materialsService.getAllPaginated(0, 1);

    expect(Array.isArray(flattened)).toBe(true);
    expect(flattened.length).toBe(1);
    expect((flattened as unknown as Raw).totalElements).toBeUndefined();
  });
});
