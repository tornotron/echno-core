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
import { describe, expect, test } from "bun:test";

import { createMaterialToJson } from "./materials/material-create";
import { updateMaterialToJson } from "./materials/material-update";
import { createTaskToJson } from "./task/task-create";
import { updateTaskToJson } from "./task/task-update";
import { TaskStatus } from "./task/task-status";
import { createIssueToJson } from "./issue/issue-create";
import { updateIssueToJson } from "./issue/issue-update";
import { IssueType } from "./issue/issue-type";
import {
  ConstructionPayeeType,
  ConstructionPaymentMethod,
  ConstructionPaymentType,
  ConstructionPaymentVoucherStatus,
  createConstructionPaymentToJson,
  parseConstructionPayment,
  updateConstructionPaymentToJson,
  type CreateConstructionPaymentRequest,
  type UpdateConstructionPaymentRequest,
} from "./finance/construction-payment";

describe("a material carries no category, status or trend to the backend", () => {
  test("create sends none of the three", () => {
    const payload = createMaterialToJson({
      materialName: "OPC 53 cement",
      unit: "bag",
      createdBy: 7,
      category: "Cement",
      status: "IN_STOCK",
      trend: [10, 12, 9],
      // Neighbours, because taking three keys out of one object literal is
      // exactly the edit that takes a fourth with it. `ltc` sits immediately
      // after them and is a real column as of echno-backend#627, so losing it
      // would silently undo that fix.
      ltc: 14,
      openingStock: 200,
      unitCost: 385,
    });

    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("trend");
    expect(payload.ltc).toBe(14);
    expect(payload.openingStock).toBe(200);
    expect(payload.unitCost).toBe(385);
    expect(payload.materialName).toBe("OPC 53 cement");
    expect(payload.unit).toBe("bag");
  });

  test("update sends none of the three", () => {
    const payload = updateMaterialToJson({
      category: "Cement",
      status: "LOW_STOCK",
      trend: [4, 3, 1],
      ltc: 21,
      materialName: "PPC cement",
    });

    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("trend");
    expect(payload.ltc).toBe(21);
    expect(payload.materialName).toBe("PPC cement");
  });

  test("the three stay on the request types, so no caller breaks", () => {
    // Deprecated rather than deleted: removing a property from a published
    // package is a compile break for every caller that still sets it. This
    // compiles only while all three remain declared.
    const payload = updateMaterialToJson({
      category: "Steel",
      status: "OUT_OF_STOCK",
      trend: [],
    });

    expect(payload).toEqual({});
  });
});

describe("a task carries no priority to the backend", () => {
  test("create sends no priority", () => {
    const payload = createTaskToJson({
      title: "Pour the raft slab",
      projectId: 3,
      priority: "high",
      // `assigneeIds` is the neighbour that matters: it became a real case on
      // the update switch in echno-backend#606 after years of being dropped,
      // and it is the line directly below the one being removed.
      assigneeIds: [8, 9],
      status: TaskStatus.onGoing,
      progress: 40,
    });

    expect(payload).not.toHaveProperty("priority");
    expect(payload.assigneeIds).toEqual([8, 9]);
    expect(payload.status).toBe(TaskStatus.onGoing);
    expect(payload.progress).toBe(40);
    expect(payload.title).toBe("Pour the raft slab");
    expect(payload.projectId).toBe(3);
  });

  test("update sends no priority", () => {
    const payload = updateTaskToJson({
      priority: "critical",
      assigneeIds: [8],
      categoryId: 2,
      title: "Pour the raft slab",
    });

    expect(payload).not.toHaveProperty("priority");
    expect(payload.assigneeIds).toEqual([8]);
    expect(payload.categoryId).toBe(2);
    expect(payload.title).toBe("Pour the raft slab");
  });
});

describe("an issue does still carry its priority, and the difference is deliberate", () => {
  // These two are the opposite decision, pinned so a later pass working from
  // the findings list alone cannot take them along with the task ones. The
  // issue form puts a priority control in front of the user; the task form has
  // none. Until the backend grows the column, this key is dropped on arrival
  // the same way task priority was, but the repair is on the other side.
  test("create still sends priority", () => {
    const payload = createIssueToJson({
      title: "Honeycombing on column C4",
      description: "Voids visible on the south face after stripping.",
      issueType: IssueType.quality,
      priority: "critical",
    });

    expect(payload.priority).toBe("critical");
  });

  test("update still sends priority", () => {
    const payload = updateIssueToJson({ priority: "low" });

    expect(payload.priority).toBe("low");
  });
});

describe("a payment voucher is verified by an action, not by its payload", () => {
  // echno-backend#631 removed verifiedBy and verifiedAt from both payment
  // payloads and replaced them with POST /construction-payments/web/{id}/verify,
  // which stamps the verifier from the session. The reason is the same one that
  // took the six identity fields out in v3.0.0: a payload with a slot for "who
  // checked this" lets anyone who can edit a voucher record that a named
  // colleague checked a payment, at a time of their choosing, and the audit
  // trail says so silently.
  //
  // The pair only ever moves together, which is why the timestamp goes with the
  // id: a settable verifiedAt is a settable verification.
  //
  // v3.6.0 stopped sending the pair and left both declared and deprecated, so
  // no caller broke on the upgrade; v4.0.0 removes them, which is what the
  // API-stability policy reserves a major for. That is why these tests are now
  // in two halves rather than one.
  //
  // The type half is the @ts-expect-error below. It is the pin that the fields
  // are gone: if either is re-added to either interface the literal stops being
  // an error, the directive goes unused, and `typecheck:tests` fails. An
  // assertion on the emitted payload could not tell that apart, because a
  // re-declared field nothing sets emits nothing either.
  //
  // The runtime half is the smuggling test. It covers the caller the type
  // system does not see: an older build, a spread, an `any`. Excess-property
  // checking fires only on a fresh object literal at the call site, so a
  // payload assembled into a variable first reaches the serializer with the
  // fields still on it, and the serializer has to drop them there.
  test("neither field is declared on either request type", () => {
    const create = () =>
      createConstructionPaymentToJson({
        type: ConstructionPaymentType.INVOICE,
        method: ConstructionPaymentMethod.BANK_TRANSFER,
        payeeType: ConstructionPayeeType.VENDOR,
        projectId: 3,
        amount: 118_000,
        paymentDate: "2026-08-30",
        // @ts-expect-error verifiedBy is not a field of the create payload
        verifiedBy: 7,
      });

    const update = () =>
      updateConstructionPaymentToJson({
        type: ConstructionPaymentType.INVOICE,
        status: ConstructionPaymentVoucherStatus.COMPLETED,
        method: ConstructionPaymentMethod.BANK_TRANSFER,
        payeeType: ConstructionPayeeType.VENDOR,
        projectId: 3,
        amount: 118_000,
        paymentDate: "2026-08-30",
        // @ts-expect-error verifiedAt is not a field of the update payload
        verifiedAt: "2026-08-30T09:00:00Z",
      });

    // Both still run: the directives above are compile-time, and the emitted
    // payloads must be clean at runtime too.
    expect(create()).not.toHaveProperty("verifiedBy");
    expect(update()).not.toHaveProperty("verifiedAt");
  });

  test("create drops a stamp a caller smuggles past the type system", () => {
    // Assembled into a variable and widened, which is exactly how the field
    // kept being sent after a clean build.
    const smuggled = {
      type: ConstructionPaymentType.INVOICE,
      method: ConstructionPaymentMethod.BANK_TRANSFER,
      payeeType: ConstructionPayeeType.VENDOR,
      projectId: 3,
      amount: 118_000,
      paymentDate: "2026-08-30",
      verifiedBy: 7,
      verifiedAt: "2026-08-30T09:00:00Z",
      // Neighbours on either side of the two removed lines.
      ifscCode: "HDFC0001234",
      description: "Second running bill",
    } as unknown as CreateConstructionPaymentRequest;

    const payload = createConstructionPaymentToJson(smuggled);

    expect(payload).not.toHaveProperty("verifiedBy");
    expect(payload).not.toHaveProperty("verifiedAt");
    expect(payload.ifscCode).toBe("HDFC0001234");
    expect(payload.description).toBe("Second running bill");
  });

  test("update drops a stamp a caller smuggles past the type system", () => {
    const smuggled = {
      type: ConstructionPaymentType.INVOICE,
      status: ConstructionPaymentVoucherStatus.COMPLETED,
      method: ConstructionPaymentMethod.BANK_TRANSFER,
      payeeType: ConstructionPayeeType.VENDOR,
      projectId: 3,
      amount: 118_000,
      paymentDate: "2026-08-30",
      verifiedBy: 7,
      verifiedAt: "2026-08-30T09:00:00Z",
      ifscCode: "HDFC0001234",
      notes: "Cleared by the QS",
    } as unknown as UpdateConstructionPaymentRequest;

    const payload = updateConstructionPaymentToJson(smuggled);

    expect(payload).not.toHaveProperty("verifiedBy");
    expect(payload).not.toHaveProperty("verifiedAt");
    expect(payload.ifscCode).toBe("HDFC0001234");
    expect(payload.notes).toBe("Cleared by the QS");
  });

  test("but the read type still carries what the backend stamped", () => {
    // The response DTO keeps all three, and echno-web renders the verifier on
    // the payment detail. Dropping them from the parser would blank a screen
    // rather than fix anything.
    const payment = parseConstructionPayment({
      id: "11111111-1111-4111-8111-111111111111",
      paymentNumber: "PAY-2026-0004",
      type: ConstructionPaymentType.INVOICE,
      status: ConstructionPaymentVoucherStatus.COMPLETED,
      method: ConstructionPaymentMethod.BANK_TRANSFER,
      payeeType: ConstructionPayeeType.VENDOR,
      projectId: 3,
      amount: 118_000,
      paymentDate: "2026-08-30",
      verifiedBy: 7,
      verifiedAt: "2026-08-30T09:00:00Z",
    });

    expect(payment.verifiedBy).toBe(7);
    expect(payment.verifiedAt).toBeDefined();
  });
});
