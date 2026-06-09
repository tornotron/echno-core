export const storageLocationKeys = {
  all: ['storage-locations'] as const,
  lists: () => [...storageLocationKeys.all, 'list'] as const,
  detail: (id: number) => [...storageLocationKeys.all, 'detail', id] as const,
};
