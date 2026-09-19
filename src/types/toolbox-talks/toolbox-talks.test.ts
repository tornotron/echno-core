import { describe, expect, test } from 'bun:test';
import { parseToolboxTalks, parseToolboxTalksPage } from './toolbox-talks';

const backendShape = {
  id: '11',
  name: 'First record',
  description: 'A description',
  projectId: 7,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('parseToolboxTalks boundary validation', () => {
  test('parses the full backend shape', () => {
    const record = parseToolboxTalks(backendShape);
    expect(record).toEqual(backendShape);
  });

  test('tolerates extra fields the backend adds later', () => {
    const record = parseToolboxTalks({ ...backendShape, future: 'field' });
    expect(record.id).toBe('11');
    expect(record).not.toHaveProperty('future');
  });

  test('defaults absent optional fields on a minimal record', () => {
    const record = parseToolboxTalks({ id: 11 });
    expect(record.id).toBe('11');
    expect(record.name).toBe('');
    expect(record.description).toBe('');
    expect(record.projectId).toBeUndefined();
  });

  test('rejects a missing id', () => {
    expect(() => parseToolboxTalks({ name: 'no id' })).toThrow();
  });
});

describe('parseToolboxTalksPage', () => {
  test('parses the page envelope and its rows', () => {
    const page = parseToolboxTalksPage({
      content: [backendShape],
      number: 2,
      size: 20,
      totalElements: 41,
      totalPages: 3,
    });
    expect(page.page).toBe(2);
    expect(page.totalElements).toBe(41);
    expect(page.content).toHaveLength(1);
    expect(page.content[0].id).toBe('11');
  });

  test('an empty envelope is an empty page', () => {
    const page = parseToolboxTalksPage({});
    expect(page.content).toEqual([]);
    expect(page.totalPages).toBe(0);
  });
});
