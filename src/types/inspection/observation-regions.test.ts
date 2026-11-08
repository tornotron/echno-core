/**
 * Observation regions and the reject reason (core #166, backend WP1). The
 * region shapes are transcribed from `ObservationRegionDto`, `RegionEditOp`
 * and `ObservationRegionRequest` on echno-backend `development`.
 */
import { describe, expect, test } from 'bun:test';
import {
  ObservationDecision,
  RegionEditKind,
  type RegionEditOp,
  RegionOrigin,
  RegionShape,
  RejectReason,
  createObservationToJson,
  hasObservationChanges,
  isRegionActive,
  parseObservation,
  parseObservationRegion,
  parseRegionShape,
  parseRejectReason,
  regionEditOpToJson,
  reviewObservationToJson,
} from './observation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const OBS = '11111111-1111-1111-1111-111111111111';
const R1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const R2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const boxRegion: Raw = {
  id: R1,
  attachmentId: 18342,
  shape: 'box',
  box: [0.412, 0.188, 0.471, 0.262],
  points: null,
  imageWidth: 4032,
  imageHeight: 3024,
  classKey: 'ppe_helmet',
  score: 0.81,
  origin: 'producer',
  supersedesId: null,
  retiredAt: null,
  retiredById: null,
  lineOrder: 0,
  createdAt: '2026-11-01T10:00:00',
  createdById: null,
};

const polygonRegion: Raw = {
  id: R2,
  attachmentId: '18342',
  shape: 'polygon',
  box: ['0.1', '0.49', '0.21', '0.61'],
  points: [
    [0.1, 0.52],
    [0.18, 0.49],
    [0.21, 0.61],
  ],
  classKey: 'crack',
  score: null,
  origin: 'reviewer',
  supersedesId: R1,
  retiredAt: '2026-11-02T09:00:00',
  retiredById: 5,
  lineOrder: 1,
  createdById: 5,
};

describe('parseObservationRegion', () => {
  test('reads a producer box with its score and image size', () => {
    const region = parseObservationRegion(boxRegion);
    expect(region).toEqual({
      id: R1,
      attachmentId: 18342,
      shape: RegionShape.BOX,
      box: [0.412, 0.188, 0.471, 0.262],
      points: undefined,
      imageWidth: 4032,
      imageHeight: 3024,
      classKey: 'ppe_helmet',
      score: 0.81,
      origin: RegionOrigin.PRODUCER,
      supersedesId: undefined,
      retiredAt: undefined,
      retiredById: undefined,
      lineOrder: 0,
      createdAt: '2026-11-01T10:00:00',
      createdById: undefined,
    });
    expect(isRegionActive(region)).toBe(true);
  });

  test('reads a retired reviewer polygon, coercing string numbers', () => {
    const region = parseObservationRegion(polygonRegion);
    expect(region.shape).toBe(RegionShape.POLYGON);
    expect(region.attachmentId).toBe(18342);
    expect(region.box).toEqual([0.1, 0.49, 0.21, 0.61]);
    expect(region.points).toEqual([
      [0.1, 0.52],
      [0.18, 0.49],
      [0.21, 0.61],
    ]);
    expect(region.score).toBeUndefined();
    expect(region.origin).toBe(RegionOrigin.REVIEWER);
    expect(region.supersedesId).toBe(R1);
    expect(isRegionActive(region)).toBe(false);
  });

  test('ignores points on a box and defaults an unknown origin to producer', () => {
    const region = parseObservationRegion({
      ...boxRegion,
      points: [[0.1, 0.1]],
      origin: 'robot',
      lineOrder: null,
    });
    expect(region.points).toBeUndefined();
    expect(region.origin).toBe(RegionOrigin.PRODUCER);
    expect(region.lineOrder).toBe(0);
  });

  test('refuses a region it cannot draw', () => {
    expect(() => parseObservationRegion({ ...boxRegion, id: null })).toThrow();
    expect(() => parseObservationRegion({ ...boxRegion, attachmentId: null })).toThrow();
    expect(() => parseObservationRegion({ ...boxRegion, box: [0.1, 0.2, 0.3] })).toThrow();
    expect(() => parseObservationRegion({ ...boxRegion, box: [0.1, 'x', 0.3, 0.4] })).toThrow();
  });

  test('reads the slug and the registry constant name for a shape', () => {
    expect(parseRegionShape('polygon')).toBe(RegionShape.POLYGON);
    expect(parseRegionShape('POLYGON')).toBe(RegionShape.POLYGON);
    expect(parseRegionShape('BOX')).toBe(RegionShape.BOX);
    expect(parseRegionShape(undefined)).toBe(RegionShape.BOX);
  });
});

describe('Observation regions and rejectReason', () => {
  test('an observation carries its regions in order and its reject reason', () => {
    const observation = parseObservation({
      id: OBS,
      title: 'Helmet',
      source: 'ai',
      reviewStatus: 'rejected',
      rejectReason: 'false-positive',
      regions: [boxRegion, polygonRegion],
    });
    expect(observation.regions.map((r) => r.id)).toEqual([R1, R2]);
    expect(observation.rejectReason).toBe(RejectReason.FALSE_POSITIVE);
  });

  test('an older backend with neither field reads as no regions and no reason', () => {
    const observation = parseObservation({ id: OBS, title: 'Crack' });
    expect(observation.regions).toEqual([]);
    expect(observation.rejectReason).toBeUndefined();
  });

  test('one unreadable region is dropped, not the observation', () => {
    const observation = parseObservation({
      id: OBS,
      title: 'Helmet',
      regions: [boxRegion, { ...polygonRegion, box: null }],
    });
    expect(observation.regions.map((r) => r.id)).toEqual([R1]);
  });

  test('an unknown reject reason is left unset rather than guessed', () => {
    expect(parseRejectReason('blurry')).toBeUndefined();
    expect(parseRejectReason('out-of-scope')).toBe(RejectReason.OUT_OF_SCOPE);
  });
});

describe('region edits', () => {
  test('replace, remove and add serialise to the backend RegionEditOp', () => {
    const ops: RegionEditOp[] = [
      {
        op: RegionEditKind.REPLACE,
        regionId: R1,
        shape: RegionShape.BOX,
        box: [0.4, 0.18, 0.48, 0.27],
        classKey: 'ppe_helmet',
      },
      { op: RegionEditKind.REMOVE, regionId: R2 },
      {
        op: RegionEditKind.ADD,
        attachmentId: 18342,
        shape: RegionShape.POLYGON,
        points: [
          [0.1, 0.1],
          [0.2, 0.1],
          [0.2, 0.2],
        ],
        classKey: 'crack',
        imageWidth: 4032,
        imageHeight: 3024,
      },
    ];
    expect(ops.map(regionEditOpToJson)).toEqual([
      {
        op: 'replace',
        regionId: R1,
        shape: 'box',
        box: [0.4, 0.18, 0.48, 0.27],
        classKey: 'ppe_helmet',
      },
      { op: 'remove', regionId: R2 },
      {
        op: 'add',
        attachmentId: 18342,
        shape: 'polygon',
        points: [
          [0.1, 0.1],
          [0.2, 0.1],
          [0.2, 0.2],
        ],
        classKey: 'crack',
        imageWidth: 4032,
        imageHeight: 3024,
      },
    ]);
  });

  test('a modify with only region edits is a change and sends them in order', () => {
    const json = reviewObservationToJson({
      decision: ObservationDecision.MODIFY,
      changes: { regions: [{ op: RegionEditKind.REMOVE, regionId: R2 }] },
    });
    expect(json).toEqual({
      decision: 'modify',
      changes: { regions: [{ op: 'remove', regionId: R2 }] },
    });
  });

  test('an empty edit list is no change', () => {
    expect(hasObservationChanges({ regions: [] })).toBe(false);
    expect(() =>
      reviewObservationToJson({
        decision: ObservationDecision.MODIFY,
        changes: { regions: [] },
      })
    ).toThrow(TypeError);
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.MODIFY,
        changes: { title: 'Helmet missing', regions: [] },
      })
    ).toEqual({ decision: 'modify', changes: { title: 'Helmet missing' } });
  });

  test('a reject reason is sent on a rejection and only then', () => {
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.REJECT,
        note: 'Shadow, not a helmet',
        rejectReason: RejectReason.FALSE_POSITIVE,
      })
    ).toEqual({
      decision: 'reject',
      note: 'Shadow, not a helmet',
      rejectReason: 'false-positive',
    });
    expect(
      reviewObservationToJson({
        decision: ObservationDecision.ACCEPT,
        rejectReason: RejectReason.DUPLICATE,
      })
    ).toEqual({ decision: 'accept' });
  });
});

describe('createObservationToJson regions', () => {
  test('sends a human box and polygon without a score', () => {
    const json = createObservationToJson({
      projectId: 7,
      title: 'Crack in slab',
      regions: [
        {
          attachmentId: 18342,
          shape: RegionShape.BOX,
          box: [0.1, 0.1, 0.2, 0.2],
          classKey: 'ppe_helmet',
        },
        {
          attachmentId: 18343,
          shape: RegionShape.POLYGON,
          points: [
            [0.1, 0.1],
            [0.2, 0.1],
            [0.2, 0.2],
          ],
          classKey: 'crack',
          imageWidth: 800,
          imageHeight: 600,
        },
      ],
    });
    expect(json.regions).toEqual([
      { attachmentId: 18342, shape: 'box', box: [0.1, 0.1, 0.2, 0.2], classKey: 'ppe_helmet' },
      {
        attachmentId: 18343,
        shape: 'polygon',
        points: [
          [0.1, 0.1],
          [0.2, 0.1],
          [0.2, 0.2],
        ],
        classKey: 'crack',
        imageWidth: 800,
        imageHeight: 600,
      },
    ]);
  });

  test('leaves regions out when none were drawn', () => {
    expect(createObservationToJson({ projectId: 7, title: 'Crack' })).not.toHaveProperty('regions');
  });
});
