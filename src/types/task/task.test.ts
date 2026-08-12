import { describe, expect, test } from 'bun:test';
import { parseTask } from './task';

describe('parseTask', () => {
  test('parses a minimal payload and applies defaults', () => {
    const task = parseTask({ id: 5, status: 'onGoing' });
    expect(task.id).toBe(5);
    expect(task.projectId).toBe(1);
    expect(task.title).toBe('Untitled Task');
    expect(task.status).toBe('onGoing');
  });

  test('throws when id is missing', () => {
    expect(() => parseTask({ status: 'onGoing' })).toThrow();
  });

  test('rejects a non-numeric progress instead of yielding NaN', () => {
    expect(() =>
      parseTask({ id: 5, status: 'onGoing', progress: 'abc' })
    ).toThrow();
  });
});
