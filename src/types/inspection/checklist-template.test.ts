import { describe, expect, test } from 'bun:test';
import {
  checklistTemplateToJson,
  parseChecklistTemplate,
  parseChecklistTemplateItem,
  parseStarterChecklistTemplate,
} from './checklist-template';
import { InspectionTrade } from './inspection';

const UUID = '11111111-1111-1111-1111-111111111111';
const ITEM_A = '22222222-2222-2222-2222-222222222222';
const ITEM_B = '33333333-3333-3333-3333-333333333333';

describe('parseChecklistTemplate', () => {
  test('parses a full payload', () => {
    const template = parseChecklistTemplate({
      id: UUID,
      trade: 'reinforcement',
      name: 'Reinforcement inspection checklist',
      description: 'Pre-pour check for slabs, beams and columns',
      active: true,
      version: 4,
      items: [
        {
          id: ITEM_A,
          category: 'Reinforcement',
          checkPoint: 'Main bar spacing matches the bar bending schedule',
          specification: 'IS 456:2000 cl. 26.3',
          expectedValue: '150 mm',
          acceptanceCriterion: 'Spacing measured at three locations per bay',
          tolerance: '+/- 10 mm',
          photosRequired: true,
          priority: 'high',
          lineOrder: 0,
        },
      ],
      createdAt: '2026-08-20T10:00:00',
      updatedAt: '2026-08-25T11:00:00',
    });
    expect(template.id).toBe(UUID);
    expect(template.trade).toBe(InspectionTrade.REINFORCEMENT);
    expect(template.name).toBe('Reinforcement inspection checklist');
    expect(template.description).toBe(
      'Pre-pour check for slabs, beams and columns'
    );
    expect(template.active).toBe(true);
    expect(template.version).toBe(4);
    expect(template.items).toHaveLength(1);
    expect(template.items[0]!.acceptanceCriterion).toBe(
      'Spacing measured at three locations per bay'
    );
    expect(template.items[0]!.tolerance).toBe('+/- 10 mm');
    expect(template.updatedAt).toBe('2026-08-25T11:00:00');
  });

  test('sorts the check points by line order, not by array position', () => {
    // The order is what the checklist means: it is the order the work is carried
    // out in, and the backend stores it as a column rather than relying on the
    // collection order.
    const template = parseChecklistTemplate({
      id: UUID,
      trade: 'rcc',
      items: [
        { id: ITEM_A, checkPoint: 'Second', lineOrder: 1 },
        { id: ITEM_B, checkPoint: 'First', lineOrder: 0 },
      ],
    });
    expect(template.items.map((i) => i.checkPoint)).toEqual([
      'First',
      'Second',
    ]);
  });

  test('falls back to the array position when no line order is sent', () => {
    const template = parseChecklistTemplate({
      id: UUID,
      items: [
        { id: ITEM_A, checkPoint: 'First' },
        { id: ITEM_B, checkPoint: 'Second' },
      ],
    });
    expect(template.items.map((i) => i.lineOrder)).toEqual([0, 1]);
  });

  test('treats an omitted active flag as active, matching the column default', () => {
    expect(parseChecklistTemplate({ id: UUID }).active).toBe(true);
    expect(parseChecklistTemplate({ id: UUID, active: false }).active).toBe(
      false
    );
  });

  test('defaults the version to 1 and the items to an empty list', () => {
    const template = parseChecklistTemplate({ id: UUID });
    expect(template.version).toBe(1);
    expect(template.items).toEqual([]);
  });

  test('leaves the trade unset rather than accepting a constant name', () => {
    expect(
      parseChecklistTemplate({ id: UUID, trade: 'REINFORCEMENT' }).trade
    ).toBeUndefined();
  });

  test('rejects a missing id instead of fabricating one', () => {
    expect(() => parseChecklistTemplate({ trade: 'rcc' })).toThrow();
  });
});

describe('parseChecklistTemplateItem', () => {
  test('defaults photosRequired to false and leaves the rest unset', () => {
    const item = parseChecklistTemplateItem({ id: ITEM_A });
    expect(item.photosRequired).toBe(false);
    expect(item.specification).toBeUndefined();
    expect(item.acceptanceCriterion).toBeUndefined();
    expect(item.tolerance).toBeUndefined();
    expect(item.priority).toBeUndefined();
  });
});

describe('parseStarterChecklistTemplate', () => {
  test('parses a starter with its items and carries no version or active flag', () => {
    const starter = parseStarterChecklistTemplate({
      id: UUID,
      trade: 'waterproofing',
      name: 'Waterproofing starter checklist',
      description: 'Shipped with the product',
      items: [{ id: ITEM_A, checkPoint: 'Ponding test held for 48 hours' }],
    });
    expect(starter.trade).toBe(InspectionTrade.WATERPROOFING);
    expect(starter.items).toHaveLength(1);
    expect('version' in starter).toBe(false);
    expect('active' in starter).toBe(false);
  });
});

describe('checklistTemplateToJson', () => {
  test('always emits the trade, name and the whole item list', () => {
    const json = checklistTemplateToJson({
      trade: InspectionTrade.PLUMBING_FIXTURES,
      name: 'Plumbing fixtures',
      items: [
        { category: 'Fixtures', checkPoint: 'Traps sealed' },
        {
          category: 'Fixtures',
          checkPoint: 'Pressure test held',
          acceptanceCriterion: 'No drop over 30 minutes',
          tolerance: '0.2 bar',
          photosRequired: true,
          priority: 'high',
        },
      ],
    });
    expect(json.trade).toBe('plumbing-fixtures');
    expect(json.name).toBe('Plumbing fixtures');
    // Optional at the template level, so an unstated description and active flag
    // are left to the backend's own defaults.
    expect('description' in json).toBe(false);
    expect('active' in json).toBe(false);

    const items = json.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    // A primitive boolean on the backend record, so it is always emitted.
    expect(items[0]!.photosRequired).toBe(false);
    expect('acceptanceCriterion' in items[0]!).toBe(false);
    expect(items[1]!.acceptanceCriterion).toBe('No drop over 30 minutes');
    expect(items[1]!.photosRequired).toBe(true);
    // The line order is the position in the list and is not accepted from us.
    expect('lineOrder' in items[1]!).toBe(false);
  });

  test('sends an explicit active flag when one is given', () => {
    const json = checklistTemplateToJson({
      trade: InspectionTrade.MASONRY,
      name: 'Masonry',
      description: 'Block work',
      active: false,
      items: [{ category: 'Masonry', checkPoint: 'Courses level' }],
    });
    expect(json.description).toBe('Block work');
    expect(json.active).toBe(false);
  });
});
