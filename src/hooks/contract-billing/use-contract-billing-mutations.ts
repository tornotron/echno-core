/**
 * @module use-contract-billing-mutations
 *
 * Mutation hooks for running account and milestone billing. A change to a
 * contract's set-up moves the figures of its open bill, and a bill's step
 * moves the home page and the contract page, so every mutation invalidates
 * the whole billing prefix.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractBillingService } from '../../services/contract-billing-service';
import type { RegisterUploadRequest } from '../../types/attachment';
import type {
  BillDocumentType,
  BoqItemRequest,
  CreateBillRequest,
  DeductionRuleRequest,
  ManualAdjustmentRequest,
  MeasurementRequest,
  MilestoneRequirementRequest,
  UpdateBillRequest,
} from '../../types/contract-billing/contract-billing';
import { contractBillingKeys } from './keys';

function useInvalidateBilling() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: contractBillingKeys.all });
}

/** Adds a BOQ item. Mutate with `{ subContractId, req }`. */
export function useAddBoqItem() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ subContractId, req }: { subContractId: number; req: BoqItemRequest }) =>
      contractBillingService.addBoqItem(subContractId, req),
    onSuccess: invalidate,
  });
}

/** Changes a BOQ item. Mutate with `{ itemId, req }`. */
export function useUpdateBoqItem() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ itemId, req }: { itemId: string; req: BoqItemRequest }) =>
      contractBillingService.updateBoqItem(itemId, req),
    onSuccess: invalidate,
  });
}

/** Deletes a BOQ item no bill uses. Mutate with the item id. */
export function useDeleteBoqItem() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (itemId: string) => contractBillingService.deleteBoqItem(itemId),
    onSuccess: invalidate,
  });
}

/** Adds a deduction rule. Mutate with `{ subContractId, req }`. */
export function useAddDeductionRule() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ subContractId, req }: { subContractId: number; req: DeductionRuleRequest }) =>
      contractBillingService.addDeductionRule(subContractId, req),
    onSuccess: invalidate,
  });
}

/** Changes a deduction rule. Mutate with `{ ruleId, req }`. */
export function useUpdateDeductionRule() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ ruleId, req }: { ruleId: string; req: DeductionRuleRequest }) =>
      contractBillingService.updateDeductionRule(ruleId, req),
    onSuccess: invalidate,
  });
}

/** Deletes a deduction rule no certified bill has applied. Mutate with the rule id. */
export function useDeleteDeductionRule() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (ruleId: string) => contractBillingService.deleteDeductionRule(ruleId),
    onSuccess: invalidate,
  });
}

/** Adds a milestone requirement. Mutate with `{ subContractId, milestoneId, req }`. */
export function useAddMilestoneRequirement() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ subContractId, milestoneId, req }: { subContractId: number; milestoneId: number; req: MilestoneRequirementRequest }) =>
      contractBillingService.addRequirement(subContractId, milestoneId, req),
    onSuccess: invalidate,
  });
}

/** Changes a milestone requirement, including its status. Mutate with `{ requirementId, req }`. */
export function useUpdateMilestoneRequirement() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ requirementId, req }: { requirementId: string; req: MilestoneRequirementRequest }) =>
      contractBillingService.updateRequirement(requirementId, req),
    onSuccess: invalidate,
  });
}

/** Deletes a milestone requirement. Mutate with the requirement id. */
export function useDeleteMilestoneRequirement() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (requirementId: string) => contractBillingService.deleteRequirement(requirementId),
    onSuccess: invalidate,
  });
}

/** Opens a bill. Mutate with the request; resolves to the new draft. */
export function useCreateBill() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: (req: CreateBillRequest) => contractBillingService.createBill(req),
    onSuccess: invalidate,
  });
}

/** Replaces a draft or returned bill's claim. Mutate with `{ id, req }`. */
export function useUpdateBill() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateBillRequest }) => contractBillingService.updateBill(id, req),
    onSuccess: invalidate,
  });
}

/** Saves the joint measurement. Mutate with `{ id, req }`. */
export function useSaveBillMeasurement() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, req }: { id: string; req: MeasurementRequest }) => contractBillingService.saveMeasurement(id, req),
    onSuccess: invalidate,
  });
}

/** Replaces the manual adjustments. Mutate with `{ id, adjustments }`. */
export function useReplaceBillAdjustments() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, adjustments }: { id: string; adjustments: ManualAdjustmentRequest[] }) =>
      contractBillingService.replaceAdjustments(id, adjustments),
    onSuccess: invalidate,
  });
}

/** The workflow steps that take only the bill id. */
export type BillStep = 'submit' | 'cancel' | 'verify' | 'certify' | 'approve';

/** Moves a bill one step. Mutate with `{ id, step }`. */
export function useBillStep() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, step }: { id: string; step: BillStep }) => {
      switch (step) {
        case 'submit':
          return contractBillingService.submitBill(id);
        case 'cancel':
          return contractBillingService.cancelBill(id);
        case 'verify':
          return contractBillingService.verifyBill(id);
        case 'certify':
          return contractBillingService.certifyBill(id);
        case 'approve':
          return contractBillingService.approveBill(id);
      }
    },
    onSuccess: invalidate,
  });
}

/** Returns a bill for correction. Mutate with `{ id, reason }`. */
export function useReturnBill() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => contractBillingService.returnBill(id, reason),
    onSuccess: invalidate,
  });
}

/** Adds a note to a bill's timeline. Mutate with `{ id, text }`. */
export function useAddBillNote() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => contractBillingService.addNote(id, text),
    onSuccess: invalidate,
  });
}

/** Registers uploaded documents on a bill under one type. Mutate with `{ id, uploads, documentType }`. */
export function useRegisterBillDocuments() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, uploads, documentType }: { id: string; uploads: RegisterUploadRequest[]; documentType: BillDocumentType }) =>
      contractBillingService.registerDocuments(id, uploads, documentType),
    onSuccess: invalidate,
  });
}

/** Removes a document from an open bill. Mutate with `{ id, attachmentId }`. */
export function useDeleteBillDocument() {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: ({ id, attachmentId }: { id: string; attachmentId: number }) =>
      contractBillingService.deleteDocument(id, attachmentId),
    onSuccess: invalidate,
  });
}
