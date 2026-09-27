import { describe, expect, test } from 'bun:test';
import { parseStorageLocation, StorageLocationType } from './storage-location';

// The boundary validates the payload shape: a valid id and scalars come
// through with `active` defaulting to true, while a non-positive id fails
// fast instead of flowing through as a fabricated value.
describe('parseStorageLocation', () => {
  test('parses a minimal valid payload', () => {
    const loc = parseStorageLocation({
      id: 2,
      locationName: 'Godown A',
      locationType: 'GODOWN',
      capacity: '1000 sq ft',
    });
    expect(loc.id).toBe(2);
    expect(loc.locationName).toBe('Godown A');
    expect(loc.locationType).toBe(StorageLocationType.GODOWN);
    expect(loc.active).toBe(true);
    expect(loc.capacity).toBe('1000 sq ft');
  });

  // The backend keeps capacity as free text (units vary by material). Parsing
  // it as a number rejected every location that had one, which emptied the
  // whole list and made the detail page report the location as missing.
  test('keeps a free-text capacity with its unit', () => {
    const loc = parseStorageLocation({
      id: 7,
      locationName: 'Disposable Store',
      locationType: 'WAREHOUSE',
      capacity: '5000 sq ft',
    });
    expect(loc.capacity).toBe('5000 sq ft');
  });

  test('reads a numeric capacity from an older payload as its text', () => {
    const loc = parseStorageLocation({ id: 8, capacity: 1200 });
    expect(loc.capacity).toBe('1200');
  });

  test('treats a missing or blank capacity as none', () => {
    expect(parseStorageLocation({ id: 9, capacity: null }).capacity).toBeUndefined();
    expect(parseStorageLocation({ id: 10, capacity: '  ' }).capacity).toBeUndefined();
    expect(parseStorageLocation({ id: 11 }).capacity).toBeUndefined();
  });

  test('rejects a capacity that is neither text nor a number', () => {
    expect(() => parseStorageLocation({ id: 12, capacity: { value: 5 } })).toThrow();
  });

  test('rejects a non-positive id', () => {
    expect(() => parseStorageLocation({ id: -3 })).toThrow();
  });
});
