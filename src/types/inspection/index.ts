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
 *
 * And the two records that turn the NCR lifecycle into evidence: the
 * {@link Reinspection} attempt that re-checks a non-conformance and the
 * {@link InspectionEvent} log of who changed what, when.
 *
 * And the {@link Observation}: a finding from any source, human or machine,
 * with a persistent id ahead of the human decision that turns it into one of
 * the records above.
 */

export * from './inspection';
export * from './defect-annotation';
export * from './ncr';
export * from './checklist-template';
export * from './reinspection';
export * from './inspection-event';
export * from './trade';
export * from './observation';
