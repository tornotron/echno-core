/**
 * Where a purchase-order edit is sent, and what it carries.
 *
 * Neither update call reached the backend. `purchaseOrdersService.update` appended the id to the
 * path, and `purchaseOrderItemsService.update` did the same, against a family whose PATCH routes
 * take no id at all: both are `PATCH .../web` with the id in the body. The live route table has
 * `GET` and nothing else on `/purchase-orders/web/{id}`, and `GET` plus `DELETE` on
 * `/purchase-order-items/{id}`. So editing a PO's header, its remarks, or any line item was a 404
 * behind a toast that said the save failed, and had been since the routes were written.
 *
 * The path alone was not the whole fault, and fixing it alone would have made things look
 * different rather than better. `PurchaseOrderItemUpdateDto` requires `id`, which the serializer
 * never sent, so a corrected path turns the 404 into a 400. The two have to move together, and
 * that is what these tests hold: the route and the required field, pinned in the same file so a
 * later edit cannot separate them again.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { purchaseOrdersService } from './purchase-orders-service';
import { purchaseOrderItemsService } from './purchase-order-items-service';
import { updatePurchaseOrderToJson } from '../types/purchase-orders/purchase-order-update';
import { updatePurchaseOrderItemToJson } from '../types/purchase-orders/purchase-order-item-update';
import { PurchaseOrderStatus } from '../types/purchase-orders/enums';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

afterEach(() => {
  // spyOn installs on the shared api object; restore so tests stay independent.
  (api.patch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** Enough of either entity to satisfy the parser on the way back out. */
const parseable: Raw = {
  id: 204,
  vendorId: 9,
  materialId: 11,
  orderedQuantity: 450,
  status: 'DRAFT',
  createdBy: { id: 5, name: 'Anita Rao' },
};

describe('where a purchase-order update is sent', () => {
  test('the order patch goes to the id-less route, with the id in the body', async () => {
    const patch = spyOn(api, 'patch').mockResolvedValue(parseable);

    await purchaseOrdersService.update({ id: 204, remarks: 'Vendor confirmed dispatch' });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0]?.[0]).toBe('/purchase-orders/web');
    expect(patch.mock.calls[0]?.[1]).toMatchObject({
      id: 204,
      remarks: 'Vendor confirmed dispatch',
    });
  });

  test('the line-item patch goes to the web route, with the id in the body', async () => {
    const patch = spyOn(api, 'patch').mockResolvedValue(parseable);

    await purchaseOrderItemsService.update(512, { orderedQuantity: 450 });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0]?.[0]).toBe('/purchase-order-items/web');
    // The id is what the correct route made mandatory: without it the fixed path answers 400.
    expect(patch.mock.calls[0]?.[1]).toMatchObject({ id: 512, orderedQuantity: 450 });
  });
});

describe('what a purchase-order update carries', () => {
  test('the order body sends only fields the endpoint applies', () => {
    const payload = updatePurchaseOrderToJson({
      id: 204,
      status: PurchaseOrderStatus.approved,
      projectId: 17,
      expectedDeliveryDate: '2026-02-14T00:00:00.000Z',
      remarks: 'Vendor confirmed dispatch',
      totalAmount: 492500,
    });

    expect(payload).toEqual({
      id: 204,
      status: PurchaseOrderStatus.approved,
      projectId: 17,
      expectedDeliveryDate: '2026-02-14T00:00:00.000Z',
      remarks: 'Vendor confirmed dispatch',
    });
    // Derived from the line items and recomputed on every line change, so putting it on the wire
    // only carries a number nothing reads.
    expect(payload).not.toHaveProperty('totalAmount');
  });

  test('the line-item body always carries the id the DTO requires', () => {
    const payload = updatePurchaseOrderItemToJson({ id: 512 });

    expect(payload.id).toBe(512);
  });

  test('the line-item body drops the parent and the derived total', () => {
    const payload = updatePurchaseOrderItemToJson({
      id: 512,
      purchaseOrderId: 204,
      materialId: 88,
      orderedQuantity: 450,
      unitPrice: 64,
      totalPrice: 28800,
      remarks: 'Vendor revised rate',
    });

    expect(payload).toEqual({
      id: 512,
      materialId: 88,
      orderedQuantity: 450,
      unitPrice: 64,
      remarks: 'Vendor revised rate',
    });
    // A line cannot be moved between orders, and the server recomputes the line total from the
    // quantity and price in the same request.
    expect(payload).not.toHaveProperty('purchaseOrderId');
    expect(payload).not.toHaveProperty('totalPrice');
  });

  test('an unset field stays absent, so a patch still means a patch', () => {
    const payload = updatePurchaseOrderItemToJson({ id: 512, remarks: 'Rate revised' });

    expect(payload.orderedQuantity).toBeUndefined();
    expect(payload.materialId).toBeUndefined();
  });
});
