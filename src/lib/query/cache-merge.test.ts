import { describe, expect, test } from 'bun:test';

import { mergePreservingNested } from './cache-merge';

interface Entity {
  id: number;
  name: string;
  status: string | null;
  attachments: string[];
  members: number[];
}

const cached: Entity = {
  id: 1,
  name: 'Original',
  status: 'active',
  attachments: ['a.pdf', 'b.pdf'],
  members: [10, 20],
};

describe('mergePreservingNested', () => {
  test('scalar fields from the partial overwrite the cached values', () => {
    const merged = mergePreservingNested(
      cached,
      { name: 'Updated', status: 'archived' },
      ['attachments', 'members']
    );
    expect(merged.name).toBe('Updated');
    expect(merged.status).toBe('archived');
  });

  test('a preserved key is kept from cache when the partial omits it (undefined)', () => {
    const merged = mergePreservingNested(cached, { name: 'Updated' }, [
      'attachments',
      'members',
    ]);
    expect(merged.attachments).toEqual(['a.pdf', 'b.pdf']);
    expect(merged.members).toEqual([10, 20]);
  });

  test('a preserved key is kept from cache when the partial sends null', () => {
    const merged = mergePreservingNested(
      cached,
      { attachments: null as unknown as string[] },
      ['attachments']
    );
    expect(merged.attachments).toEqual(['a.pdf', 'b.pdf']);
  });

  test('a preserved key IS overwritten when the partial supplies a real value', () => {
    const merged = mergePreservingNested(cached, { attachments: ['c.pdf'] }, [
      'attachments',
    ]);
    expect(merged.attachments).toEqual(['c.pdf']);
  });

  test('a non-preserved scalar can be overwritten with null', () => {
    const merged = mergePreservingNested(cached, { status: null }, [
      'attachments',
    ]);
    expect(merged.status).toBeNull();
  });

  test('does not mutate the cached object (returns a new object)', () => {
    const merged = mergePreservingNested(cached, { name: 'Updated' }, [
      'attachments',
    ]);
    expect(merged).not.toBe(cached);
    expect(cached.name).toBe('Original');
  });

  test('with no preserve keys it is a plain shallow merge', () => {
    const merged = mergePreservingNested(
      cached,
      { name: 'Updated', attachments: undefined as unknown as string[] },
      []
    );
    expect(merged.name).toBe('Updated');
    // undefined from the spread overwrites when the key is not preserved
    expect(merged.attachments).toBeUndefined();
  });
});
