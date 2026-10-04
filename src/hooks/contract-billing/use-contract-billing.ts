/**
 * @module use-contract-billing
 *
 * Query hooks for running account and milestone billing.
 */

import { useQuery } from '@tanstack/react-query';
import { contractBillingService } from '../../services/contract-billing-service';
import { shouldRetry } from '../../lib/query/retry';
import type { BillListParams, ContractBillingListParams } from '../../types/contract-billing/contract-billing';
import { contractBillingKeys } from './keys';

/** Organization-wide figures for the billing home page. */
export function useBillingOverview(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.overview(),
    queryFn: () => contractBillingService.getOverview(),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** One page of contracts with their billing state. */
export function useBillingContracts(params: ContractBillingListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.contracts(params),
    queryFn: () => contractBillingService.listContracts(params),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** One contract's billing: BOQ, rules, milestones and bills. Disabled until an id is known. */
export function useContractBilling(subContractId: number | undefined) {
  return useQuery({
    queryKey: contractBillingKeys.contract(subContractId ?? 0),
    queryFn: () => contractBillingService.getContract(subContractId as number),
    enabled: Boolean(subContractId),
    retry: shouldRetry,
  });
}

/** One page of bills. */
export function useBills(params: BillListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.bills(params),
    queryFn: () => contractBillingService.listBills(params),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** One bill; disabled until an id is known. */
export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: contractBillingKeys.bill(id ?? ''),
    queryFn: () => contractBillingService.getBill(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}

/** A bill's timeline, newest first; disabled until an id is known. */
export function useBillEvents(id: string | undefined) {
  return useQuery({
    queryKey: contractBillingKeys.events(id ?? ''),
    queryFn: () => contractBillingService.getEvents(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}

/** A bill's supporting documents; disabled until an id is known. */
export function useBillDocuments(id: string | undefined) {
  return useQuery({
    queryKey: contractBillingKeys.documents(id ?? ''),
    queryFn: () => contractBillingService.getDocuments(id as string),
    enabled: Boolean(id),
    retry: shouldRetry,
  });
}
