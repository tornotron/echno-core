/**
 * Thirteen more findings on the request contract, all the same shape as the
 * nineteen in `dropped-request-fields.test.ts`: a key this package put on the
 * wire that the endpoint receiving it has no field for. Spring leaves
 * `FAIL_ON_UNKNOWN_PROPERTIES` off, so each came back 200 with the value
 * discarded. What separates them from that sweep is that none was drift. Each
 * one has a home, and in four cases the home is somewhere else:
 *
 * - **Organization `isActive`**, on create and update. The flag is being
 *   removed rather than wired up. `Organization.isActive` has two writers, both
 *   an unconditional `true`, and no reader anywhere in the backend; the column
 *   is nullable with no default, so every seeded row is `NULL` and any check
 *   would have to read `NULL` as active, leaving the flag meaningful only in a
 *   `false` case nothing can produce. Enforcing it would put a self-service
 *   lockout on the tenant behind `system-admin` and `hr-admin`, both roles
 *   inside the organization being locked out, recoverable only through the
 *   global-admin bypass in `TenantFilter`. Tenant suspension, when it is
 *   wanted, is the subscription record, which already carries the eight states
 *   a boolean cannot express.
 *
 * - **Employee `gender`, `address`, `qualification`, `skills` and
 *   `experience`.** Real columns, on `User` rather than on `Employee`, and
 *   `PATCH /user/web/{id}` accepts all five under those exact names. So the
 *   repair is not to grow five columns on the employee endpoint but to send
 *   them to the endpoint that already has them, which is a change in echno-web
 *   rather than here.
 *
 * - **Employee `organizationId`.** Unlike the five above, this one has no other
 *   home. An employee's organization is fixed at creation and the tenant filter
 *   derives it from the caller's token, so moving an employee between
 *   organizations is not an operation the API offers, and a backend that read
 *   this off the body would be honouring a tenant the caller named for
 *   themselves.
 *
 * - **Material `openingStock`, `storageLocationId`, `projectId` and
 *   `unitCost`.** Present on creation and absent from `MaterialUpdateDto`, and
 *   the asymmetry is deliberate: the four are the coordinates of the single
 *   `OPENING_BALANCE` inventory transaction a material is created with, not
 *   editable catalogue attributes. Correcting an opening balance is a stock
 *   adjustment, which has its own endpoint and its own audit trail. The
 *   contract tool's hint that `unitCost` means `unit` is wrong: `unit` is the
 *   unit of measure, is a different field, and is still sent.
 *
 * - **Task `projectId`.** Named in `TaskService`'s own `default` branch, with
 *   no screen behind it: nothing in echno-web moves a task between projects.
 *
 * The properties stay on the request interfaces, optional and deprecated,
 * because removing one is a compile break for every caller of a published
 * package.
 *
 * Each case pins its neighbours as well as the dropped key, for the reason the
 * sibling file gives: taking a key out of an object literal is exactly the edit
 * that takes the line below it too, and the request still answers 200 either
 * way.
 */
import { describe, expect, test } from 'bun:test';

import { createOrganizationToJson } from './organization/organization-create';
import { updateOrganizationToJson } from './organization/organization-update';
import { updateEmployeeToJson } from './employee/employee-update';
import { Department } from './employee/departments';
import { EmployeeStatus } from './employee/employee-status';
import { updateMaterialToJson } from './materials/material-update';
import { updateTaskToJson } from './task/task-update';
import { TaskStatus } from './task/task-status';

describe('an organization has no active flag to set', () => {
  test('create sends no isActive', () => {
    const payload = createOrganizationToJson({
      organizationName: 'Fereydon',
      organizationAddress: 'IIT Madras Research Park',
      organizationEmail: 'info@example.com',
      organizationPhone: '+910000000000',
      organizationWebsite: 'https://example.com',
      isActive: true,
    });

    expect(payload).not.toHaveProperty('isActive');
    expect(payload.organizationName).toBe('Fereydon');
    expect(payload.organizationWebsite).toBe('https://example.com');
  });

  test('update sends no isActive', () => {
    const payload = updateOrganizationToJson({
      organizationName: 'Fereydon Private Limited',
      organizationWebsite: 'https://example.com',
      isActive: false,
    });

    expect(payload).not.toHaveProperty('isActive');
    expect(payload.organizationName).toBe('Fereydon Private Limited');
    expect(payload.organizationWebsite).toBe('https://example.com');
  });

  test('a false is dropped as surely as a true', () => {
    // The whole point of the finding is that a deactivation answered 200 and
    // changed nothing, so the falsy value is the one worth pinning.
    expect(updateOrganizationToJson({ isActive: false })).toEqual({});
  });
});

describe('an employee profile is edited through the user endpoint', () => {
  test('update sends none of the five user columns, nor organizationId', () => {
    const payload = updateEmployeeToJson({
      name: 'Priya Raman',
      designation: 'Site Engineer',
      department: Department.construction,
      status: EmployeeStatus.active,
      managerId: 4,
      gender: 'female',
      address: '12 Mount Road, Chennai',
      qualification: 'B.E. Civil',
      skills: ['formwork', 'survey'],
      experience: 6,
      organizationId: 2,
    });

    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('qualification');
    expect(payload).not.toHaveProperty('skills');
    expect(payload).not.toHaveProperty('experience');
    expect(payload).not.toHaveProperty('organizationId');

    // The neighbours. `employeeName` and `emailAddress` are renames rather
    // than passthroughs, so a sweep through this serializer could lose the
    // rename as easily as the key.
    expect(payload.employeeName).toBe('Priya Raman');
    expect(payload.designation).toBe('Site Engineer');
    expect(payload.department).toBe(Department.construction);
    expect(payload.status).toBe(EmployeeStatus.active);
    expect(payload.managerId).toBe(4);
  });

  test('a narrow patch of only the moved keys sends an empty body', () => {
    expect(updateEmployeeToJson({ gender: 'male', experience: 3 })).toEqual({});
  });
});

describe('an opening balance is corrected by a stock adjustment', () => {
  test('update sends none of the four opening-balance coordinates', () => {
    const payload = updateMaterialToJson({
      materialName: 'OPC 53 cement',
      unit: 'bag',
      minStock: 50,
      reorderLevel: 80,
      openingStock: 120,
      storageLocationId: 9,
      projectId: 3,
      unitCost: 410,
    });

    expect(payload).not.toHaveProperty('openingStock');
    expect(payload).not.toHaveProperty('storageLocationId');
    expect(payload).not.toHaveProperty('projectId');
    expect(payload).not.toHaveProperty('unitCost');

    // `unit` is the neighbour the contract tool confuses `unitCost` with, so
    // it is the one that must survive.
    expect(payload.unit).toBe('bag');
    expect(payload.materialName).toBe('OPC 53 cement');
    expect(payload.minStock).toBe(50);
    expect(payload.reorderLevel).toBe(80);
  });

  test('an explicit null clears nothing either, since the key never leaves', () => {
    // Three of the four are `number | null` on the interface, so a caller
    // clearing one has to be told the same thing as a caller setting one.
    expect(
      updateMaterialToJson({
        openingStock: null,
        storageLocationId: null,
        projectId: null,
      })
    ).toEqual({});
  });
});

describe('a task does not move between projects', () => {
  test('update sends no projectId', () => {
    const payload = updateTaskToJson({
      title: 'Pour foundation slab, block A',
      status: TaskStatus.onGoing,
      progress: 0.4,
      projectId: 12,
    });

    expect(payload).not.toHaveProperty('projectId');
    expect(payload.title).toBe('Pour foundation slab, block A');
    expect(payload.status).toBe(TaskStatus.onGoing);
    expect(payload.progress).toBe(0.4);
  });
});
