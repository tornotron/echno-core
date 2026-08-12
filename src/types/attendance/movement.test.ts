import { describe, expect, test } from 'bun:test';
import { parseMovementRecord } from './movement';

const valid = {
  id: 3,
  attendanceId: 5,
  employeeId: 9,
  startTime: '2026-02-25T09:00:00Z',
  createdAt: '2026-02-25T09:00:00Z',
  updatedAt: '2026-02-25T09:30:00Z',
};

describe('parseMovementRecord boundary validation', () => {
  test('parses a valid record and hydrates startTime', () => {
    const movement = parseMovementRecord(valid);
    expect(movement.id).toBe(3);
    expect(movement.startTime.toISOString()).toBe('2026-02-25T09:00:00.000Z');
  });

  test('rejects a non-positive id', () => {
    expect(() => parseMovementRecord({ ...valid, id: -2 })).toThrow();
  });
});
