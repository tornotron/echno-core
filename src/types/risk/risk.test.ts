import { describe, expect, test } from 'bun:test';
import { formatRiskNumber, parseRisk, riskRequestToJson, riskScore } from './risk';

const ID = '4f1c0d6e-2b7a-4c55-9d38-1a2b3c4d5e6f';

describe('parseRisk', () => {
  test('parses a full payload', () => {
    const risk = parseRisk({
      id: ID,
      projectId: 42,
      riskNumber: 7,
      riskId: 'R-007',
      title: 'Late drawings',
      description: null,
      category: 'design-engineering',
      subCategory: 'Incomplete or delayed design',
      status: 'identified',
      owner: 'Ravi Kumar',
      probability: 'medium',
      impact: 'major',
      riskScore: 12,
      residualProbability: 'low',
      residualImpact: 'minor',
      residualScore: 4,
      responseType: 'mitigate',
      identifiedDate: '2026-10-01',
      costImpact: 250000.5,
      scheduleImpact: 14,
      version: 3,
    });
    expect(risk.id).toBe(ID);
    expect(risk.riskId).toBe('R-007');
    expect(risk.description).toBeUndefined();
    expect(risk.subCategory).toBe('Incomplete or delayed design');
    expect(risk.riskScore).toBe(12);
    expect(risk.costImpact).toBe(250000.5);
    expect(risk.version).toBe(3);
  });

  test('reads an unknown code as a known one and derives what is missing', () => {
    const risk = parseRisk({ id: ID, riskNumber: 2, status: 'escalated', probability: 'likely' });
    expect(risk.status).toBe('identified');
    expect(risk.probability).toBe('medium');
    expect(risk.riskId).toBe('R-002');
    expect(risk.riskScore).toBe(9);
  });

  test('throws without an id', () => {
    expect(() => parseRisk({ title: 'No id' })).toThrow();
  });
});

describe('riskScore and formatRiskNumber', () => {
  test('score is the product of the two scales', () => {
    expect(riskScore('very-low', 'negligible')).toBe(1);
    expect(riskScore('very-high', 'catastrophic')).toBe(25);
    expect(riskScore('high', 'moderate')).toBe(12);
  });

  test('numbers pad to three digits and then grow', () => {
    expect(formatRiskNumber(7)).toBe('R-007');
    expect(formatRiskNumber(1000)).toBe('R-1000');
  });
});

describe('riskRequestToJson', () => {
  test('sends the required fields and only the optional ones that are set', () => {
    expect(
      riskRequestToJson({
        title: 'Late drawings',
        category: 'design-engineering',
        status: 'identified',
        probability: 'medium',
        impact: 'major',
        residualProbability: 'low',
        residualImpact: 'minor',
        responseType: 'mitigate',
        subCategory: 'Typed by hand',
        version: 2,
      })
    ).toEqual({
      title: 'Late drawings',
      category: 'design-engineering',
      status: 'identified',
      probability: 'medium',
      impact: 'major',
      residualProbability: 'low',
      residualImpact: 'minor',
      responseType: 'mitigate',
      subCategory: 'Typed by hand',
      version: 2,
    });
  });
});
