import { describe, expect, test } from 'bun:test';
import {
  holidayRequestToJson,
  parseHoliday,
  parseWorkingWeek,
} from './holidays';

const backendShape = {
  id: 11,
  organizationId: 2,
  holidayDate: '2026-10-02',
  name: 'Gandhi Jayanti',
  description: 'National holiday',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('parseHoliday', () => {
  test('parses the full backend shape', () => {
    const holiday = parseHoliday(backendShape);
    expect(holiday.id).toBe(11);
    expect(holiday.organizationId).toBe(2);
    expect(holiday.holidayDateIso).toBe('2026-10-02');
    expect(holiday.holidayDate.getFullYear()).toBe(2026);
    expect(holiday.holidayDate.getMonth()).toBe(9);
    expect(holiday.holidayDate.getDate()).toBe(2);
    expect(holiday.name).toBe('Gandhi Jayanti');
    expect(holiday.description).toBe('National holiday');
    expect(holiday.createdAt).toBeInstanceOf(Date);
  });

  test('tolerates extra fields and a null note', () => {
    const holiday = parseHoliday({
      ...backendShape,
      description: null,
      future: 'field',
    });
    expect(holiday.description).toBeUndefined();
    expect(holiday).not.toHaveProperty('future');
  });

  test('rejects a holiday without a date or an id', () => {
    expect(() => parseHoliday({ ...backendShape, holidayDate: null })).toThrow();
    expect(() => parseHoliday({ ...backendShape, id: undefined })).toThrow();
  });
});

describe('parseWorkingWeek', () => {
  test('orders the days Monday first whatever order they arrive in', () => {
    const week = parseWorkingWeek({
      organizationId: 2,
      workingDays: ['SATURDAY', 'MONDAY', 'TUESDAY'],
    });
    expect(week.workingDays).toEqual(['MONDAY', 'TUESDAY', 'SATURDAY']);
  });

  test('drops a day it does not know and defaults an empty week', () => {
    expect(
      parseWorkingWeek({ organizationId: 2, workingDays: ['FUNDAY'] })
        .workingDays
    ).toEqual(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
  });
});

describe('holidayRequestToJson', () => {
  test('leaves an empty note out', () => {
    expect(
      holidayRequestToJson({ holidayDate: '2026-10-02', name: 'X', description: '' })
    ).toEqual({ holidayDate: '2026-10-02', name: 'X' });
  });
});
