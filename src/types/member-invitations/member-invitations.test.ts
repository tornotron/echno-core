import { describe, expect, test } from 'bun:test';
import {
  createMemberInvitationToJson,
  isMemberInvitationOpen,
  parseMemberInvitation,
} from './member-invitations';

const backendShape = {
  id: '6f1c2a4e-1d1b-4c55-9a43-2f7d0d3b9e10',
  email: 'ravi.kumar@example.com',
  status: 'PENDING',
  expiresAt: '2026-11-15T06:30:00Z',
  sentAt: null,
  acceptedAt: null,
  revokedAt: null,
  createdAt: '2026-11-08T06:30:00Z',
  invitedByUserId: 7,
  roles: [
    { roleId: 'a3b1d6f0-0d7e-4c21-8e5f-0e2a9c1b7d44', projectId: null },
    { roleId: 'c8e2f4a1-5b3d-4e6f-9a7b-1c2d3e4f5a6b', projectId: 12 },
  ],
  employee: {
    designation: 'Site Engineer',
    department: 'Civil',
    joiningDate: '2026-12-01T00:00:00',
    employeeId: 'EMP-0042',
    salary: 65000,
    managerId: 5,
    shiftTimingId: null,
    status: 'active',
    employeeName: null,
    email: null,
    phone: null,
  },
};

describe('parseMemberInvitation boundary validation', () => {
  test('parses the backend shape', () => {
    const invitation = parseMemberInvitation(backendShape);
    expect(invitation.id).toBe(backendShape.id);
    expect(invitation.status).toBe('PENDING');
    expect(invitation.expiresAt?.toISOString()).toBe('2026-11-15T06:30:00.000Z');
    expect(invitation.sentAt).toBeUndefined();
    expect(invitation.invitedByUserId).toBe(7);
    expect(invitation.roles).toEqual([
      { roleId: 'a3b1d6f0-0d7e-4c21-8e5f-0e2a9c1b7d44', projectId: undefined },
      { roleId: 'c8e2f4a1-5b3d-4e6f-9a7b-1c2d3e4f5a6b', projectId: 12 },
    ]);
    expect(invitation.employee.designation).toBe('Site Engineer');
    expect(invitation.employee.managerId).toBe(5);
    expect(invitation.employee.shiftTimingId).toBeUndefined();
  });

  test('reads the joining date as the local calendar date it was written as', () => {
    const joining = parseMemberInvitation(backendShape).employee.joiningDate;
    expect(joining?.getFullYear()).toBe(2026);
    expect(joining?.getMonth()).toBe(11);
    expect(joining?.getDate()).toBe(1);
  });

  test('reads every stage the backend publishes', () => {
    for (const status of ['PENDING', 'ACCEPTED', 'ACCEPTED_BY_ANOTHER_ADDRESS', 'EXPIRED', 'REVOKED'] as const) {
      expect(parseMemberInvitation({ ...backendShape, status }).status).toBe(status);
    }
  });

  test('reads a stage it does not know as UNKNOWN, never as pending', () => {
    expect(parseMemberInvitation({ ...backendShape, status: 'ON_HOLD' }).status).toBe('UNKNOWN');
    expect(parseMemberInvitation({ ...backendShape, status: null }).status).toBe('UNKNOWN');
  });

  test('reads missing roles and employee details as empty', () => {
    const { roles: _r, employee: _e, ...bare } = backendShape;
    const invitation = parseMemberInvitation(bare);
    expect(invitation.roles).toEqual([]);
    expect(invitation.employee.status).toBe('active');
  });

  test('rejects a payload without an id or an address', () => {
    const { id: _i, ...noId } = backendShape;
    const { email: _m, ...noEmail } = backendShape;
    expect(() => parseMemberInvitation(noId)).toThrow();
    expect(() => parseMemberInvitation(noEmail)).toThrow();
  });
});

describe('createMemberInvitationToJson', () => {
  test('sends the three fields InvitationCreationDto has', () => {
    const json = createMemberInvitationToJson({
      email: '  ravi.kumar@example.com ',
      roles: [{ roleId: 'r-1' }, { roleId: 'r-2', projectId: 12 }],
      employee: {
        designation: 'Site Engineer',
        department: 'Civil',
        joiningDate: new Date(2026, 11, 1),
        managerId: 5,
      },
    });
    expect(Object.keys(json).sort()).toEqual(['email', 'employee', 'roles']);
    expect(json.email).toBe('ravi.kumar@example.com');
    expect(json.roles).toEqual([{ roleId: 'r-1' }, { roleId: 'r-2', projectId: 12 }]);
    expect(json.employee).toEqual({
      status: 'active',
      designation: 'Site Engineer',
      department: 'Civil',
      joiningDate: '2026-12-01T00:00:00',
      managerId: 5,
    });
  });

  test('keeps a status the caller chose', () => {
    const json = createMemberInvitationToJson({
      email: 'a@example.com',
      roles: [],
      employee: { status: 'probation' },
    });
    expect(json.employee).toEqual({ status: 'probation' });
  });
});

describe('isMemberInvitationOpen', () => {
  test('a pending or expired invitation can be resent or revoked', () => {
    expect(isMemberInvitationOpen({ status: 'PENDING' })).toBe(true);
    expect(isMemberInvitationOpen({ status: 'EXPIRED' })).toBe(true);
  });

  test('an accepted, revoked or unknown one cannot', () => {
    for (const status of ['ACCEPTED', 'ACCEPTED_BY_ANOTHER_ADDRESS', 'REVOKED', 'UNKNOWN'] as const) {
      expect(isMemberInvitationOpen({ status })).toBe(false);
    }
  });
});
