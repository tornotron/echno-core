/**
 * @module types/inspection/defect-annotation
 *
 * The marks drawn over an inspection's defect photographs (backend
 * `DefectPhotoAnnotationDto` / `DefectPhotoAnnotationRequest` /
 * `ReplaceAnnotationsRequest`), served from
 * `/inspections/web/{id}/annotations`.
 *
 * Two things about this contract are easy to model wrongly, and both are
 * deliberate on the backend rather than incidental.
 *
 * **A mark is keyed by the photograph, not by the defect.** The obvious model is
 * a child collection on the defect row. It does not work: the inspection update
 * endpoint clears an inspection's defects and rebuilds them from the payload on
 * every save, so each defect row is deleted and reinserted under a new id every
 * time an inspector saves, and anything hanging off it goes with it. The mark
 * therefore names {@link DefectPhotoAnnotation.photo}, byte for byte the string
 * that appears in some defect's `photos` list, and is scoped by `inspectionId`.
 * A defect rebuild carries the same photo strings through unchanged, so the
 * marks survive it. Neither the defect id nor a position in the defect list is
 * part of the key, and a consumer that groups by either will lose marks on the
 * next save. Group with {@link annotationsByPhoto}.
 *
 * Replacing the image itself does drop its marks, on purpose: a replacement is a
 * new object under a new key, the geometry describes a region of specific
 * pixels, and an arrow that pointed at a crack would otherwise point at bare
 * wall while still being presented as evidence.
 *
 * **The coordinates are fractions of the image, not pixels.** All four are in
 * `[0, 1]`, so the same mark renders correctly on a thumbnail in the web app and
 * on a half-page plate in the PDF, with no stored dependence on the resolution
 * of the file. Multiply by the rendered width and height at draw time; never
 * store or send device pixels. The backend rejects a value outside the range
 * with a 400, which {@link isAnnotationWithinImage} lets the UI catch first.
 */

import { z } from 'zod';
import { parseUuid } from '../../lib/utils/parse-id';
import { nullableString, optionalNumericId } from '../../lib/validation/backend-schema';

/**
 * The mark drawn over a defect photo. Every shape is described by the same two
 * points, so one geometry serves all three:
 *
 * - `RECTANGLE` and `ELLIPSE` read the points as opposite corners of the
 *   bounding box, in either order.
 * - `ARROW` reads the first point as the tail and the second as the head, so
 *   for it the order carries meaning and must not be normalized.
 *
 * There is deliberately no freehand path: a stroke needs a variable-length point
 * list, which is a different storage shape and a different validation problem.
 */
export enum DefectAnnotationShape {
  RECTANGLE = 'rectangle',
  ELLIPSE = 'ellipse',
  ARROW = 'arrow',
}

/** Human-readable label for each {@link DefectAnnotationShape}. */
export const defectAnnotationShapeLabels: Record<DefectAnnotationShape, string> =
  {
    [DefectAnnotationShape.RECTANGLE]: 'Rectangle',
    [DefectAnnotationShape.ELLIPSE]: 'Ellipse',
    [DefectAnnotationShape.ARROW]: 'Arrow',
  };

/**
 * Most marks one inspection may carry in a single replace call, mirroring the
 * backend's `ReplaceAnnotationsRequest.MAX_ANNOTATIONS`. Above this the request
 * is rejected with a 400, so a mark-up canvas should stop the user here rather
 * than lose the whole save.
 */
export const MAX_DEFECT_ANNOTATIONS = 400;

/**
 * Narrows an untyped backend string to {@link DefectAnnotationShape}, defaulting
 * to `RECTANGLE` when the value is absent or unrecognized. A mark is never
 * stored without a shape, so an unreadable one is drawn as a box rather than
 * dropped: losing the mark would lose the evidence it points at.
 */
export function parseDefectAnnotationShape(raw: unknown): DefectAnnotationShape {
  return typeof raw === 'string' &&
    (Object.values(DefectAnnotationShape) as string[]).includes(raw)
    ? (raw as DefectAnnotationShape)
    : DefectAnnotationShape.RECTANGLE;
}

// The coordinates are `BigDecimal` on the backend, so each may arrive as a JSON
// number or as a numeric string; coerce rather than assume one of the two.
const coordinate = z.coerce.number().nullish();

const DefectPhotoAnnotationSchema = z.object({
  id: z.string().nullish(),
  inspectionId: z.string().nullish(),
  photo: nullableString,
  shape: z.unknown().nullish(),
  x1: coordinate,
  y1: coordinate,
  x2: coordinate,
  y2: coordinate,
  label: nullableString,
  lineOrder: z.coerce.number().nullish(),
  createdById: optionalNumericId,
});

/**
 * One mark drawn over one defect photograph.
 *
 * Read the module notes before consuming this: `photo` is the key, and the four
 * coordinates are fractions of the image rather than pixels.
 */
export interface DefectPhotoAnnotation {
  /** UUID primary key. */
  id: string;
  /** The inspection the mark belongs to. */
  inspectionId: string;
  /**
   * The photograph the mark is drawn on, exactly as it appears in a defect's
   * `photos` list. This, not a defect id, is what a mark is keyed by.
   */
  photo: string;
  /** Shape of the mark. */
  shape: DefectAnnotationShape;
  /** First point, x, as a fraction of the image width (`[0, 1]`). */
  x1: number;
  /** First point, y, as a fraction of the image height (`[0, 1]`). */
  y1: number;
  /** Second point, x, as a fraction of the image width (`[0, 1]`). */
  x2: number;
  /** Second point, y, as a fraction of the image height (`[0, 1]`). */
  y2: number;
  /** What the mark points out, printed beside it on the report. */
  label?: string;
  /** Draw and print order. Assigned server-side from the submitted order. */
  lineOrder: number;
  /**
   * Employee who drew the mark. Unset when the caller has no employee record in
   * the tenant, which is the case for an organization's bootstrap administrator.
   */
  createdById?: number;
}

/**
 * Parses a raw annotation payload into a typed {@link DefectPhotoAnnotation}.
 *
 * @param json - The untyped JSON object from the backend.
 * @returns A validated `DefectPhotoAnnotation`.
 * @throws {TypeError} If `id` or `inspectionId` is missing or not a non-empty
 *   string.
 */
export function parseDefectPhotoAnnotation(
  json: unknown
): DefectPhotoAnnotation {
  const raw = DefectPhotoAnnotationSchema.parse(json);
  return {
    id: parseUuid(raw.id, 'parseDefectPhotoAnnotation.id'),
    inspectionId: parseUuid(
      raw.inspectionId,
      'parseDefectPhotoAnnotation.inspectionId'
    ),
    photo: raw.photo ?? '',
    shape: parseDefectAnnotationShape(raw.shape),
    x1: raw.x1 ?? 0,
    y1: raw.y1 ?? 0,
    x2: raw.x2 ?? 0,
    y2: raw.y2 ?? 0,
    label: raw.label ?? undefined,
    lineOrder: raw.lineOrder ?? 0,
    createdById: raw.createdById ?? undefined,
  };
}

/**
 * Groups an inspection's marks by the photograph they are drawn on, each group
 * in print order.
 *
 * This is the grouping the contract supports. Grouping by defect id is not
 * possible (a mark carries none) and grouping by the position of a defect in the
 * list is wrong, because the list is rebuilt on every save.
 *
 * @param annotations - The marks, in any order.
 * @returns A map from photo reference to that photo's marks, sorted by
 *   `lineOrder`. Insertion order follows first appearance.
 */
export function annotationsByPhoto(
  annotations: readonly DefectPhotoAnnotation[]
): Map<string, DefectPhotoAnnotation[]> {
  const byPhoto = new Map<string, DefectPhotoAnnotation[]>();
  for (const annotation of annotations) {
    const group = byPhoto.get(annotation.photo);
    if (group) group.push(annotation);
    else byPhoto.set(annotation.photo, [annotation]);
  }
  for (const group of byPhoto.values()) {
    group.sort((a, b) => a.lineOrder - b.lineOrder);
  }
  return byPhoto;
}

/**
 * One mark to store. `id`, `lineOrder` and the author are all server-set, so
 * none of them appears here: the order is the position in the submitted list.
 */
export interface DefectPhotoAnnotationRequest {
  /**
   * The photograph to draw on (max 500), exactly as it appears in one of the
   * inspection's defects' `photos` lists. A mark naming a photo no defect on the
   * inspection carries is rejected with a 400.
   */
  photo: string;
  /** Shape of the mark. Required. */
  shape: DefectAnnotationShape;
  /**
   * First point, x, as a fraction of the image width. A corner for a box shape,
   * the tail for an arrow. Must be in `[0, 1]`.
   */
  x1: number;
  /** First point, y, as a fraction of the image height. Must be in `[0, 1]`. */
  y1: number;
  /**
   * Second point, x. The opposite corner for a box shape, the head for an arrow.
   * Must be in `[0, 1]`.
   */
  x2: number;
  /** Second point, y. Must be in `[0, 1]`. */
  y2: number;
  /** What the mark points out (max 200), printed beside it on the report. */
  label?: string;
}

/**
 * The complete set of marks for one inspection, replacing whatever is stored.
 *
 * A whole-set replace rather than per-mark create and delete: the client that
 * draws these holds the entire canvas, so one save records everything currently
 * drawn, and an empty list clears them.
 */
export interface ReplaceAnnotationsRequest {
  /** The marks to store, at most {@link MAX_DEFECT_ANNOTATIONS} of them. */
  annotations: DefectPhotoAnnotationRequest[];
}

/**
 * Whether every coordinate of a mark sits on the image, which is what the
 * backend requires. A point outside `[0, 1]` describes a position off the
 * photograph: the renderer cannot draw it and a reader cannot interpret it, so
 * the request is refused with a 400.
 *
 * @param mark - The mark to check.
 * @returns `true` when all four coordinates are finite and within `[0, 1]`.
 */
export function isAnnotationWithinImage(
  mark: DefectPhotoAnnotationRequest
): boolean {
  return [mark.x1, mark.y1, mark.x2, mark.y2].every(
    (value) => Number.isFinite(value) && value >= 0 && value <= 1
  );
}

/**
 * Serializes one {@link DefectPhotoAnnotationRequest} into a backend annotation
 * object. Required fields are always emitted; the label only when set.
 */
function defectPhotoAnnotationToJson(
  mark: DefectPhotoAnnotationRequest
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    photo: mark.photo,
    shape: mark.shape,
    x1: mark.x1,
    y1: mark.y1,
    x2: mark.x2,
    y2: mark.y2,
  };
  if (mark.label !== undefined) json.label = mark.label;
  return json;
}

/**
 * Serializes a {@link ReplaceAnnotationsRequest} into the backend request body.
 *
 * `annotations` is always emitted, including when empty: an omitted list is a
 * 400 (the field is `@NotNull`), whereas an empty one is how the marks are
 * cleared.
 *
 * @param dto - The complete set of marks to store.
 * @returns A plain object matching the backend `ReplaceAnnotationsRequest`.
 */
export function replaceAnnotationsToJson(
  dto: ReplaceAnnotationsRequest
): Record<string, unknown> {
  return {
    annotations: (dto.annotations ?? []).map((mark) =>
      defectPhotoAnnotationToJson(mark)
    ),
  };
}
