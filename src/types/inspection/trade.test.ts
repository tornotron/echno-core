import { describe, expect, test } from 'bun:test';
import {
  InspectionTrade,
  createCatalogueRowToJson,
  groupCatalogueRows,
  inspectionTradeLabel,
  inspectionTradeLabels,
  inspectionTradeOrder,
  isLegacyInspectionTrade,
  parseInspectionTrade,
  parseOrgElementType,
  parseOrgTrade,
  parseTradeCatalogueEntry,
  templateApplies,
  updateCatalogueRowToJson,
} from './trade';
import { parseChecklistTemplate } from './checklist-template';
import { parseInspection } from './inspection';
import { ProjectType } from '../project/project-type';

/**
 * Transcribed from echno-backend `inspection/InspectionTrade.java`. The enum
 * is a compatibility shim there for one release; these sixteen strings are
 * what the catalogue seeds as `legacy_enum` rows, and a rename on either side
 * must fail here rather than as a 422 on the first request.
 */
const LEGACY: Record<string, string> = {
  PRE_CONSTRUCTION_DOCUMENTATION: 'pre-construction-documentation',
  SHUTTERING_FORMWORK: 'shuttering-formwork',
  REINFORCEMENT: 'reinforcement',
  RCC: 'rcc',
  MASONRY: 'masonry',
  PLASTERING: 'plastering',
  WATERPROOFING: 'waterproofing',
  FLOORING: 'flooring',
  FABRICATION: 'fabrication',
  ALUMINIUM_UPVC: 'aluminium-upvc',
  ELECTRICAL_FIXTURES: 'electrical-fixtures',
  PLUMBING_FIXTURES: 'plumbing-fixtures',
  SANITARY_FIXTURES: 'sanitary-fixtures',
  FINISHING: 'finishing',
  DIMENSIONAL_CHECK: 'dimensional-check',
  PROGRESS_CHECK: 'progress-check',
};

describe('InspectionTrade widened to a slug', () => {
  test('the sixteen legacy constants keep their wire values', () => {
    expect({ ...InspectionTrade } as Record<string, string>).toEqual(LEGACY);
    expect(inspectionTradeOrder).toHaveLength(16);
    for (const value of Object.values(LEGACY)) {
      expect(inspectionTradeLabels[value as keyof typeof inspectionTradeLabels]).toBeTruthy();
      expect(isLegacyInspectionTrade(value)).toBe(true);
    }
  });

  test('every legacy value still parses', () => {
    for (const value of Object.values(LEGACY)) {
      expect(parseInspectionTrade(value)).toBe(value);
    }
  });

  test('a new catalogue slug and an org-defined slug parse', () => {
    expect(parseInspectionTrade('fire-systems')).toBe('fire-systems');
    expect(parseInspectionTrade('precast-erection')).toBe('precast-erection');
    expect(isLegacyInspectionTrade('precast-erection')).toBe(false);
  });

  test('a missing or malformed value is left unset', () => {
    expect(parseInspectionTrade(null)).toBeUndefined();
    expect(parseInspectionTrade(undefined)).toBeUndefined();
    expect(parseInspectionTrade('')).toBeUndefined();
    expect(parseInspectionTrade('REINFORCEMENT')).toBeUndefined();
    expect(parseInspectionTrade(3)).toBeUndefined();
  });

  test('labels prefer the row name, then the legacy label, then the slug', () => {
    expect(inspectionTradeLabel('rcc', 'Reinforced concrete')).toBe(
      'Reinforced concrete'
    );
    expect(inspectionTradeLabel('rcc')).toBe('RCC');
    expect(inspectionTradeLabel('precast-erection')).toBe('Precast Erection');
    expect(inspectionTradeLabel(undefined)).toBe('');
  });
});

describe('nullable trade on templates and inspections', () => {
  test('a template with a null trade and a tradeId parses', () => {
    const template = parseChecklistTemplate({
      id: 'e6f9d8c2-7b1a-4c3e-9f2d-1a2b3c4d5e6f',
      trade: null,
      tradeId: '0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      tradeName: 'Precast erection',
      tradeGroup: 'structural',
      name: 'Precast',
      items: [],
      applicableElementTypes: ['column', 'beam'],
      applicableProjectTypes: ['RESIDENTIAL', 'NOT_A_TYPE'],
    });
    expect(template.trade).toBeUndefined();
    expect(template.tradeId).toBe('0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d');
    expect(template.tradeName).toBe('Precast erection');
    expect(template.tradeGroup).toBe('structural');
    expect(template.applicableElementTypes).toEqual(['column', 'beam']);
    expect(template.applicableProjectTypes).toEqual([ProjectType.RESIDENTIAL]);
  });

  test('null applicability means any', () => {
    const template = parseChecklistTemplate({
      id: 'e6f9d8c2-7b1a-4c3e-9f2d-1a2b3c4d5e6f',
      trade: 'tiling',
      name: 'Tiling',
      items: [],
      applicableElementTypes: null,
      applicableProjectTypes: [],
    });
    expect(template.trade).toBe('tiling');
    expect(template.applicableElementTypes).toBeUndefined();
    expect(template.applicableProjectTypes).toBeUndefined();
  });

  test('an inspection carries the trade row fields', () => {
    const inspection = parseInspection({
      id: 'e6f9d8c2-7b1a-4c3e-9f2d-1a2b3c4d5e6f',
      type: 'qa-qc',
      trade: 'doors-windows',
      tradeId: '0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      tradeName: 'Doors and windows',
      tradeGroup: 'openings',
    });
    expect(inspection.trade).toBe('doors-windows');
    expect(inspection.tradeId).toBe('0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d');
    expect(inspection.tradeName).toBe('Doors and windows');
    expect(inspection.tradeGroup).toBe('openings');
  });
});

describe('catalogue rows', () => {
  test('an org trade parses with its catalogue code', () => {
    const trade = parseOrgTrade({
      id: '0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      code: 'rcc',
      name: 'RCC',
      groupCode: 'structural',
      description: null,
      sortOrder: 4,
      active: true,
      catalogueCode: 'rcc',
    });
    expect(trade.catalogueCode).toBe('rcc');
    expect(trade.active).toBe(true);
  });

  test('an org-defined element type has no catalogue code', () => {
    const type = parseOrgElementType({
      id: '0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      code: 'precast-panel',
      name: 'Precast panel',
      groupCode: 'structure',
      sortOrder: 99,
      catalogueCode: null,
    });
    expect(type.catalogueCode).toBeUndefined();
    expect(type.active).toBe(true);
  });

  test('a catalogue entry parses and an org row without an id throws', () => {
    expect(
      parseTradeCatalogueEntry({ code: 'tiling', name: 'Tiling', groupCode: 'finishes', sortOrder: 11, active: true }).code
    ).toBe('tiling');
    expect(() => parseOrgTrade({ code: 'tiling', name: 'Tiling' })).toThrow();
  });

  test('requests serialize only what was set', () => {
    expect(
      createCatalogueRowToJson({ code: 'x', name: 'X', groupCode: 'g' })
    ).toEqual({ code: 'x', name: 'X', groupCode: 'g' });
    expect(updateCatalogueRowToJson({ active: false })).toEqual({ active: false });
  });

  test('grouping keeps sort order and drops inactive rows by default', () => {
    const rows = [
      { code: 'b', name: 'B', groupCode: 'mep', sortOrder: 2, active: true },
      { code: 'a', name: 'A', groupCode: 'structural', sortOrder: 1, active: true },
      { code: 'c', name: 'C', groupCode: 'mep', sortOrder: 3, active: false },
    ];
    const groups = groupCatalogueRows(rows);
    expect(groups.map((g) => g.groupCode)).toEqual(['structural', 'mep']);
    expect(groups[1]!.rows.map((r) => r.code)).toEqual(['b']);
    expect(groupCatalogueRows(rows, true)[1]!.rows).toHaveLength(2);
  });
});

describe('templateApplies', () => {
  test('unset applicability admits everything', () => {
    expect(templateApplies({}, 'column', 'RESIDENTIAL')).toBe(true);
  });
  test('a listed element type is admitted and an unlisted one is not', () => {
    const t = { applicableElementTypes: ['column', 'beam'] };
    expect(templateApplies(t, 'column')).toBe(true);
    expect(templateApplies(t, 'slab')).toBe(false);
    expect(templateApplies(t, undefined)).toBe(true);
  });
  test('project type is checked the same way', () => {
    const t = { applicableProjectTypes: ['INDUSTRIAL'] };
    expect(templateApplies(t, 'column', 'INDUSTRIAL')).toBe(true);
    expect(templateApplies(t, 'column', 'RESIDENTIAL')).toBe(false);
  });
});
