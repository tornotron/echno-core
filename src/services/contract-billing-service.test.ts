import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import {
  BillStatus,
  BillingModel,
  DeductionBasis,
  DeductionKind,
  parseBill,
  parseContractBillingSummary,
} from '../types/contract-billing/contract-billing';
import { contractBillingService } from './contract-billing-service';

const ID = 'b5a1c3d2-8e4f-4a6b-9c7d-0e1f2a3b4c5d';

afterEach(() => {
  for (const method of ['get', 'post', 'put', 'delete'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('contractBillingService paths', () => {
  test('contracts and bills read the web twin with the filters given', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [] });
    await contractBillingService.listContracts({ projectId: 7, pageNo: 0, pageSize: 20 });
    expect(api.get).toHaveBeenCalledWith('/contract-billing/web/contracts', { projectId: 7, pageNo: 0, pageSize: 20 });
    await contractBillingService.listBills({ subContractId: 3, status: BillStatus.CERTIFIED });
    expect(api.get).toHaveBeenCalledWith('/contract-billing/web/bills', { subContractId: 3, status: 'CERTIFIED' });
  });

  test('opening a bill posts only the fields given', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: ID, billingModel: 'RUNNING_ACCOUNT' });
    await contractBillingService.createBill({
      subContractId: 3,
      billingModel: BillingModel.RUNNING_ACCOUNT,
      periodFrom: '2026-08-01',
      periodTo: '2026-08-31',
    });
    expect(api.post).toHaveBeenCalledWith('/contract-billing/web/bills', {
      subContractId: 3,
      billingModel: 'RUNNING_ACCOUNT',
      periodFrom: '2026-08-01',
      periodTo: '2026-08-31',
    });
  });

  test('a rule posts its basis and only the amount that goes with it', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: 'r1' });
    await contractBillingService.addDeductionRule(3, {
      kind: DeductionKind.RETENTION,
      label: 'Retention 5%',
      basis: DeductionBasis.PERCENT,
      rate: 5,
    });
    expect(api.post).toHaveBeenCalledWith('/contract-billing/web/contracts/3/deduction-rules', {
      kind: 'RETENTION',
      label: 'Retention 5%',
      basis: 'PERCENT',
      rate: 5,
    });
  });

  test('each workflow step posts to its own path', async () => {
    spyOn(api, 'post').mockResolvedValue({ id: ID });
    for (const [call, step] of [
      [contractBillingService.submitBill, 'submit'],
      [contractBillingService.verifyBill, 'verify'],
      [contractBillingService.certifyBill, 'certify'],
      [contractBillingService.approveBill, 'approve'],
      [contractBillingService.cancelBill, 'cancel'],
    ] as const) {
      await call(ID);
      expect(api.post).toHaveBeenCalledWith(`/contract-billing/web/bills/${ID}/${step}`);
    }
    await contractBillingService.returnBill(ID, 'Photos missing');
    expect(api.post).toHaveBeenCalledWith(`/contract-billing/web/bills/${ID}/return`, { text: 'Photos missing' });
  });

  test('the measurement and claim drop unset line fields', async () => {
    spyOn(api, 'put').mockResolvedValue({ id: ID });
    await contractBillingService.saveMeasurement(ID, {
      measurementDate: '2026-09-19',
      lines: [{ lineId: 'l1', acceptedQuantity: 10 }],
    });
    expect(api.put).toHaveBeenCalledWith(`/contract-billing/web/bills/${ID}/measurement`, {
      measurementDate: '2026-09-19',
      lines: [{ lineId: 'l1', acceptedQuantity: 10 }],
    });
  });

  test('documents are registered under their type', async () => {
    spyOn(api, 'post').mockResolvedValue([]);
    await contractBillingService.registerDocuments(ID, [], 'test-report');
    expect(api.post).toHaveBeenCalledWith(`/contract-billing/web/bills/${ID}/documents/register`, [], {
      documentType: 'test-report',
    });
  });

  test('a malformed bill payload is an ApiError, not a crash', async () => {
    spyOn(api, 'get').mockResolvedValue({ not: 'a bill' });
    await expect(contractBillingService.getBill(ID)).rejects.toBeInstanceOf(ApiError);
    spyOn(api, 'get').mockResolvedValue({ not: 'an array' });
    await expect(contractBillingService.getEvents(ID)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('contract billing parsers', () => {
  test('a bill reads its figures as numbers and an unknown status as draft', () => {
    const bill = parseBill({
      id: ID,
      billingModel: 'MILESTONE',
      status: 'SOMETHING_NEW',
      grossClaimed: '1275000.00',
      netPayable: 1140000,
      lines: [],
      adjustments: [{ kind: 'GST', effect: 'ADD', basis: 'PERCENT', rate: 18, amount: '100.50', source: 'RULE', preview: true }],
    });
    expect(bill.status).toBe(BillStatus.DRAFT);
    expect(bill.billingModel).toBe(BillingModel.MILESTONE);
    expect(bill.grossClaimed).toBe(1275000);
    expect(bill.adjustments[0].amount).toBe(100.5);
    expect(bill.adjustments[0].preview).toBe(true);
    expect(bill.requirements).toEqual([]);
  });

  test('a contract that has not started billing has no model', () => {
    const summary = parseContractBillingSummary({ subContractId: 4, contractName: 'Civil', billingModel: null });
    expect(summary.billingModel).toBeUndefined();
    expect(summary.openBill).toBeUndefined();
    expect(summary.certifiedToDate).toBe(0);
  });
});
