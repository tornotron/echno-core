import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../lib/api/api-client';
import { attachmentService } from './attachment-service';

// --- Fake XMLHttpRequest -----------------------------------------------------
// putToStorage uses a raw XHR (fetch has no upload-progress event). We install
// a minimal fake that resolves/rejects on the next microtask based on a
// per-url outcome map, and fires a single progress event so the progress
// plumbing is exercised.

type XhrOutcome = 'success' | 'http-error' | 'network-error';

interface FakeXhrState {
  outcomeByUrl: Map<string, XhrOutcome>;
  default: XhrOutcome;
}

const xhrState: FakeXhrState = {
  outcomeByUrl: new Map(),
  default: 'success',
};

class FakeXMLHttpRequest {
  status = 0;
  responseText = '';
  withCredentials = false;
  upload = {
    listeners: {} as Record<string, (e: unknown) => void>,
    addEventListener(type: string, cb: (e: unknown) => void) {
      this.listeners[type] = cb;
    },
  };
  private listeners: Record<string, () => void> = {};
  private url = '';

  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  addEventListener(type: string, cb: () => void) {
    this.listeners[type] = cb;
  }
  send() {
    queueMicrotask(() => {
      const outcome = xhrState.outcomeByUrl.get(this.url) ?? xhrState.default;
      this.upload.listeners.progress?.({
        loaded: 5,
        total: 10,
        lengthComputable: true,
      });
      if (outcome === 'success') {
        this.status = 204;
        this.listeners.load?.();
      } else if (outcome === 'http-error') {
        this.status = 403;
        this.responseText = 'SignatureDoesNotMatch';
        this.listeners.load?.();
      } else {
        this.listeners.error?.();
      }
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).XMLHttpRequest = FakeXMLHttpRequest;

function slot(key: string, url: string, contentType = 'application/pdf') {
  return { key, url, contentType, expiresInSeconds: 900 };
}

function attachmentDto(id: number, fileName: string) {
  return { id, fileName, contentType: 'application/pdf' };
}

function file(name: string, type = 'application/pdf', size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

afterEach(() => {
  xhrState.outcomeByUrl.clear();
  xhrState.default = 'success';
});

describe('attachmentService.uploadDirect', () => {
  test('happy path: presigns, PUTs, and registers every file', async () => {
    const postSpy = spyOn(api, 'post').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (endpoint: string): Promise<any> => {
        if (endpoint.includes('/presign/')) {
          return [
            slot('k1', 'https://store/k1'),
            slot('k2', 'https://store/k2'),
          ];
        }
        // register
        return [attachmentDto(1, 'a.pdf'), attachmentDto(2, 'b.pdf')];
      }
    );

    const progress: number[] = [];
    const result = await attachmentService.uploadDirect(
      {
        entityId: 7,
        entityType: 'ISSUE_ATTACHMENTS',
        files: [file('a.pdf'), file('b.pdf')],
      },
      (p, i) => progress.push(i)
    );

    expect(result.errors).toHaveLength(0);
    expect(result.attachments.map((a) => a.id)).toEqual([1, 2]);
    // progress fired for both file indices
    expect(progress.sort()).toEqual([0, 1]);

    // register was called with exactly the two successful keys
    const registerCall = postSpy.mock.calls.find(([e]) =>
      String(e).includes('/register/')
    );
    expect(registerCall).toBeDefined();
    const registerBody = registerCall?.[1] as Array<{ key: string }>;
    expect(registerBody.map((r) => r.key)).toEqual(['k1', 'k2']);

    postSpy.mockRestore();
  });

  test('partial failure: a failed PUT is not registered', async () => {
    xhrState.outcomeByUrl.set('https://store/k2', 'http-error');

    let registeredKeys: string[] = [];
    const postSpy = spyOn(api, 'post').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (endpoint: string, body?: unknown): Promise<any> => {
        if (endpoint.includes('/presign/')) {
          return [
            slot('k1', 'https://store/k1'),
            slot('k2', 'https://store/k2'),
          ];
        }
        registeredKeys = (body as Array<{ key: string }>).map((r) => r.key);
        return [attachmentDto(1, 'a.pdf')];
      }
    );

    const result = await attachmentService.uploadDirect({
      entityId: 7,
      entityType: 'ISSUE_ATTACHMENTS',
      files: [file('a.pdf'), file('b.pdf')],
    });

    // only the first key was registered; the failed PUT was excluded
    expect(registeredKeys).toEqual(['k1']);
    expect(result.attachments.map((a) => a.id)).toEqual([1]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ filename: 'b.pdf', stage: 'put' });

    postSpy.mockRestore();
  });

  test('presign failure fails the whole batch without registering', async () => {
    const postSpy = spyOn(api, 'post').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (endpoint: string): Promise<any> => {
        if (endpoint.includes('/presign/')) {
          throw new Error('presign boom');
        }
        throw new Error('register should not be called');
      }
    );

    const result = await attachmentService.uploadDirect({
      entityId: 7,
      entityType: 'ISSUE_ATTACHMENTS',
      files: [file('a.pdf'), file('b.pdf')],
    });

    expect(result.attachments).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every((e) => e.stage === 'presign')).toBe(true);
    // register endpoint never hit
    expect(
      postSpy.mock.calls.some(([e]) => String(e).includes('/register/'))
    ).toBe(false);

    postSpy.mockRestore();
  });

  test('every PUT failing registers nothing', async () => {
    xhrState.default = 'network-error';

    const postSpy = spyOn(api, 'post').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (endpoint: string): Promise<any> => {
        if (endpoint.includes('/presign/')) {
          return [slot('k1', 'https://store/k1')];
        }
        throw new Error('register should not be called when all PUTs fail');
      }
    );

    const result = await attachmentService.uploadDirect({
      entityId: 7,
      entityType: 'ISSUE_ATTACHMENTS',
      files: file('a.pdf'),
    });

    expect(result.attachments).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ filename: 'a.pdf', stage: 'put' });
    expect(
      postSpy.mock.calls.some(([e]) => String(e).includes('/register/'))
    ).toBe(false);

    postSpy.mockRestore();
  });
});
