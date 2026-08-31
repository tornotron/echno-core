/**
 * Who the server thinks made a request, and why the client stopped telling it.
 *
 * Four create payloads used to name their own actor: an issue said who raised it, a comment said
 * who wrote it, a task said who created it, and a leave approval said who approved. The backend
 * took each of those at face value, which is a value the caller chose rather than evidence of
 * anything. It now resolves all four from the subject claim of the access token instead, and the
 * request DTOs no longer declare the fields at all.
 *
 * That change is safe in both directions, which is why the client can follow it at its own pace
 * rather than in lockstep. Spring Boot's auto-configured mapper leaves `FAIL_ON_UNKNOWN_PROPERTIES`
 * off and nothing in the backend turns it back on, so a published core still sending these keys is
 * ignored rather than refused. The reverse holds too: none of the four is required any more, so a
 * client that omits them is complete. There is no window in which either side is broken, and so no
 * shim to add and later remove.
 *
 * The keys are dropped from the payloads here. Whether they stay on the request interfaces is
 * decided per field by whether the client itself still reads the value:
 *
 * - `creatorId` on issue and task, and `authorId` on a comment, become optional and deprecated.
 *   Nothing on this side reads them.
 * - `approverId` on a leave action stays required. It never reaches the wire, but the three
 *   mutation success handlers use it to drop the request from that approver's pending list without
 *   a refetch. Same shape as `employeeId` on the leave-request create call.
 *
 * Nothing is deleted outright, because removing a property from a request interface is a compile
 * break for every caller on a published core, and there is nothing to gain by making this move a
 * breaking one.
 */
import { describe, expect, test } from 'bun:test';

import {
  createIssueToJson,
  createIssueCommentToJson,
} from './issue/issue-create';
import { IssueType } from './issue/issue-type';
import { createTaskToJson } from './task/task-create';
import { approvalActionToJson } from './leave/leave-approval';

describe('the server resolves the actor from the token', () => {
  test('createIssueToJson names no creator', () => {
    const body = createIssueToJson({
      title: 'Cracked screed on level 3',
      issueType: IssueType.quality,
      projectId: 4,
      creatorId: 7,
    });

    // Neither the client's name for it nor the backend's former name for it.
    expect(Object.hasOwn(body, 'createdById')).toBe(false);
    expect(Object.hasOwn(body, 'creatorId')).toBe(false);

    // The rename this serializer already carries is untouched: issueType goes out as type.
    expect(body.type).toBe(IssueType.quality);
    expect(body.projectId).toBe(4);
  });

  test('createIssueCommentToJson names no author', () => {
    const body = createIssueCommentToJson({
      issueId: 12,
      comment: 'Rectified and re-poured on the 29th.',
      authorId: 7,
    });

    expect(Object.hasOwn(body, 'authorId')).toBe(false);
    expect(body).toEqual({
      issueId: 12,
      comment: 'Rectified and re-poured on the 29th.',
    });
  });

  test('createTaskToJson names no creator, even when handed one', () => {
    // creatorId was already optional here and only emitted when set, so the assertion has to hand
    // it a value: an empty payload would pass against the old code too.
    const body = createTaskToJson({
      title: 'Strip formwork, grid C',
      projectId: 4,
      creatorId: 7,
    });

    expect(Object.hasOwn(body, 'creatorId')).toBe(false);
    expect(body.title).toBe('Strip formwork, grid C');
    expect(body.projectId).toBe(4);
  });

  test('approvalActionToJson names no approver, and still carries the action detail', () => {
    const body = approvalActionToJson({
      approverId: 7,
      comments: 'Cover is thin on the crew.',
      delegateToId: 9,
    });

    expect(Object.hasOwn(body, 'approverId')).toBe(false);

    // delegateToId is a different thing and must survive: it names the person being delegated to,
    // which the caller genuinely chooses and the server cannot infer from the token.
    expect(body).toEqual({
      comments: 'Cover is thin on the crew.',
      delegateToId: 9,
    });
  });

  test('an approval with nothing to say sends an empty body rather than an actor', () => {
    expect(approvalActionToJson({ approverId: 7 })).toEqual({});
  });
});
