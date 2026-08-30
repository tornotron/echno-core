/**
 * The accounts-receivable invoice listing, and the link back to the document
 * that raised the receivable.
 *
 * This module carried the rest of the AR invoice client and no listing, because
 * the endpoint did not exist when it was written. Its doc comment said so and
 * went on saying so after backend #582 landed, so `echno-web` grew a
 * screen-local client for the one call. Both halves of echno-core#61 are here:
 * the listing, and `arInvoiceId` on the construction invoice, which is the join
 * between the two documents and the only way a receivables screen can tell a
 * row it must not offer to cancel.
 *
 * Every test fails without the change: the listing ones because
 * `financeInvoiceService.list` does not exist, the last one because the field
 * is parsed away.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { financeInvoiceService, INVOICE_PAGE_SIZE } from './finance-invoice-service';
import { parseConstructionInvoice } from '../types/finance';
import { InvoiceStatus } from '../types/finance/finance-enums';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** Enough of an InvoiceDto to satisfy the parser. */
const invoiceRow: Raw = {
  id: '3f1c7e60-0f7a-4a1a-9a3e-2b7d5a1c9e01',
  invoiceNumber: 'INV-2026-0007',
  customerId: 'a2e4c1b8-5d3f-4c2a-9b1e-7f0d6c4a2b33',
  customerName: 'Asset Homes',
  status: 'ISSUED',
  invoiceDate: '2026-08-14',
  dueDate: '2026-09-13',
  subtotal: 100000,
  taxTotal: 18000,
  total: 118000,
  amountPaid: 0,
  balanceDue: 118000,
  lines: [],
};

const page = (rows: Raw[], extra: Raw = {}): Raw => ({
  content: rows,
  totalElements: 41,
  totalPages: 3,
  number: 0,
  size: 20,
  ...extra,
});

describe('listing accounts-receivable invoices', () => {
  test('reads the rows and keeps the total the caller pages on', async () => {
    spyOn(api, 'get').mockResolvedValue(page([invoiceRow]));

    const result = await financeInvoiceService.list();

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.invoiceNumber).toBe('INV-2026-0007');
    // The point of returning a page rather than an array: 41 cannot be
    // recovered from a single page of rows, and the pager needs it.
    expect(result.totalElements).toBe(41);
    expect(result.totalPages).toBe(3);
  });

  test('asks for a page even when the caller names none', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await financeInvoiceService.list();

    expect(get.mock.calls[0]?.[0]).toBe('/finance/invoices/web');
    expect(get.mock.calls[0]?.[1]).toEqual({
      pageNo: 0,
      pageSize: INVOICE_PAGE_SIZE,
    });
  });

  test('sends only the filters that were set', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await financeInvoiceService.list({
      pageNo: 2,
      pageSize: 50,
      customerId: 'a2e4c1b8-5d3f-4c2a-9b1e-7f0d6c4a2b33',
    });

    // An absent parameter leaves that dimension unfiltered on the server; the
    // string "undefined" would filter on nothing that exists.
    expect(get.mock.calls[0]?.[1]).toEqual({
      pageNo: 2,
      pageSize: 50,
      customerId: 'a2e4c1b8-5d3f-4c2a-9b1e-7f0d6c4a2b33',
    });
  });

  test('omits openOnly unless it is true, since the server already defaults it to false', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(page([]));

    await financeInvoiceService.list({ openOnly: false });
    expect(get.mock.calls[0]?.[1]).not.toHaveProperty('openOnly');

    await financeInvoiceService.list({ openOnly: true, status: InvoiceStatus.ISSUED });
    expect(get.mock.calls[1]?.[1]).toMatchObject({
      openOnly: true,
      status: InvoiceStatus.ISSUED,
    });
  });

  test('reads a bare array as the whole of what there is', async () => {
    spyOn(api, 'get').mockResolvedValue([invoiceRow]);

    const result = await financeInvoiceService.list();

    expect(result.content).toHaveLength(1);
    expect(result.totalElements).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  test('reads a shape that is neither as an empty page rather than throwing', async () => {
    // A partial outage should leave the screen empty, not broken. This is how
    // the sibling construction-invoice client treats the same situation.
    spyOn(api, 'get').mockResolvedValue({ message: 'service unavailable' });

    const result = await financeInvoiceService.list({ pageNo: 1 });

    expect(result.content).toEqual([]);
    expect(result.totalElements).toBe(0);
    expect(result.number).toBe(1);
  });

  test('refuses a page holding a row it cannot read, rather than dropping it', async () => {
    // Silently losing an invoice from a receivables list is worse than saying
    // the list could not be read.
    spyOn(api, 'get').mockResolvedValue(page([{ ...invoiceRow, total: 'not a number' }]));

    await expect(financeInvoiceService.list()).rejects.toMatchObject({ status: 422 });
  });
});

describe('the link from a construction invoice to the receivable it raised', () => {
  test('parses arInvoiceId', () => {
    const parsed = parseConstructionInvoice({
      id: '9c2f7a10-4b6d-4f0e-8a21-1d3c5e7b9f42',
      invoiceNumber: 'CI-2026-0031',
      type: 'SALES',
      status: 'APPROVED',
      paymentStatus: 'UNPAID',
      projectId: 17,
      arInvoiceId: '3f1c7e60-0f7a-4a1a-9a3e-2b7d5a1c9e01',
      lines: [],
    });

    expect(parsed.arInvoiceId).toBe('3f1c7e60-0f7a-4a1a-9a3e-2b7d5a1c9e01');
  });

  test('leaves it undefined on an invoice that raised no receivable', () => {
    // Only a sales or service invoice materializes one, so absent is the
    // ordinary case and must not become a null the caller has to test for.
    const parsed = parseConstructionInvoice({
      id: '9c2f7a10-4b6d-4f0e-8a21-1d3c5e7b9f42',
      invoiceNumber: 'CI-2026-0032',
      type: 'PURCHASE',
      status: 'APPROVED',
      paymentStatus: 'UNPAID',
      projectId: 17,
      arInvoiceId: null,
      lines: [],
    });

    expect(parsed.arInvoiceId).toBeUndefined();
  });
});
