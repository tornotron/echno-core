import { describe, expect, test } from 'bun:test';
import {
  parseReceipt,
  createReceiptToJson,
  ReceiptType,
  ReceiptStatus,
} from './receipt';

// The backend serializes the BigDecimal amount as a string and sends the
// lowercase enum vocabulary; the boundary coerces the amount to a number, the
// timestamps to Date, and narrows the enums with a sensible default.
describe('parseReceipt', () => {
  test('parses a valid payload with enums, money and dates', () => {
    const receipt = parseReceipt({
      id: 42,
      receiptNumber: 'RCP-2027-000001',
      type: 'advance',
      status: 'issued',
      amount: '45000.00',
      currency: 'INR',
      receiptDate: '2026-08-20',
      receivedFrom: 'Asset Homes Pvt Ltd',
      taxAmount: '8100.00',
      taxRate: '18.00',
      taxType: 'GST',
      projectId: 3,
      customerId: 12,
      createdAt: '2026-08-20T09:00:00',
      updatedAt: '2026-08-22T14:20:00',
    });
    expect(receipt.id).toBe(42);
    expect(receipt.receiptNumber).toBe('RCP-2027-000001');
    expect(receipt.type).toBe(ReceiptType.advance);
    expect(receipt.status).toBe(ReceiptStatus.issued);
    expect(receipt.amount).toBe(45000);
    expect(receipt.currency).toBe('INR');
    expect(receipt.receivedFrom).toBe('Asset Homes Pvt Ltd');
    expect(receipt.taxAmount).toBe(8100);
    expect(receipt.taxRate).toBe(18);
    expect(receipt.taxType).toBe('GST');
    expect(receipt.projectId).toBe(3);
    expect(receipt.customerId).toBe(12);
    expect(receipt.receiptDate).toBeInstanceOf(Date);
    expect(receipt.createdAt).toBeInstanceOf(Date);
    // The naive server timestamp is read as UTC.
    expect(receipt.createdAt.toISOString()).toBe('2026-08-20T09:00:00.000Z');
    expect(receipt.updatedAt?.toISOString()).toBe('2026-08-22T14:20:00.000Z');
  });

  test('coerces a string-serialized amount to a number', () => {
    expect(parseReceipt({ id: 1, amount: '1500.50' }).amount).toBe(1500.5);
  });

  test('defaults a missing amount to 0 and currency to INR', () => {
    const receipt = parseReceipt({ id: 1 });
    expect(receipt.amount).toBe(0);
    expect(receipt.currency).toBe('INR');
  });

  test('falls back to default enums on an unknown or absent value', () => {
    const receipt = parseReceipt({ id: 1, type: 'BOGUS' });
    expect(receipt.type).toBe(ReceiptType.payment);
    expect(receipt.status).toBe(ReceiptStatus.draft);
  });

  test('leaves optional links, tax and dates undefined when absent', () => {
    const receipt = parseReceipt({ id: 1 });
    expect(receipt.projectId).toBeUndefined();
    expect(receipt.customerId).toBeUndefined();
    expect(receipt.taxAmount).toBeUndefined();
    expect(receipt.receiptDate).toBeUndefined();
    expect(receipt.updatedAt).toBeUndefined();
  });

  test('defaults an absent receivedFrom to an empty string', () => {
    expect(parseReceipt({ id: 1 }).receivedFrom).toBe('');
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseReceipt({ amount: 10 })).toThrow();
  });

  test('rejects a non-positive id', () => {
    expect(() => parseReceipt({ id: 0 })).toThrow();
  });
});

describe('createReceiptToJson', () => {
  test('always emits the required fields and only set optionals', () => {
    const json = createReceiptToJson({
      amount: 3200,
      receivedFrom: 'Asset Homes Pvt Ltd',
      type: ReceiptType.deposit,
      projectId: 5,
    });
    expect(json.amount).toBe(3200);
    expect(json.receivedFrom).toBe('Asset Homes Pvt Ltd');
    expect(json.type).toBe('deposit');
    expect(json.projectId).toBe(5);
    expect('customerId' in json).toBe(false);
    expect('status' in json).toBe(false);
  });
});
