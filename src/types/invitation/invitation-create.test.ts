import { describe, expect, test } from 'bun:test';
import {
  GenerateInviteCodeRequest,
  generateInviteCodeToJson,
} from './invitation-create';

// A newly created employee must have a reporting manager (ClickUp 14zdkkvrf25,
// backend #823). The invite is where the manager is chosen, so the request type
// makes the caller state one, and the serializer carries it through. `null` is
// the explicit first-employee case and is left out of the body so the backend
// applies its own exemption.
describe('GenerateInviteCodeRequest.managerId', () => {
  test('is required on the request type', () => {
    // @ts-expect-error managerId is required: a new employee must have a reporting manager
    const request: GenerateInviteCodeRequest = {
      designation: 'Engineer',
      department: 'Civil',
    };
    expect(request.designation).toBe('Engineer');
  });

  test('is sent when a manager is chosen', () => {
    const payload = generateInviteCodeToJson({
      designation: 'Engineer',
      department: 'Civil',
      managerId: 5,
    });
    expect(payload.managerId).toBe(5);
  });

  test('is omitted for the first employee of an organization', () => {
    const payload = generateInviteCodeToJson({
      designation: 'Engineer',
      department: 'Civil',
      managerId: null,
    });
    expect(payload).not.toHaveProperty('managerId');
  });
});
