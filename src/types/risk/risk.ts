/**
 * @module risk
 *
 * Domain types for a project's risk register: each risk with its category
 * and sub-category, probability and impact before and after the response,
 * owner, dates, and cost and schedule impact.
 *
 * The register is kept on the server (`/project/{projectId}/risks/web`), so
 * everyone on the project reads the same one. Scores and the R-number are
 * worked out by the server; a request never carries them.
 *
 * Category codes are the construction risk categories plus the seven codes
 * of the generic list they replaced, which older risks still carry. The
 * labels, descriptions and the standard sub-categories are presentation and
 * live with the client that shows them. Sub-categories are free text.
 *
 * The parsers are non-strict: a field the backend adds later never breaks
 * this client.
 */

import { z } from 'zod';
import {
  backendDate,
  money,
  nullableNumber,
  nullableString,
} from '../../lib/validation/backend-schema';

/** Likelihood of a risk, lowest to highest. Scores 1 to 5. */
export type RiskProbability = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';

/** Consequence of a risk, least to worst. Scores 1 to 5. */
export type RiskImpact = 'negligible' | 'minor' | 'moderate' | 'major' | 'catastrophic';

/** Where a risk stands. */
export type RiskStatus =
  | 'identified'
  | 'analysed'
  | 'response-planned'
  | 'mitigated'
  | 'closed'
  | 'occurred';

/** How a risk is being handled. */
export type RiskResponseType = 'avoid' | 'mitigate' | 'transfer' | 'accept';

export const RISK_PROBABILITIES: readonly RiskProbability[] = [
  'very-low',
  'low',
  'medium',
  'high',
  'very-high',
];

export const RISK_IMPACTS: readonly RiskImpact[] = [
  'negligible',
  'minor',
  'moderate',
  'major',
  'catastrophic',
];

export const RISK_STATUSES: readonly RiskStatus[] = [
  'identified',
  'analysed',
  'response-planned',
  'mitigated',
  'closed',
  'occurred',
];

export const RISK_RESPONSE_TYPES: readonly RiskResponseType[] = [
  'avoid',
  'mitigate',
  'transfer',
  'accept',
];

/** One risk on a project's register, as read back. Dates are ISO `YYYY-MM-DD`. */
export interface Risk {
  /** UUID of the risk. */
  id: string;
  projectId: number;
  /** The project's running number. */
  riskNumber: number;
  /** The running number as shown, `R-007`. */
  riskId: string;
  title: string;
  description?: string;
  /** Category code; see the module note. */
  category: string;
  /** Standard sub-category or free text. */
  subCategory?: string;
  status: RiskStatus;
  /** Who owns the risk, as a name. */
  owner?: string;
  probability: RiskProbability;
  impact: RiskImpact;
  /** Probability score times impact score, 1 to 25. */
  riskScore: number;
  residualProbability: RiskProbability;
  residualImpact: RiskImpact;
  /** Residual probability score times residual impact score, 1 to 25. */
  residualScore: number;
  responseType: RiskResponseType;
  contingencyPlan?: string;
  identifiedDate?: string;
  reviewDate?: string;
  closedDate?: string;
  /** Estimated cost if the risk occurs. */
  costImpact?: number;
  /** Potential delay in days if the risk occurs. */
  scheduleImpact?: number;
  /** Optimistic-lock version; send it back on an update. */
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Body of a create, an update, or one line of an import. The server derives
 * the scores and the R-number.
 */
export interface RiskRequest {
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  status: RiskStatus;
  owner?: string;
  probability: RiskProbability;
  impact: RiskImpact;
  residualProbability: RiskProbability;
  residualImpact: RiskImpact;
  responseType: RiskResponseType;
  contingencyPlan?: string;
  identifiedDate?: string;
  reviewDate?: string;
  closedDate?: string;
  costImpact?: number;
  scheduleImpact?: number;
  /**
   * On an update, the version the editor started from. If someone else saved
   * in between, the update is refused with a 409. Ignored elsewhere.
   */
  version?: number;
  /**
   * On an import, the risk's id in the browser storage it came from. A risk
   * whose reference the project already holds is skipped, so a repeated
   * import adds nothing. Ignored elsewhere.
   */
  importRef?: string;
}

/** Score of one probability and impact pair, 1 to 25. */
export function riskScore(probability: RiskProbability, impact: RiskImpact): number {
  return (RISK_PROBABILITIES.indexOf(probability) + 1) * (RISK_IMPACTS.indexOf(impact) + 1);
}

/** The display number for a running number: `R-007`. */
export function formatRiskNumber(riskNumber: number): string {
  return `R-${String(riskNumber).padStart(3, '0')}`;
}

/**
 * Serializes a {@link RiskRequest}. Only fields that are set are sent, so
 * an update that leaves an optional field out clears it.
 */
export function riskRequestToJson(req: RiskRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  payload.title = req.title;
  payload.category = req.category;
  payload.status = req.status;
  payload.probability = req.probability;
  payload.impact = req.impact;
  payload.residualProbability = req.residualProbability;
  payload.residualImpact = req.residualImpact;
  payload.responseType = req.responseType;
  if (req.description !== undefined) payload.description = req.description;
  if (req.subCategory !== undefined) payload.subCategory = req.subCategory;
  if (req.owner !== undefined) payload.owner = req.owner;
  if (req.contingencyPlan !== undefined) payload.contingencyPlan = req.contingencyPlan;
  if (req.identifiedDate !== undefined) payload.identifiedDate = req.identifiedDate;
  if (req.reviewDate !== undefined) payload.reviewDate = req.reviewDate;
  if (req.closedDate !== undefined) payload.closedDate = req.closedDate;
  if (req.costImpact !== undefined) payload.costImpact = req.costImpact;
  if (req.scheduleImpact !== undefined) payload.scheduleImpact = req.scheduleImpact;
  if (req.version !== undefined) payload.version = req.version;
  if (req.importRef !== undefined) payload.importRef = req.importRef;
  return payload;
}

const numeric = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);

const RiskSchema = z.object({
  id: z.union([z.string(), z.number()]),
  projectId: numeric.nullish(),
  riskNumber: numeric.nullish(),
  riskId: nullableString,
  title: nullableString,
  description: nullableString,
  category: nullableString,
  subCategory: nullableString,
  status: nullableString,
  owner: nullableString,
  probability: nullableString,
  impact: nullableString,
  riskScore: nullableNumber,
  residualProbability: nullableString,
  residualImpact: nullableString,
  residualScore: nullableNumber,
  responseType: nullableString,
  contingencyPlan: nullableString,
  identifiedDate: backendDate,
  reviewDate: backendDate,
  closedDate: backendDate,
  costImpact: money,
  scheduleImpact: nullableNumber,
  version: numeric.nullish(),
  createdAt: backendDate,
  updatedAt: backendDate,
});

function oneOf<T extends string>(values: readonly T[], raw: string | null | undefined, fallback: T): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Parses one risk. Only `id` is required. A value outside a vocabulary reads
 * as that vocabulary's middle or first value, so a code the backend adds
 * later still renders.
 *
 * @throws {Error} If `id` is missing.
 */
export function parseRisk(json: unknown): Risk {
  const raw = RiskSchema.parse(json);
  const probability = oneOf(RISK_PROBABILITIES, raw.probability, 'medium');
  const impact = oneOf(RISK_IMPACTS, raw.impact, 'moderate');
  const residualProbability = oneOf(RISK_PROBABILITIES, raw.residualProbability, 'low');
  const residualImpact = oneOf(RISK_IMPACTS, raw.residualImpact, 'minor');
  const riskNumber = raw.riskNumber ?? 0;
  return {
    id: String(raw.id),
    projectId: raw.projectId ?? 0,
    riskNumber,
    riskId: raw.riskId ?? formatRiskNumber(riskNumber),
    title: raw.title ?? '',
    description: raw.description ?? undefined,
    category: raw.category ?? '',
    subCategory: raw.subCategory ?? undefined,
    status: oneOf(RISK_STATUSES, raw.status, 'identified'),
    owner: raw.owner ?? undefined,
    probability,
    impact,
    riskScore: raw.riskScore ?? riskScore(probability, impact),
    residualProbability,
    residualImpact,
    residualScore: raw.residualScore ?? riskScore(residualProbability, residualImpact),
    responseType: oneOf(RISK_RESPONSE_TYPES, raw.responseType, 'mitigate'),
    contingencyPlan: raw.contingencyPlan ?? undefined,
    identifiedDate: raw.identifiedDate ?? undefined,
    reviewDate: raw.reviewDate ?? undefined,
    closedDate: raw.closedDate ?? undefined,
    costImpact: raw.costImpact ?? undefined,
    scheduleImpact: raw.scheduleImpact ?? undefined,
    version: raw.version ?? 0,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}
