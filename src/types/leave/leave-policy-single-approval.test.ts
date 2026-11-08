/**
 * Leave goes to the employee's immediate manager alone (ClickUp 14zdkkvzx68), and the backend no
 * longer has a per-policy multi-level toggle. A caller that still sets the retired field must not
 * put it on the wire, where the request contract would no longer recognise it.
 */
import { describe, expect, test } from 'bun:test';

import { createLeavePolicyToJson } from './leave-policy-create';
import { updateLeavePolicyToJson } from './leave-policy-update';

describe('the retired multi-level approval toggle', () => {
  test('create leaves it out of the payload', () => {
    const payload = createLeavePolicyToJson({
      organizationId: 2,
      leaveTypeCode: 'CASUAL',
      leaveTypeName: 'Casual leave',
      annualQuota: 12,
      multiLevelApprovalEnabled: true,
    });

    expect(payload).not.toHaveProperty('multiLevelApprovalEnabled');
    expect(payload.leaveTypeCode).toBe('CASUAL');
  });

  test('update leaves it out of the payload', () => {
    const payload = updateLeavePolicyToJson({
      annualQuota: 10,
      multiLevelApprovalEnabled: false,
    });

    expect(payload).not.toHaveProperty('multiLevelApprovalEnabled');
    expect(payload.annualQuota).toBe(10);
  });
});
