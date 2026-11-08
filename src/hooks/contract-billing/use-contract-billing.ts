/**
 * @module use-contract-billing
 *
 * Query hooks for running account and milestone billing.
 */

import { useQuery } from '@tanstack/react-query';
import { contractBillingService } from '../../services/contract-billing-service';
import { shouldRetry } from '../../lib/query/retry';
import type { BillListParams, ContractBillingListParams, ProjectBillingListParams } from '../../types/contract-billing/contract-billing';
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

/** One page of projects with their contracts and bills added up. */
export function useBillingProjects(params: ProjectBillingListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.projects(params),
    queryFn: () => contractBillingService.listProjects(params),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** One project's billing figures. Disabled until an id is known. */
export function useBillingProject(projectId: number | undefined) {
  return useQuery({
    queryKey: contractBillingKeys.project(projectId ?? 0),
    queryFn: () => contractBillingService.getProject(projectId as number),
    enabled: Boolean(projectId),
    retry: shouldRetry,
  });
}

/** The latest bill events, across the organization or for one project. */
export function useBillingActivity(params: { projectId?: number; limit?: number } = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.activity(params),
    queryFn: () => contractBillingService.listActivity(params),
    enabled: options.enabled ?? true,
    retry: shouldRetry,
  });
}

/** Who authorizes payments on a project's bills, with the changes. Disabled until an id is known. */
export function usePaymentAuthorizer(projectId: number | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.paymentAuthorizer(projectId ?? 0),
    queryFn: () => contractBillingService.getPaymentAuthorizer(projectId as number),
    enabled: (options.enabled ?? true) && Boolean(projectId),
    retry: shouldRetry,
  });
}

/** A bill's payments and what is left to pay. Disabled until an id is known. */
export function useBillPayments(billId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contractBillingKeys.payments(billId ?? ''),
    queryFn: () => contractBillingService.getBillPayments(billId as string),
    enabled: (options.enabled ?? true) && Boolean(billId),
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
