import { describe, expect, test } from 'bun:test';
import {
  childSpatialLevel,
  createSpatialNodeToJson,
  formatSpatialPath,
  parseSpatialImportResult,
  parseSpatialNode,
  parseSpatialTreeNode,
  spatialImportToJson,
  updateSpatialNodeToJson,
} from './spatial';

const B1 = '6a1f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6c';
const L03 = '7b2f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6d';
const Z1 = '8c3f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6e';
const C4 = '9d4f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6f';

/** `SpatialNodeDto` as the backend serializes it (openapi.json, be #773). */
const nodeShape = {
  id: C4,
  projectId: 12,
  parentId: Z1,
  level: 'ELEMENT',
  code: 'C4',
  name: 'Column C4',
  depth: 3,
  sortOrder: 4,
  levelIndex: null,
  elementType: 'column',
  bimElementGuid: '2O2Fr$t4X7Zf8NOew3FLKI',
  externalRef: 'Grid C/4',
  archivedAt: null,
  spatialPath: [
    { id: B1, level: 'BUILDING', code: 'B1', name: 'Block B' },
    { id: L03, level: 'FLOOR', code: 'L03', name: 'Level 3' },
    { id: Z1, level: 'ZONE', code: 'Z1', name: 'Zone 1' },
    { id: C4, level: 'ELEMENT', code: 'C4', name: 'Column C4' },
  ],
};

/** `SpatialTreeNodeDto[]` as `GET /project/{id}/spatial` returns it. */
const treeShape = [
  {
    id: B1,
    level: 'BUILDING',
    code: 'B1',
    name: 'Block B',
    parentId: null,
    sortOrder: 0,
    children: [
      {
        id: L03,
        level: 'FLOOR',
        code: 'L03',
        name: 'Level 3',
        parentId: B1,
        levelIndex: 3,
        sortOrder: 0,
        children: [
          {
            id: Z1,
            level: 'ZONE',
            code: 'Z1',
            name: 'Zone 1',
            parentId: L03,
            sortOrder: 0,
            archivedAt: '2026-09-12T10:00:00Z',
            children: [
              {
                id: C4,
                level: 'ELEMENT',
                code: 'C4',
                name: 'Column C4',
                parentId: Z1,
                elementType: 'column',
                sortOrder: 4,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('parseSpatialNode', () => {
  test('parses the backend shape with its breadcrumb', () => {
    const node = parseSpatialNode(nodeShape);
    expect(node.id).toBe(C4);
    expect(node.level).toBe('ELEMENT');
    expect(node.projectId).toBe(12);
    expect(node.depth).toBe(3);
    expect(node.parentId).toBe(Z1);
    expect(node.elementType).toBe('column');
    expect(node.levelIndex).toBeUndefined();
    expect(node.archivedAt).toBeUndefined();
    expect(node.spatialPath.map((s) => s.code)).toEqual(['B1', 'L03', 'Z1', 'C4']);
    expect(node.spatialPath[1]).toEqual({
      id: L03,
      level: 'FLOOR',
      code: 'L03',
      name: 'Level 3',
    });
  });

  test('tolerates extra fields the backend adds later', () => {
    const node = parseSpatialNode({
      ...nodeShape,
      geometry: { x: 1 },
      spatialPath: [{ ...nodeShape.spatialPath[0], future: true }],
    });
    expect(node.id).toBe(C4);
    expect(node.spatialPath).toHaveLength(1);
    expect(node.spatialPath[0]).not.toHaveProperty('future');
  });

  test('defaults the absent optionals on a minimal node', () => {
    const node = parseSpatialNode({ id: B1, level: 'BUILDING', code: 'B1' });
    expect(node.name).toBe('B1');
    expect(node.sortOrder).toBe(0);
    expect(node.depth).toBe(0);
    expect(node.spatialPath).toEqual([]);
  });

  test('rejects a missing id', () => {
    expect(() => parseSpatialNode({ level: 'BUILDING', code: 'B1' })).toThrow();
  });
});

describe('parseSpatialTreeNode', () => {
  test('parses the nested tree down to the element', () => {
    const [building] = treeShape.map((n) => parseSpatialTreeNode(n));
    expect(building.level).toBe('BUILDING');
    expect(building.parentId).toBeUndefined();
    const floor = building.children[0];
    expect(floor.levelIndex).toBe(3);
    const zone = floor.children[0];
    expect(zone.archivedAt).toBe('2026-09-12T10:00:00Z');
    const element = zone.children[0];
    expect(element.id).toBe(C4);
    expect(element.elementType).toBe('column');
    expect(element.children).toEqual([]);
  });

  test('reads absent children as none', () => {
    const node = parseSpatialTreeNode({ id: B1, level: 'BUILDING', code: 'B1' });
    expect(node.children).toEqual([]);
  });
});

describe('levels and breadcrumbs', () => {
  test('walks the chain building to element', () => {
    expect(childSpatialLevel('BUILDING')).toBe('FLOOR');
    expect(childSpatialLevel('ZONE')).toBe('ELEMENT');
    expect(childSpatialLevel('ELEMENT')).toBeUndefined();
  });

  test('formats a path by code, or by name', () => {
    const { spatialPath } = parseSpatialNode(nodeShape);
    expect(formatSpatialPath(spatialPath)).toBe('B1 / L03 / Z1 / C4');
    expect(formatSpatialPath(spatialPath, 'name', ' > ')).toBe(
      'Block B > Level 3 > Zone 1 > Column C4'
    );
  });
});

describe('request serializers match the backend contract', () => {
  test('create sends only the fields set', () => {
    expect(
      createSpatialNodeToJson({
        level: 'FLOOR',
        code: 'L03',
        name: 'Level 3',
        parentId: B1,
        levelIndex: 3,
      })
    ).toEqual({
      level: 'FLOOR',
      code: 'L03',
      name: 'Level 3',
      parentId: B1,
      levelIndex: 3,
    });
  });

  test('update omits what was not given', () => {
    expect(updateSpatialNodeToJson({ name: 'Level Three' })).toEqual({
      name: 'Level Three',
    });
  });

  test('import rows keep the building and drop undefined optionals', () => {
    expect(
      spatialImportToJson({
        rows: [
          { building: 'B1', floor: 'L03', element: 'C4', elementType: 'column' },
          { building: 'B2' },
        ],
      })
    ).toEqual({
      rows: [
        { building: 'B1', floor: 'L03', element: 'C4', elementType: 'column' },
        { building: 'B2' },
      ],
    });
  });

  test('import result defaults absent counts to zero', () => {
    expect(parseSpatialImportResult({ created: 7 })).toEqual({
      created: 7,
      skipped: 0,
    });
  });
});
