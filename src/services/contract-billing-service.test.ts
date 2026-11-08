import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import {
  BillEventType,
  BillPaymentAuthority,
  BillPaymentAuthorizeBlock,
  BillPaymentProvider,
  BillPaymentState,
  BillPaymentStatus,
  BillStatus,
  BillingModel,
  DeductionBasis,
  DeductionKind,
  ProjectBillingState,
  isBillPaymentInFlight,
  parseBill,
  parseBillActivity,
  parseBillPayments,
  parseBillingOverview,
  parseContractBillingSummary,
  parseProjectBillingSummary,
  parseProjectPaymentAuthorizer,
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

describe('project billing and payment paths', () => {
  const PAYMENTS = { billId: ID, billNumber: 'RA-01', provider: 'MANUAL', payments: [] };

  test('projects and activity read the web twin with the filters given', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 } as never);
    await contractBillingService.listProjects({ search: 'tower', pageNo: 1, pageSize: 12 });
    expect(get).toHaveBeenCalledWith('/contract-billing/web/projects', { search: 'tower', pageNo: 1, pageSize: 12 });
    get.mockResolvedValue({ projectId: 7 } as never);
    expect((await contractBillingService.getProject(7)).projectId).toBe(7);
    expect(get).toHaveBeenLastCalledWith('/contract-billing/web/projects/7');
    get.mockResolvedValue([] as never);
    await contractBillingService.listActivity({ projectId: 7, limit: 8 });
    expect(get).toHaveBeenCalledWith('/contract-billing/web/activity', { projectId: 7, limit: 8 });
  });

  test('a bill drafted from inspections says so, and an ordinary bill does not', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ id: ID } as never);
    await contractBillingService.createBill({ subContractId: 1, billingModel: BillingModel.RUNNING_ACCOUNT, draftFromInspections: true });
    expect(post.mock.calls[0]?.[1]).toEqual({ subContractId: 1, billingModel: 'RUNNING_ACCOUNT', draftFromInspections: true });
    await contractBillingService.createBill({ subContractId: 1, billingModel: BillingModel.RUNNING_ACCOUNT });
    expect(post.mock.calls[1]?.[1]).toEqual({ subContractId: 1, billingModel: 'RUNNING_ACCOUNT' });
  });

  test('each payment step posts to its own path with the payment id', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(PAYMENTS as never);
    await contractBillingService.raiseBillPayment(ID, { amount: 250000.5, note: 'First part' });
    expect(post).toHaveBeenLastCalledWith(`/contract-billing/web/bills/${ID}/payments`, { amount: 250000.5, note: 'First part' });
    await contractBillingService.raiseBillPayment(ID, { amount: 10 });
    expect(post).toHaveBeenLastCalledWith(`/contract-billing/web/bills/${ID}/payments`, { amount: 10 });
    await contractBillingService.authorizeBillPayment('p1');
    expect(post).toHaveBeenLastCalledWith('/contract-billing/web/bill-payments/p1/authorize');
    await contractBillingService.rejectBillPayment('p1', 'Wrong amount');
    expect(post).toHaveBeenLastCalledWith('/contract-billing/web/bill-payments/p1/reject', { text: 'Wrong amount' });
    await contractBillingService.recordBillPayment('p1', { bankReference: 'UTR-1', paidOn: '2026-11-08' });
    expect(post).toHaveBeenLastCalledWith('/contract-billing/web/bill-payments/p1/record', { bankReference: 'UTR-1', paidOn: '2026-11-08' });
    await contractBillingService.syncBillPayment('p1');
    expect(post).toHaveBeenLastCalledWith('/contract-billing/web/bill-payments/p1/sync');
  });

  test("a project's payment authorizer is read, named and cleared on its own path", async () => {
    const body = { projectId: 7, employeeId: 3, employeeName: 'Meera', active: true, changes: [] };
    const get = spyOn(api, 'get').mockResolvedValue(body as never);
    const put = spyOn(api, 'put').mockResolvedValue(body as never);
    const del = spyOn(api, 'delete').mockResolvedValue({ projectId: 7, changes: [] } as never);
    expect((await contractBillingService.getPaymentAuthorizer(7)).employeeName).toBe('Meera');
    expect(get).toHaveBeenLastCalledWith('/contract-billing/web/projects/7/payment-authorizer');
    await contractBillingService.setPaymentAuthorizer(7, { employeeId: 3 });
    expect(put).toHaveBeenLastCalledWith('/contract-billing/web/projects/7/payment-authorizer', { employeeId: 3 });
    expect((await contractBillingService.clearPaymentAuthorizer(7)).employeeId).toBeUndefined();
    expect(del).toHaveBeenLastCalledWith('/contract-billing/web/projects/7/payment-authorizer');
  });

  test('a malformed payments payload is an ApiError', async () => {
    spyOn(api, 'get').mockResolvedValue({ payments: 'nope' } as never);
    await expect(contractBillingService.getBillPayments(ID)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('who authorizes a payment', () => {
  test('a payment says whether the reader may sign it and why not, and an absent answer reads as no', () => {
    const view = parseBillPayments({
      billId: ID,
      billNumber: 'RA-01',
      provider: 'MANUAL',
      projectId: 7,
      authorizerEmployeeId: '3',
      authorizerName: 'Meera',
      authorizerActive: true,
      readerIsAuthorizer: true,
      payments: [
        { id: 'p1', billId: ID, amount: '10', status: 'REQUESTED', readerMayAuthorize: false, authorizeBlock: 'OWN_REQUEST' },
        { id: 'p2', billId: ID, amount: '10', status: 'SETTLED', authorizedAs: 'PROJECT_AUTHORIZER' },
        { id: 'p3', billId: ID, amount: '10', status: 'REQUESTED', authorizeBlock: 'SOMETHING_NEW' },
      ],
    });
    expect(view.authorizerEmployeeId).toBe(3);
    expect(view.readerIsAuthorizer).toBe(true);
    expect(view.payments[0]?.authorizeBlock).toBe(BillPaymentAuthorizeBlock.OWN_REQUEST);
    expect(view.payments[1]?.authorizedAs).toBe(BillPaymentAuthority.PROJECT_AUTHORIZER);
    expect(view.payments[1]?.readerMayAuthorize).toBe(false);
    expect(view.payments[2]?.authorizeBlock).toBeUndefined();

    const older = parseBillPayments({ billId: ID, payments: [{ id: 'p1', billId: ID, status: 'REQUESTED' }] });
    expect(older.readerIsAuthorizer).toBe(false);
    expect(older.authorizerActive).toBe(false);
    expect(older.payments[0]?.readerMayAuthorize).toBe(false);
  });

  test("a project's authorizer reads its history, and needs a project id", () => {
    const parsed = parseProjectPaymentAuthorizer({
      projectId: '7',
      employeeId: 3,
      employeeName: 'Meera',
      active: true,
      readerMayChange: true,
      changes: [{ id: 'c1', previousEmployeeId: null, employeeId: 3, employeeName: 'Meera', changedByName: 'Ravi' }],
    });
    expect(parsed.projectId).toBe(7);
    expect(parsed.readerIsAuthorizer).toBe(false);
    expect(parsed.changes[0]?.previousEmployeeId).toBeUndefined();
    expect(parsed.changes[0]?.changedByName).toBe('Ravi');
    expect(() => parseProjectPaymentAuthorizer({ employeeId: 3 })).toThrow();
  });
});

describe('project billing and payment parsers', () => {
  test('a project reads its figures and an unknown state as in progress, which claims nothing about money', () => {
    const row = parseProjectBillingSummary({
      projectId: 7,
      projectName: 'Tower A',
      contractValue: '1000000.00',
      amountDue: '40.50',
      billingState: 'PAYMENT_DUE',
    });
    expect(row.contractValue).toBe(1000000);
    expect(row.amountDue).toBe(40.5);
    expect(row.billingState).toBe(ProjectBillingState.PAYMENT_DUE);
    expect(row.city).toBeUndefined();
    expect(parseProjectBillingSummary({ projectId: 7, billingState: 'NEW' }).billingState).toBe(ProjectBillingState.IN_PROGRESS);
  });

  test('payments read as numbers, and an unknown status is treated as still in flight', () => {
    const view = parseBillPayments({
      billId: ID,
      billNumber: 'RA-01',
      provider: 'FAKE',
      amountDue: '600.00',
      paymentState: 'PART_PAID',
      inFlight: false,
      payments: [
        { id: 'p1', billId: ID, amount: '400.00', status: 'SETTLED', provider: 'FAKE', test: true, bankReference: 'TEST-1' },
        { id: 'p2', billId: ID, amount: '1.00', status: 'SOMETHING_NEW' },
      ],
    });
    expect(view.provider).toBe(BillPaymentProvider.FAKE);
    expect(view.amountDue).toBe(600);
    expect(view.paymentState).toBe(BillPaymentState.PART_PAID);
    expect(view.payments[0]?.amount).toBe(400);
    expect(view.payments[0]?.test).toBe(true);
    expect(isBillPaymentInFlight(view.payments[0]?.status as BillPaymentStatus)).toBe(false);
    expect(view.payments[1]?.status).toBe(BillPaymentStatus.PROCESSING);
    expect(view.payments[1]?.provider).toBe(BillPaymentProvider.MANUAL);
    expect(isBillPaymentInFlight(view.payments[1]?.status as BillPaymentStatus)).toBe(true);
  });

  test('a recent event names its bill, and a payment event is not read as a note', () => {
    const event = parseBillActivity({ id: 'e1', billId: ID, billNumber: 'RA-01', type: 'PAYMENT_SETTLED', projectId: 7 });
    expect(event.type).toBe(BillEventType.PAYMENT_SETTLED);
    expect(event.billId).toBe(ID);
  });

  test('the overview and a contract default their new figures, for a backend that has not sent them yet', () => {
    expect(parseBillingOverview({}).paidToDate).toBe(0);
    expect(parseBillingOverview({ paymentsInFlight: 2 }).paymentsInFlight).toBe(2);
    expect(parseContractBillingSummary({ subContractId: 1 }).amountDue).toBe(0);
    expect(parseBill({ id: ID, amountPaid: '5.00', paymentState: 'UNPAID' }).amountPaid).toBe(5);
    expect(parseBill({ id: ID }).paymentState).toBeUndefined();
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
