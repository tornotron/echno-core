import { describe, expect, test } from 'bun:test';
import { camelOf, featureKeyOf, nameOf, pascalOf, plan } from './scaffold-domain';

describe('scaffold-domain naming', () => {
  test('derives every casing from the id', () => {
    expect(pascalOf('toolbox-talks')).toBe('ToolboxTalks');
    expect(camelOf('toolbox-talks')).toBe('toolboxTalks');
    expect(featureKeyOf('toolbox-talks')).toBe('MODULE_TOOLBOX_TALKS');
    expect(nameOf('toolbox-talks')).toBe('Toolbox Talks');
  });
});

describe('scaffold-domain plan', () => {
  test('refuses an id outside the manifest pattern', () => {
    expect(() => plan('Toolbox', 'x')).toThrow(/must match/);
    expect(() => plan('1abc', 'x')).toThrow(/must match/);
  });

  test('refuses an id that already exists', () => {
    expect(() => plan('spatial', 'Spatial')).toThrow(/already exists/);
  });

  test('renders every layer with no placeholder left behind', () => {
    const p = plan('ci-probe-plan', 'Probe');
    const paths = p.files.map((f) => f.path);
    expect(paths).toContain('src/types/ci-probe-plan/ci-probe-plan.ts');
    expect(paths).toContain('src/services/ci-probe-plan-service.ts');
    expect(paths).toContain('src/hooks/ci-probe-plan/keys.ts');
    for (const f of p.files) expect(f.content, f.path).not.toMatch(/__[A-Z_]+__/);
    expect(p.indexBlock).toInclude("export * from './hooks/ci-probe-plan';");
  });
});
