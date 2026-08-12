import { describe, expect, test } from 'bun:test';
import { parseIssueComment } from './issue-comment';

describe('parseIssueComment boundary validation', () => {
  test('parses a valid comment and carries fields through', () => {
    const comment = parseIssueComment({
      id: 2,
      comment: 'Looks good',
      authorId: 4,
      createdAt: '2026-02-25T09:00:00Z',
    });
    expect(comment.id).toBe(2);
    expect(comment.comment).toBe('Looks good');
    expect(comment.authorId).toBe(4);
  });

  test('rejects a missing id', () => {
    expect(() => parseIssueComment({ comment: 'orphan' })).toThrow();
  });
});
