// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;
import { parsePositiveInt } from '../../lib/utils/parse-id';

export enum StorageLocationType {
  GODOWN = 'GODOWN',
  PROJECT_SITE = 'PROJECT_SITE',
  HEAD_OFFICE = 'HEAD_OFFICE',
  WAREHOUSE = 'WAREHOUSE',
  OTHERS = 'OTHERS',
  PROCESSING_PLANT = 'PROCESSING_PLANT',
}

export const STORAGE_LOCATION_TYPE_LABELS: Record<StorageLocationType, string> =
  {
    [StorageLocationType.GODOWN]: 'Godown',
    [StorageLocationType.PROJECT_SITE]: 'Project Site',
    [StorageLocationType.HEAD_OFFICE]: 'Head Office',
    [StorageLocationType.WAREHOUSE]: 'Warehouse',
    [StorageLocationType.OTHERS]: 'Others',
    [StorageLocationType.PROCESSING_PLANT]: 'Processing Plant',
  };

export interface StorageLocation {
  id: number;
  locationName: string;
  locationType: StorageLocationType;
  address?: string;
  projectId?: number;
  projectName?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  storageItemsCount?: number;
  active: boolean;
}

export function parseStorageLocation(raw: Raw): StorageLocation {
  const id = parsePositiveInt(raw.id, 'parseStorageLocation.id');
  return {
    id,
    locationName: raw.locationName ?? '',
    locationType: raw.locationType as StorageLocationType,
    address: raw.address ?? undefined,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName ?? undefined,
    capacity: raw.capacity ?? undefined,
    latitude: raw.latitude ?? undefined,
    longitude: raw.longitude ?? undefined,
    storageItemsCount: raw.storageItemsCount ?? undefined,
    active: raw.active ?? true,
  };
}
