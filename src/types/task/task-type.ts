// types/task/task-type.ts

export enum TaskType {
  open = 'open',
  closed = 'closed',
  disposed = 'disposed',
}

export function getTaskTypeLabel(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: 'Open',
    [TaskType.closed]: 'Closed',
    [TaskType.disposed]: 'Disposed',
  };
  return map[type];
}

export function getTaskTypeColor(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: '#2196F3',
    [TaskType.closed]: '#4CAF50',
    [TaskType.disposed]: '#9E9E9E',
  };
  return map[type];
}

export function getTaskTypeIcon(type: TaskType): string {
  const map: Record<TaskType, string> = {
    [TaskType.open]: 'folder-open',
    [TaskType.closed]: 'folder',
    [TaskType.disposed]: 'trash-2',
  };
  return map[type];
}

export function taskTypeFromString(str: string): TaskType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const type = (TaskType as any)[str];
  if (!type) throw new Error(`Invalid task type: ${str}`);
  return type;
}
