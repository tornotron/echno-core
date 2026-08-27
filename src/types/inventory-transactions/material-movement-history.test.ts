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
  quantityChanged: -15,
  referenceNumber: 'GRN-2026-0042',
};

describe('parseMaterialMovementHistoryEntry', () => {
  test('parses a full payload', () => {
    const entry = parseMaterialMovementHistoryEntry(validPayload);
    expect(entry.id).toBe(5012);
    expect(entry.transactionType).toBe(InventoryTransactionType.use);
    expect(entry.direction).toBe(StockDirection.decrease);
    expect(entry.storageLocationName).toBe('Site A main store');
    expect(entry.quantityChanged).toBe(-15);
    expect(entry.referenceNumber).toBe('GRN-2026-0042');
  });

  test('coerces a string-serialized quantity to a number', () => {
    const entry = parseMaterialMovementHistoryEntry({
      ...validPayload,
      quantityChanged: '12.50',
    });
    expect(entry.quantityChanged).toBe(12.5);
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

  test('throws when id is not a positive integer', () => {
    expect(() =>
      parseMaterialMovementHistoryEntry({ ...validPayload, id: 0 })
    ).toThrow();
  });
});
