import { describe, expect, test } from 'bun:test';
import {
  DelayReason,
  ProgressOutcome,
  parseProgressInspection,
  parseProgressInspectionPage,
} from './work-progress';

const ID = 'b5a1c3d2-8e4f-4a6b-9c7d-0e1f2a3b4c5d';

const record = {
  id: ID,
  projectId: 7,
  wbsElementId: 42,
  wbsCode: '1.2',
  activityTitle: 'RCC Column Casting - Block A',
  inspectionDate: '2026-09-19',
  outcome: 'NOT_DONE',
  percentComplete: '0.00',
  forecastFinishDate: '2026-09-25',
  plannedFinishDate: '2026-09-10',
  delayDays: 15,
  delayReason: 'MATERIAL',
  delayNotes: 'Steel not delivered',
  inspectorEmployeeId: 14,
  inspectorName: 'Ravi Kumar',
  createdAt: '2026-09-19T05:00:00',
};

describe('parseProgressInspection', () => {
  test('reads the record as the backend publishes it', () => {
    const parsed = parseProgressInspection(record);
    expect(parsed.outcome).toBe(ProgressOutcome.NOT_DONE);
    expect(parsed.percentComplete).toBe(0);
    expect(parsed.delayReason).toBe(DelayReason.MATERIAL);
    expect(parsed.delayDays).toBe(15);
    expect(parsed.inspectorName).toBe('Ravi Kumar');
  });

  test('a reason the backend adds later still shows, as OTHER', () => {
    expect(parseProgressInspection({ ...record, delayReason: 'STRIKE' }).delayReason).toBe(DelayReason.OTHER);
    expect(parseProgressInspection({ ...record, delayReason: null }).delayReason).toBeUndefined();
  });

  test('the page reads either spelling of the index', () => {
    const page = parseProgressInspectionPage({ content: [record], number: 2, size: 10, totalElements: 21, totalPages: 3 });
    expect(page.page).toBe(2);
    expect(page.content[0].id).toBe(ID);
    expect(parseProgressInspectionPage({}).content).toEqual([]);
  });
});
