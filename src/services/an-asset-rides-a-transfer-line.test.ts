/**
 * Asset lines on a site transfer (ClickUp 86d45vjd0).
 *
 * An asset moves between sites as a line on the same transfer that carries
 * materials, so the client has to say which kind each line is, and has to
 * read both kinds back. What each test pins:
 *
 * - the create tests fail on a serializer that drops `lineType` or `assetId`,
 *   which the server would read as a material line with no material and
 *   refuse, or that sends an asset line with any quantity but one;
 * - the material-line test fails if a line with no type starts going out with
 *   one, which would change what every existing caller sends;
 * - the parse tests fail on a schema that strips the asset fields, which would
 *   render an asset line as a nameless material;
 * - the sendable-assets tests fail if the location filter is sent as an empty
 *   value rather than left out, since an absent location and a named one are
 *   different questions to the server.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { api } from '../lib/api/api-client';
import { siteTransfersService } from './site-transfers-service';
import {
  SiteTransferLineType,
  createSiteTransferToJson,
  parseSiteTransferItem,
} from '../types/site-transfers';

afterEach(() => {
  (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
});

const header = {
  issueDate: '2026-09-28T09:00:00',
  sendingPerson: 3,
  sendingProjectId: 2,
  sendingStorageLocationId: 5,
  receivingProjectId: 6,
  receivingStorageLocationId: 9,
};

describe('what a transfer with asset lines puts on the wire', () => {
  test('an asset line names its type, the asset and one unit', () => {
    const body = createSiteTransferToJson({
      ...header,
      items: [
        { lineType: SiteTransferLineType.asset, assetId: 12, remarks: 'With its bucket' },
      ],
    });
    expect(body.items).toEqual([
      { lineType: 'ASSET', assetId: 12, sentQuantity: 1, remarks: 'With its bucket' },
    ]);
  });

  test('a material line goes out as it always has', () => {
    const body = createSiteTransferToJson({
      ...header,
      items: [
        { materialId: 21, sentQuantity: 40 },
        { lineType: SiteTransferLineType.asset, assetId: 12 },
      ],
    });
    expect(body.items).toEqual([
      { materialId: 21, sentQuantity: 40, remarks: undefined },
      { lineType: 'ASSET', assetId: 12, sentQuantity: 1, remarks: undefined },
    ]);
  });
});

describe('reading asset lines back', () => {
  test('an asset line carries the asset and no material', () => {
    const line = parseSiteTransferItem({
      id: 85,
      lineType: 'ASSET',
      assetId: 12,
      assetCode: 'AST-0021',
      assetName: 'JCB 3DX Backhoe Loader',
      sentQuantity: 1,
      receivedQuantity: null,
      inTransitQuantity: 1,
    });
    expect(line.lineType).toBe(SiteTransferLineType.asset);
    expect(line.assetId).toBe(12);
    expect(line.assetCode).toBe('AST-0021');
    expect(line.assetName).toBe('JCB 3DX Backhoe Loader');
    expect(line.materialId).toBeNull();
    expect(line.materialName).toBeNull();
    expect(line.inTransitQuantity).toBe(1);
  });

  test('a line from a server that predates asset lines reads as a material line', () => {
    const line = parseSiteTransferItem({
      id: 84,
      materialId: 21,
      materialName: 'Cement',
      sentQuantity: 10,
    });
    expect(line.lineType).toBe(SiteTransferLineType.material);
    expect(line.materialId).toBe(21);
    expect(line.assetId).toBeNull();
  });
});

describe('the assets a transfer can send', () => {
  function captureGet(response: unknown) {
    const calls: { path: string; params: unknown }[] = [];
    spyOn(api, 'get').mockImplementation(
      async (path: string, params?: unknown) => {
        calls.push({ path, params });
        return response as never;
      }
    );
    return calls;
  }

  test('asks for one project and store, and parses the options', async () => {
    const calls = captureGet([
      { id: 12, assetCode: 'AST-0021', name: 'Backhoe', type: 'heavy-equipment', status: 'in-use' },
    ]);
    const options = await siteTransfersService.getSendableAssets(2, 5);
    expect(calls).toEqual([
      { path: '/site-transfers/web/sendable-assets', params: { projectId: 2, storageLocationId: 5 } },
    ]);
    expect(options).toEqual([
      {
        id: 12,
        assetCode: 'AST-0021',
        name: 'Backhoe',
        type: 'heavy-equipment',
        status: 'in-use',
        assignedTo: null,
      },
    ]);
  });

  test('leaves the store out when the transfer names none', async () => {
    const calls = captureGet([]);
    await siteTransfersService.getSendableAssets(2, null);
    expect(calls[0].params).toEqual({ projectId: 2 });
  });
});
