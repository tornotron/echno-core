import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { PurchaseOrderStatus } from '../types/purchase-orders/enums';
import { employeeService } from './employee-service';
import { purchaseOrdersService } from './purchase-orders-service';

// PATCH /employee/web/{id} and PATCH /purchase-orders/web/{id}/status answer
// with an ApiResponse acknowledgement, never the saved entity. Parsing that
// acknowledgement as the entity threw a 422 after the write had succeeded,
// so the console reported a failed save that had in fact been stored.

const ACK = { message: 'updated' };

afterEach(() => {
  for (const method of ['get', 'patch'] as const) {
    (api[method] as unknown as { mockRestore?: () => void }).mockRestore?.();
  }
});

describe('a save the server acknowledges is read back', () => {
  test('employee update resolves to the stored employee, not a 422', async () => {
    spyOn(api, 'patch').mockResolvedValue(ACK);
    spyOn(api, 'get').mockResolvedValue({ id: 7, organizationId: 1, employeeName: 'Anjali Nair' });

    const employee = await employeeService.update(7, { name: 'Anjali Nair' });

    expect(api.patch).toHaveBeenCalledWith('/employee/web/7', expect.any(Object));
    expect(api.get).toHaveBeenCalledWith('/employee/web/7');
    expect(employee.id).toBe(7);
    expect(employee.name).toBe('Anjali Nair');
  });

  test('a failed employee PATCH is not followed by a read', async () => {
    spyOn(api, 'patch').mockRejectedValue(new Error('403'));
    const get = spyOn(api, 'get');

    await expect(employeeService.update(7, { name: 'x' })).rejects.toThrow('403');
    expect(get).not.toHaveBeenCalled();
  });

  test('purchase order status change resolves to the stored order', async () => {
    spyOn(api, 'patch').mockResolvedValue(ACK);
    spyOn(api, 'get').mockResolvedValue({ id: 3, vendorId: 9, status: 'APPROVED', createdBy: { id: 2, employeeName: 'Meera' } });

    const po = await purchaseOrdersService.updateStatus(3, PurchaseOrderStatus.approved);

    expect(api.patch).toHaveBeenCalledWith('/purchase-orders/web/3/status', {}, {
      status: PurchaseOrderStatus.approved,
    });
    expect(api.get).toHaveBeenCalledWith('/purchase-orders/web/3');
    expect(po.id).toBe(3);
  });
});
