import { describe, expect, test } from 'bun:test';
import { parseClockEvent } from './clock-event';

// Timestamp-convention coverage lives in `clock-timestamp.test.ts`, which pins a
// non-UTC zone so the assertions are not vacuous. What is left here are the parts
// of the parser that do not depend on the client's offset.
describe('parseClockEvent', () => {
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

  test('rejects a non-positive id', () => {
    expect(() =>
      parseClockEvent({ id: 0, timestamp: '2026-02-25T10:30:00Z' })
    ).toThrow();
  });
});
