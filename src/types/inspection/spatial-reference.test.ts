import { describe, expect, test } from 'bun:test';
import {
  CheckItemStatus,
  InspectionType,
  createInspectionToJson,
  parseInspection,
  parseInspectionCheckItem,
  parseInspectionDefect,
} from './inspection';

const Z1 = '8c3f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6e';
const B1 = '6a1f3c1e-0d4e-4f5a-9b2c-1d2e3f4a5b6c';
const path = [
  { id: B1, level: 'BUILDING', code: 'B1', name: 'Block B' },
  { id: Z1, level: 'ZONE', code: 'Z1', name: 'Zone 1' },
];

describe('spatial reference on inspection entities (be #775)', () => {
  test('an inspection carries its node and breadcrumb', () => {
    const inspection = parseInspection({
      id: '0f0e0d0c-0b0a-4908-8706-050403020100',
      title: 'Slab pour',
      type: 'quality',
      status: 'scheduled',
      spatialNodeId: Z1,
      spatialPath: path,
    });
    expect(inspection.spatialNodeId).toBe(Z1);
    expect(inspection.spatialPath.map((s) => s.code)).toEqual(['B1', 'Z1']);
  });

  test('an inspection with only free text keeps the fallback and an empty path', () => {
    const inspection = parseInspection({
      id: '0f0e0d0c-0b0a-4908-8706-050403020100',
      title: 'Slab pour',
      type: 'quality',
      status: 'scheduled',
      location: 'Block C, Ground Floor',
      spatialNodeId: null,
      spatialPath: [],
    });
    expect(inspection.location).toBe('Block C, Ground Floor');
    expect(inspection.spatialNodeId).toBeUndefined();
    expect(inspection.spatialPath).toEqual([]);
  });

  test('a defect and a check item carry the same pair', () => {
    const defect = parseInspectionDefect({
      id: '1f0e0d0c-0b0a-4908-8706-050403020100',
      description: 'Honeycombing',
      correctiveAction: 'Grout',
      spatialNodeId: Z1,
      spatialPath: path,
    });
    expect(defect.spatialNodeId).toBe(Z1);
    expect(defect.spatialPath).toHaveLength(2);

    const item = parseInspectionCheckItem({
      id: '2f0e0d0c-0b0a-4908-8706-050403020100',
      category: 'Formwork',
      checkPoint: 'Alignment',
      status: 'passed',
      spatialNodeId: Z1,
      spatialPath: path,
    });
    expect(item.spatialNodeId).toBe(Z1);
    expect(item.spatialPath[1].name).toBe('Zone 1');
  });

  test('requests send spatialNodeId on the inspection, its defects and its check items', () => {
    const json = createInspectionToJson({
      title: 'Slab pour',
      type: InspectionType.QUALITY,
      scheduledDate: '2026-09-14',
      inspectorId: 7,
      projectId: 12,
      spatialNodeId: Z1,
      location: 'note kept alongside',
      defects: [
        { description: 'Honeycombing', correctiveAction: 'Grout', spatialNodeId: Z1 },
      ],
      checkItems: [
        {
          category: 'Formwork',
          checkPoint: 'Alignment',
          status: CheckItemStatus.PASSED,
          photosRequired: false,
          spatialNodeId: null,
        },
      ],
    });
    expect(json.spatialNodeId).toBe(Z1);
    expect(json.location).toBe('note kept alongside');
    expect((json.defects as Record<string, unknown>[])[0].spatialNodeId).toBe(Z1);
    expect((json.checkItems as Record<string, unknown>[])[0].spatialNodeId).toBeNull();
  });
});
