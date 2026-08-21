/**
 * @module project-type
 *
 * Broad construction category of a {@link Project}, plus a tolerant parser.
 */

/**
 * Broad category of construction a {@link Project} is.
 *
 * Together with the project's state (derived from its address) this drives
 * which statutory compliances the AI generation flow considers, so the
 * constant set matches the backend `ProjectType` enum. The backend serializes
 * it by the enum name, so the wire values are the uppercase constants.
 */
export enum ProjectType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  INSTITUTIONAL = 'INSTITUTIONAL',
  MIXED_USE = 'MIXED_USE',
  OTHER = 'OTHER',
}

/**
 * Parses a raw string into a {@link ProjectType}, or `undefined` when the value
 * is absent or unrecognized. The field is optional on existing projects (only
 * set once a project type is chosen), so a missing value is preserved as unset
 * rather than defaulted.
 *
 * @param raw - The raw type string (case-insensitive).
 * @returns The matching enum value, or `undefined`.
 */
export function parseProjectType(raw: unknown): ProjectType | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.toUpperCase();
  return (Object.values(ProjectType) as string[]).includes(upper)
    ? (upper as ProjectType)
    : undefined;
}
