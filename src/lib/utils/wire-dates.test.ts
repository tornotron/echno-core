/**
 * Behaviour tests for the conversions this sweep changed.
 *
 * Two zones are pinned rather than one, on purpose, and which zone is used
 * where is the interesting part.
 *
 * `Asia/Kolkata` is the house choice because it is where the users are, and it
 * is the zone that exposes the *write*-side bugs: at UTC+05:30 a `Date` at
 * local midnight falls on the previous UTC day, so `toISOString()` emits the
 * wrong calendar date.
 *
 * It does not expose the *read*-side ones. A naive `'2026-08-27T00:00:00'` read
 * as UTC is 05:30 on the 27th in IST, whose local calendar date is still the
 * 27th, so the assertion passes against the bug. Only a negative offset moves
 * it back across midnight. `America/New_York` is pinned for exactly those
 * cases, which is why the round-trip half of this file uses it.
 *
 * That asymmetry is the point worth carrying forward: picking IST by reflex
 * because it is the standing convention would have signed off on every
 * read-side fix below.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import {
  parseLocalDate,
  parseLocalDateTime,
  parseUTCDate,
  toLocalDateAtMidnight,
  toLocalDateTimeString,
} from './date-helpers';
import { parseTask, taskToJson } from '../../types/task/task';
import { projectToJson } from '../../types/project/project';
import { employeeToJson } from '../../types/employee/employee';
import { createIssueToJson } from '../../types/issue/issue-create';
import { updateIssueToJson } from '../../types/issue/issue-update';
import { generateInviteCodeToJson } from '../../types/invitation/invitation-create';

// Resolved rather than read straight from the environment: TZ is unset on CI,
// and restoring an unset TZ by deleting the key freezes the zone for the rest of
// the process in Bun, so later files can no longer pin their own. Assigning a
// concrete zone back is the only restore that works.
const originalTimeZone =
  process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

function restoreTimeZone(): void {
  process.env.TZ = originalTimeZone;
}

afterAll(restoreTimeZone);

/**
 * Runs a test body with `zone` in effect.
 *
 * The zone is set inside the test rather than in a `beforeAll`, because the
 * runner shares one process across test files and another file's `afterAll` can
 * land between this file's `beforeAll` and its tests, resetting the zone. That
 * produced a failure which reproduced only when TZ was unset to begin with,
 * which is CI and not a developer's machine.
 */
function inZone(zone: string, body: () => void): () => void {
  return () => {
    process.env.TZ = zone;
    try {
      body();
    } finally {
      restoreTimeZone();
    }
  };
}

/** The local calendar date, which is what every assertion here is really about. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

describe('parseLocalDate, under a negative offset', () => {
  test(
    'keeps a bare LocalDate on its own day',
    inZone('America/New_York', () => {
      // The behaviour being replaced, asserted directly. A date-only string is
      // the one form the spec requires new Date() to read as UTC.
      expect(localDay(new Date('2026-08-27'))).toBe('2026-08-26');
      expect(localDay(parseLocalDate('2026-08-27')!)).toBe('2026-08-27');
    })
  );

  test(
    'delegates a value that carries a time part',
    inZone('America/New_York', () => {
      expect(localDay(parseLocalDate('2026-08-27T09:30:00')!)).toBe(
        '2026-08-27'
      );
    })
  );

  test(
    'returns null for nullish and unparseable input',
    inZone('America/New_York', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('not a date')).toBeNull();
    })
  );
});

describe('a calendar date survives the round trip', () => {
  test(
    'written local and read local, the day is preserved',
    inZone('America/New_York', () => {
      const picked = new Date(2026, 7, 27); // what a calendar picker yields
      const wire = toLocalDateAtMidnight(picked);

      expect(wire).toBe('2026-08-27T00:00:00');
      // The read side this sweep changed. parseUTCDate was the previous half of
      // the pair and lands a day early here, which is invisible in IST.
      expect(localDay(parseUTCDate(wire)!)).toBe('2026-08-26');
      expect(localDay(parseLocalDateTime(wire)!)).toBe('2026-08-27');
    })
  );

  test(
    'parseTask reads the planned dates as local and the timestamps as UTC',
    inZone('America/New_York', () => {
      const task = parseTask({
        id: 1,
        projectId: 2,
        title: 'Raft pour',
        status: 'onGoing',
        startDate: '2026-08-27T00:00:00',
        createdAt: '2026-08-27T00:00:00',
      });

      // A calendar date the user picked.
      expect(localDay(task.startDate!)).toBe('2026-08-27');
      // A server-set instant, recorded by a backend running in UTC.
      expect(task.createdAt!.toISOString()).toBe('2026-08-27T00:00:00.000Z');
    })
  );
});

describe('round-trip serializers emit no offset', () => {
  test(
    'taskToJson sends local dates, not a UTC instant',
    inZone('Asia/Kolkata', () => {
      const json = taskToJson({
        id: 1,
        projectId: 2,
        title: 'Raft pour',
        startDate: new Date(2026, 7, 27),
        endDate: new Date(2026, 8, 30),
        createdAt: new Date(2026, 7, 27, 9, 15, 0),
        tags: [],
        issues: [],
      } as unknown as Parameters<typeof taskToJson>[0]);

      expect(json.startDate).toBe('2026-08-27T00:00:00');
      expect(json.endDate).toBe('2026-09-30T00:00:00');
      expect(json.createdAt).toBe('2026-08-27T09:15:00');
      // The shape the backend's @JsonFormat(lenient = FALSE) rejects.
      expect(String(json.startDate)).not.toContain('Z');
    })
  );

  test(
    'projectToJson sends local dates',
    inZone('Asia/Kolkata', () => {
      const json = projectToJson({
        id: 1,
        projectName: 'Marina Towers',
        startDate: new Date(2026, 7, 27),
        createdAt: new Date(2026, 7, 27, 9, 15, 0),
        members: [],
        tasks: [],
        attachments: [],
      } as unknown as Parameters<typeof projectToJson>[0]);

      expect(json.startDate).toBe('2026-08-27T00:00:00');
      expect(json.createdAt).toBe('2026-08-27T09:15:00');
    })
  );

  test(
    'employeeToJson sends the birth and joining dates as calendar dates',
    inZone('Asia/Kolkata', () => {
      const json = employeeToJson({
        dateOfBirth: new Date(1990, 7, 22),
        joiningDate: new Date(2026, 7, 27),
        updatedAt: new Date(2026, 7, 27, 21, 45, 30),
      } as unknown as Parameters<typeof employeeToJson>[0]);

      expect(json.dateOfBirth).toBe('1990-08-22T00:00:00');
      expect(json.joiningDate).toBe('2026-08-27T00:00:00');
      expect(json.updatedAt).toBe('2026-08-27T21:45:30');
    })
  );

  test(
    'toLocalDateTimeString keeps the wall clock the user saw',
    inZone('Asia/Kolkata', () => {
      expect(toLocalDateTimeString(new Date(2026, 7, 27, 9, 0, 0))).toBe(
        '2026-08-27T09:00:00'
      );
    })
  );
});

describe('fields the backend has no column for are no longer sent', () => {
  test('issue create and update send no due date', () => {
    const created = createIssueToJson({
      title: 'Honeycombing on the south face',
      issueType: 'QUALITY',
      projectId: 1,
    } as unknown as Parameters<typeof createIssueToJson>[0]);
    const updated = updateIssueToJson({
      title: 'Honeycombing on the south face',
    } as unknown as Parameters<typeof updateIssueToJson>[0]);

    expect(created).not.toHaveProperty('dueDate');
    expect(updated).not.toHaveProperty('dueDate');
  });

  test('invite-code generation sends no joining date', () => {
    const json = generateInviteCodeToJson({
      designation: 'Site Engineer',
      department: 'Execution',
    });

    expect(json).not.toHaveProperty('joiningDate');
  });
});
