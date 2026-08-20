import { describe, expect, test } from 'bun:test';
import { parsePresignedUpload } from './presigned-upload';

// The presign parser validates the response shape at the boundary: a valid
// slot yields a typed PresignedUpload, a slot missing its key or url throws
// instead of flowing a null/empty value through to a doomed PUT.
describe('parsePresignedUpload', () => {
  test('parses a valid slot', () => {
    const slot = parsePresignedUpload({
      key: 'issue/12/plan.pdf',
      url: 'https://store.example.com/issue/12/plan.pdf?sig=abc',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    expect(slot.key).toBe('issue/12/plan.pdf');
    expect(slot.url).toBe('https://store.example.com/issue/12/plan.pdf?sig=abc');
    expect(slot.contentType).toBe('application/pdf');
    expect(slot.expiresInSeconds).toBe(900);
  });

  test('defaults a missing contentType and expiry', () => {
    const slot = parsePresignedUpload({
      key: 'k',
      url: 'https://store.example.com/k',
    });
    expect(slot.contentType).toBe('');
    expect(slot.expiresInSeconds).toBe(0);
  });

  test('throws when key is missing or blank', () => {
    expect(() =>
      parsePresignedUpload({ url: 'https://store.example.com/k' })
    ).toThrow();
    expect(() =>
      parsePresignedUpload({ key: '   ', url: 'https://store.example.com/k' })
    ).toThrow();
  });

  test('throws when url is missing', () => {
    expect(() => parsePresignedUpload({ key: 'k' })).toThrow();
  });
});
