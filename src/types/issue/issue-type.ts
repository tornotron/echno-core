// types/issue/issue-type.ts

export enum IssueType {
  technical = 'technical',
  design = 'design',
  quality = 'quality',
  safety = 'safety',
  material = 'material',
  equipment = 'equipment',
  labour = 'labour',
  weather = 'weather',
  permit = 'permit',
  coordination = 'coordination',
  other = 'other',
}

/** Human-readable label */
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

/** Tailwind hex color */
export function getIssueTypeColor(type: IssueType): string {
  const map: Record<IssueType, string> = {
    [IssueType.technical]: '#2196F3', // Blue
    [IssueType.design]: '#9C27B0', // Purple
    [IssueType.quality]: '#4CAF50', // Green
    [IssueType.safety]: '#F44336', // Red
    [IssueType.material]: '#795548', // Brown
    [IssueType.equipment]: '#607D8B', // Blue Grey
    [IssueType.labour]: '#FF9800', // Orange
    [IssueType.weather]: '#00BCD4', // Cyan
    [IssueType.permit]: '#673AB7', // Deep Purple
    [IssueType.coordination]: '#3F51B5', // Indigo
    [IssueType.other]: '#9E9E9E', // Grey
  };
  return map[type];
}

/** Lucide icon name */
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

/** Convert string → IssueType */
export function issueTypeFromString(str: string): IssueType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (IssueType as any)[str];
  if (!type) throw new Error(`Invalid issue type: ${str}`);
  return type;
}
