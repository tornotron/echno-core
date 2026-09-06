/**
 * @module types/issue/issue-priority
 *
 * How urgent an {@link Issue} is, as the backend now records it.
 *
 * This was a free-form `priority?: string` on the request interfaces for as
 * long as the backend had nowhere to put it. echno-backend#677 gave `Issue` a
 * `priority` column with a closed set of values, so the type is closed here
 * too: a caller that could send `urgent` would get a 400 from an endpoint that
 * accepts four values, and nothing before this would have said so.
 */

/**
 * Urgency of an {@link Issue}. The string values match the backend's wire
 * representation; do not rename without coordinating a backend change.
 */
export enum IssuePriority {
  /** Can wait for a scheduled slot. */
  low = 'low',

  /** The default an issue is raised at. */
  medium = 'medium',

  /** Wanted before the next planned batch of work. */
  high = 'high',

  /** Blocking, or a safety matter; wanted now. */
  critical = 'critical',
}

/**
 * Returns a human-readable label for the given priority.
 *
 * @param priority - The priority to label.
 * @returns Display-ready label string.
 */
export function getIssuePriorityLabel(priority: IssuePriority): string {
  const map: Record<IssuePriority, string> = {
    [IssuePriority.low]: 'Low',
    [IssuePriority.medium]: 'Medium',
    [IssuePriority.high]: 'High',
    [IssuePriority.critical]: 'Critical',
  };
  return map[priority];
}

/**
 * Returns a hex color associated with the given priority, suitable for badges
 * and chips in the UI.
 *
 * @param priority - The priority to color-code.
 * @returns A 6-digit hex color (e.g. `'#E57373'`).
 */
export function getIssuePriorityColor(priority: IssuePriority): string {
  const map: Record<IssuePriority, string> = {
    [IssuePriority.low]: '#81C784',
    [IssuePriority.medium]: '#FFB74D',
    [IssuePriority.high]: '#FF8A65',
    [IssuePriority.critical]: '#E57373',
  };
  return map[priority];
}

/**
 * Parses a wire-format string into an {@link IssuePriority}.
 *
 * @param str - The backend's string representation of the priority.
 * @returns The matching {@link IssuePriority} member.
 * @throws {Error} If `str` does not match any known priority.
 */
export function issuePriorityFromString(str: string): IssuePriority {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priority = (IssuePriority as any)[str];
  if (!priority) throw new Error(`Invalid issue priority: ${str}`);
  return priority;
}
