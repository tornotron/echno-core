import { describe, expect, test } from 'bun:test';
import { parseAttachment } from './attachment';

describe('attachment document type', () => {
  test('is read when the server sends it and absent otherwise', () => {
    expect(parseAttachment({ id: 3, fileName: 'cube.pdf', documentType: 'test-report' }).documentType).toBe('test-report');
    expect(parseAttachment({ id: 4, fileName: 'site.jpg' }).documentType).toBeUndefined();
  });
});
