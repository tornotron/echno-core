import { describe, expect, test } from 'bun:test';
import {
  WbsDependencyType,
  WbsStatus,
  parseWbsActivity,
  parseWbsDependency,
  parseWbsSchedule,
} from './wbs';

const activity = {
  id: 42,
  wbsCode: '1.2',
  title: 'RCC Column Casting - Block A',
  level: 1,
  sortOrder: 0,
  status: 'IN_PROGRESS',
  startDate: '2026-09-01',
  endDate: '2026-09-10',
  actualStartDate: '2026-09-02',
  forecastEndDate: '2026-09-25',
  progress: 40,
  weight: 1.5,
  budgetedCost: '850000.00',
  actualCost: 612340.5,
  isLeaf: true,
  isMilestone: false,
  parentId: 12,
  projectId: 7,
  responsibleEmployeeId: 14,
  responsibleEmployeeName: 'Ravi Kumar',
  responsibleSubContractId: 3,
  responsibleSubContractorName: 'Sree Builders',
  delayDays: 15,
  children: null,
};

describe('parseWbsActivity', () => {
  test('reads the schedule fields the backend publishes', () => {
    const row = parseWbsActivity(activity);
    expect(row.status).toBe(WbsStatus.IN_PROGRESS);
    expect(row.endDate).toBe('2026-09-10');
    expect(row.forecastEndDate).toBe('2026-09-25');
    expect(row.delayDays).toBe(15);
    expect(row.budgetedCost).toBe(850000);
    expect(row.responsibleSubContractorName).toBe('Sree Builders');
    expect(row).not.toHaveProperty('children');
  });

  test('defaults what an older backend leaves out', () => {
    const row = parseWbsActivity({ id: '9', status: 'SOMETHING_NEW' });
    expect(row.id).toBe(9);
    expect(row.status).toBe(WbsStatus.NOT_STARTED);
    expect(row.isMilestone).toBe(false);
    expect(row.isLeaf).toBe(true);
    expect(row.delayDays).toBeUndefined();
  });

  test('an on-time activity keeps a delay of zero, not absent', () => {
    expect(parseWbsActivity({ ...activity, delayDays: 0 }).delayDays).toBe(0);
  });
});

describe('parseWbsDependency and parseWbsSchedule', () => {
  test('an unknown link type reads as finish-to-start', () => {
    const link = parseWbsDependency({ id: 1, predecessorId: 41, successorId: 42, type: 'XX' });
    expect(link.type).toBe(WbsDependencyType.FS);
    expect(link.lagDays).toBe(0);
  });

  test('the schedule carries activities and links', () => {
    const schedule = parseWbsSchedule({
      activities: [activity],
      dependencies: [{ id: 1, predecessorId: 41, predecessorWbsCode: '1.1', successorId: 42, successorWbsCode: '1.2', type: 'SS', lagDays: 2 }],
    });
    expect(schedule.activities).toHaveLength(1);
    expect(schedule.dependencies[0]).toEqual({
      id: 1,
      predecessorId: 41,
      predecessorWbsCode: '1.1',
      successorId: 42,
      successorWbsCode: '1.2',
      type: WbsDependencyType.SS,
      lagDays: 2,
    });
  });

  test('an empty schedule is empty, not an error', () => {
    expect(parseWbsSchedule({})).toEqual({ activities: [], dependencies: [] });
  });
});
