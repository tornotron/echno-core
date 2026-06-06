// types/task/task-status.ts

export enum TaskStatus {
  upcoming = 'upcoming',
  onGoing = 'onGoing',
  onHold = 'onHold',
  completed = 'completed',
}

/** Human-readable label */
export function getTaskStatusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: 'Upcoming',
    [TaskStatus.onGoing]: 'On Going',
    [TaskStatus.onHold]: 'On Hold',
    [TaskStatus.completed]: 'Completed',
  };
  return map[status];
}

/** Primary color (hex) */
export function getTaskStatusColor(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: '#607D8B', // Blue Grey
    [TaskStatus.onGoing]: '#2196F3', // Blue
    [TaskStatus.onHold]: '#FF9800', // Orange
    [TaskStatus.completed]: '#4CAF50', // Green
  };
  return map[status];
}

/** Gradient (CSS string) */
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

/** Lucide icon name */
export function getTaskStatusIcon(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    [TaskStatus.upcoming]: 'clock',
    [TaskStatus.onGoing]: 'play',
    [TaskStatus.onHold]: 'pause',
    [TaskStatus.completed]: 'check-circle',
  };
  return map[status];
}

/** Convert string → TaskStatus */
export function taskStatusFromString(str: string): TaskStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (TaskStatus as any)[str];
  if (!status) throw new Error(`Invalid task status: ${str}`);
  return status;
}

/** From label string (e.g., "On Going") */
export function taskStatusFromLabel(label: string): TaskStatus {
  const lower = label.toLowerCase();
  for (const status of Object.values(TaskStatus)) {
    if (getTaskStatusLabel(status).toLowerCase() === lower) {
      return status;
    }
  }
  return TaskStatus.upcoming;
}
