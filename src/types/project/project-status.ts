/**
 * @module project-status
 *
 * Lifecycle status of a {@link Project} plus the helpers that map the enum
 * to display labels, palette colours, and tolerant string parsing.
 */

/**
 * Lifecycle states a {@link Project} can occupy.
 *
 * Persisted as the lowercase string value; UI labels are produced by
 * {@link getProjectStatusLabel}.
 */
export enum ProjectStatus {
  /** Project is in active execution. */
  open = 'open',

  /** Project has been administratively closed; no further work expected. */
  closed = 'closed',

  /** Project is planned but has not yet started. */
  upcoming = 'upcoming',

  /** Project finished successfully. */
  completed = 'completed',

  /** Project work has been dropped before completion. */
  dropped = 'dropped',

  /** Project is temporarily paused. */
  onHold = 'onHold',

  /** Project was cancelled before completion. */
  cancelled = 'cancelled',
}

/**
 * Returns the human-readable label for a {@link ProjectStatus}.
 *
 * @param status - The status enum value.
 * @returns The display label (e.g. `'On Hold'` for {@link ProjectStatus.onHold}).
 */
export function getProjectStatusLabel(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.open]: 'Open',
    [ProjectStatus.closed]: 'Closed',
    [ProjectStatus.upcoming]: 'Upcoming',
    [ProjectStatus.completed]: 'Completed',
    [ProjectStatus.onHold]: 'On Hold',
    [ProjectStatus.cancelled]: 'Cancelled',
    [ProjectStatus.dropped]: 'Dropped',
  };
  return map[status];
}

/**
 * Returns the foreground colour associated with a {@link ProjectStatus}.
 *
 * Intended for status pills, badges, and other indicators where the status
 * value drives a small palette swatch.
 *
 * @param status - The status enum value.
 * @returns A hex colour string (e.g. `'#4CAF50'`).
 */
export function getProjectStatusColor(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.open]: '#4CAF50', // Green
    [ProjectStatus.closed]: '#2A5797', // Blue
    [ProjectStatus.upcoming]: '#2196F3', // Blue
    [ProjectStatus.completed]: '#9C27B0', // Purple
    [ProjectStatus.onHold]: '#FF9800', // Orange
    [ProjectStatus.cancelled]: '#9E9E9E', // Grey
    [ProjectStatus.dropped]: '#795548', // Brown
  };
  return map[status];
}

/**
 * Returns the background colour associated with a {@link ProjectStatus}.
 *
 * The palette is tuned for filled badges and chips; see
 * {@link getProjectStatusColor} for the lighter foreground variant.
 *
 * @param status - The status enum value.
 * @returns A hex colour string.
 */
export function getProjectStatusBackground(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.upcoming]: '#EF6C00', // Orange 600
    [ProjectStatus.open]: '#388E3C', // Green 600
    [ProjectStatus.completed]: '#2E7D32', // Green 700
    [ProjectStatus.closed]: '#616161', // Grey 600
    [ProjectStatus.onHold]: '#FF8F00', // Amber 700
    [ProjectStatus.dropped]: '#D32F2F', // Red 700
    [ProjectStatus.cancelled]: '#E53935', // Red 600
  };
  return map[status];
}

/**
 * Parses a raw string into a {@link ProjectStatus}.
 *
 * Accepts common aliases — `'ongoing'` maps to {@link ProjectStatus.open},
 * `'on_hold'` / `'paused'` map to {@link ProjectStatus.onHold} — so the
 * parser tolerates minor backend or CSV variations. Unknown values fall
 * back to {@link ProjectStatus.upcoming}.
 *
 * @param str - The raw status string. Case-insensitive.
 * @returns The matching enum value, or `null` if `str` is empty/undefined.
 */
export function getProjectStatus(str?: string): ProjectStatus | null {
  if (!str) return null;
  const lower = str.toLowerCase();
  switch (lower) {
    case 'upcoming': {
      return ProjectStatus.upcoming;
    }
    case 'ongoing':
    case 'open': {
      return ProjectStatus.open;
    }
    case 'completed': {
      return ProjectStatus.completed;
    }
    case 'closed': {
      return ProjectStatus.closed;
    }
    case 'onhold':
    case 'on_hold':
    case 'paused': {
      return ProjectStatus.onHold;
    }
    case 'dropped': {
      return ProjectStatus.dropped;
    }
    case 'cancelled': {
      return ProjectStatus.cancelled;
    }
    default: {
      return ProjectStatus.upcoming;
    }
  }
}

/**
 * Returns the display label for a status, throwing when the value is
 * missing.
 *
 * Use this in contexts where a status must be present (e.g. rendering a
 * detail header); use {@link getProjectStatusLabel} directly when the
 * status is guaranteed non-null.
 *
 * @param status - The status enum value.
 * @returns The display label.
 * @throws {Error} If `status` is `undefined`.
 */
export function getProjectStatusName(status?: ProjectStatus): string {
  if (!status) throw new Error('Invalid project status');
  return getProjectStatusLabel(status);
}
