/**
 * The BIM module's wire shapes (core #115). Fails without the code: the
 * `types/bim` folder does not exist on `development`.
 */
import { describe, expect, test } from 'bun:test';
import {
  BIM_SOURCE_MAX_BYTES,
  confirmBimHierarchyToJson,
  isBimJobActive,
  isBimVersionInProgress,
  parseBimBoundingBox,
  parseBimElement,
  parseBimElementPage,
  parseBimHierarchyProposal,
  parseBimImportJob,
  parseBimModel,
  parseBimSourceUpload,
  parseBimTileManifest,
  presignBimSourceToJson,
} from './bim';

const MODEL = '11111111-1111-1111-1111-111111111111';
const V1 = '22222222-2222-2222-2222-222222222222';
const V2 = '33333333-3333-3333-3333-333333333333';
const JOB = '44444444-4444-4444-4444-444444444444';
const EL = '55555555-5555-5555-5555-555555555555';
const NODE = '66666666-6666-6666-6666-666666666666';

describe('parseBimModel', () => {
  test('parses a model with its versions and the current READY one', () => {
    const model = parseBimModel({
      id: MODEL,
      projectId: 12,
      name: 'Tower A',
      currentVersionId: V1,
      versions: [
        { id: V2, modelId: MODEL, versionNumber: 2, status: 'PROCESSING', meta: null },
        {
          id: V1,
          modelId: MODEL,
          versionNumber: 1,
          status: 'READY',
          ifcSchema: 'IFC4',
          elementCount: 1200,
          storeyCount: 5,
          hierarchyProposed: true,
          meta: { units: 'METRE', trueNorth: 12.5 },
        },
      ],
      extra: 'dropped',
    });
    expect(model.projectId).toBe(12);
    expect(model.currentVersionId).toBe(V1);
    expect(model.versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(model.versions[0].status).toBe('PROCESSING');
    expect(model.versions[0].meta).toEqual({});
    expect(model.versions[1].meta).toEqual({ units: 'METRE', trueNorth: 12.5 });
    expect(model.versions[1].hierarchyProposed).toBe(true);
    expect(model).not.toHaveProperty('extra');
  });

  test('an unknown version status reads as UNKNOWN and is not in progress', () => {
    const model = parseBimModel({
      id: MODEL,
      versions: [{ id: V1, status: 'SOMETHING_NEW' }],
    });
    expect(model.versions[0].status).toBe('UNKNOWN');
    expect(isBimVersionInProgress(model.versions[0].status)).toBe(false);
    expect(isBimVersionInProgress('PROCESSING')).toBe(true);
    expect(isBimVersionInProgress('READY')).toBe(false);
  });

  test('rejects a missing id', () => {
    expect(() => parseBimModel({ name: 'x' })).toThrow();
  });
});

describe('parseBimImportJob', () => {
  test('reads the status and knows which ones are still active', () => {
    const job = parseBimImportJob({
      id: JOB,
      modelId: MODEL,
      versionId: V1,
      status: 'RUNNING',
      attempt: 1,
      maxAttempts: 3,
      startedAt: '2026-09-13T10:00:00Z',
    });
    expect(job.status).toBe('RUNNING');
    expect(job.attempt).toBe(1);
    expect(isBimJobActive(job.status)).toBe(true);
    expect(isBimJobActive('QUEUED')).toBe(true);
    expect(isBimJobActive('DONE')).toBe(false);
    expect(isBimJobActive('FAILED')).toBe(false);
    expect(isBimJobActive(undefined)).toBe(false);
  });

  test('an unknown job status is not polled', () => {
    const job = parseBimImportJob({ id: JOB, status: 'PAUSED' });
    expect(job.status).toBe('UNKNOWN');
    expect(isBimJobActive(job.status)).toBe(false);
  });
});

describe('parseBimElement', () => {
  test('keeps the GlobalId, the spatial node bridge and the properties', () => {
    const el = parseBimElement({
      id: EL,
      modelId: MODEL,
      globalId: '2O2Fr$t4X7Zf8NOew3FLKI',
      ifcType: 'IfcColumn',
      name: 'Column C4',
      storeyGlobalId: '1xS3BCk291UvhgP2a6eflN',
      properties: { Pset_ColumnCommon: { LoadBearing: true } },
      bbox: { min: [0, 0, 0], max: [0.4, 0.4, 3.2] },
      spatialNodeId: NODE,
      retired: false,
    });
    expect(el.globalId).toBe('2O2Fr$t4X7Zf8NOew3FLKI');
    expect(el.spatialNodeId).toBe(NODE);
    expect(el.bbox).toEqual({ min: [0, 0, 0], max: [0.4, 0.4, 3.2] });
    expect(el.properties.Pset_ColumnCommon).toEqual({ LoadBearing: true });
    expect(el.retired).toBe(false);
  });

  test('reads the flat bbox form and drops an unreadable one', () => {
    expect(
      parseBimBoundingBox({ minX: 1, minY: 2, minZ: 3, maxX: 4, maxY: 5, maxZ: 6 })
    ).toEqual({ min: [1, 2, 3], max: [4, 5, 6] });
    expect(parseBimBoundingBox({ min: [1, 2] })).toBeUndefined();
    expect(parseBimBoundingBox(null)).toBeUndefined();
    expect(parseBimBoundingBox({ min: [null, 0, 0], max: [1, 1, 1] })).toBeUndefined();
    expect(parseBimBoundingBox({ min: ['', 0, 0], max: [1, 1, 1] })).toBeUndefined();
    expect(
      parseBimBoundingBox({ minX: null, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 })
    ).toBeUndefined();
  });

  test('a retired element with no node parses with the defaults', () => {
    const el = parseBimElement({ id: EL, globalId: 'abc', retired: true, mergedIntoId: NODE });
    expect(el.retired).toBe(true);
    expect(el.spatialNodeId).toBeUndefined();
    expect(el.mergedIntoId).toBe(NODE);
    expect(el.properties).toEqual({});
  });

  test('pages keep the backend envelope', () => {
    const page = parseBimElementPage({
      content: [{ id: EL, globalId: 'a' }],
      page: 2,
      size: 200,
      totalElements: 401,
      totalPages: 3,
    });
    expect(page.content).toHaveLength(1);
    expect(page.page).toBe(2);
    expect(page.totalPages).toBe(3);
  });
});

describe('parseBimTileManifest', () => {
  test('lists one presigned url per storey plus coarse and unassigned', () => {
    const m = parseBimTileManifest({
      modelId: MODEL,
      versionId: V1,
      coarseUrl: 'https://store/bim/m/1/tiles/coarse.glb?sig',
      unassignedUrl: 'https://store/bim/m/1/tiles/unassigned.glb?sig',
      storeys: [
        { globalId: 'S0', name: 'Ground', elevation: 0, elementCount: 300, url: 'https://store/S0.glb?sig' },
        { globalId: 'S1', elevation: 3.3, url: 'https://store/S1.glb?sig' },
      ],
      expiresInSeconds: 900,
    });
    expect(m.storeys.map((s) => s.globalId)).toEqual(['S0', 'S1']);
    expect(m.storeys[1].name).toBe('S1');
    expect(m.coarseUrl).toContain('coarse.glb');
    expect(m.unassignedUrl).toContain('unassigned.glb');
    expect(m.expiresInSeconds).toBe(900);
  });
});

describe('parseBimHierarchyProposal', () => {
  test('parses the tree down to the elements and the confirmation', () => {
    const p = parseBimHierarchyProposal({
      versionId: V1,
      counts: { buildings: 1, floors: 1, zones: 1, elements: 2, unplaced: 3 },
      buildings: [
        {
          globalId: 'B', code: 'B1', name: 'Block B',
          floors: [
            {
              globalId: 'F', code: 'L03', levelIndex: 3, elevation: 9.9, matchedNodeId: NODE,
              zones: [
                {
                  code: 'Z0', defaultZone: true,
                  elements: [
                    { globalId: 'E1', code: 'C4', name: 'Column C4', ifcType: 'IfcColumn', elementType: 'column' },
                    { globalId: 'E2', code: 'W1', ifcType: 'IfcWall' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      confirmation: { confirmedAt: '2026-09-13T11:00:00Z', nodesCreated: 3, nodesMatched: 1, elementsLinked: 2, elementsSkipped: 0 },
    });
    expect(p.counts.unplaced).toBe(3);
    const floor = p.buildings[0].floors[0];
    expect(floor.name).toBe('L03');
    expect(floor.matchedNodeId).toBe(NODE);
    expect(floor.zones[0].defaultZone).toBe(true);
    expect(floor.zones[0].elements.map((e) => e.globalId)).toEqual(['E1', 'E2']);
    expect(p.confirmation?.nodesCreated).toBe(3);
  });

  test('a pending proposal has no confirmation', () => {
    expect(parseBimHierarchyProposal({ versionId: V1 }).confirmation).toBeUndefined();
  });

  test('the confirm body only carries what the caller set', () => {
    expect(confirmBimHierarchyToJson({})).toEqual({});
    expect(confirmBimHierarchyToJson({ includeElements: false })).toEqual({ includeElements: false });
    expect(confirmBimHierarchyToJson({ elementGlobalIds: ['a'] })).toEqual({ elementGlobalIds: ['a'] });
  });
});

describe('upload presign', () => {
  test('parses the version and its PUT slot', () => {
    const u = parseBimSourceUpload({
      versionId: V2,
      versionNumber: 2,
      upload: { key: 'bim/m/2/source.ifc', url: 'https://store/put?sig', contentType: 'application/x-step', expiresInSeconds: 900 },
    });
    expect(u.versionId).toBe(V2);
    expect(u.upload.key).toBe('bim/m/2/source.ifc');
    expect(u.upload.contentType).toBe('application/x-step');
  });

  test('rejects a slot with no url', () => {
    expect(() =>
      parseBimSourceUpload({ versionId: V2, upload: { key: 'k', contentType: 'x' } })
    ).toThrow();
  });

  test('the request carries filename and size, content type only when set', () => {
    expect(presignBimSourceToJson({ filename: 'a.ifc', fileSize: 10 })).toEqual({ filename: 'a.ifc', fileSize: 10 });
    expect(BIM_SOURCE_MAX_BYTES).toBe(1073741824);
  });
});
