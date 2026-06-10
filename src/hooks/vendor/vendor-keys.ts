export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  detail: (id: number) => [...vendorKeys.all, 'detail', id] as const,
  search: (name: string) => [...vendorKeys.all, 'search', name] as const,
  paginated: (pageNo: number, pageSize: number) =>
    [...vendorKeys.all, 'paginated', { pageNo, pageSize }] as const,
  summary: (vendorId: number) =>
    [...vendorKeys.all, 'summary', vendorId] as const,
  contacts: (vendorId: number) =>
    [...vendorKeys.all, 'contacts', vendorId] as const,
  taxIdentifiers: (vendorId: number) =>
    [...vendorKeys.all, 'tax-identifiers', vendorId] as const,
  bankAccounts: (vendorId: number) =>
    [...vendorKeys.all, 'bank-accounts', vendorId] as const,
  paymentTerms: (vendorId: number) =>
    [...vendorKeys.all, 'payment-terms', vendorId] as const,
};
