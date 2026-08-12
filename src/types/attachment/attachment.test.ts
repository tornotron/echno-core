import { describe, expect, test } from 'bun:test';
import { AttachmentType, parseAttachment } from './attachment';

// The boundary now validates the payload shape before building the domain
// object: a valid id yields a typed Attachment, a non-positive id throws
// instead of flowing through as a fabricated value.
describe('parseAttachment', () => {
  test('parses a minimal valid payload and derives fileType', () => {
    const att = parseAttachment({
      id: 5,
      fileName: 'plan.pdf',
      contentType: 'application/pdf',
    });
    expect(att.id).toBe(5);
    expect(att.fileName).toBe('plan.pdf');
    expect(att.fileType).toBe(AttachmentType.pdf);
  });

  test('rejects a non-positive id', () => {
    expect(() => parseAttachment({ id: 0 })).toThrow();
  });
});
