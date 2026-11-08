import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api, ApiError } from '../lib/api/api-client';
import { memberInvitationsService } from './member-invitations-service';

const id = '6f1c2a4e-1d1b-4c55-9a43-2f7d0d3b9e10';
const dto = {
  id,
  email: 'ravi.kumar@example.com',
  status: 'PENDING',
  expiresAt: '2026-11-15T06:30:00Z',
  createdAt: '2026-11-08T06:30:00Z',
  roles: [{ roleId: 'r-1', projectId: null }],
  employee: { status: 'active', managerId: 5 },
};

afterEach(() => {
  for (const method of ['get', 'post'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('memberInvitationsService reads', () => {
  test('list reads the collection with only the paging it was given', async () => {
    const get = spyOn(api, 'get').mockResolvedValue([dto]);
    const page = await memberInvitationsService.list({ pageNo: 1, pageSize: 20 });
    await memberInvitationsService.list();
    expect(get.mock.calls).toEqual([
      ['/invitations/web', { pageNo: 1, pageSize: 20 }],
      ['/invitations/web', {}],
    ]);
    expect(page[0].id).toBe(id);
  });

  test('list throws on a response that is not a list', async () => {
    spyOn(api, 'get').mockResolvedValue({ content: [dto] });
    await expect(memberInvitationsService.list()).rejects.toThrow(ApiError);
  });

  test('get reads one invitation by id', async () => {
    spyOn(api, 'get').mockResolvedValue(dto);
    const invitation = await memberInvitationsService.get(id);
    expect(api.get).toHaveBeenCalledWith(`/invitations/web/${id}`);
    expect(invitation.email).toBe('ravi.kumar@example.com');
  });

  test('a malformed invitation is an ApiError, never a half-parsed object', async () => {
    spyOn(api, 'get').mockResolvedValue({ email: 'no id' });
    await expect(memberInvitationsService.get(id)).rejects.toThrow(ApiError);
  });
});

describe('memberInvitationsService writes', () => {
  test('create posts the serialized body to the collection', async () => {
    const post = spyOn(api, 'post').mockResolvedValue(dto);
    await memberInvitationsService.create({
      email: 'ravi.kumar@example.com',
      roles: [{ roleId: 'r-1' }],
      employee: { managerId: 5 },
    });
    expect(post).toHaveBeenCalledWith('/invitations/web', {
      email: 'ravi.kumar@example.com',
      roles: [{ roleId: 'r-1' }],
      employee: { status: 'active', managerId: 5 },
    });
  });

  test('resend and revoke post to their actions with no body', async () => {
    const post = spyOn(api, 'post').mockResolvedValue({ ...dto, status: 'REVOKED' });
    await memberInvitationsService.resend(id);
    const revoked = await memberInvitationsService.revoke(id);
    expect(post.mock.calls).toEqual([[`/invitations/web/${id}/resend`], [`/invitations/web/${id}/revoke`]]);
    expect(revoked.status).toBe('REVOKED');
  });
});
