/**
 * TanStack Query key factory for contract billing.
 *
 * Key shapes:
 * - `['contract-billing']`: namespace root; the invalidation prefix.
 * - `['contract-billing', 'overview']`: home page figures.
 * - `['contract-billing', 'projects', params]`: one page of projects.
 * - `['contract-billing', 'project', id]`: one project's figures.
 * - `['contract-billing', 'project', id, 'payment-authorizer']`: who signs its payments.
 * - `['contract-billing', 'activity', params]`: the latest bill events.
 * - `['contract-billing', 'contracts', params]`: one page of contracts.
 * - `['contract-billing', 'contract', id]`: one contract's billing.
 * - `['contract-billing', 'bills', params]`: one page of bills.
 * - `['contract-billing', 'bill', id]`: one bill.
 * - `['contract-billing', 'bill', id, 'events' | 'documents' | 'payments']`: its timeline, documents and payments.
 */
import type { BillListParams, ContractBillingListParams, ProjectBillingListParams } from '../../types/contract-billing/contract-billing';

export const contractBillingKeys = {
  all: ['contract-billing'] as const,
  overview: () => [...contractBillingKeys.all, 'overview'] as const,
  projects: (params: ProjectBillingListParams = {}) => [...contractBillingKeys.all, 'projects', params] as const,
  project: (projectId: number) => [...contractBillingKeys.all, 'project', projectId] as const,
  paymentAuthorizer: (projectId: number) => [...contractBillingKeys.project(projectId), 'payment-authorizer'] as const,
  activity: (params: { projectId?: number; limit?: number } = {}) =>
    [...contractBillingKeys.all, 'activity', params] as const,
  contracts: (params: ContractBillingListParams = {}) => [...contractBillingKeys.all, 'contracts', params] as const,
  contract: (subContractId: number) => [...contractBillingKeys.all, 'contract', subContractId] as const,
  bills: (params: BillListParams = {}) => [...contractBillingKeys.all, 'bills', params] as const,
  bill: (id: string) => [...contractBillingKeys.all, 'bill', id] as const,
  events: (id: string) => [...contractBillingKeys.bill(id), 'events'] as const,
  documents: (id: string) => [...contractBillingKeys.bill(id), 'documents'] as const,
  payments: (id: string) => [...contractBillingKeys.bill(id), 'payments'] as const,
};
