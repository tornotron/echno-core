// types/project/project-status.ts

export enum ProjectStatus {
  open = 'open',
  closed = 'closed',
  upcoming = 'upcoming',
  completed = 'completed',
  dropped = 'dropped',
  onHold = 'onHold',
  cancelled = 'cancelled',
}

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

/** Convert string → ProjectStatus */
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

export function getProjectStatusName(status?: ProjectStatus): string {
  if (!status) throw new Error('Invalid project status');
  return getProjectStatusLabel(status);
}
