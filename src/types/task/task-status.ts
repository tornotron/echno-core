/**
 * @module task-status
 *
 * Lifecycle status of a {@link Task} plus the helpers that map the enum
 * to display labels, palette swatches, gradients, Lucide icon names, and
 * tolerant string parsing.
 */

// types/task/task-status.ts

/**
 * Lifecycle states a {@link Task} can occupy.
 *
 * Persisted as the literal string value; UI labels are produced by
 * {@link getTaskStatusLabel}.
 */
export enum TaskStatus {
  /** Task is planned but has not yet started. */
  upcoming = 'upcoming',

  /** Task is in active execution. */
  onGoing = 'onGoing',

  /** Task is temporarily paused. */
  onHold = 'onHold',

  /** Task finished successfully. */
  completed = 'completed',
}

/**
 * Returns the human-readable label for a {@link TaskStatus}.
 *
 * @param status - The status enum value.
 * @returns The display label (e.g. `'On Going'`).
 */
export function getTaskStatusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: 'Upcoming',
    [TaskStatus.onGoing]: 'On Going',
    [TaskStatus.onHold]: 'On Hold',
    [TaskStatus.completed]: 'Completed',
  };
  return map[status];
}

/**
 * Returns the primary brand colour associated with a {@link TaskStatus}.
 *
 * @param status - The status enum value.
 * @returns A hex colour string.
 */
export function getTaskStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: '#607D8B', // Blue Grey
    [TaskStatus.onGoing]: '#2196F3', // Blue
    [TaskStatus.onHold]: '#FF9800', // Orange
    [TaskStatus.completed]: '#4CAF50', // Green
  };
  return map[status];
}

/**
 * Returns a CSS `linear-gradient(...)` string for a {@link TaskStatus}.
 *
 * Intended for filled cards and badges where the status drives a
 * background gradient.
 *
 * @param status - The status enum value.
 * @returns A CSS gradient string usable as a `background` value.
 */
export function getTaskStatusGradient(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: 'linear-gradient(to bottom right, #607D8B, #78909C)',
    [TaskStatus.onHold]: 'linear-gradient(to bottom right, #FF9800, #FFB74D)',
    [TaskStatus.onGoing]: 'linear-gradient(to bottom right, #2196F3, #64B5F6)',
    [TaskStatus.completed]:
      'linear-gradient(to bottom right, #4CAF50, #81C784)',
  };
  return map[status];
}

/**
 * Returns the Lucide icon name associated with a {@link TaskStatus}.
 *
 * @param status - The status enum value.
 * @returns A Lucide icon identifier (e.g. `'play'`).
 */
export function getTaskStatusIcon(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: 'clock',
    [TaskStatus.onGoing]: 'play',
    [TaskStatus.onHold]: 'pause',
    [TaskStatus.completed]: 'check-circle',
  };
  return map[status];
}

/**
 * Parses a raw enum-key string into a {@link TaskStatus}.
 *
 * Expects the literal key (e.g. `'onGoing'`); for label-style strings
 * (e.g. `'On Going'`) use {@link taskStatusFromLabel}.
 *
 * @param str - The raw string to parse.
 * @returns The matching enum value.
 * @throws {Error} If `str` is not a recognized {@link TaskStatus} key.
 */
export function taskStatusFromString(str: string): TaskStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (TaskStatus as any)[str];
  if (!status) throw new Error(`Invalid task status: ${str}`);
  return status;
}

/**
 * Parses a human-readable label (e.g. `'On Going'`) into a
 * {@link TaskStatus}.
 *
 * Comparison is case-insensitive. Unknown labels fall back to
 * {@link TaskStatus.upcoming}.
 *
 * @param label - The display label to parse.
 * @returns The matching enum value, or {@link TaskStatus.upcoming} when
 *   no label matches.
 */
export function taskStatusFromLabel(label: string): TaskStatus {
  const lower = label.toLowerCase();
  for (const status of Object.values(TaskStatus)) {
    if (getTaskStatusLabel(status).toLowerCase() === lower) {
      return status;
    }
  }
  return TaskStatus.upcoming;
}
