import { describe, expect, test } from 'bun:test';
import { parseModuleDescriptor } from './module';

const backendShape = {
  id: 'inspections',
  name: 'Inspections',
  version: '1.4.0',
  entitlementFeatureKey: 'MODULE_INSPECTIONS',
  enabled: true,
  entitled: true,
  nav: [
    {
      label: 'Inspections',
      section: 'inspections',
      path: '/users/dashboard/inspections',
      icon: 'ClipboardCheck',
      requiredPermissions: ['inspections:view'],
    },
  ],
  permissions: ['inspections:view', 'inspections:edit'],
};

describe('parseModuleDescriptor boundary validation', () => {
  test('parses the full backend shape', () => {
    const module = parseModuleDescriptor(backendShape);
    expect(module.id).toBe('inspections');
    expect(module.name).toBe('Inspections');
    expect(module.version).toBe('1.4.0');
    expect(module.entitlementFeatureKey).toBe('MODULE_INSPECTIONS');
    expect(module.enabled).toBe(true);
    expect(module.entitled).toBe(true);
    expect(module.nav).toHaveLength(1);
    expect(module.nav[0]).toEqual({
      label: 'Inspections',
      section: 'inspections',
      path: '/users/dashboard/inspections',
      icon: 'ClipboardCheck',
      requiredPermissions: ['inspections:view'],
    });
    expect(module.permissions).toEqual(['inspections:view', 'inspections:edit']);
  });

  test('tolerates extra fields the backend adds later', () => {
    const module = parseModuleDescriptor({
      ...backendShape,
      description: 'a field this client does not know about yet',
      nav: [{ ...backendShape.nav[0], future: 'field' }],
    });
    expect(module.id).toBe('inspections');
    expect(module.nav[0].path).toBe('/users/dashboard/inspections');
  });

  test('defaults absent optional fields on a minimal descriptor', () => {
    const module = parseModuleDescriptor({ id: 'inspections' });
    expect(module.id).toBe('inspections');
    expect(module.name).toBe('inspections');
    expect(module.enabled).toBe(false);
    expect(module.entitled).toBe(false);
    expect(module.nav).toEqual([]);
    expect(module.permissions).toEqual([]);
  });

  test('rejects a missing id', () => {
    expect(() => parseModuleDescriptor({ name: 'Inspections' })).toThrow();
  });

  test('rejects an empty id', () => {
    expect(() => parseModuleDescriptor({ id: '' })).toThrow();
  });
});
