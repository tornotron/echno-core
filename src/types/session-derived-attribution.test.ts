/**
 * Four request payloads used to name who was acting: an issue's creator, a
 * comment's author, a task's creator and a leave approver. The backend stamps
 * all four from the signed-in session now (echno-backend #598 / PR #607) and
 * `docs/openapi.json` no longer declares them, so a client that keeps sending
 * one is claiming an authorship the server will not read.
 *
 * The values were harmless while they were sent, because each was the signed-in
 * employee's own id anyway. The reason to pin them shut is what they made
 * possible rather than what they did: a payload with a field for "who did this"
 * is a payload someone can put a colleague's id into. The server closed that
 * door; these tests keep the client from wedging it back open, and they are the
 * only guard, because a serializer that emits an extra key still gets a 200
 * from Spring, which ignores what it does not recognise.
 */
import { describe, expect, test } from 'bun:test';

import {
  createIssueToJson,
  createIssueCommentToJson,
} from './issue/issue-create';
import { createTaskToJson } from './task/task-create';
import { updateTaskToJson } from './task/task-update';
import { approvalActionToJson } from './leave/leave-approval';
import { IssueType } from './issue/issue-type';

describe('payloads no longer name who is acting', () => {
  test('issue create sends no creator', () => {
    const payload = createIssueToJson({
      title: 'Honeycombing on the block A raft',
      issueType: IssueType.quality,
      projectId: 3,
      assigneeId: 8,
    });

    expect(payload).not.toHaveProperty('createdById');
    expect(payload).not.toHaveProperty('creatorId');
    // The fields that are still the caller's to set are untouched.
    expect(payload.projectId).toBe(3);
    expect(payload.assignedToId).toBe(8);
  });

  test('issue comment create sends no author', () => {
    const payload = createIssueCommentToJson({
      issueId: 12,
      comment: 'Rebar spacing corrected on the east bay.',
    });

    expect(payload).not.toHaveProperty('authorId');
    expect(payload.issueId).toBe(12);
    expect(payload.comment).toBe('Rebar spacing corrected on the east bay.');
  });

  // The task creator was already optional, so omitting it was always enough to
  // keep it off the wire. The cast is what makes this a real check: it forces
  // the value past the type and asserts the serializer drops it rather than
  // copying whatever it is handed.
  test('task create sends no creator, even when one is forced in', () => {
    const payload = createTaskToJson({
      title: 'Shutter the block B slab',
      projectId: 4,
      assigneeIds: [7],
      creatorId: 5,
    } as unknown as Parameters<typeof createTaskToJson>[0]);

    expect(payload).not.toHaveProperty('creatorId');
    expect(payload.projectId).toBe(4);
    expect(payload.assigneeIds).toEqual([7]);
  });

  // A task edit form has no creator field, so the value here was never read
  // off the loaded task: it was the editing session's own id. `TaskUpdateFieldsDto`
  // has no such property and never applied it, but the payload was still asking
  // to record whoever opened the form as the creator.
  test('task update does not ask to rewrite the creator', () => {
    const payload = updateTaskToJson({
      title: 'Shutter the block B slab',
      creatorId: 5,
    } as unknown as Parameters<typeof updateTaskToJson>[0]);

    expect(payload).not.toHaveProperty('creatorId');
    expect(payload.title).toBe('Shutter the block B slab');
  });

  test('a leave decision sends no approver', () => {
    const approved = approvalActionToJson({ comments: 'Cover arranged.' });
    expect(approved).not.toHaveProperty('approverId');
    expect(approved.comments).toBe('Cover arranged.');

    // A delegation still names the delegate, which is a real instruction and
    // not an attribution: it says where the request goes next.
    const delegated = approvalActionToJson({ delegateToId: 9 });
    expect(delegated).not.toHaveProperty('approverId');
    expect(delegated.delegateToId).toBe(9);

    // With nothing to say, the body is empty rather than carrying an id.
    expect(Object.keys(approvalActionToJson({}))).toEqual([]);
  });
});
