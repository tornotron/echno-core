/**
 * The observation client (core #106). Fails without the code: the service
 * does not exist on `development`.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import {
  ObservationDecision,
  ObservationOutcomeKind,
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
