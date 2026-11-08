/**
 * The observation client (core #106). Fails without the code: the service
 * does not exist on `development`.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { ApiError } from '../lib/api/api-client';
import {
  ObservationDecision,
  ObservationOutcomeKind,
  RejectReason,
  ObservationReviewStatus,
  ObservationSource,
} from '../types/inspection';
import { observationService } from './observation-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const OBS = '11111111-1111-1111-1111-111111111111';
const row: Raw = { id: OBS, title: 'Crack', source: 'drone', reviewStatus: 'pending' };

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
  (api.post as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('observationService', () => {
  test('lists a filtered page and keeps the envelope', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({
      content: [row, { ...row, id: '22222222-2222-2222-2222-222222222222' }],
      totalElements: 12,
      totalPages: 2,
      number: 1,
      size: 10,
    });
    const page = await observationService.list({
      projectId: 7,
      reviewStatus: ObservationReviewStatus.PENDING,
      source: ObservationSource.DRONE,
      page: 1,
      size: 10,
    });
    expect(get).toHaveBeenCalledWith('/inspections/web/observations', {
      projectId: 7,
      reviewStatus: 'pending',
      source: 'drone',
      page: 1,
      size: 10,
    });
    expect(page.content).toHaveLength(2);
    expect(page.totalElements).toBe(12);
    expect(page.number).toBe(1);
  });

  test('a bare array still comes back as one page', async () => {
    spyOn(api, 'get').mockResolvedValue([row]);
    const page = await observationService.list({ projectId: 7 });
    expect(page.totalPages).toBe(1);
    expect(page.content[0]?.source).toBe(ObservationSource.DRONE);
  });

  test('creates a human observation on the web controller', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ ...row, source: 'human', reviewStatus: 'accepted' });
    const created = await observationService.create({ projectId: 7, title: 'Crack', evidenceAttachmentIds: [3] });
    expect(post).toHaveBeenCalledWith('/inspections/web/observations', {
      projectId: 7,
      title: 'Crack',
      evidenceAttachmentIds: [3],
    });
    expect(created.reviewStatus).toBe(ObservationReviewStatus.ACCEPTED);
  });

  test('posts the decision to the review path', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ ...row, reviewStatus: 'accepted', outcomeKind: 'none' });
    const reviewed = await observationService.review(OBS, {
      decision: ObservationDecision.ACCEPT,
      outcome: { kind: ObservationOutcomeKind.NONE },
    });
    expect(post).toHaveBeenCalledWith(`/inspections/web/observations/${OBS}/review`, {
      decision: 'accept',
      outcome: { kind: 'none' },
    });
    expect(reviewed.outcomeKind).toBe(ObservationOutcomeKind.NONE);
  });

  test('a rejection with no note never reaches the wire', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(row);
    await expect(
      observationService.review(OBS, { decision: ObservationDecision.REJECT })
    ).rejects.toThrow(TypeError);
    expect(post).not.toHaveBeenCalled();
  });

  test('evidence goes through the observation-owned presign and register paths', async () => {
    const post = spyOn(api, 'post').mockResolvedValue([]);
    await observationService.presignEvidence(OBS, [
      { filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 10 },
    ]);
    expect(post).toHaveBeenCalledWith(`/inspections/web/observations/${OBS}/evidence/presign`, [
      { filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 10 },
    ]);
    await observationService.registerEvidence(OBS, [{ key: 'k', filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 10 }] as Raw);
    expect(post).toHaveBeenLastCalledWith(`/inspections/web/observations/${OBS}/evidence/register`, [
      { key: 'k', filename: 'a.jpg', contentType: 'image/jpeg', fileSize: 10 },
    ]);
    const get = spyOn(api, 'get').mockResolvedValue([]);
    expect(await observationService.getEvidence(OBS)).toEqual([]);
    expect(get).toHaveBeenCalledWith(`/inspections/web/observations/${OBS}/evidence`);
  });

  test('offers no intake: machine producers use a service account, not the console', () => {
    expect(observationService).not.toHaveProperty('intake');
  });
});

describe('observationService, regions and bulk review (core #166)', () => {
  test('the model filters reach the wire, with category repeated', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
    await observationService.list({
      projectId: 7,
      source: ObservationSource.AI,
      modelName: 'ppe',
      modelVersion: '0.1.0',
      categories: ['ppe_helmet', 'ppe_vest'],
      minConfidence: 0.3,
      maxConfidence: 0.9,
      hasRegions: true,
      attachmentId: 18342,
      sortByConfidence: 'asc',
    });
    expect(get).toHaveBeenCalledWith('/inspections/web/observations', {
      projectId: 7,
      source: 'ai',
      modelName: 'ppe',
      modelVersion: '0.1.0',
      category: ['ppe_helmet', 'ppe_vest'],
      minConfidence: 0.3,
      maxConfidence: 0.9,
      hasRegions: true,
      attachmentId: 18342,
      sort: 'confidence,asc',
    });
  });

  test('an empty category list and an unset hasRegions send nothing', async () => {
    const get = spyOn(api, 'get').mockResolvedValue({ content: [] });
    await observationService.list({ projectId: 7, categories: [], hasRegions: false });
    expect(get).toHaveBeenCalledWith('/inspections/web/observations', {
      projectId: 7,
      hasRegions: false,
    });
  });

  test('getById asks for retired regions only when told to', async () => {
    const get = spyOn(api, 'get').mockResolvedValue(row);
    await observationService.getById(OBS, { includeRetiredRegions: true });
    expect(get).toHaveBeenCalledWith(`/inspections/web/observations/${OBS}`, {
      includeRetiredRegions: true,
    });
    await observationService.getById(OBS);
    expect(get).toHaveBeenLastCalledWith(`/inspections/web/observations/${OBS}`);
  });

  test('reviewBatch posts the decision and parses each result', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({
      batchId: '99999999-9999-9999-9999-999999999999',
      results: [{ observationId: OBS, status: 'REVIEWED' }],
    });
    const result = await observationService.reviewBatch({
      decision: ObservationDecision.REJECT,
      observationIds: [OBS],
      note: 'Shadows',
      rejectReason: RejectReason.FALSE_POSITIVE,
    });
    expect(post).toHaveBeenCalledWith('/inspections/web/observations/review-batch', {
      decision: 'reject',
      observationIds: [OBS],
      note: 'Shadows',
      rejectReason: 'false-positive',
    });
    expect(result.results[0]?.status).toBe('REVIEWED');
  });

  test('a bulk modify is refused before the request', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({});
    await expect(
      observationService.reviewBatch({
        decision: ObservationDecision.MODIFY as ObservationDecision.ACCEPT,
        observationIds: [OBS],
      })
    ).rejects.toThrow(TypeError);
    expect(post).not.toHaveBeenCalled();
  });

  test('a malformed bulk result is a 422 ApiError', async () => {
    spyOn(api, 'post').mockResolvedValue({ results: [] });
    await expect(
      observationService.reviewBatch({
        decision: ObservationDecision.ACCEPT,
        observationIds: [OBS],
      })
    ).rejects.toBeInstanceOf(ApiError);
  });
});
