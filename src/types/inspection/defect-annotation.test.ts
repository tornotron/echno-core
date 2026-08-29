import { describe, expect, test } from 'bun:test';
import {
  annotationsByPhoto,
  DefectAnnotationShape,
  isAnnotationWithinImage,
  MAX_DEFECT_ANNOTATIONS,
  parseDefectAnnotationShape,
  parseDefectPhotoAnnotation,
  replaceAnnotationsToJson,
} from './defect-annotation';

const UUID = '11111111-1111-1111-1111-111111111111';
const INSPECTION_UUID = '22222222-2222-2222-2222-222222222222';
const PHOTO = 'https://cdn.example.com/inspections/6f1c-crack.jpg';

function annotation(overrides: Record<string, unknown> = {}) {
  return parseDefectPhotoAnnotation({
    id: UUID,
    inspectionId: INSPECTION_UUID,
    photo: PHOTO,
    shape: 'rectangle',
    x1: 0.31,
    y1: 0.22,
    x2: 0.58,
    y2: 0.47,
    lineOrder: 0,
    ...overrides,
  });
}

describe('parseDefectPhotoAnnotation', () => {
  test('parses a full payload', () => {
    const mark = annotation({
      label: 'Honeycombing, approx 120 mm across',
      createdById: 8,
      shape: 'arrow',
      lineOrder: 3,
    });
    expect(mark.id).toBe(UUID);
    expect(mark.inspectionId).toBe(INSPECTION_UUID);
    expect(mark.photo).toBe(PHOTO);
    expect(mark.shape).toBe(DefectAnnotationShape.ARROW);
    expect(mark.x1).toBe(0.31);
    expect(mark.y2).toBe(0.47);
    expect(mark.label).toBe('Honeycombing, approx 120 mm across');
    expect(mark.lineOrder).toBe(3);
    expect(mark.createdById).toBe(8);
  });

  test('coerces coordinates sent as BigDecimal strings', () => {
    // The columns are BigDecimal(9, 6), so a serializer configured to write them
    // as strings must not turn the geometry into NaN.
    const mark = annotation({ x1: '0.310000', y1: '0.220000' });
    expect(mark.x1).toBe(0.31);
    expect(mark.y1).toBe(0.22);
  });

  test('keeps a coordinate of exactly 0, which is the edge of the image', () => {
    const mark = annotation({ x1: 0, y1: 0 });
    expect(mark.x1).toBe(0);
    expect(mark.y1).toBe(0);
  });

  test('leaves the label and author unset when the backend omits them', () => {
    // An organization's bootstrap administrator has no employee record, so a
    // mark they drew is stored with no author rather than refused.
    const mark = annotation();
    expect(mark.label).toBeUndefined();
    expect(mark.createdById).toBeUndefined();
  });

  test('rejects a missing id or inspectionId instead of fabricating one', () => {
    expect(() =>
      parseDefectPhotoAnnotation({ inspectionId: INSPECTION_UUID, photo: PHOTO })
    ).toThrow();
    expect(() =>
      parseDefectPhotoAnnotation({ id: UUID, photo: PHOTO })
    ).toThrow();
  });

  test('draws an unreadable shape as a rectangle rather than dropping the mark', () => {
    expect(parseDefectAnnotationShape('RECTANGLE')).toBe(
      DefectAnnotationShape.RECTANGLE
    );
    expect(parseDefectAnnotationShape('freehand')).toBe(
      DefectAnnotationShape.RECTANGLE
    );
    expect(annotation({ shape: null }).shape).toBe(
      DefectAnnotationShape.RECTANGLE
    );
  });
});

// The point the model turns on: a mark is keyed by the photograph, because an
// inspection's defects are cleared and rebuilt under new ids on every save.
describe('annotationsByPhoto', () => {
  test('groups by photo and sorts each group by line order', () => {
    const other = 'https://cdn.example.com/inspections/6f1c-spall.jpg';
    const grouped = annotationsByPhoto([
      annotation({ id: '33333333-3333-3333-3333-333333333333', lineOrder: 2 }),
      annotation({
        id: '44444444-4444-4444-4444-444444444444',
        photo: other,
        lineOrder: 1,
      }),
      annotation({ id: '55555555-5555-5555-5555-555555555555', lineOrder: 0 }),
    ]);

    expect([...grouped.keys()]).toEqual([PHOTO, other]);
    expect(grouped.get(PHOTO)!.map((m) => m.lineOrder)).toEqual([0, 2]);
    expect(grouped.get(other)).toHaveLength(1);
  });

  test('is empty for an inspection with no marks', () => {
    expect(annotationsByPhoto([]).size).toBe(0);
  });
});

describe('isAnnotationWithinImage', () => {
  const mark = {
    photo: PHOTO,
    shape: DefectAnnotationShape.RECTANGLE,
    x1: 0.1,
    y1: 0.1,
    x2: 0.9,
    y2: 0.9,
  };

  test('accepts fractions inside the image, including its edges', () => {
    expect(isAnnotationWithinImage(mark)).toBe(true);
    expect(isAnnotationWithinImage({ ...mark, x1: 0, y2: 1 })).toBe(true);
  });

  test('refuses a coordinate off the image', () => {
    expect(isAnnotationWithinImage({ ...mark, x2: 1.2 })).toBe(false);
    expect(isAnnotationWithinImage({ ...mark, y1: -0.01 })).toBe(false);
  });

  test('refuses pixel coordinates, the mistake it exists to catch', () => {
    // A canvas that forgets to divide by the rendered size sends pixels, which
    // the backend rejects with a 400 after the user has drawn the whole set.
    expect(
      isAnnotationWithinImage({ ...mark, x1: 320, y1: 210, x2: 580, y2: 470 })
    ).toBe(false);
  });

  test('refuses a non-finite coordinate', () => {
    expect(isAnnotationWithinImage({ ...mark, x1: Number.NaN })).toBe(false);
  });
});

describe('replaceAnnotationsToJson', () => {
  test('emits the geometry and the label', () => {
    const json = replaceAnnotationsToJson({
      annotations: [
        {
          photo: PHOTO,
          shape: DefectAnnotationShape.ELLIPSE,
          x1: 0.31,
          y1: 0.22,
          x2: 0.58,
          y2: 0.47,
          label: 'Spalling',
        },
      ],
    });
    const marks = json.annotations as Record<string, unknown>[];
    expect(marks).toHaveLength(1);
    expect(marks[0]!.shape).toBe('ellipse');
    expect(marks[0]!.x1).toBe(0.31);
    expect(marks[0]!.label).toBe('Spalling');
  });

  test('omits the label when unset', () => {
    const json = replaceAnnotationsToJson({
      annotations: [
        {
          photo: PHOTO,
          shape: DefectAnnotationShape.ARROW,
          x1: 0,
          y1: 0,
          x2: 1,
          y2: 1,
        },
      ],
    });
    const marks = json.annotations as Record<string, unknown>[];
    expect('label' in marks[0]!).toBe(false);
  });

  test('emits an empty list rather than omitting the field', () => {
    // The backend field is @NotNull, so an omitted list is a 400; an empty one is
    // how the marks are cleared.
    const json = replaceAnnotationsToJson({ annotations: [] });
    expect(json.annotations).toEqual([]);
  });

  test('the request cap matches the backend limit', () => {
    expect(MAX_DEFECT_ANNOTATIONS).toBe(400);
  });
});
