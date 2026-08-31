/**
 * Nineteen findings on the request contract were the same shape: a key this
 * package put on the wire that the endpoint receiving it has no field for.
 * Spring leaves `FAIL_ON_UNKNOWN_PROPERTIES` off, so every one of them came
 * back 200 with the value discarded, which is why none of them ever surfaced
 * as a bug report. The client stops sending them.
 *
 * Three are worth naming, because the obvious repair is the wrong one:
 *
 * - A project's `organizationId` must not be honoured. `ProjectService` takes
 *   the organization from the tenant on the request context. A backend that
 *   read it off the body would let a caller file a project into an
 *   organization they are not in.
 * - A storage location's `projectName` is not a misspelt `projectId`. The id
 *   is sent alongside and the association works; the name is a read-side
 *   flattening that was being echoed back on write.
 * - An issue's `projectId` on create stays on the interface even though it
 *   leaves the payload, because `useCreateIssue` reads it to append the new
 *   issue to the right project's cached list.
 *
 * The properties themselves stay on the request interfaces, optional and
 * deprecated, because removing one is a compile break for every caller of a
 * published package.
 *
 * Each case pins its neighbours as well as the dropped key. Taking a key out
 * of an object literal is exactly the edit that takes the line below it too,
 * and a serializer that quietly stopped sending `projectId` alongside
 * `projectName` would leave no other trace: the request still succeeds, and
 * the field it needed is simply absent.
 */
import { describe, expect, test } from 'bun:test';

import { createIssueToJson } from './issue/issue-create';
import { IssueType } from './issue/issue-type';
import { createProjectToJson } from './project/project-create';
import { updateProjectToJson } from './project/project-update';
import { ProjectStatus } from './project/project-status';
import { updateIndentToJson } from './indents/indent-update';
import { IndentStatus } from './indents/enums';
import { createStorageLocationToJson } from './storage-locations/storage-location-create';
import { updateStorageLocationToJson } from './storage-locations/storage-location-update';
import { StorageLocationType } from './storage-locations/storage-location';
import { createOrganizationToJson } from './organization/organization-create';

describe('a project belongs to the tenant, not to the payload', () => {
  test('create sends no organizationId', () => {
    const payload = createProjectToJson({
      projectName: 'Riverside Tower',
      projectAddress: '12 Mount Road',
      organizationId: 4,
      projectState: 'Tamil Nadu',
      status: ProjectStatus.upcoming,
    });

    expect(payload).not.toHaveProperty('organizationId');
    expect(payload.projectName).toBe('Riverside Tower');
    expect(payload.projectAddress).toBe('12 Mount Road');
    expect(payload.projectState).toBe('Tamil Nadu');
    expect(payload.status).toBe(ProjectStatus.upcoming);
  });

  test('update sends no organizationId', () => {
    const payload = updateProjectToJson({
      organizationId: 4,
      projectName: 'Riverside Tower East',
      projectCity: 'Chennai',
    });

    expect(payload).not.toHaveProperty('organizationId');
    expect(payload.projectName).toBe('Riverside Tower East');
    expect(payload.projectCity).toBe('Chennai');
  });
});

describe('project membership is its own pair of routes', () => {
  test('create sends no employees list', () => {
    const payload = createProjectToJson({
      projectName: 'Riverside Tower',
      projectAddress: '12 Mount Road',
      memberIds: [7, 9],
      projectPostalCode: '600004',
    });

    // `memberIds` used to be renamed to `employees` on the way out, so both
    // names have to be absent for the key to be genuinely gone.
    expect(payload).not.toHaveProperty('employees');
    expect(payload).not.toHaveProperty('memberIds');
    expect(payload.projectName).toBe('Riverside Tower');
    expect(payload.projectPostalCode).toBe('600004');
  });

  test('update sends no employees list', () => {
    const payload = updateProjectToJson({
      memberIds: [7, 9],
      status: ProjectStatus.open,
    });

    expect(payload).not.toHaveProperty('employees');
    expect(payload).not.toHaveProperty('memberIds');
    expect(payload.status).toBe(ProjectStatus.open);
  });
});

describe('an indent line item is edited through its own route', () => {
  test('update sends no items array', () => {
    const payload = updateIndentToJson({
      status: IndentStatus.ordered,
      remarks: 'Cleared by the site engineer',
      projectId: 3,
      expectedOn: '2026-09-15',
      items: [{ materialId: 1, requestedQuantity: 20 }],
    });

    expect(payload).not.toHaveProperty('items');
    expect(payload.status).toBe(IndentStatus.ordered);
    expect(payload.remarks).toBe('Cleared by the site engineer');
    expect(payload.projectId).toBe(3);
    expect(payload.expectedOn).toBe('2026-09-15');
  });
});

describe('a storage location names its project by id', () => {
  test('create sends projectId and not projectName', () => {
    const payload = createStorageLocationToJson({
      locationName: 'Block A store',
      locationType: StorageLocationType.PROJECT_SITE,
      projectId: 3,
      projectName: 'Riverside Tower',
      capacity: 500,
    });

    expect(payload).not.toHaveProperty('projectName');
    // The id is the whole association. If dropping the name took this with
    // it, every location created afterwards would be unattached.
    expect(payload.projectId).toBe(3);
    expect(payload.locationName).toBe('Block A store');
    expect(payload.capacity).toBe(500);
  });

  test('update sends projectId and not projectName', () => {
    const payload = updateStorageLocationToJson({
      projectId: 5,
      projectName: 'Riverside Tower',
      locationName: 'Block B store',
    });

    expect(payload).not.toHaveProperty('projectName');
    expect(payload.projectId).toBe(5);
    expect(payload.locationName).toBe('Block B store');
  });
});

describe('an organization takes its owner from the token', () => {
  test('create sends no creatorId', () => {
    const payload = createOrganizationToJson({
      organizationName: 'Fereydon',
      organizationAddress: 'IIT Madras Research Park',
      organizationEmail: 'info@example.com',
      organizationPhone: '+910000000000',
      creatorId: 11,
      organizationWebsite: 'https://example.com',
    });

    expect(payload).not.toHaveProperty('creatorId');
    expect(payload.organizationName).toBe('Fereydon');
    expect(payload.organizationAddress).toBe('IIT Madras Research Park');
    expect(payload.organizationEmail).toBe('info@example.com');
    expect(payload.organizationPhone).toBe('+910000000000');
    expect(payload.organizationWebsite).toBe('https://example.com');
  });
});

describe("an issue's project comes from its task", () => {
  test('create sends taskId and not projectId', () => {
    const payload = createIssueToJson({
      title: 'Honeycombing on the block A raft',
      issueType: IssueType.quality,
      projectId: 3,
      taskId: 17,
      assigneeId: 8,
    });

    expect(payload).not.toHaveProperty('projectId');
    // `taskId` is what the backend walks to reach the project, so losing it
    // alongside `projectId` would leave the issue attached to nothing.
    expect(payload.taskId).toBe(17);
    expect(payload.type).toBe(IssueType.quality);
    expect(payload.assignedToId).toBe(8);
  });
});
