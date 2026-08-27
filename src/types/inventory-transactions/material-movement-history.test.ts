import { describe, expect, test } from 'bun:test';
import {
  StockDirection,
  parseMaterialMovementHistoryEntry,
} from './material-movement-history';
import { InventoryTransactionType } from './enums';

const validPayload = {
  id: 5012,
  transactionDate: '2026-08-01T10:30:00',
  transactionType: 'USE',
  direction: 'DECREASE',
  storageLocationId: 7,
  storageLocationName: 'Site A main store',
  projectId: 42,
  projectName: 'Tower B fit-out',
  openingStock: 115,
  quantityChanged: -15,
  closingStock: 100,
  referenceNumber: 'GRN-2026-0042',
  createdByName: 'Asha Menon',
};

describe('parseMaterialMovementHistoryEntry', () => {
  test('parses a full payload', () => {
    const entry = parseMaterialMovementHistoryEntry(validPayload);
    expect(entry.id).toBe(5012);
    expect(entry.transactionType).toBe(InventoryTransactionType.use);
    expect(entry.direction).toBe(StockDirection.decrease);
    expect(entry.storageLocationName).toBe('Site A main store');
    expect(entry.openingStock).toBe(115);
    expect(entry.quantityChanged).toBe(-15);
    expect(entry.closingStock).toBe(100);
    expect(entry.referenceNumber).toBe('GRN-2026-0042');
    expect(entry.createdByName).toBe('Asha Menon');
  });

  test('coerces string-serialized stock figures to numbers', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      openingStock: '100.25',
      quantityChanged: '12.50',
      closingStock: '112.75',
    });
    expect(entry.openingStock).toBe(100.25);
    expect(entry.quantityChanged).toBe(12.5);
    expect(entry.closingStock).toBe(112.75);
  });

  test('falls back to EITHER when the direction is absent', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      direction: null,
    });
    expect(entry.direction).toBe(StockDirection.either);
  });

  test('leaves an omitted reference number undefined and names blank', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      referenceNumber: null,
      projectName: null,
    });
    expect(entry.referenceNumber).toBeUndefined();
    expect(entry.projectName).toBe('');
  });

  test('leaves the creator name undefined for an uncredited movement', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      createdByName: null,
    });
    expect(entry.createdByName).toBeUndefined();
  });

  test('falls back to a zero balance when the stock figures are absent', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      openingStock: null,
      closingStock: null,
    });
    expect(entry.openingStock).toBe(0);
    expect(entry.closingStock).toBe(0);
  });

  test('throws when id is not a positive integer', () => {
    expect(() =>
      parseMaterialMovementHistoryEntry({ ...validPayload, id: 0 })
    ).toThrow();
  });
});
