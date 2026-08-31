/**
 * Who names an indent, a purchase order, a site transfer and a GRN.
 *
 * The server does, and it always did. `DocumentNumberAllocator` hands out all four atomically per
 * organisation, document type and year, and every create service calls it unconditionally before
 * it saves anything. Each creation DTO's own `@Schema` already says so: the number "is allocated
 * by the server ... it is not part of this payload". The allocator exists because the numbers used
 * to be invented in the browser from whatever page of the list happened to be loaded, so two
 * people on the New Purchase Order screen would propose the same one.
 *
 * These four serializers had not been told. They sent a number the request DTOs do not declare, so
 * it was read off no field and dropped, and the record came back carrying whatever the allocator
 * had decided. `indentNumber` and `poNumber` were worse than inert: they reached the wire from
 * required, user-editable inputs, so someone could type `PO-LEGACY-0042`, be told the order was
 * saved, and find it filed under a different number.
 *
 * So the payload is the contract, and these tests are on the payload rather than the type. The
 * fields stay on the request interfaces, deprecated, because removing a required property is a
 * compile break for every caller on a published core and there is nothing to gain by making the
 * client's move a breaking one. What matters is that nothing reaches the server.
 *
 * One asymmetry worth keeping visible, because it decides where a genuine correction goes:
 * `IndentUpdateDto` does declare `indentNumber`, so an indent's number can be amended after the
 * fact. No update DTO on the other three does.
 */
import { describe, expect, test } from 'bun:test';

import { createIndentToJson } from './indents/indent-create';
import type { CreateIndentRequest } from './indents/indent-create';
import { createPurchaseOrderToJson } from './purchase-orders/purchase-order-create';
import type { CreatePurchaseOrderRequest } from './purchase-orders/purchase-order-create';
import { createSiteTransferToJson } from './site-transfers/site-transfer-create';
import type { CreateSiteTransferRequest } from './site-transfers/site-transfer-create';
import { createGrnToJson } from './grn/grn-create';
import type { CreateGrnRequest } from './grn/grn-create';
import { IndentStatus } from './indents/enums';
import { PurchaseOrderStatus } from './purchase-orders/enums';

/**
 * Each case builds a complete, valid create payload that also carries the deprecated number, so
 * the assertion is about the serializer dropping it rather than about the caller omitting it.
 */
const cases: {
  name: string;
  field: string;
  proposed: string;
  body: () => Record<string, unknown>;
}[] = [
  {
    name: 'createIndentToJson',
    field: 'indentNumber',
    proposed: 'IND-LEGACY-0042',
    body: () => {
      const dto: CreateIndentRequest = {
        indentNumber: 'IND-LEGACY-0042',
        createdByEmployeeId: 7,
        status: IndentStatus.pending,
        projectId: 4,
        items: [],
      };
      return createIndentToJson(dto);
    },
  },
  {
    name: 'createPurchaseOrderToJson',
    field: 'poNumber',
    proposed: 'PO-LEGACY-0042',
    body: () => {
      const dto: CreatePurchaseOrderRequest = {
        poNumber: 'PO-LEGACY-0042',
        vendorId: 9,
        projectId: 4,
        status: PurchaseOrderStatus.draft,
        createdBy: 7,
        items: [],
      };
      return createPurchaseOrderToJson(dto);
    },
  },
  {
    name: 'createSiteTransferToJson',
    field: 'transferNumber',
    proposed: 'ST-LEGACY-0042',
    body: () => {
      const dto: CreateSiteTransferRequest = {
        transferNumber: 'ST-LEGACY-0042',
        issueDate: '2026-08-31',
        sendingPerson: 7,
        sendingProjectId: 4,
        sendingStorageLocationId: 11,
        receivingProjectId: 5,
        receivingStorageLocationId: 12,
        items: [],
      };
      return createSiteTransferToJson(dto);
    },
  },
  {
    name: 'createGrnToJson',
    field: 'grnNumber',
    proposed: 'GRN-LEGACY-0042',
    body: () => {
      const dto: CreateGrnRequest = {
        grnNumber: 'GRN-LEGACY-0042',
        receivedOn: '2026-08-31',
        receivedByEmployeeId: 7,
        vendorId: 9,
        projectId: 4,
        items: [],
      };
      return createGrnToJson(dto);
    },
  },
];

describe('the server allocates the document number', () => {
  for (const { name, field, proposed, body } of cases) {
    test(`${name} leaves ${field} out of the body entirely`, () => {
      const json = body();

      // Absent, not present-and-undefined. A key carrying undefined still serializes to a key on
      // some paths, and the point is that the request says nothing at all about the number.
      expect(Object.hasOwn(json, field)).toBe(false);
      expect(Object.keys(json)).not.toContain(field);
    });

    test(`${name} drops ${field} even when the caller insists on one`, () => {
      // The caller here has done the thing the old UI let a user do: typed a number and submitted
      // it. Before this change that string reached the wire; now the allocator's answer stands.
      expect(JSON.stringify(body())).not.toContain(proposed);
    });
  }

  test('the rest of each payload still goes through', () => {
    // The fields were removed by deletion from an object literal, which is exactly the edit that
    // takes a neighbour with it. Pin one identifying field per document so that cannot happen
    // silently.
    expect(cases[0]!.body().createdByEmployeeId).toBe(7);
    expect(cases[1]!.body().vendorId).toBe(9);
    expect(cases[2]!.body().sendingStorageLocationId).toBe(11);
    expect(cases[3]!.body().receivedByEmployeeId).toBe(7);
  });
});
