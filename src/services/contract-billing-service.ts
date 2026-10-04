/**
 * @module contract-billing-service
 *
 * Typed client for running account and milestone billing in the Work
 * Progress module (`/contract-billing/web`, the twin the web app talks to;
 * `/contract-billing` serves the same operations to the phone).
 *
 * Endpoints:
 * - `GET    /contract-billing/web/overview`                                   home page figures
 * - `GET    /contract-billing/web/contracts`                                  contracts, paged
 * - `GET    /contract-billing/web/contracts/{id}`                             one contract's billing
 * - `GET    /contract-billing/web/contracts/{id}/boq-items`                   its BOQ
 * - `POST   /contract-billing/web/contracts/{id}/boq-items`                   add a BOQ item
 * - `PUT    /contract-billing/web/boq-items/{itemId}`                         change one
 * - `DELETE /contract-billing/web/boq-items/{itemId}`                         delete one
 * - `GET    /contract-billing/web/contracts/{id}/deduction-rules`             its rules
 * - `POST   /contract-billing/web/contracts/{id}/deduction-rules`             add a rule
 * - `PUT    /contract-billing/web/deduction-rules/{ruleId}`                   change one
 * - `DELETE /contract-billing/web/deduction-rules/{ruleId}`                   delete one
 * - `GET    /contract-billing/web/contracts/{id}/milestones/{m}/requirements` a milestone's requirements
 * - `POST   /contract-billing/web/contracts/{id}/milestones/{m}/requirements` add one
 * - `PUT    /contract-billing/web/requirements/{reqId}`                       change one, including status
 * - `DELETE /contract-billing/web/requirements/{reqId}`                       delete one
 * - `GET    /contract-billing/web/bills`                                      bills, paged
 * - `POST   /contract-billing/web/bills`                                      open a bill
 * - `GET    /contract-billing/web/bills/{id}`                                 one bill
 * - `PUT    /contract-billing/web/bills/{id}`                                 change the claim
 * - `POST   /contract-billing/web/bills/{id}/submit|cancel|verify|certify|approve`
 * - `PUT    /contract-billing/web/bills/{id}/measurement`                     joint measurement
 * - `POST   /contract-billing/web/bills/{id}/return`                          return for correction
 * - `PUT    /contract-billing/web/bills/{id}/adjustments`                     manual adjustments
 * - `GET    /contract-billing/web/bills/{id}/events`                          timeline
 * - `POST   /contract-billing/web/bills/{id}/notes`                           add a note
 * - `GET    /contract-billing/web/bills/{id}/pdf`                             the bill as a PDF
 * - `GET    /contract-billing/web/bills/{id}/documents`                       supporting documents
 * - `POST   /contract-billing/web/bills/{id}/documents/presign`               step 1 of upload
 * - `POST   /contract-billing/web/bills/{id}/documents/register`              step 3, with a document type
 * - `DELETE /contract-billing/web/bills/{id}/documents/{attachmentId}`        remove one
 *
 * Every function throws {@link ApiError} on a non-2xx response or a parse
 * failure. The server's message is on the error, for the failure toast.
 */

import { api, ApiError } from '../lib/api/api-client';
import { logger } from '../lib/logger';
import {
  Attachment,
  PresignedUpload,
  RegisterUploadRequest,
  UploadRequest,
  parseAttachment,
  parsePresignedUpload,
} from '../types/attachment';
import {
  Bill,
  BillDocumentType,
  BillEvent,
  BillListParams,
  BillSummary,
  BillingOverview,
  BillingPage,
  BoqItem,
  BoqItemRequest,
  ContractBillingDetail,
  ContractBillingListParams,
  ContractBillingSummary,
  CreateBillRequest,
  DeductionRule,
  DeductionRuleRequest,
  ManualAdjustmentRequest,
  MeasurementRequest,
  MilestoneRequirement,
  MilestoneRequirementRequest,
  UpdateBillRequest,
  parseBill,
  parseBillEvent,
  parseBillSummary,
  parseBillingOverview,
  parseBillingPage,
  parseBoqItem,
  parseContractBillingDetail,
  parseContractBillingSummary,
  parseDeductionRule,
  parseMilestoneRequirement,
} from '../types/contract-billing/contract-billing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

const BASE = '/contract-billing/web';

function parseWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    logger.error(`Failed to parse ${what}:`, error);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
}

function parseArrayWith<T>(what: string, data: unknown, parse: (raw: unknown) => T): T[] {
  if (!Array.isArray(data)) {
    logger.error(`Failed to parse ${what}: expected an array`);
    throw new ApiError(`Failed to process ${what} data. Please try again.`, 422);
  }
  return data.map((item) => parseWith(what, item, parse));
}

function definedOnly(source: object): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

function boqPayload(req: BoqItemRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.itemCode = req.itemCode;
  payload.description = req.description;
  payload.unit = req.unit;
  payload.contractQuantity = req.contractQuantity;
  payload.rate = req.rate;
  if (req.wbsElementId !== undefined) payload.wbsElementId = req.wbsElementId;
  if (req.sortOrder !== undefined) payload.sortOrder = req.sortOrder;
  return payload;
}

function rulePayload(req: DeductionRuleRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.kind = req.kind;
  payload.label = req.label;
  if (req.effect !== undefined) payload.effect = req.effect;
  payload.basis = req.basis;
  if (req.rate !== undefined) payload.rate = req.rate;
  if (req.fixedAmount !== undefined) payload.fixedAmount = req.fixedAmount;
  if (req.capAmount !== undefined) payload.capAmount = req.capAmount;
  if (req.enabled !== undefined) payload.enabled = req.enabled;
  if (req.sortOrder !== undefined) payload.sortOrder = req.sortOrder;
  return payload;
}

function requirementPayload(req: MilestoneRequirementRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.title = req.title;
  payload.type = req.type;
  if (req.description !== undefined) payload.description = req.description;
  if (req.mandatory !== undefined) payload.mandatory = req.mandatory;
  if (req.dueDate !== undefined) payload.dueDate = req.dueDate;
  if (req.status !== undefined) payload.status = req.status;
  if (req.remarks !== undefined) payload.remarks = req.remarks;
  if (req.sortOrder !== undefined) payload.sortOrder = req.sortOrder;
  return payload;
}

export const contractBillingService = {
  // ---------------------------------------------------------------- home page and contracts

  /** `GET /contract-billing/web/overview` */
  async getOverview(): Promise<BillingOverview> {
    const data = await api.get<ApiResponse>(`${BASE}/overview`);
    return parseWith('billing overview', data, parseBillingOverview);
  },

  /** `GET /contract-billing/web/contracts`: one page, newest contract first. */
  async listContracts(params: ContractBillingListParams = {}): Promise<BillingPage<ContractBillingSummary>> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<ApiResponse>(`${BASE}/contracts`, query);
    return parseWith('billing contracts', data, (raw) => parseBillingPage(raw, parseContractBillingSummary));
  },

  /** `GET /contract-billing/web/contracts/{id}` */
  async getContract(subContractId: number): Promise<ContractBillingDetail> {
    const data = await api.get<ApiResponse>(`${BASE}/contracts/${subContractId}`);
    return parseWith('contract billing', data, parseContractBillingDetail);
  },

  // ---------------------------------------------------------------- BOQ

  async listBoqItems(subContractId: number): Promise<BoqItem[]> {
    const data = await api.get<ApiResponse>(`${BASE}/contracts/${subContractId}/boq-items`);
    return parseArrayWith('BOQ', data, parseBoqItem);
  },

  async addBoqItem(subContractId: number, req: BoqItemRequest): Promise<BoqItem> {
    const data = await api.post<ApiResponse>(`${BASE}/contracts/${subContractId}/boq-items`, boqPayload(req));
    return parseWith('BOQ item', data, parseBoqItem);
  },

  async updateBoqItem(itemId: string, req: BoqItemRequest): Promise<BoqItem> {
    const data = await api.put<ApiResponse>(`${BASE}/boq-items/${itemId}`, boqPayload(req));
    return parseWith('BOQ item', data, parseBoqItem);
  },

  async deleteBoqItem(itemId: string): Promise<void> {
    await api.delete(`${BASE}/boq-items/${itemId}`);
  },

  // ---------------------------------------------------------------- deduction rules

  async listDeductionRules(subContractId: number): Promise<DeductionRule[]> {
    const data = await api.get<ApiResponse>(`${BASE}/contracts/${subContractId}/deduction-rules`);
    return parseArrayWith('deduction rules', data, parseDeductionRule);
  },

  async addDeductionRule(subContractId: number, req: DeductionRuleRequest): Promise<DeductionRule> {
    const data = await api.post<ApiResponse>(`${BASE}/contracts/${subContractId}/deduction-rules`, rulePayload(req));
    return parseWith('deduction rule', data, parseDeductionRule);
  },

  async updateDeductionRule(ruleId: string, req: DeductionRuleRequest): Promise<DeductionRule> {
    const data = await api.put<ApiResponse>(`${BASE}/deduction-rules/${ruleId}`, rulePayload(req));
    return parseWith('deduction rule', data, parseDeductionRule);
  },

  async deleteDeductionRule(ruleId: string): Promise<void> {
    await api.delete(`${BASE}/deduction-rules/${ruleId}`);
  },

  // ---------------------------------------------------------------- milestone requirements

  async listRequirements(subContractId: number, milestoneId: number): Promise<MilestoneRequirement[]> {
    const data = await api.get<ApiResponse>(`${BASE}/contracts/${subContractId}/milestones/${milestoneId}/requirements`);
    return parseArrayWith('milestone requirements', data, parseMilestoneRequirement);
  },

  async addRequirement(
    subContractId: number,
    milestoneId: number,
    req: MilestoneRequirementRequest
  ): Promise<MilestoneRequirement> {
    const data = await api.post<ApiResponse>(
      `${BASE}/contracts/${subContractId}/milestones/${milestoneId}/requirements`,
      requirementPayload(req)
    );
    return parseWith('milestone requirement', data, parseMilestoneRequirement);
  },

  async updateRequirement(requirementId: string, req: MilestoneRequirementRequest): Promise<MilestoneRequirement> {
    const data = await api.put<ApiResponse>(`${BASE}/requirements/${requirementId}`, requirementPayload(req));
    return parseWith('milestone requirement', data, parseMilestoneRequirement);
  },

  async deleteRequirement(requirementId: string): Promise<void> {
    await api.delete(`${BASE}/requirements/${requirementId}`);
  },

  // ---------------------------------------------------------------- bills

  /** `GET /contract-billing/web/bills`: one page, newest first. */
  async listBills(params: BillListParams = {}): Promise<BillingPage<BillSummary>> {
    const query: Record<string, string | number | boolean> = {};
    if (params.projectId !== undefined) query.projectId = params.projectId;
    if (params.subContractId !== undefined) query.subContractId = params.subContractId;
    if (params.status !== undefined) query.status = params.status;
    if (params.billingModel !== undefined) query.billingModel = params.billingModel;
    if (params.pageNo !== undefined) query.pageNo = params.pageNo;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    const data = await api.get<ApiResponse>(`${BASE}/bills`, query);
    return parseWith('bill list', data, (raw) => parseBillingPage(raw, parseBillSummary));
  },

  /** `POST /contract-billing/web/bills`: opens a draft. */
  async createBill(req: CreateBillRequest): Promise<Bill> {
    const payload: Record<string, unknown> = {};
    payload.subContractId = req.subContractId;
    payload.billingModel = req.billingModel;
    if (req.periodFrom !== undefined) payload.periodFrom = req.periodFrom;
    if (req.periodTo !== undefined) payload.periodTo = req.periodTo;
    if (req.contractMilestoneId !== undefined) payload.contractMilestoneId = req.contractMilestoneId;
    if (req.claimedPercent !== undefined) payload.claimedPercent = req.claimedPercent;
    if (req.contractorReference !== undefined) payload.contractorReference = req.contractorReference;
    if (req.location !== undefined) payload.location = req.location;
    if (req.remarks !== undefined) payload.remarks = req.remarks;
    const data = await api.post<ApiResponse>(`${BASE}/bills`, payload);
    return parseWith('bill', data, parseBill);
  },

  async getBill(id: string): Promise<Bill> {
    const data = await api.get<ApiResponse>(`${BASE}/bills/${id}`);
    return parseWith('bill', data, parseBill);
  },

  /**
   * `PUT /contract-billing/web/bills/{id}`: replaces the claim. The header
   * fields are replaced as sent, so send the ones to keep as well.
   */
  async updateBill(id: string, req: UpdateBillRequest): Promise<Bill> {
    const payload: Record<string, unknown> = {};
    if (req.periodFrom !== undefined) payload.periodFrom = req.periodFrom;
    if (req.periodTo !== undefined) payload.periodTo = req.periodTo;
    if (req.claimedPercent !== undefined) payload.claimedPercent = req.claimedPercent;
    if (req.contractorReference !== undefined) payload.contractorReference = req.contractorReference;
    if (req.location !== undefined) payload.location = req.location;
    if (req.remarks !== undefined) payload.remarks = req.remarks;
    if (req.lines !== undefined) payload.lines = req.lines.map(definedOnly);
    const data = await api.put<ApiResponse>(`${BASE}/bills/${id}`, payload);
    return parseWith('bill', data, parseBill);
  },

  async submitBill(id: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/submit`);
    return parseWith('bill', data, parseBill);
  },

  async cancelBill(id: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/cancel`);
    return parseWith('bill', data, parseBill);
  },

  /** `PUT /contract-billing/web/bills/{id}/measurement`: may be saved more than once. */
  async saveMeasurement(id: string, req: MeasurementRequest): Promise<Bill> {
    const payload: Record<string, unknown> = {};
    if (req.measurementDate !== undefined) payload.measurementDate = req.measurementDate;
    if (req.measuredBy !== undefined) payload.measuredBy = req.measuredBy;
    if (req.clientRepresentative !== undefined) payload.clientRepresentative = req.clientRepresentative;
    if (req.certifiedPercent !== undefined) payload.certifiedPercent = req.certifiedPercent;
    if (req.lines !== undefined) payload.lines = req.lines.map(definedOnly);
    const data = await api.put<ApiResponse>(`${BASE}/bills/${id}/measurement`, payload);
    return parseWith('bill', data, parseBill);
  },

  async verifyBill(id: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/verify`);
    return parseWith('bill', data, parseBill);
  },

  /** `POST /contract-billing/web/bills/{id}/return`: back to the preparer with the reason. */
  async returnBill(id: string, reason: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/return`, { text: reason });
    return parseWith('bill', data, parseBill);
  },

  /** `PUT /contract-billing/web/bills/{id}/adjustments`: replaces the manual lines. */
  async replaceAdjustments(id: string, adjustments: ManualAdjustmentRequest[]): Promise<Bill> {
    const data = await api.put<ApiResponse>(`${BASE}/bills/${id}/adjustments`, {
      adjustments: adjustments.map(definedOnly),
    });
    return parseWith('bill', data, parseBill);
  },

  async certifyBill(id: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/certify`);
    return parseWith('bill', data, parseBill);
  },

  /** `POST /contract-billing/web/bills/{id}/approve`: final approval; hands the net to finance. */
  async approveBill(id: string): Promise<Bill> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/approve`);
    return parseWith('bill', data, parseBill);
  },

  async getEvents(id: string): Promise<BillEvent[]> {
    const data = await api.get<ApiResponse>(`${BASE}/bills/${id}/events`);
    return parseArrayWith('bill timeline', data, parseBillEvent);
  },

  async addNote(id: string, text: string): Promise<BillEvent> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/notes`, { text });
    return parseWith('bill note', data, parseBillEvent);
  },

  /** `GET /contract-billing/web/bills/{id}/pdf` */
  async downloadPdf(id: string): Promise<Blob> {
    return api.getBlob(`${BASE}/bills/${id}/pdf`);
  },

  // ---------------------------------------------------------------- supporting documents

  async getDocuments(id: string): Promise<Attachment[]> {
    const data = await api.get<ApiResponse>(`${BASE}/bills/${id}/documents`);
    return parseArrayWith('bill documents', data, parseAttachment);
  },

  /** Step 1 of the direct-to-storage document flow: one slot per file. */
  async presignDocuments(id: string, requests: UploadRequest[]): Promise<PresignedUpload[]> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/documents/presign`, requests);
    return parseArrayWith('bill document slot', data, parsePresignedUpload);
  },

  /** Step 3 of the direct-to-storage document flow: confirm the keys under one document type. */
  async registerDocuments(
    id: string,
    requests: RegisterUploadRequest[],
    documentType: BillDocumentType = 'other'
  ): Promise<Attachment[]> {
    const data = await api.post<ApiResponse>(`${BASE}/bills/${id}/documents/register`, requests, { documentType });
    return parseArrayWith('bill documents', data, parseAttachment);
  },

  async deleteDocument(id: string, attachmentId: number): Promise<void> {
    await api.delete(`${BASE}/bills/${id}/documents/${attachmentId}`);
  },
};
