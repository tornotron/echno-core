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
      capacity: 1000,
    });
    expect(loc.id).toBe(2);
    expect(loc.locationName).toBe('Godown A');
    expect(loc.locationType).toBe(StorageLocationType.GODOWN);
    expect(loc.active).toBe(true);
  });

  test('rejects a non-positive id', () => {
    expect(() => parseStorageLocation({ id: -3 })).toThrow();
  });
});
