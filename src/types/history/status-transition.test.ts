/**
 * A system change and a person's change must not read the same.
 *
 * echno-backend#660 writes two kinds of entry no person made: `BASELINE`, the
 * status a record was observed to hold when the trail began, and `SYSTEM`, a
 * status the migration corrected to match movements already posted. Both carry
 * no actor. A screen that renders every entry as somebody's act attributes a
 * migration to a colleague, which is the failure a trail exists to prevent.
 *
 * Delete `isPersonsChange` and the two tests below fail; delete the `system`
 * member of the enum and the parser folds a `SYSTEM` entry to `UPDATE`, which
 * is the same misattribution arriving by a different route.
 */
import { describe, expect, test } from 'bun:test';

import {
  StatusTransitionSource,
  isPersonsChange,
  parseStatusTransition,
} from './status-transition';

/** A trail entry with the fields the parser needs. */
const entry = (over: Record<string, unknown>) =>
  parseStatusTransition({
    id: 1,
    fromStatus: 'PENDING',
    toStatus: 'COMPLETED',
    source: 'UPDATE',
    occurredAt: '2026-01-17T14:05:00',
    changedBy: 3,
    changedByName: 'Hrishi',
    ...over,
  });

describe('who an entry is attributed to', () => {
  test('a receipt is somebody act, and names them', () => {
    const moved = entry({ source: 'UPDATE' });

    expect(isPersonsChange(moved)).toBe(true);
    expect(moved.changedByName).toBe('Hrishi');
  });

  test('a migration correcting a status is not somebody act', () => {
    const corrected = entry({
      source: 'SYSTEM',
      changedBy: null,
      changedByName: null,
      note: 'Status corrected to match movements already posted',
    });

    expect(corrected.source).toBe(StatusTransitionSource.system);
    expect(isPersonsChange(corrected)).toBe(false);
  });

  test('the status a transfer was observed to hold is not a change at all', () => {
    const baseline = entry({
      source: 'BASELINE',
      fromStatus: null,
      changedBy: null,
      changedByName: null,
    });

    expect(baseline.source).toBe(StatusTransitionSource.baseline);
    expect(isPersonsChange(baseline)).toBe(false);
    expect(baseline.fromStatus).toBeNull();
  });

  test('creation is somebody act', () => {
    expect(isPersonsChange(entry({ source: 'CREATION' }))).toBe(true);
  });
});

describe('a source the backend adds later', () => {
  test('renders rather than throwing', () => {
    const unknown = entry({ source: 'SOMETHING_NEW' });

    expect(unknown.source).toBe(StatusTransitionSource.update);
  });
});
