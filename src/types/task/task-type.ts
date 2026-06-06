/**
 * @module task-type
 *
 * Classification of a {@link Task} (open / closed / disposed) plus
 * helpers that map the enum to display labels, swatches, Lucide icon
 * names, and string parsing.
 */

// types/task/task-type.ts

/**
 * Classification of a {@link Task} independent of its lifecycle status.
 *
 * Persisted as the literal string value.
 */
export enum TaskType {
  /** Task is active and accepting updates. */
  open = 'open',

  /** Task is finished and archived in the active workspace. */
  closed = 'closed',

  /** Task has been disposed and is hidden from the default view. */
  disposed = 'disposed',
}

/**
 * Returns the human-readable label for a {@link TaskType}.
 *
 * @param type - The type enum value.
 * @returns The display label (e.g. `'Open'`).
 */
export function getTaskTypeLabel(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: 'Open',
    [TaskType.closed]: 'Closed',
    [TaskType.disposed]: 'Disposed',
  };
  return map[type];
}

/**
 * Returns the colour associated with a {@link TaskType}.
 *
 * @param type - The type enum value.
 * @returns A hex colour string.
 */
export function getTaskTypeColor(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: '#2196F3',
    [TaskType.closed]: '#4CAF50',
    [TaskType.disposed]: '#9E9E9E',
  };
  return map[type];
}

/**
 * Returns the Lucide icon name associated with a {@link TaskType}.
 *
 * @param type - The type enum value.
 * @returns A Lucide icon identifier (e.g. `'folder-open'`).
 */
export function getTaskTypeIcon(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: 'folder-open',
    [TaskType.closed]: 'folder',
    [TaskType.disposed]: 'trash-2',
  };
  return map[type];
}

/**
 * Parses a raw enum-key string into a {@link TaskType}.
 *
 * @param str - The raw string to parse.
 * @returns The matching enum value.
 * @throws {Error} If `str` is not a recognized {@link TaskType} key.
 */
export function taskTypeFromString(str: string): TaskType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (TaskType as any)[str];
  if (!type) throw new Error(`Invalid task type: ${str}`);
  return type;
}
