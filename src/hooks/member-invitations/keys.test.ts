import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { invitationKeys } from '../invitation/keys';
import { memberInvitationsKeys } from './keys';

const source = readFileSync(
  new URL('./use-member-invitations-mutations.ts', import.meta.url),
  'utf8'
);

describe('memberInvitationsKeys', () => {
  test('list and detail keys share the domain prefix', () => {
    expect(memberInvitationsKeys.list({ pageNo: 0 })).toEqual(['member-invitations', 'list', { pageNo: 0 }]);
    expect(memberInvitationsKeys.detail('5e0f')).toEqual(['member-invitations', 'detail', '5e0f']);
  });

  test('the root is apart from the invite-code root', () => {
    expect(memberInvitationsKeys.all[0]).not.toBe(invitationKeys.all[0]);
  });
});

describe('member invitation mutations', () => {
  test('every mutation invalidates the domain prefix', () => {
    for (const hook of ['useCreateMemberInvitation', 'useResendMemberInvitation', 'useRevokeMemberInvitation']) {
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, hook).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}\n', start));
      expect(body, hook).toInclude('onSuccess: invalidate');
    }
    expect(source).toInclude('queryKey: memberInvitationsKeys.all');
  });
});
