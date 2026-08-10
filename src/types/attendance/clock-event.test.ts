import { describe, expect, test } from 'bun:test';
import { parseClockEvent } from './clock-event';

// The backend sends attendance timestamps without a timezone suffix. `new Date()`
// reads those as local time, which shifts every clock event by the client offset
// (a payroll-correctness bug). The parser now treats naive timestamps as UTC.
describe('parseClockEvent timestamp handling', () => {
  test('treats a naive timestamp as UTC, not local time', () => {
    const event = parseClockEvent({ id: 1, timestamp: '2026-02-25T10:30:00' });

    // UTC instant is fixed regardless of the machine running the test.
    expect(event.timestamp.toISOString()).toBe('2026-02-25T10:30:00.000Z');
  });

  test('preserves an explicit UTC (Z) timestamp', () => {
    const event = parseClockEvent({ id: 1, timestamp: '2026-02-25T10:30:00Z' });

    expect(event.timestamp.toISOString()).toBe('2026-02-25T10:30:00.000Z');
  });

  test('preserves an explicit offset timestamp', () => {
    const event = parseClockEvent({ id: 1, timestamp: '2026-02-25T16:00:00+05:30' });

    expect(event.timestamp.toISOString()).toBe('2026-02-25T10:30:00.000Z');
  });

  test('leaves an absent verifiedAt undefined', () => {
    const event = parseClockEvent({ id: 1, timestamp: '2026-02-25T10:30:00Z' });

    expect(event.verifiedAt).toBeUndefined();
  });
});
