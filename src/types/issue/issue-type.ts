/**
 * @module types/issue/issue-type
 *
 * Enumeration of the domain categories an {@link Issue} can belong to,
 * with helpers for human-readable labels, type-coded colors, and icon
 * names.
 */

/**
 * Domain category of an {@link Issue}. The string values match the
 * backend's wire representation; do not rename without coordinating a
 * backend change.
 */
export enum IssueType {
  /** Code-, system-, or infrastructure-related issue. */
  technical = 'technical',

  /** Design specification or visual issue. */
  design = 'design',

  /** Quality-control finding (e.g. workmanship, finish). */
  quality = 'quality',

  /** Worker- or site-safety concern. */
  safety = 'safety',

  /** Materials shortage, defect, or specification mismatch. */
  material = 'material',

  /** Equipment failure, shortage, or maintenance need. */
  equipment = 'equipment',

  /** Labour shortage, performance, or coordination issue. */
  labour = 'labour',

  /** Weather-related delay or hazard. */
  weather = 'weather',

  /** Permit, license, or compliance blocker. */
  permit = 'permit',

  /** Inter-team coordination breakdown. */
  coordination = 'coordination',

  /** Unclassified — use sparingly. */
  other = 'other',
}

/**
 * Returns a human-readable label for the given issue type.
 *
 * @param type - The issue type to label.
 * @returns Display-ready label string.
 */
export function getIssueTypeLabel(type: IssueType): string {
  const map: Record<IssueType, string> = {
    [IssueType.technical]: 'Technical',
    [IssueType.design]: 'Design',
    [IssueType.quality]: 'Quality',
    [IssueType.safety]: 'Safety',
    [IssueType.material]: 'Material',
    [IssueType.equipment]: 'Equipment',
    [IssueType.labour]: 'Labour',
    [IssueType.weather]: 'Weather',
    [IssueType.permit]: 'Permit',
    [IssueType.coordination]: 'Coordination',
    [IssueType.other]: 'Other',
  };
  return map[type];
}

/**
 * Returns a hex color associated with the given issue type, suitable for
 * type badges and chips in the UI.
 *
 * @param type - The issue type to color-code.
 * @returns A 6-digit hex color (e.g. `'#2196F3'`).
 */
export function getIssueTypeColor(type: IssueType): string {
  const map: Record<IssueType, string> = {
    [IssueType.technical]: '#2196F3',
    [IssueType.design]: '#9C27B0',
    [IssueType.quality]: '#4CAF50',
    [IssueType.safety]: '#F44336',
    [IssueType.material]: '#795548',
    [IssueType.equipment]: '#607D8B',
    [IssueType.labour]: '#FF9800',
    [IssueType.weather]: '#00BCD4',
    [IssueType.permit]: '#673AB7',
    [IssueType.coordination]: '#3F51B5',
    [IssueType.other]: '#9E9E9E',
  };
  return map[type];
}

/**
 * Returns a Lucide-compatible icon name for the given issue type.
 *
 * @param type - The issue type to icon-code.
 * @returns A kebab-case icon identifier.
 */
export function getIssueTypeIcon(type: IssueType): string {
  const map: Record<IssueType, string> = {
    [IssueType.technical]: 'wrench',
    [IssueType.design]: 'palette',
    [IssueType.quality]: 'shield-check',
    [IssueType.safety]: 'alert-triangle',
    [IssueType.material]: 'package',
    [IssueType.equipment]: 'hammer',
    [IssueType.labour]: 'users',
    [IssueType.weather]: 'cloud',
    [IssueType.permit]: 'file-text',
    [IssueType.coordination]: 'git-merge',
    [IssueType.other]: 'help-circle',
  };
  return map[type];
}

/**
 * Parses a wire-format string into an {@link IssueType}.
 *
 * @param str - The backend's string representation of the type.
 * @returns The matching {@link IssueType} member.
 * @throws {Error} If `str` does not match any known type.
 */
export function issueTypeFromString(str: string): IssueType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (IssueType as any)[str];
  if (!type) throw new Error(`Invalid issue type: ${str}`);
  return type;
}
