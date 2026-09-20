import { describe, expect, test } from 'bun:test';
import { parseProjectSummary } from './project-summary';
import { ProjectStatus } from './project-status';
import { ProjectType } from './project-type';

describe('parseProjectSummary', () => {
  test('parses a ProjectSummaryDto payload', () => {
    const summary = parseProjectSummary({
      id: 42,
      projectName: 'Tower B',
      projectAddress: '12 Marina Road',
      projectCity: 'Chennai',
      projectState: 'Tamil Nadu',
      projectPostalCode: '600004',
      createdAt: '2026-08-01T09:00:00',
      status: 'ONGOING',
      projectType: 'RESIDENTIAL',
      projectLatitude: 13.0827,
      projectLongitude: 80.2707,
      startDate: '2026-09-01T00:00:00',
      endDate: '2027-06-30T00:00:00',
      progress: 35,
      memberCount: 8,
      taskCount: 24,
    });
    expect(summary.id).toBe(42);
    expect(summary.projectName).toBe('Tower B');
    expect(summary.status).toBe(ProjectStatus.open);
    expect(summary.projectType).toBe(ProjectType.RESIDENTIAL);
    expect(summary.startDate).toBeInstanceOf(Date);
    expect(summary.progress).toBe(35);
    expect(summary.memberCount).toBe(8);
    expect(summary.taskCount).toBe(24);
  });

  test('absent counts read as zero and unknown keys are ignored', () => {
    const summary = parseProjectSummary({
      id: 3,
      projectName: 'x',
      employees: [{ id: 1 }],
      tasks: [{ id: 2 }],
    });
    expect(summary.memberCount).toBe(0);
    expect(summary.taskCount).toBe(0);
    expect(summary.progress).toBe(0);
    expect('members' in summary).toBe(false);
    expect('tasks' in summary).toBe(false);
  });

  test('rejects a missing id', () => {
    expect(() => parseProjectSummary({ projectName: 'x' })).toThrow();
  });
});
