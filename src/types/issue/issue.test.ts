import { describe, expect, test } from 'bun:test';
import { parseIssue } from './issue';
import { IssueType } from './issue-type';
import { IssueStatus } from './issue-status';

const valid = {
  id: 8,
  title: 'Broken lift',
  type: 'technical',
  status: 'open',
  createdById: 4,
  assignedToId: 6,
  createdAt: '2026-02-25T09:00:00Z',
};

describe('parseIssue boundary validation', () => {
  test('parses a valid issue and maps the wire field names', () => {
    const issue = parseIssue(valid);
    expect(issue.id).toBe(8);
    expect(issue.title).toBe('Broken lift');
    expect(issue.type).toBe(IssueType.technical);
    expect(issue.status).toBe(IssueStatus.open);
    expect(issue.creatorId).toBe(4);
    expect(issue.assigneeId).toBe(6);
  });

  test('rejects a missing id', () => {
    expect(() => parseIssue({ ...valid, id: undefined })).toThrow();
  });

  test('rejects an unknown type', () => {
    expect(() => parseIssue({ ...valid, type: 'nonsense' })).toThrow();
  });
});
