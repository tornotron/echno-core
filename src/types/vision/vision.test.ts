/**
 * The vision registry, settings and run types (core #166). Registry shapes
 * transcribed from `CvModelDto`, `CvModelVersionDto` and `CvModelClassDto`
 * on echno-backend `development`; settings and runs from the WP6 contract.
 */
import { describe, expect, test } from 'bun:test';
import { RegionShape } from '../inspection/observation';
import {
  CvModelFamily,
  CvModelTask,
  CvModelVersionStatus,
  activeCvModelVersion,
  parseCvModel,
  parseQueueVisionRunResult,
  parseVisionSettings,
  queueVisionRunToJson,
  updateVisionSettingsToJson,
} from './vision';

const version = (v: string, status: string) => ({
  id: `id-${v}`,
  modelKey: 'ppe',
  version: v,
  status,
  classes: [
    { key: 'ppe_helmet', shape: 'BOX', threshold: 0.35 },
    { key: 'crack', shape: 'POLYGON', threshold: '0.5' },
  ],
  licence: 'Apache-2.0',
  baseWeights: 'rf-detr-nano COCO (Apache-2.0)',
  weightsUri: 's3://models/ppe/0.1.0/model.onnx',
  weightsSha256: 'a'.repeat(64),
  runtime: 'onnxruntime',
  inputSize: 640,
  trainingRelease: null,
  trainingRunUri: null,
  metrics: { mAP50: 0.71 },
  evalReportUri: null,
  registeredById: null,
  activatedAt: status === 'ACTIVE' ? '2026-11-01T10:00:00' : null,
  retiredAt: null,
  createdAt: '2026-11-01T09:00:00',
  updatedAt: '2026-11-01T10:00:00',
});

describe('parseCvModel', () => {
  test('reads a family with its versions and classes', () => {
    const model = parseCvModel({
      key: 'ppe',
      name: 'PPE',
      task: 'DETECT',
      family: 'SAFETY',
      versions: [version('0.0.1', 'RETIRED'), version('0.1.0', 'ACTIVE')],
    });
    expect(model.key).toBe('ppe');
    expect(model.task).toBe(CvModelTask.DETECT);
    expect(model.family).toBe(CvModelFamily.SAFETY);
    expect(model.versions.map((v) => v.status)).toEqual([
      CvModelVersionStatus.RETIRED,
      CvModelVersionStatus.ACTIVE,
    ]);
    const active = activeCvModelVersion(model);
    expect(active?.version).toBe('0.1.0');
    expect(active?.classes).toEqual([
      { key: 'ppe_helmet', shape: RegionShape.BOX, threshold: 0.35 },
      { key: 'crack', shape: RegionShape.POLYGON, threshold: 0.5 },
    ]);
    expect(active?.metrics).toEqual({ mAP50: 0.71 });
    expect(active?.trainingRelease).toBeUndefined();
  });

  test('unknown enums fall back, and an unreadable status is never active', () => {
    const model = parseCvModel({
      key: 'ppe',
      task: 'CLASSIFY',
      family: 'ROBOTICS',
      versions: [{ ...version('0.1.0', 'active'), modelKey: null }],
    });
    expect(model.name).toBe('ppe');
    expect(model.task).toBe(CvModelTask.DETECT);
    expect(model.family).toBe(CvModelFamily.OBJECT);
    expect(model.versions[0]?.status).toBe(CvModelVersionStatus.DRAFT);
    expect(model.versions[0]?.modelKey).toBe('ppe');
    expect(activeCvModelVersion(model)).toBeUndefined();
  });

  test('refuses a family with no key or a version with no id', () => {
    expect(() => parseCvModel({ name: 'PPE' })).toThrow(TypeError);
    expect(() => parseCvModel({ key: 'ppe', versions: [{ version: '1' }] })).toThrow(TypeError);
  });
});

describe('vision settings', () => {
  test('a never-saved organization reads as off, every family, no author', () => {
    expect(
      parseVisionSettings({ autoInfer: false, modelKeys: [], updatedById: null, updatedAt: null })
    ).toEqual({ autoInfer: false, modelKeys: [], updatedById: null, updatedAt: null });
    expect(parseVisionSettings({})).toEqual({
      autoInfer: false,
      modelKeys: [],
      updatedById: null,
      updatedAt: null,
    });
  });

  test('reads saved settings', () => {
    expect(
      parseVisionSettings({
        autoInfer: true,
        modelKeys: ['ppe'],
        updatedById: 4,
        updatedAt: '2026-11-08T10:00:00',
      })
    ).toEqual({
      autoInfer: true,
      modelKeys: ['ppe'],
      updatedById: 4,
      updatedAt: '2026-11-08T10:00:00',
    });
  });

  test('an update always sends both fields', () => {
    expect(updateVisionSettingsToJson({ autoInfer: true, modelKeys: [] })).toEqual({
      autoInfer: true,
      modelKeys: [],
    });
  });
});

describe('queueVisionRunToJson', () => {
  test('sends one source with the optional families and rerun', () => {
    expect(
      queueVisionRunToJson({ inspectionId: 'i1', modelKeys: ['ppe'], rerun: true })
    ).toEqual({ inspectionId: 'i1', modelKeys: ['ppe'], rerun: true });
    expect(queueVisionRunToJson({ attachmentIds: [1, 2] })).toEqual({ attachmentIds: [1, 2] });
    expect(queueVisionRunToJson({ observationId: 'o1' })).toEqual({ observationId: 'o1' });
  });

  test('refuses no source, two sources, and an attachment list out of bounds', () => {
    expect(() => queueVisionRunToJson({})).toThrow(TypeError);
    expect(() => queueVisionRunToJson({ inspectionId: 'i1', observationId: 'o1' })).toThrow(
      TypeError
    );
    expect(() => queueVisionRunToJson({ attachmentIds: [] })).toThrow(TypeError);
    expect(() =>
      queueVisionRunToJson({ attachmentIds: Array.from({ length: 201 }, (_, i) => i + 1) })
    ).toThrow(TypeError);
  });

  test('a run result reads its counts, a missing one as 0', () => {
    expect(parseQueueVisionRunResult({ queued: 3, skippedDuplicate: 1, skippedNotImage: 2 })).toEqual(
      { queued: 3, skippedDuplicate: 1, skippedNotImage: 2 }
    );
    expect(parseQueueVisionRunResult({ queued: 3 })).toEqual({
      queued: 3,
      skippedDuplicate: 0,
      skippedNotImage: 0,
    });
  });
});
