import { describe, expect, test } from 'bun:test';
import { parseProject } from './project';
import { ProjectStatus } from './project-status';

// The boundary validates the payload shape before building the domain
// object: a valid id and scalars come through, missing nested arrays
// collapse to empty, and a non-positive id fails fast.
describe('parseProject', () => {
  test('parses a minimal valid payload', () => {
    const project = parseProject({
      id: 3,
      projectName: 'Riverside Tower',
      status: 'open',
      progress: 40,
    });
    expect(project.id).toBe(3);
    expect(project.projectName).toBe('Riverside Tower');
    expect(project.status).toBe(ProjectStatus.open);
    expect(project.members).toEqual([]);
  });

  test('rejects a non-positive id', () => {
    expect(() => parseProject({ id: 0 })).toThrow();
  });
});
