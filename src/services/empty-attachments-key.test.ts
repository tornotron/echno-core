/**
 * Six of the request-contract findings were the same line, copied across three
 * services: when a create or update had no files to upload, the JSON half of
 * the multipart body got an `attachments: []` key added to it.
 *
 * Every doc comment that described the line said it told the backend that no
 * files had been uploaded, or separated "no upload" from "untouched". None of
 * that was true. Files reach these endpoints as their own multipart part and
 * the controllers read them from a `@RequestParam`, so the JSON key is not
 * something the backend looks at on the way in. On create there is no
 * `attachments` property on `ProjectCreationDto`, `TaskCreationDto` or
 * `IssueCreationDto` for it to bind to; on update the handler switches over
 * the keys it was given and names `attachments` in the branch it deliberately
 * drops. The two cases the key was supposed to separate were always the same
 * request.
 *
 * These tests read the payload out of the multipart call rather than the
 * serializer, because the key was added in the service after serialization,
 * which is why the serializer tests never saw it.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { issueService } from './issue-service';
import { projectService } from './project-service';
import { taskService } from './task-service';
import { IssueType } from '../types/issue/issue-type';
import { ProjectStatus } from '../types/project/project-status';
import { TaskStatus } from '../types/task/task-status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/**
 * The parsers reject a payload they cannot read, and every call here goes
 * through one, so the stub has to be a plausible entity rather than `{}`.
 */
const rawProject: Raw = {
  id: 1,
  projectName: 'Riverside Tower',
  projectAddress: '12 Mount Road',
  status: 'upcoming',
};

const rawTask: Raw = {
  id: 1,
  title: 'Pour the block A raft',
  description: '',
  projectId: 3,
  status: 'onGoing',
  progress: 0,
};

const rawIssue: Raw = {
  id: 1,
  title: 'Honeycombing on the block A raft',
  type: 'quality',
  status: 'open',
};

afterEach(() => {
  (
    api.postMultipart as unknown as { mockRestore?: () => void }
  ).mockRestore?.();
  (
    api.patchMultipart as unknown as { mockRestore?: () => void }
  ).mockRestore?.();
});

/** The JSON payload the service handed to the multipart call. */
function bodyOf(spy: {
  mock: { calls: unknown[][] };
}): Record<string, unknown> {
  return spy.mock.calls[0]?.[1] as Record<string, unknown>;
}

describe('a create with no files adds no attachments key', () => {
  test('project create', async () => {
    const post = spyOn(api, 'postMultipart').mockResolvedValue(rawProject);

    await projectService.createWithFiles(
      {
        projectName: 'Riverside Tower',
        projectAddress: '12 Mount Road',
        status: ProjectStatus.upcoming,
      },
      {}
    );

    const body = bodyOf(post);
    expect(body).not.toHaveProperty('attachments');
    expect(body.projectName).toBe('Riverside Tower');
    expect(body.projectAddress).toBe('12 Mount Road');
    // No files means no file map either, which is the part that was always
    // doing the work.
    expect(post.mock.calls[0]?.[2]).toBeUndefined();
  });

  test('task create', async () => {
    const post = spyOn(api, 'postMultipart').mockResolvedValue(rawTask);

    await taskService.create({
      title: 'Pour the block A raft',
      projectId: 3,
      categoryId: 2,
      progress: 0,
    });

    const body = bodyOf(post);
    expect(body).not.toHaveProperty('attachments');
    expect(body.title).toBe('Pour the block A raft');
    expect(body.projectId).toBe(3);
    expect(body.categoryId).toBe(2);
  });

  test('issue create', async () => {
    const post = spyOn(api, 'postMultipart').mockResolvedValue(rawIssue);

    await issueService.create({
      title: 'Honeycombing on the block A raft',
      issueType: IssueType.quality,
      taskId: 17,
    });

    const body = bodyOf(post);
    expect(body).not.toHaveProperty('attachments');
    expect(body.title).toBe('Honeycombing on the block A raft');
    expect(body.type).toBe(IssueType.quality);
    expect(body.taskId).toBe(17);
  });
});

describe('an update with no files adds no attachments key', () => {
  test('project update', async () => {
    const patch = spyOn(api, 'patchMultipart').mockResolvedValue(rawProject);

    await projectService.updateWithFiles(
      1,
      { projectName: 'Riverside Tower East' },
      {}
    );

    const body = bodyOf(patch);
    expect(body).not.toHaveProperty('attachments');
    expect(body.projectName).toBe('Riverside Tower East');
    // An update payload is a whitelist of what the caller changed, so an
    // extra key here is the one thing that can make it say more than it meant.
    expect(Object.keys(body)).toEqual(['projectName']);
  });

  test('task update', async () => {
    const patch = spyOn(api, 'patchMultipart').mockResolvedValue(rawTask);

    await taskService.update(1, { status: TaskStatus.completed, progress: 100 });

    const body = bodyOf(patch);
    expect(body).not.toHaveProperty('attachments');
    expect(body.status).toBe(TaskStatus.completed);
    expect(body.progress).toBe(100);
    expect(Object.keys(body).sort()).toEqual(['progress', 'status']);
  });

  test('issue update', async () => {
    const patch = spyOn(api, 'patchMultipart').mockResolvedValue(rawIssue);

    await issueService.update(1, { title: 'Honeycombing along the north edge' });

    const body = bodyOf(patch);
    expect(body).not.toHaveProperty('attachments');
    expect(body.title).toBe('Honeycombing along the north edge');
    expect(Object.keys(body)).toEqual(['title']);
  });
});

describe('a call that does carry files still sends them', () => {
  test('the files go in the file map, where the backend reads them', async () => {
    const post = spyOn(api, 'postMultipart').mockResolvedValue(rawTask);
    const file = new File(['x'], 'section.pdf', { type: 'application/pdf' });

    await taskService.create(
      {
        title: 'Pour the block A raft',
        projectId: 3,
        categoryId: 2,
        progress: 0,
      },
      { attachments: [file] }
    );

    const body = bodyOf(post);
    expect(body).not.toHaveProperty('attachments');
    expect(post.mock.calls[0]?.[2]).toEqual({ attachments: [file] });
  });
});
