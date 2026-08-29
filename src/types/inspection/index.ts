/**
 * @module types/inspection
 *
 * Barrel export for the inspection domain: the {@link Inspection} entity with
 * its {@link InspectionCheckItem} and {@link InspectionDefect} rows, the
 * inspection enums, their parsers, and the create / update request DTOs with
 * their serializers.
 *
 * Alongside it, the three surfaces that hang off an inspection: the marks drawn
 * over its defect photographs ({@link DefectPhotoAnnotation}), the
 * non-conformance reports raised from it ({@link Ncr}), and the reusable
 * per-trade {@link ChecklistTemplate} an inspection's check points are created
 * from.
 */

export * from './inspection';
export * from './defect-annotation';
export * from './ncr';
export * from './checklist-template';
