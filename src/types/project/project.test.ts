import { describe, expect, test } from 'bun:test';
import { parseProject } from './project';
import { createProjectToJson } from './project-create';
import { updateProjectToJson } from './project-update';
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

  test('carries the structured address parts through', () => {
    const project = parseProject({
      id: 3,
      projectAddress: '12 Mount Road',
      projectCity: 'Chennai',
      projectState: 'Tamil Nadu',
      projectPostalCode: '600004',
    });
    expect(project.projectCity).toBe('Chennai');
    expect(project.projectState).toBe('Tamil Nadu');
    expect(project.projectPostalCode).toBe('600004');
  });

  test('leaves the address parts undefined on a project that has none', () => {
    // Every project created before those columns existed. They must not
    // surface as empty strings, which would read as "recorded, and blank".
    const project = parseProject({ id: 3, projectAddress: '12 Mount Road' });
    expect(project.projectCity).toBeUndefined();
    expect(project.projectState).toBeUndefined();
    expect(project.projectPostalCode).toBeUndefined();
  });
});

describe('createProjectToJson', () => {
  test('emits the address parts that are set and omits the rest', () => {
    // The serializer is a whitelist, so a field it does not name never
    // reaches the backend however well typed it is upstream.
    const json = createProjectToJson({
      projectName: 'Riverside Tower',
      projectAddress: '12 Mount Road',
      projectState: 'Tamil Nadu',
      projectPostalCode: '600004',
    });
    expect(json.projectState).toBe('Tamil Nadu');
    expect(json.projectPostalCode).toBe('600004');
    expect('projectCity' in json).toBe(false);
  });
});

describe('updateProjectToJson', () => {
  test('emits only the address parts the caller changed', () => {
    const json = updateProjectToJson({ projectState: 'Kerala' });
    expect(json).toEqual({ projectState: 'Kerala' });
  });
});
