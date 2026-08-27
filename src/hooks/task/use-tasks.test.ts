import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * Where `useTasksByProject` gets its rows.
 *
 * It used to call `taskService.getAll()` and keep the rows whose `projectId`
 * matched. That listing is bounded, so a project whose tasks fell outside the
 * bound rendered as having none, and every project view paid for the whole
 * tenant's tasks to use a handful of them. Filtering by project belongs on the
 * server, and an endpoint for it already exists.
 *
 * Asserted against the source because this package has no React test renderer,
 * and because the property is about which call the hook makes rather than what
 * that call returns. `task-service.test.ts` covers the request and the parsing.
 */
const source = readFileSync(
  new URL('./use-tasks.ts', import.meta.url),
  'utf8'
);

/** The body of one exported hook, up to the start of the next one. */
function hookBody(name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf('\nexport function ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('useTasksByProject', () => {
  const body = hookBody('useTasksByProject');

  test('asks the service for the project’s tasks', () => {
    expect(body).toInclude('taskService.getByProjectId(projectId)');
  });

  test('does not read the whole task list', () => {
    expect(body).not.toInclude('getAll(');
  });

  test('does not filter by projectId in the browser', () => {
    expect(body).not.toInclude('task.projectId === projectId');
  });
});
