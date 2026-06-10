export const labourKeys = {
  all: ['labour'] as const,
  lists: () => [...labourKeys.all, 'list'] as const,
  detail: (id: number) => [...labourKeys.all, 'detail', id] as const,
};
