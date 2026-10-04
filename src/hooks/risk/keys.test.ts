import { describe, expect, test } from 'bun:test';
import { riskKeys } from './keys';

describe('riskKeys', () => {
  test('a risk sits under its project, which sits under the root', () => {
    expect(riskKeys.project(42)).toEqual(['risks', 'project', 42]);
    expect(riskKeys.detail(42, 'abc')).toEqual(['risks', 'project', 42, 'abc']);
    expect(riskKeys.detail(42, 'abc').slice(0, 3)).toEqual([...riskKeys.project(42)]);
  });
});
