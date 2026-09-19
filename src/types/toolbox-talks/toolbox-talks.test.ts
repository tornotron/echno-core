import { describe, expect, test } from 'bun:test';
import {
  ToolboxTalkStatus,
  parseToolboxTalk,
  parseToolboxTalkAttendee,
  parseToolboxTalkPage,
} from './toolbox-talks';

const TALK = 'b5a1c3d2-8e4f-4a6b-9c7d-0e1f2a3b4c5d';
const NODE = '0f9e8d7c-6b5a-4433-9221-100f0e0d0c0b';

const backendShape = {
  id: TALK,
  projectId: 7,
  spatialNodeId: NODE,
  topic: 'Working at height',
  talkDate: '2026-09-19',
  talkTime: '07:30:00',
  conductorEmployeeId: 12,
  notes: 'Harness check before the scaffold.',
  status: 'RECORDED',
  attendees: [{ employeeId: 21 }, { employeeId: 22 }],
  recordedAt: '2026-09-19T02:05:00Z',
  createdAt: '2026-09-19T01:00:00Z',
  updatedAt: '2026-09-19T02:05:00Z',
};

describe('parseToolboxTalk boundary validation', () => {
  test('parses the full backend shape', () => {
    const talk = parseToolboxTalk(backendShape);
    expect(talk).toEqual({ ...backendShape, status: ToolboxTalkStatus.RECORDED });
    expect(talk.attendees.map((a) => a.employeeId)).toEqual([21, 22]);
  });

  test('tolerates extra fields the backend adds later', () => {
    const talk = parseToolboxTalk({ ...backendShape, future: 'field' });
    expect(talk.id).toBe(TALK);
    expect(talk).not.toHaveProperty('future');
  });

  test('defaults absent optional fields on a minimal draft', () => {
    const talk = parseToolboxTalk({ id: TALK });
    expect(talk.status).toBe(ToolboxTalkStatus.DRAFT);
    expect(talk.attendees).toEqual([]);
    expect(talk.notes).toBe('');
    expect(talk.spatialNodeId).toBeUndefined();
    expect(talk.talkTime).toBeUndefined();
    expect(talk.recordedAt).toBeUndefined();
  });

  test('an unknown status reads as a draft', () => {
    expect(parseToolboxTalk({ id: TALK, status: 'ARCHIVED' }).status).toBe(
      ToolboxTalkStatus.DRAFT
    );
  });

  test('drops a malformed attendee row and keeps the rest', () => {
    const talk = parseToolboxTalk({
      id: TALK,
      attendees: [
        { employeeId: 21 },
        { name: 'no id' },
        { employeeId: '23' },
        { employeeId: null },
        { employeeId: '' },
        { employeeId: false },
      ],
    });
    expect(talk.attendees.map((a) => a.employeeId)).toEqual([21, 23]);
  });

  test('rejects a missing id', () => {
    expect(() => parseToolboxTalk({ topic: 'no id' })).toThrow();
  });
});

describe('parseToolboxTalkAttendee', () => {
  test('coerces a string id', () => {
    expect(parseToolboxTalkAttendee({ employeeId: '9' })).toEqual({ employeeId: 9 });
  });

  test('rejects a row without an employee', () => {
    expect(() => parseToolboxTalkAttendee({})).toThrow();
  });
});

describe('parseToolboxTalkPage', () => {
  test('parses the page envelope and its rows', () => {
    const page = parseToolboxTalkPage({
      content: [backendShape],
      number: 2,
      size: 20,
      totalElements: 41,
      totalPages: 3,
    });
    expect(page.page).toBe(2);
    expect(page.totalElements).toBe(41);
    expect(page.content).toHaveLength(1);
    expect(page.content[0].topic).toBe('Working at height');
  });

  test('an empty envelope is an empty page', () => {
    const page = parseToolboxTalkPage({});
    expect(page.content).toEqual([]);
    expect(page.totalPages).toBe(0);
  });
});
