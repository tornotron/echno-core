/**
 * TanStack Query key factory for contract billing.
 *
 * Key shapes:
 * - `['contract-billing']`: namespace root; the invalidation prefix.
 * - `['contract-billing', 'overview']`: home page figures.
 * - `['contract-billing', 'contracts', params]`: one page of contracts.
 * - `['contract-billing', 'contract', id]`: one contract's billing.
 * - `['contract-billing', 'bills', params]`: one page of bills.
 * - `['contract-billing', 'bill', id]`: one bill.
 * - `['contract-billing', 'bill', id, 'events' | 'documents']`: its timeline and documents.
 */
import type { BillListParams, ContractBillingListParams } from '../../types/contract-billing/contract-billing';

export const contractBillingKeys = {
  all: ['contract-billing'] as const,
  overview: () => [...contractBillingKeys.all, 'overview'] as const,
  contracts: (params: ContractBillingListParams = {}) => [...contractBillingKeys.all, 'contracts', params] as const,
  contract: (subContractId: number) => [...contractBillingKeys.all, 'contract', subContractId] as const,
  bills: (params: BillListParams = {}) => [...contractBillingKeys.all, 'bills', params] as const,
  bill: (id: string) => [...contractBillingKeys.all, 'bill', id] as const,
  events: (id: string) => [...contractBillingKeys.bill(id), 'events'] as const,
  documents: (id: string) => [...contractBillingKeys.bill(id), 'documents'] as const,
};
