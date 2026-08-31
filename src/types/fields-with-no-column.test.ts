/**
 * Eight findings on the request contract were held back from the sweep in
 * `dropped-request-fields.test.ts` because they were classified as decisions
 * rather than repairs: material `category`, `status` and `trend` on both write
 * paths, and task `priority` on both. Nothing in the backend names any of them
 * at any layer, so either the client stops sending them or the backend grows
 * the columns. This file is the answer, and the reason it is not obvious is in
 * the last describe block.
 *
 * **Material `category`, `status` and `trend` stop being sent.** No entity
 * column, no field on `MaterialCreationDto` or `MaterialUpdateDto`, and no
 * input on the material form that could set one, so the request has never
 * carried a value. Growing three columns to serve a form that offers no way to
 * fill them would be building a feature nobody asked for.
 *
 * The read side is a separate matter and is deliberately left alone here.
 * `MaterialDto` carries none of the three either, so the materials dashboard
 * renders a category column that is always a dash, a category filter whose
 * option list is always empty, and a sparkline drawn from an empty array. That
 * is dead UI in echno-web, not a request-contract finding, and deleting the
 * read properties from `Material` would be a compile break for it.
 *
 * **Task `priority` stops being sent** on the same argument, one step further
 * along: there is no column, no DTO field, and no control anywhere in the
 * client. `TaskService` names it explicitly above its `default` branch as a key
 * this package sends that the endpoint has no field for.
 *
 * **Issue `priority` keeps being sent, and that is the point of the last
 * block.** It reads identically on the findings list and collapses the other
 * way. The issue form has a real priority control: it defaults to `medium`,
 * colour-codes the value, and branches on `critical`. Dropping the request
 * field would freeze a half-built feature as permanently decorative, so the
 * decision there is for the backend to grow the column. Two entries that look
 * the same and are not, which is why they are pinned side by side: a later
 * sweep reading only the findings list would take both.
 */
import { describe, expect, test } from 'bun:test';

import { createMaterialToJson } from './materials/material-create';
import { updateMaterialToJson } from './materials/material-update';
import { createTaskToJson } from './task/task-create';
import { updateTaskToJson } from './task/task-update';
import { createIssueToJson } from './issue/issue-create';
import { updateIssueToJson } from './issue/issue-update';
import { IssueType } from './issue/issue-type';

describe('a material carries no category, status or trend to the backend', () => {
  test('create sends none of the three', () => {
    const payload = createMaterialToJson({
      materialName: 'OPC 53 cement',
      unit: 'bag',
      createdBy: 7,
      category: 'Cement',
      status: 'IN_STOCK',
      trend: [10, 12, 9],
      // Neighbours, because taking three keys out of one object literal is
      // exactly the edit that takes a fourth with it. `ltc` sits immediately
      // after them and is a real column as of echno-backend#627, so losing it
      // would silently undo that fix.
      ltc: 14,
      openingStock: 200,
      unitCost: 385,
    });

    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('trend');
    expect(payload.ltc).toBe(14);
    expect(payload.openingStock).toBe(200);
    expect(payload.unitCost).toBe(385);
    expect(payload.materialName).toBe('OPC 53 cement');
    expect(payload.unit).toBe('bag');
  });

  test('update sends none of the three', () => {
    const payload = updateMaterialToJson({
      category: 'Cement',
      status: 'LOW_STOCK',
      trend: [4, 3, 1],
      ltc: 21,
      materialName: 'PPC cement',
    });

    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('trend');
    expect(payload.ltc).toBe(21);
    expect(payload.materialName).toBe('PPC cement');
  });

  test('the three stay on the request types, so no caller breaks', () => {
    // Deprecated rather than deleted: removing a property from a published
    // package is a compile break for every caller that still sets it. This
    // compiles only while all three remain declared.
    const payload = updateMaterialToJson({
      category: 'Steel',
      status: 'OUT_OF_STOCK',
      trend: [],
    });

    expect(payload).toEqual({});
  });
});

describe('a task carries no priority to the backend', () => {
  test('create sends no priority', () => {
    const payload = createTaskToJson({
      title: 'Pour the raft slab',
      projectId: 3,
      priority: 'high',
      // `assigneeIds` is the neighbour that matters: it became a real case on
      // the update switch in echno-backend#606 after years of being dropped,
      // and it is the line directly below the one being removed.
      assigneeIds: [8, 9],
      status: 'in-progress',
      progress: 40,
    });

    expect(payload).not.toHaveProperty('priority');
    expect(payload.assigneeIds).toEqual([8, 9]);
    expect(payload.status).toBe('in-progress');
    expect(payload.progress).toBe(40);
    expect(payload.title).toBe('Pour the raft slab');
    expect(payload.projectId).toBe(3);
  });

  test('update sends no priority', () => {
    const payload = updateTaskToJson({
      priority: 'critical',
      assigneeIds: [8],
      categoryId: 2,
      title: 'Pour the raft slab',
    });

    expect(payload).not.toHaveProperty('priority');
    expect(payload.assigneeIds).toEqual([8]);
    expect(payload.categoryId).toBe(2);
    expect(payload.title).toBe('Pour the raft slab');
  });
});

describe('an issue does still carry its priority, and the difference is deliberate', () => {
  // These two are the opposite decision, pinned so a later pass working from
  // the findings list alone cannot take them along with the task ones. The
  // issue form puts a priority control in front of the user; the task form has
  // none. Until the backend grows the column, this key is dropped on arrival
  // the same way task priority was, but the repair is on the other side.
  test('create still sends priority', () => {
    const payload = createIssueToJson({
      title: 'Honeycombing on column C4',
      description: 'Voids visible on the south face after stripping.',
      issueType: IssueType.quality,
      priority: 'critical',
    });

    expect(payload.priority).toBe('critical');
  });

  test('update still sends priority', () => {
    const payload = updateIssueToJson({ priority: 'low' });

    expect(payload.priority).toBe('low');
  });
});
