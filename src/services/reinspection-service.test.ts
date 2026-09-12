/**
 * The reinspection and event-log clients. Every test fails without the
 * code: the services do not exist on `development`, and the NCR verify
 * body has no `reinspectionId` field.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { ReinspectionOutcome } from '../types/inspection';
import { inspectionEventService } from './inspection-event-service';
import { ncrService } from './ncr-service';
import { reinspectionService } from './reinspection-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const NCR = '22222222-2222-2222-2222-222222222222';
const ATTEMPT = '11111111-1111-1111-1111-111111111111';
const DEFECT = '55555555-5555-5555-5555-555555555555';

const row: Raw = {
  id: ATTEMPT,
  ncrId: NCR,
  originalInspectionId: '33333333-3333-3333-3333-333333333333',
  reinspectionInspectionId: '44444444-4444-4444-4444-444444444444',
  sequence: 1,
  outcome: 'pending',
};

const ncrRow: Raw = {
  id: NCR,
  inspectionId: '33333333-3333-3333-3333-333333333333',
  status: 'verified',
};

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('reinspectionService', () => {
  test('lists the attempts on an NCR from the NCR controller', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([row, { ...row, sequence: 2 }]);
    const attempts = await reinspectionService.getByNcr(NCR);
    expect(get).toHaveBeenCalledWith(`/ncrs/web/${NCR}/reinspections`);
    expect(attempts.map((a) => a.sequence)).toEqual([1, 2]);
  });

  test('schedules from an NCR with an always-present body', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(row);
    await reinspectionService.scheduleForNcr(NCR);
    expect(post).toHaveBeenCalledWith(`/ncrs/web/${NCR}/reinspections`, {});
    await reinspectionService.scheduleForNcr(NCR, {
      assignedInspectorId: 8,
      targetDate: '2026-09-20',
    });
    expect(post).toHaveBeenLastCalledWith(`/ncrs/web/${NCR}/reinspections`, {
      assignedInspectorId: 8,
      targetDate: '2026-09-20',
    });
  });

  test('schedules from a defect through the inspection controller', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ ...row, ncrId: null, defectId: DEFECT });
    const attempt = await reinspectionService.scheduleForDefect(DEFECT, {
      copyAllItems: true,
    });
    expect(post).toHaveBeenCalledWith(
      `/inspections/web/defects/${DEFECT}/reinspections`,
      { copyAllItems: true }
    );
    expect(attempt.defectId).toBe(DEFECT);
    expect(attempt.ncrId).toBeUndefined();
  });

  test('records the outcome in lower case', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ ...row, outcome: 'passed' });
    const attempt = await reinspectionService.recordOutcome(ATTEMPT, {
      outcome: ReinspectionOutcome.PASSED,
      remarks: 'Conforms.',
    });
    expect(post).toHaveBeenCalledWith(
      `/inspections/web/reinspections/${ATTEMPT}/outcome`,
      { outcome: 'passed', remarks: 'Conforms.' }
    );
    expect(attempt.outcome).toBe(ReinspectionOutcome.PASSED);
  });

  test('fetches one attempt by id', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(row);
    await reinspectionService.getById(ATTEMPT);
    expect(get).toHaveBeenCalledWith(`/inspections/web/reinspections/${ATTEMPT}`);
  });
});

describe('ncrService.verify with a reinspection', () => {
  test('names the passed attempt the verification rests on', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(ncrRow);
    await ncrService.verify(NCR, { remarks: 'Accepted.', reinspectionId: ATTEMPT });
    expect(post).toHaveBeenCalledWith(`/ncrs/web/${NCR}/verify`, {
      remarks: 'Accepted.',
      reinspectionId: ATTEMPT,
    });
  });

  test('a bare verification still sends a body', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(ncrRow);
    await ncrService.verify(NCR);
    expect(post).toHaveBeenCalledWith(`/ncrs/web/${NCR}/verify`, {});
  });
});

describe('inspectionEventService', () => {
  const eventRow: Raw = {
    id: ATTEMPT,
    subjectId: NCR,
    subjectType: 'NCR',
    eventType: 'ncr.verified',
    actorType: 'USER',
    actorId: '7',
    occurredAt: '2026-09-12T09:00:00',
  };

  test('keeps the page envelope of an inspection timeline', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [eventRow],
      totalElements: 41,
      totalPages: 3,
      number: 1,
      size: 20,
    });
    const page = await inspectionEventService.getByInspection(NCR, {
      page: 1,
      size: 20,
    });
    expect(get).toHaveBeenCalledWith(`/inspections/web/${NCR}/events`, {
      page: 1,
      size: 20,
    });
    expect(page.totalElements).toBe(41);
    expect(page.totalPages).toBe(3);
    expect(page.number).toBe(1);
    expect(page.content[0].eventType).toBe('ncr.verified');
  });

  test('reads an NCR timeline from the NCR controller', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
    const page = await inspectionEventService.getByNcr(NCR);
    expect(get).toHaveBeenCalledWith(`/ncrs/web/${NCR}/events`, {});
    expect(page.content).toEqual([]);
    expect(page.totalPages).toBe(0);
  });

  test('passes every filter of the project-wide query and nothing unset', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
    await inspectionEventService.query({
      projectId: 4,
      subjectType: 'NCR',
      eventType: 'ncr.verified',
      page: 0,
    });
    expect(get).toHaveBeenCalledWith('/inspections/web/events', {
      page: 0,
      projectId: 4,
      subjectType: 'NCR',
      eventType: 'ncr.verified',
    });
  });

  test('a malformed body is an empty page, not a crash', async () => {
    spyOn(api, 'get').mockResolvedValue({ message: 'nope' });
    const page = await inspectionEventService.getByNcr(NCR);
    expect(page.content).toEqual([]);
    expect(page.totalElements).toBe(0);
  });
});
